import { Router } from 'express';
import AuditLog from '../models/AuditLog';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from '../utils/cursorPagination';

const router = Router();

// Admin: full audit log search
router.get(
  '/',
  authenticate,
  authorize(['ADMIN']),
  async (req: AuthRequest, res) => {
    try {
      const {
        action,
        entityType,
        module,
        page = '1',
        limit = '50',
        startDate,
        endDate
      } = req.query;

      const query: any = {};
      if (typeof action === 'string') query.action = action;
      if (typeof entityType === 'string') query.entityType = entityType;
      if (typeof module === 'string') query.module = module;

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(String(startDate));
        if (endDate) query.createdAt.$lte = new Date(String(endDate));
      }

      const pageNum = Math.max(1, parseInt(String(page), 10));
      const limitNum = Math.max(1, parseInt(String(limit), 10));
      const skip = (pageNum - 1) * limitNum;

      const [auditLogs, total] = await Promise.all([
        AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        AuditLog.countDocuments(query)
      ]);

      return res.json({
        auditLogs,
        success: true,
        pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) }
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Failed to load audit logs', success: false });
    }
  }
);

// Any authenticated user: their own activity
router.get('/my', authenticate, async (req: AuthRequest, res) => {
  try {
    const { limit = '50', startDate, endDate } = req.query;
    const query: any = { user: req.user!._id };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(String(startDate));
      if (endDate) query.createdAt.$lte = new Date(String(endDate));
    }

    const pageLimit = parseListLimit(limit, 50, 100);
    const cursor =
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    let merged: Record<string, unknown>;
    try {
      merged = mergeWithCursorFilter(query, cursor);
    } catch {
      return res.status(400).json({ message: 'Invalid cursor', success: false });
    }

    const raw = await AuditLog.find(merged)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageLimit + 1)
      .lean();
    const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);

    return res.json({
      auditLogs: items,
      success: true,
      nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to load my audit logs', success: false });
  }
});

// Admin: simple stats
router.get('/stats', authenticate, authorize(['ADMIN']), async (_req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = _req.query;
    const query: any = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(String(startDate));
      if (endDate) query.createdAt.$lte = new Date(String(endDate));
    }

    const total = await AuditLog.countDocuments(query);
    const actionStats = await AuditLog.aggregate([
      { $match: query },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return res.json({ success: true, total, actionStats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to load audit stats', success: false });
  }
});

export default router;

