import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import Approval from '../models/Approval';
import PurchaseRequest from '../models/PurchaseRequest';
import User from '../models/User';
import Tender from '../models/Tender';
import Notification from '../models/Notification';
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from '../utils/cursorPagination';

const router = express.Router();

const generateTenderRef = () =>
  'TDR-' +
  Date.now().toString(36).toUpperCase() +
  Math.random().toString(36).slice(2, 6).toUpperCase();

router.post(
  '/create',
  authenticate,
  authorize(['ADMIN']),
  async (req: AuthRequest, res) => {
    // Not used by current frontend flow, but kept for completeness.
    const {
      entityType,
      entityId,
      purchaseRequest,
      requester,
      requesterName,
      requesterDepartment,
      title,
      description,
      amount,
      priority
    } = req.body || {};

    const approval = new Approval({
      entityType,
      entityId,
      purchaseRequest,
      requester: requester ?? req.user?._id,
      requesterName: requesterName ?? req.user?.name ?? 'Unknown',
      requesterDepartment: requesterDepartment ?? '',
      title,
      description,
      amount: amount ?? 0,
      currency: 'USD',
      priority,
      currentApprover: req.user?._id,
      status: 'pending'
    });
    await approval.save();
    res.status(201).json({ success: true, approval: approval.toObject() });
  }
);

router.get(
  '/my-pending',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    try {
      const pageLimit = parseListLimit(req.query.limit, 40, 100);
      const cursor =
        typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const base = {
        status: 'pending',
        currentApprover: req.user?._id,
      } as Record<string, unknown>;
      let merged: Record<string, unknown>;
      try {
        merged = mergeWithCursorFilter(base, cursor);
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid cursor' });
      }
      const raw = await Approval.find(merged)
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageLimit + 1)
        .select('-description -comments -approvalHistory')
        .lean();
      const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
      res.json({ success: true, approvals: items, nextCursor, hasMore });
    } catch (err: any) {
      console.error('GET /my-pending approvals', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching pending approvals.',
        error: err?.message
      });
    }
  }
);

router.get(
  '/',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR']),
  async (req: AuthRequest, res) => {
    try {
      const pageLimit = parseListLimit(req.query.limit, 40, 100);
      const cursor =
        typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      let merged: Record<string, unknown>;
      try {
        merged = mergeWithCursorFilter({}, cursor);
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid cursor' });
      }
      const raw = await Approval.find(merged)
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageLimit + 1)
        .select('-description -comments -approvalHistory')
        .lean();
      const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
      res.json({ success: true, approvals: items, nextCursor, hasMore });
    } catch (err: any) {
      console.error('GET / approvals', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching approvals.',
        error: err?.message
      });
    }
  }
);

router.get(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR']),
  async (req: AuthRequest, res) => {
    try {
      const approval = await Approval.findById(req.params.id).lean();
      if (!approval) return res.status(404).json({ message: 'Approval not found' });
      res.json({ success: true, approval });
    } catch (err: any) {
      console.error('GET /:id approval', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching approval.',
        error: err?.message
      });
    }
  }
);

router.put(
  '/:approvalId/approve',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const approval = await Approval.findById(req.params.approvalId);
    if (!approval) return res.status(404).json({ message: 'Approval not found' });
    if (approval.status !== 'pending') {
      return res.status(400).json({ message: `Approval already ${approval.status}` });
    }

    approval.status = 'approved';
    approval.approvedBy = req.user?._id;
    approval.approvedAt = new Date();
    approval.comments = req.body?.comments ?? '';

    let autoTender: any = null;
    if (approval.purchaseRequest) {
      const pr = await PurchaseRequest.findById(approval.purchaseRequest);
      if (pr) {
        pr.status = 'approved';
        const existingTender = await Tender.findOne({ purchaseRequest: pr._id });
        if (existingTender) {
          autoTender = existingTender;
          pr.linkedTender = existingTender._id as any;
        } else {
          const now = new Date();
          const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          const requiredDate = pr.requiredDate ? new Date(pr.requiredDate) : sevenDays;
          const closeDate = requiredDate > now ? (requiredDate < sevenDays ? requiredDate : sevenDays) : sevenDays;
          const topCategory =
            pr.items?.find((x: any) => (x.category || '').trim())?.category || 'general';
          const requirements =
            pr.items?.length
              ? pr.items
                  .map((it: any, i: number) => {
                    const spec = String(it.specifications || '').trim();
                    return `${i + 1}. ${it.itemName} x${it.quantity} ${it.unit}${spec ? ` (${spec})` : ''}`;
                  })
                  .join('\n')
              : pr.justification || pr.description || '';

          autoTender = await Tender.create({
            title: pr.title,
            referenceNumber: generateTenderRef(),
            description: pr.description,
            createdBy: req.user!._id,
            status: 'DRAFT',
            openDate: now,
            closeDate,
            category: String(topCategory),
            budget: pr.totalEstimatedAmount || 0,
            budgetRange: { min: 0, max: pr.totalEstimatedAmount || 0 },
            requirements,
            purchaseRequest: pr._id
          });
          pr.linkedTender = autoTender._id as any;
        }
        await pr.save();

        const notifyUsers = await User.find({
          _id: { $ne: req.user!._id },
          $or: [
            { _id: pr.requester },
            { role: 'ADMIN' },
            { role: 'PROCUREMENT_OFFICER' }
          ]
        }).select('_id');

        if (notifyUsers.length) {
          const baseNotifs = notifyUsers.map((u) => ({
            user: u._id,
            title: 'Purchase request approved',
            body: `${pr.requestNumber}: ${pr.title} was approved.`,
            link: '/approvals',
            type: 'purchase_request_approved' as const
          }));
          const tenderNotifs = autoTender
            ? notifyUsers.map((u) => ({
                user: u._id,
                title: 'Tender created from approved request',
                body: `${pr.requestNumber}: Tender ${autoTender.referenceNumber} created in Draft.`,
                link: '/tenders',
                type: 'tender_auto_created' as const
              }))
            : [];
          await Notification.insertMany([...baseNotifs, ...tenderNotifs]);
        }
      }
    }

    await approval.save();
    res.json({
      success: true,
      approval: approval.toObject(),
      tender: autoTender ? autoTender.toObject() : null
    });
  }
);

router.put(
  '/:approvalId/reject',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const approval = await Approval.findById(req.params.approvalId);
    if (!approval) return res.status(404).json({ message: 'Approval not found' });
    if (approval.status !== 'pending') {
      return res.status(400).json({ message: `Approval already ${approval.status}` });
    }

    const { rejectionReason } = req.body || {};
    approval.status = 'rejected';
    approval.rejectionReason = rejectionReason ?? '';
    approval.comments = req.body?.comments ?? '';

    if (approval.purchaseRequest) {
      const pr = await PurchaseRequest.findById(approval.purchaseRequest);
      if (pr) {
        pr.status = 'rejected';
        await pr.save();

        await Notification.create({
          user: pr.requester,
          title: 'Purchase request rejected',
          body: `${pr.requestNumber}: ${pr.title} was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
          link: '/purchase-requests',
          type: 'purchase_request_rejected'
        }).catch(() => {});
      }
    }

    await approval.save();
    res.json({ success: true, approval: approval.toObject() });
  }
);

export default router;

