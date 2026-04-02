import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import PurchaseOrder from '../models/PurchaseOrder';
import PurchaseRequest from '../models/PurchaseRequest';
import Vendor from '../models/Vendor';
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from '../utils/cursorPagination';

const router = express.Router();

async function aggregatePurchaseOrderListPage(
  merged: Record<string, unknown>,
  pageLimit: number,
) {
  const prColl = PurchaseRequest.collection.collectionName;
  const raw = await PurchaseOrder.aggregate([
    { $match: merged },
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: pageLimit + 1 },
    {
      $project: {
        orderNumber: 1,
        purchaseRequest: 1,
        vendor: 1,
        vendorName: 1,
        totalAmount: 1,
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
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const { purchaseRequestId, vendorId, items, deliveryDate, status } = req.body || {};
    const pr = await PurchaseRequest.findById(purchaseRequestId);
    if (!pr) return res.status(404).json({ message: 'Purchase request not found' });

    const vendorProfile = vendorId ?? req.user?.vendorProfile;
    const vendor = vendorProfile ? await Vendor.findById(vendorProfile) : null;
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const po = new PurchaseOrder({
      purchaseRequest: pr._id,
      vendor: vendor._id,
      vendorName: vendor.name,
      items: Array.isArray(items) ? items : [],
      deliveryDate: deliveryDate ? new Date(deliveryDate) : new Date(),
      status: status ?? 'draft'
    });

    await po.save();
    res.status(201).json({ success: true, purchaseOrder: po.toObject() });
  }
);

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
    const { items, nextCursor, hasMore } = await aggregatePurchaseOrderListPage(
      merged,
      pageLimit,
    );
    res.json({ success: true, purchaseOrders: items, nextCursor, hasMore });
  }
);

router.get(
  '/:orderId',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR']),
  async (req: AuthRequest, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.orderId).populate(
      'purchaseRequest',
      'requestNumber'
    );
    if (!purchaseOrder) return res.status(404).json({ message: 'Purchase order not found' });
    res.json({ success: true, purchaseOrder });
  }
);

router.put(
  '/:orderId',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const purchaseOrder = await PurchaseOrder.findById(req.params.orderId);
    if (!purchaseOrder) return res.status(404).json({ message: 'Purchase order not found' });

    const { items, deliveryDate, status } = req.body || {};
    if (Array.isArray(items)) purchaseOrder.items = items;
    if (deliveryDate) purchaseOrder.deliveryDate = new Date(deliveryDate);
    if (status) purchaseOrder.status = status;

    await purchaseOrder.save();
    res.json({ success: true, purchaseOrder: purchaseOrder.toObject() });
  }
);

export default router;

