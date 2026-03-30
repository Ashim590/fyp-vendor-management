import { Router } from 'express';
import Tender from '../models/Tender';
import Vendor from '../models/Vendor';
import User from '../models/User';
import Notification from '../models/Notification';
import Bid from '../models/Bid';
import Payment from '../models/Payment';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { createAudit } from '../utils/auditLog';
import { isVendorApprovedForMarketplace } from '../utils/vendorGate';
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from '../utils/cursorPagination';
import { invalidateStaffSummaryCache } from '../utils/staffDashboardCache';
import { invalidateAdminDashboardCache } from '../utils/adminDashboardCache';
const router = Router();

const generateRef = () =>
  'TDR-' +
  Date.now().toString(36).toUpperCase() +
  Math.random().toString(36).slice(2, 6).toUpperCase();

router.post(
  '/',
  authenticate,
  authorize(['PROCUREMENT_OFFICER', 'ADMIN']),
  async (req: AuthRequest, res) => {
    try {
      const {
        title,
        description,
        openDate,
        closeDate,
        category,
        budget,
        budgetRange,
        requirements,
        status
      } = req.body;

      if (!title || !description || !openDate || !closeDate || !category) {
        return res.status(400).json({
          message: 'Title, description, open date, close date, and category are required.',
          success: false
        });
      }

      const referenceNumber = generateRef();
      const tender = await Tender.create({
        title,
        referenceNumber,
        description,
        createdBy: req.user!._id,
        openDate,
        closeDate,
        category,
        budget: budget != null ? Number(budget) : undefined,
        budgetRange:
          budgetRange != null
            ? typeof budgetRange === 'string'
              ? JSON.parse(budgetRange)
              : budgetRange
            : budget != null
              ? { min: 0, max: Number(budget) }
              : undefined,
        requirements: requirements || '',
        status: status || 'DRAFT'
      });

      return res.status(201).json({
        message: 'Tender created successfully.',
        tender,
        success: true
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: 'Error creating tender.',
        success: false
      });
    }
  }
);

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { status, q, category } = req.query;
    const pageLimit = parseListLimit(req.query.limit, 50, 100);
    const cursor =
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const filter: Record<string, unknown> = {};

    // Vendors can only access verified vendor accounts + published tenders.
    if (req.user?.role === 'VENDOR') {
      const vendorDoc = req.user.vendorProfile
        ? await Vendor.findById(req.user.vendorProfile)
        : null;

      if (!isVendorApprovedForMarketplace(vendorDoc)) {
        return res.json({
          tenders: [],
          success: true,
          nextCursor: null,
          hasMore: false,
        });
      }

      // Enforce published-only visibility for vendors.
      filter.status = 'PUBLISHED';
    } else if (status && typeof status === 'string') {
      filter.status = status;
    }

    if (q && typeof q === 'string') {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { referenceNumber: { $regex: q, $options: 'i' } }
      ];
    }

    if (category && typeof category === 'string') {
      filter.category = category;
    }

    let merged: Record<string, unknown>;
    try {
      merged = mergeWithCursorFilter(filter, cursor);
    } catch {
      return res.status(400).json({ message: 'Invalid cursor', success: false });
    }

    /** List cards: skip heavy requirements / budgetRange; detail page loads full tender. */
    const raw = await Tender.find(merged)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageLimit + 1)
      .select(
        'title description referenceNumber status openDate closeDate category budget createdBy awardedVendor purchaseRequest createdAt updatedAt',
      )
      .populate('createdBy', 'name email')
      .populate('awardedVendor', 'name email phoneNumber')
      .lean();

    const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);

    return res.json({
      tenders: items,
      success: true,
      nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to list tenders', success: false });
  }
});

/** Procurement officer: withdraw published tender (→ CLOSED) or remove a draft (delete). */
router.patch(
  '/:id/withdraw',
  authenticate,
  authorize(['PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    try {
      const tender = await Tender.findById(req.params.id);
      if (!tender) {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }

      if (tender.status === 'AWARDED') {
        return res.status(400).json({
          message: 'Cannot withdraw an awarded tender. Ask an administrator if removal is required.',
          success: false
        });
      }

      if (tender.status === 'CLOSED') {
        return res.status(400).json({ message: 'Tender is already closed.', success: false });
      }

      if (tender.status === 'DRAFT') {
        await Payment.deleteMany({ tender: tender._id });
        await Bid.deleteMany({ tender: tender._id });
        await Tender.deleteOne({ _id: tender._id });
        await createAudit({
          req,
          action: 'withdraw',
          entityType: 'tender',
          entityId: tender._id,
          entityName: tender.title,
          description: 'Draft tender withdrawn (deleted)',
          module: 'tenders',
          subModule: 'withdraw',
          status: 'success',
          details: { previousStatus: 'DRAFT' }
        });
        return res.json({
          success: true,
          deleted: true,
          message: 'Draft tender removed.'
        });
      }

      if (tender.status === 'PUBLISHED') {
        tender.status = 'CLOSED';
        await tender.save();
        await createAudit({
          req,
          action: 'withdraw',
          entityType: 'tender',
          entityId: tender._id,
          entityName: tender.title,
          description: 'Published tender withdrawn (closed to new bids)',
          module: 'tenders',
          subModule: 'withdraw',
          status: 'success',
          details: { status: 'CLOSED' }
        });
        return res.json({
          success: true,
          tender,
          message: 'Tender withdrawn from bidding (closed).'
        });
      }

      return res.status(400).json({ message: 'Invalid tender state.', success: false });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Failed to withdraw tender', success: false });
    }
  }
);

/** Admin only: permanently delete tender and related bids / non-completed payments. */
router.delete(
  '/:id',
  authenticate,
  authorize(['ADMIN']),
  async (req: AuthRequest, res) => {
    try {
      const tender = await Tender.findById(req.params.id);
      if (!tender) {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }

      const completed = await Payment.countDocuments({
        tender: tender._id,
        status: 'Completed'
      });
      if (completed > 0) {
        return res.status(400).json({
          message:
            'Cannot delete tender: there are completed payments linked to it.',
          success: false
        });
      }

      await Payment.deleteMany({ tender: tender._id });
      await Bid.deleteMany({ tender: tender._id });
      await Tender.deleteOne({ _id: tender._id });

      await createAudit({
        req,
        action: 'delete',
        entityType: 'tender',
        entityId: tender._id,
        entityName: tender.title,
        description: 'Tender deleted by administrator',
        module: 'tenders',
        subModule: 'delete',
        status: 'success',
        details: {}
      });

      return res.json({ success: true, message: 'Tender deleted.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Failed to delete tender', success: false });
    }
  }
);

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const tender = await Tender.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('awardedVendor', 'name email phoneNumber');
    if (!tender) {
      return res.status(404).json({ message: 'Tender not found', success: false });
    }

    // Vendor visibility enforcement.
    if (req.user?.role === 'VENDOR') {
      if (tender.status !== 'PUBLISHED') {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }

      const vendorDoc = req.user.vendorProfile
        ? await Vendor.findById(req.user.vendorProfile)
        : null;
      if (!isVendorApprovedForMarketplace(vendorDoc)) {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }
    }
    return res.json({ tender, success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to load tender', success: false });
  }
});

router.patch(
  '/:id/publish',
  authenticate,
  authorize(['PROCUREMENT_OFFICER', 'ADMIN']),
  async (req, res) => {
    try {
      const tender = await Tender.findByIdAndUpdate(
        req.params.id,
        { status: 'PUBLISHED' },
        { new: true }
      );
      if (!tender) {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }

      await createAudit({
        req,
        action: 'publish',
        entityType: 'tender',
        entityId: tender._id,
        entityName: tender.title,
        description: 'Tender published',
        module: 'tenders',
        subModule: 'publish',
        status: 'success',
        details: { status: 'PUBLISHED' }
      });

      // Notify all verified vendors: new tender available in Tenders section
      try {
        const verifiedIds = await Vendor.find({ status: 'approved' }).distinct('_id');
        const vendorUsers = await User.find({
          role: 'VENDOR',
          isActive: true,
          vendorProfile: { $in: verifiedIds }
        }).select('_id');

        const tid = String(tender._id);
        const notifs = vendorUsers.map((u) => ({
          user: u._id,
          title: 'New tender published',
          body: `"${tender.title}" (${tender.referenceNumber}) is now open for bidding. View it under Tenders.`,
          link: `/tenders/${tid}`,
          type: 'tender_created' as const,
          read: false
        }));
        if (notifs.length) {
          await Notification.insertMany(notifs);
        }
      } catch (notifyErr) {
        console.error('Vendor tender publish notifications failed', notifyErr);
      }

      invalidateStaffSummaryCache();
      invalidateAdminDashboardCache();
      return res.json({ tender, success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Failed to publish', success: false });
    }
  }
);

router.patch(
  '/:id/close',
  authenticate,
  authorize(['PROCUREMENT_OFFICER', 'ADMIN']),
  async (req, res) => {
    try {
      const tender = await Tender.findByIdAndUpdate(
        req.params.id,
        { status: 'CLOSED' },
        { new: true }
      );
      if (!tender) {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }

      await createAudit({
        req,
        action: 'close',
        entityType: 'tender',
        entityId: tender._id,
        entityName: tender.title,
        description: 'Tender closed',
        module: 'tenders',
        subModule: 'close',
        status: 'success',
        details: { status: 'CLOSED' }
      });
      invalidateStaffSummaryCache();
      invalidateAdminDashboardCache();
      return res.json({ tender, success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Failed to close', success: false });
    }
  }
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(['PROCUREMENT_OFFICER', 'ADMIN']),
  async (req, res) => {
    const { status } = req.body;
    const tender = await Tender.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(tender);
  }
);

router.patch(
  '/:id/award',
  authenticate,
  authorize(['PROCUREMENT_OFFICER', 'ADMIN']),
  async (req, res) => {
    const { awardedVendor } = req.body;
    const tender = await Tender.findByIdAndUpdate(
      req.params.id,
      { status: 'AWARDED', awardedVendor },
      { new: true }
    );

    if (tender) {
      await createAudit({
        req,
        action: 'award',
        entityType: 'tender',
        entityId: tender._id,
        entityName: tender.title,
        description: 'Tender awarded',
        module: 'tenders',
        subModule: 'award',
        status: 'success',
        details: { awardedVendor }
      });
    }
    res.json(tender);
  }
);

export default router;
