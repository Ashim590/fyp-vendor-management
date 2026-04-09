import { Router } from 'express';
import mongoose from 'mongoose';
import Tender from '../models/Tender';
import Vendor from '../models/Vendor';
import User from '../models/User';
import Notification from '../models/Notification';
import Bid from '../models/Bid';
import Payment from '../models/Payment';
import TenderClarification from '../models/TenderClarification';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { buildQuotationComparison } from '../utils/quotationComparison';
import { createAudit } from '../utils/auditLog';
import { vendorMayAccessMarketplace } from '../utils/vendorGate';
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from '../utils/cursorPagination';
import { invalidateStaffSummaryCache } from '../utils/staffDashboardCache';
import { invalidateAdminDashboardCache } from '../utils/adminDashboardCache';
import { ensurePaymentForAwardedBid } from '../utils/tenderAwardPayment';
const router = Router();

function refId(ref: unknown): string {
  if (ref && typeof ref === 'object' && '_id' in (ref as Record<string, unknown>)) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref || '');
}

const generateRef = () =>
  'TDR-' +
  Date.now().toString(36).toUpperCase() +
  Math.random().toString(36).slice(2, 6).toUpperCase();

function parseRequiredDocuments(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x || '').trim())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) {
          return parsed.map((x) => String(x || '').trim()).filter(Boolean);
        }
      } catch {
        // fallback below
      }
    }
    return t
      .split(/\r?\n|,/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

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
        requiredDocuments,
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
        requiredDocuments: parseRequiredDocuments(requiredDocuments),
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

    // Vendors: verified accounts; list split into open (published) vs history (closed/awarded they joined).
    if (req.user?.role === 'VENDOR') {
      const mayBid = await vendorMayAccessMarketplace(req.user.vendorProfile);
      if (!mayBid) {
        return res.json({
          tenders: [],
          success: true,
          nextCursor: null,
          hasMore: false,
        });
      }

      const vendorScope =
        typeof req.query.scope === 'string' && req.query.scope === 'previous'
          ? 'previous'
          : 'active';

      if (vendorScope === 'previous') {
        const vid = refId(req.user.vendorProfile);
        if (!vid || !mongoose.isValidObjectId(vid)) {
          return res.json({
            tenders: [],
            success: true,
            nextCursor: null,
            hasMore: false,
          });
        }
        const vendorOid = new mongoose.Types.ObjectId(vid);
        const tenderIds = await Bid.distinct('tender', { vendor: vendorOid });
        if (!tenderIds.length) {
          return res.json({
            tenders: [],
            success: true,
            nextCursor: null,
            hasMore: false,
          });
        }
        filter._id = { $in: tenderIds };
        filter.status = { $in: ['CLOSED', 'AWARDED'] };
      } else {
        filter.status = 'PUBLISHED';
      }
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

/** Procurement officer or admin: withdraw published tender (→ CLOSED) or remove a draft (delete). */
router.patch(
  '/:id/withdraw',
  authenticate,
  authorize(['PROCUREMENT_OFFICER', 'ADMIN']),
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

/** Admin + procurement officer: permanently delete tender and related bids / non-completed payments. */
router.delete(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
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
      await TenderClarification.deleteMany({ tender: tender._id });
      await Tender.deleteOne({ _id: tender._id });

      const deletedBy =
        req.user?.role === 'ADMIN' ? 'administrator' : 'procurement officer';

      await createAudit({
        req,
        action: 'delete',
        entityType: 'tender',
        entityId: tender._id,
        entityName: tender.title,
        description: `Tender deleted by ${deletedBy}`,
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

/**
 * Automated quotation comparison for staff: lowest price, fastest stated delivery, weighted “best value” (price + delivery + vendor rating).
 */
router.get(
  '/:id/quotation-comparison',
  authenticate,
  authorize(['PROCUREMENT_OFFICER', 'ADMIN']),
  async (req: AuthRequest, res) => {
    try {
      const tender = await Tender.findById(req.params.id).select('_id title referenceNumber status');
      if (!tender) {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }

      const bids = await Bid.find({
        tender: tender._id,
        status: { $in: ['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED'] },
      })
        .populate('vendor', 'name rating preferredSupplier')
        .select('amount deliveryDaysOffer status vendor')
        .lean();

      const inputs = bids.map((b: any) => {
        const v = b.vendor;
        const vid = v?._id ? String(v._id) : String(b.vendor);
        return {
          bidId: String(b._id),
          vendorId: vid,
          vendorName: String(v?.name || 'Vendor'),
          amount: Number(b.amount) || 0,
          deliveryDaysOffer:
            b.deliveryDaysOffer != null && Number.isFinite(Number(b.deliveryDaysOffer))
              ? Number(b.deliveryDaysOffer)
              : undefined,
          rating: typeof v?.rating === 'number' ? v.rating : 0,
          preferredSupplier: !!v?.preferredSupplier,
          status: String(b.status),
        };
      });

      const comparisons = buildQuotationComparison(inputs).sort(
        (a, b) => b.valueScore - a.valueScore,
      );

      return res.json({
        success: true,
        tenderId: String(tender._id),
        title: tender.title,
        referenceNumber: tender.referenceNumber,
        tenderStatus: tender.status,
        meta: {
          bidCount: comparisons.length,
          weights: { price: 0.45, delivery: 0.25, rating: 0.25, preferredBonus: 0.05 },
        },
        comparisons,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: 'Failed to build quotation comparison',
        success: false,
      });
    }
  },
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
      const mayBid = await vendorMayAccessMarketplace(req.user.vendorProfile);
      if (!mayBid) {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }

      const vendorProfileId = refId(req.user.vendorProfile);
      const awardedVendorId = refId(tender.awardedVendor);
      const isOwnAwardedTender =
        tender.status === 'AWARDED' &&
        vendorProfileId &&
        awardedVendorId &&
        vendorProfileId === awardedVendorId;

      const participated =
        vendorProfileId &&
        mongoose.isValidObjectId(vendorProfileId) &&
        (await Bid.exists({
          tender: tender._id,
          vendor: new mongoose.Types.ObjectId(vendorProfileId),
        }));

      const mayViewClosedHistory =
        !!participated &&
        (tender.status === 'CLOSED' || tender.status === 'AWARDED');

      if (
        tender.status !== 'PUBLISHED' &&
        !isOwnAwardedTender &&
        !mayViewClosedHistory
      ) {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }
    }
    return res.json({ tender, success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to load tender', success: false });
  }
});

router.get('/:id/clarifications', authenticate, async (req: AuthRequest, res) => {
  try {
    const tender = await Tender.findById(req.params.id).select('_id status awardedVendor');
    if (!tender) {
      return res.status(404).json({ message: 'Tender not found', success: false });
    }

    const role = req.user?.role;
    const uid = req.user?._id;
    const vendorProfileId = refId(req.user?.vendorProfile);
    const awardedVendorId = refId(tender.awardedVendor);
    const isOwnAwardedTender =
      role === 'VENDOR' &&
      tender.status === 'AWARDED' &&
      vendorProfileId &&
      awardedVendorId &&
      vendorProfileId === awardedVendorId;

    if (role === 'VENDOR') {
      const mayBid = await vendorMayAccessMarketplace(req.user?.vendorProfile);
      const participated =
        vendorProfileId &&
        mongoose.isValidObjectId(vendorProfileId) &&
        (await Bid.exists({
          tender: tender._id,
          vendor: new mongoose.Types.ObjectId(vendorProfileId),
        }));
      const mayViewHistory =
        !!participated &&
        (tender.status === 'CLOSED' || tender.status === 'AWARDED');
      if (!mayBid && !isOwnAwardedTender && !mayViewHistory) {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }
      if (
        tender.status !== 'PUBLISHED' &&
        !isOwnAwardedTender &&
        !mayViewHistory
      ) {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }
    }

    const filter: Record<string, unknown> = { tender: tender._id };
    if (role === 'VENDOR') {
      filter.$or = [{ isPublic: true }, { vendorUser: uid }];
    }

    const clarifications = await TenderClarification.find(filter)
      .sort({ askedAt: -1, _id: -1 })
      .populate('vendorUser', 'name')
      .lean();

    return res.json({ clarifications, success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to load clarifications', success: false });
  }
});

router.post(
  '/:id/clarifications',
  authenticate,
  authorize(['VENDOR']),
  async (req: AuthRequest, res) => {
    try {
      const tender = await Tender.findById(req.params.id).select('_id status');
      if (!tender) {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }
      if (tender.status !== 'PUBLISHED') {
        return res.status(400).json({
          message: 'Clarifications can be requested only while tender is published.',
          success: false,
        });
      }
      if (!req.user?.vendorProfile) {
        return res.status(400).json({ message: 'Vendor profile is required', success: false });
      }
      const mayBid = await vendorMayAccessMarketplace(req.user.vendorProfile);
      if (!mayBid) {
        return res.status(403).json({
          message: 'Vendor is not approved yet.',
          success: false,
        });
      }

      const question = String(req.body?.question || '').trim();
      if (!question) {
        return res.status(400).json({ message: 'Question is required.', success: false });
      }

      const c = await TenderClarification.create({
        tender: tender._id,
        vendorUser: req.user._id,
        vendor: req.user.vendorProfile,
        question,
        isPublic: true,
      });
      return res.status(201).json({ clarification: c, success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Failed to create clarification', success: false });
    }
  },
);

router.patch(
  '/:id/clarifications/:clarificationId/answer',
  authenticate,
  authorize(['PROCUREMENT_OFFICER', 'ADMIN']),
  async (req: AuthRequest, res) => {
    try {
      const answer = String(req.body?.answer || '').trim();
      if (!answer) {
        return res.status(400).json({ message: 'Answer is required.', success: false });
      }
      const c = await TenderClarification.findOneAndUpdate(
        {
          _id: req.params.clarificationId,
          tender: req.params.id,
        },
        {
          answer,
          isPublic: true,
          answeredAt: new Date(),
        },
        { new: true },
      );
      if (!c) {
        return res.status(404).json({ message: 'Clarification not found', success: false });
      }
      return res.json({ clarification: c, success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Failed to answer clarification', success: false });
    }
  },
);

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

      // Notify approved marketplace vendors only — not staff or admins.
      try {
        const verifiedIds = await Vendor.find({ status: 'approved' }).distinct('_id');
        const vendorUsers = await User.find({
          role: 'VENDOR',
          isActive: true,
          vendorProfile: { $in: verifiedIds, $exists: true, $ne: null },
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
  async (req: AuthRequest, res) => {
    try {
      const { awardedVendor } = req.body as { awardedVendor?: string };
      if (!awardedVendor) {
        return res.status(400).json({
          message: 'awardedVendor is required',
          success: false
        });
      }

      const tender = await Tender.findById(req.params.id);
      if (!tender) {
        return res.status(404).json({ message: 'Tender not found', success: false });
      }

      if (tender.status === 'AWARDED') {
        return res.status(400).json({
          message: 'This tender is already awarded',
          success: false
        });
      }

      if (tender.status !== 'PUBLISHED' && tender.status !== 'CLOSED') {
        return res.status(400).json({
          message: 'Only published or closed tenders can be awarded',
          success: false
        });
      }

      const vendorOid = new mongoose.Types.ObjectId(String(awardedVendor));
      const winningBid = await Bid.findOne({
        tender: tender._id,
        vendor: vendorOid,
        status: 'ACCEPTED'
      });

      if (!winningBid) {
        return res.status(400).json({
          message:
            'Select a preferred quotation (Accept on the tender) for this vendor before awarding.',
          success: false
        });
      }

      tender.status = 'AWARDED';
      tender.awardedVendor = vendorOid;
      await tender.save();

      await Bid.updateMany(
        { tender: tender._id, _id: { $ne: winningBid._id } },
        { status: 'REJECTED' }
      );

      await ensurePaymentForAwardedBid(winningBid, tender, req.user?._id);

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
        details: { awardedVendor: String(vendorOid) }
      });

      invalidateStaffSummaryCache();
      invalidateAdminDashboardCache();

      const fresh = await Tender.findById(tender._id).populate(
        'awardedVendor',
        'name email phoneNumber'
      );
      return res.json({ tender: fresh, success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Failed to award tender', success: false });
    }
  }
);

export default router;
