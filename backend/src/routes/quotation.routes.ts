import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import Quotation from '../models/Quotation';
import PurchaseRequest from '../models/PurchaseRequest';
import Vendor from '../models/Vendor';
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from '../utils/cursorPagination';

const router = express.Router();

/** List view: no line-item arrays / attachments — keeps procurement pages fast over slow links. */
async function aggregateQuotationListPage(
  merged: Record<string, unknown>,
  pageLimit: number,
) {
  const prColl = PurchaseRequest.collection.collectionName;
  const raw = await Quotation.aggregate([
    { $match: merged },
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: pageLimit + 1 },
    {
      $project: {
        quotationNumber: 1,
        purchaseRequest: 1,
        vendor: 1,
        vendorName: 1,
        totalAmount: 1,
        subtotal: 1,
        currency: 1,
        validityDate: 1,
        deliveryDate: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        itemsCount: { $size: { $ifNull: ['$items', []] } },
      },
    },
    {
      $lookup: {
        from: prColl,
        localField: 'purchaseRequest',
        foreignField: '_id',
        as: '_pr',
        pipeline: [{ $project: { requestNumber: 1 } }],
      },
    },
    { $addFields: { purchaseRequest: { $arrayElemAt: ['$_pr', 0] } } },
    { $project: { _pr: 0 } },
  ]);
  return trimExtraDoc(
    raw as Array<{ createdAt?: Date; _id: unknown }>,
    pageLimit,
  );
}

router.post(
  '/create',
  authenticate,
  authorize(['VENDOR']),
  async (req: AuthRequest, res) => {
    const { purchaseRequestId, items, deliveryDate, validityDate } = req.body || {};

    const pr = await PurchaseRequest.findById(purchaseRequestId);
    if (!pr) return res.status(404).json({ message: 'Purchase request not found' });

    const vendorProfile = req.user?.vendorProfile;
    if (!vendorProfile) return res.status(400).json({ message: 'Vendor profile not found' });

    const vendor = await Vendor.findById(vendorProfile);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const quotation = new Quotation({
      purchaseRequest: pr._id,
      vendor: vendor._id,
      vendorName: vendor.name,
      items: Array.isArray(items) ? items : [],
      deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
      validityDate: validityDate ? new Date(validityDate) : new Date(),
      status: 'submitted',
      quotedBy: req.user?._id
    });

    await quotation.save();

    return res.status(201).json({ success: true, quotation: quotation.toObject() });
  }
);

// List quotations for procurement views
router.get(
  '/',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR']),
  async (req: AuthRequest, res) => {
    const pageLimit = parseListLimit(req.query.limit, 40, 100);
    const cursor =
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const base: Record<string, unknown> = {};
    if (req.user?.role === 'VENDOR' && req.user.vendorProfile) {
      base.vendor = req.user.vendorProfile;
    }
    let merged: Record<string, unknown>;
    try {
      merged = mergeWithCursorFilter(base, cursor);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid cursor' });
    }
    const { items, nextCursor, hasMore } = await aggregateQuotationListPage(
      merged,
      pageLimit,
    );
    res.json({ success: true, quotations: items, nextCursor, hasMore });
  }
);

router.get(
  '/my',
  authenticate,
  authorize(['VENDOR']),
  async (req: AuthRequest, res) => {
    const vendorProfile = req.user?.vendorProfile;
    if (!vendorProfile) return res.json({ success: true, quotations: [] });
    const prColl = PurchaseRequest.collection.collectionName;
    const quotations = await Quotation.aggregate([
      { $match: { vendor: vendorProfile } },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      {
        $project: {
          quotationNumber: 1,
          purchaseRequest: 1,
          vendor: 1,
          vendorName: 1,
          totalAmount: 1,
          subtotal: 1,
          currency: 1,
          validityDate: 1,
          deliveryDate: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          itemsCount: { $size: { $ifNull: ['$items', []] } },
        },
      },
      {
        $lookup: {
          from: prColl,
          localField: 'purchaseRequest',
          foreignField: '_id',
          as: '_pr',
          pipeline: [{ $project: { requestNumber: 1 } }],
        },
      },
      { $addFields: { purchaseRequest: { $arrayElemAt: ['$_pr', 0] } } },
      { $project: { _pr: 0 } },
    ]);
    res.json({ success: true, quotations });
  }
);

router.get(
  '/request/:requestId',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR']),
  async (req: AuthRequest, res) => {
    const pageLimit = parseListLimit(req.query.limit, 40, 100);
    const cursor =
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const base = { purchaseRequest: req.params.requestId } as Record<string, unknown>;
    let merged: Record<string, unknown>;
    try {
      merged = mergeWithCursorFilter(base, cursor);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid cursor' });
    }
    const { items, nextCursor, hasMore } = await aggregateQuotationListPage(
      merged,
      pageLimit,
    );
    res.json({ success: true, quotations: items, nextCursor, hasMore });
  }
);

router.get(
  '/:quotationId',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR']),
  async (req: AuthRequest, res) => {
    const quotation = await Quotation.findById(req.params.quotationId).populate(
      'purchaseRequest',
      'requestNumber'
    );
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
    res.json({ success: true, quotation });
  }
);

router.put(
  '/:quotationId/accept',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const quotation = await Quotation.findById(req.params.quotationId);
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

    const { comparisonNotes } = req.body || {};
    quotation.status = 'accepted';
    quotation.comparisonNotes = comparisonNotes ?? '';
    quotation.reviewedBy = req.user?._id;

    const pr = await PurchaseRequest.findById(quotation.purchaseRequest);
    if (pr) {
      pr.status = 'quotation_received';
      await pr.save();
    }

    await quotation.save();

    res.json({ success: true, quotation: quotation.toObject() });
  }
);

router.put(
  '/:quotationId/reject',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const quotation = await Quotation.findById(req.params.quotationId);
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });

    const { rejectionReason } = req.body || {};
    quotation.status = 'rejected';
    quotation.rejectionReason = rejectionReason ?? '';
    quotation.reviewedBy = req.user?._id;

    await quotation.save();

    res.json({ success: true, quotation: quotation.toObject() });
  }
);

export default router;

