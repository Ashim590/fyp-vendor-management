import express from 'express';
import mongoose from 'mongoose';
import VendorReview, { refreshVendorRatingFromReviews } from '../models/VendorReview';
import Vendor from '../models/Vendor';
import PurchaseOrder from '../models/PurchaseOrder';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { createAudit } from '../utils/auditLog';
import { parseListLimit } from '../utils/cursorPagination';

const router = express.Router();

function parseScore(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

router.post(
  '/',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    try {
      const {
        vendorId,
        purchaseOrderId,
        deliveryScore: dRaw,
        qualityScore: qRaw,
        communicationScore: cRaw,
        comment,
      } = req.body || {};

      if (!vendorId || !mongoose.isValidObjectId(String(vendorId))) {
        return res.status(400).json({ message: 'vendorId is required', success: false });
      }

      const deliveryScore = parseScore(dRaw);
      const qualityScore = parseScore(qRaw);
      const communicationScore = parseScore(cRaw);
      if (deliveryScore == null || qualityScore == null || communicationScore == null) {
        return res.status(400).json({
          message: 'deliveryScore, qualityScore, and communicationScore must be integers 1–5.',
          success: false,
        });
      }

      const vendor = await Vendor.findById(vendorId).select('_id name status');
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor not found', success: false });
      }

      if (purchaseOrderId) {
        if (!mongoose.isValidObjectId(String(purchaseOrderId))) {
          return res.status(400).json({ message: 'Invalid purchaseOrderId', success: false });
        }
        const po = await PurchaseOrder.findById(purchaseOrderId)
          .select('vendor status')
          .lean();
        if (!po) {
          return res.status(404).json({ message: 'Purchase order not found', success: false });
        }
        if (String(po.vendor) !== String(vendorId)) {
          return res.status(400).json({
            message: 'Purchase order does not belong to this vendor.',
            success: false,
          });
        }
      }

      const review = await VendorReview.create({
        vendor: vendor._id,
        purchaseOrder: purchaseOrderId || undefined,
        createdBy: req.user!._id,
        deliveryScore,
        qualityScore,
        communicationScore,
        comment: String(comment || '').trim().slice(0, 4000),
      });

      const newRating = await refreshVendorRatingFromReviews(vendor._id);

      await createAudit({
        req,
        action: 'create',
        entityType: 'vendor_review',
        entityId: review._id,
        entityName: vendor.name,
        description: 'Procurement submitted vendor performance review',
        module: 'vendors',
        subModule: 'review',
        status: 'success',
        details: {
          vendorId: String(vendor._id),
          purchaseOrderId: purchaseOrderId ? String(purchaseOrderId) : undefined,
        },
      });

      return res.status(201).json({
        success: true,
        review: review.toObject(),
        vendorRating: newRating,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: 'Failed to create review',
        success: false,
      });
    }
  },
);

router.get(
  '/vendor/:vendorId',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR']),
  async (req: AuthRequest, res) => {
    try {
      const { vendorId } = req.params;
      if (!mongoose.isValidObjectId(vendorId)) {
        return res.status(400).json({ message: 'Invalid vendor id', success: false });
      }

      if (req.user?.role === 'VENDOR') {
        if (String(req.user.vendorProfile) !== String(vendorId)) {
          return res.status(403).json({ message: 'Forbidden', success: false });
        }
      }

      const pageLimit = parseListLimit(req.query.limit, 30, 100);

      const reviews = await VendorReview.find({ vendor: vendorId })
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageLimit)
        .populate('createdBy', 'name email role')
        .populate('purchaseOrder', 'orderNumber status totalAmount')
        .lean();

      return res.json({
        success: true,
        reviews,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: 'Failed to load reviews',
        success: false,
      });
    }
  },
);

export default router;
