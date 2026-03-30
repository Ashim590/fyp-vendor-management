import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import Invoice from '../models/Invoice';
import PurchaseOrder from '../models/PurchaseOrder';
import Vendor from '../models/Vendor';
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from '../utils/cursorPagination';
import { reconcileInvoicesFromVerifiedPayments } from '../utils/invoiceFromTenderPayment';

const router = express.Router();

router.post(
  '/create',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const { purchaseOrderId, vendorId, items, issueDate, dueDate, status } = req.body || {};
    const po = await PurchaseOrder.findById(purchaseOrderId);
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });
    const vendor = vendorId ? await Vendor.findById(vendorId) : await Vendor.findById(po.vendor);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const invoice = new Invoice({
      purchaseOrder: po._id,
      purchaseOrderNumber: po.orderNumber,
      vendor: vendor._id,
      vendorName: vendor.name,
      items: Array.isArray(items) ? items : [],
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(),
      status: status ?? 'draft'
    });

    await invoice.save();
    res.status(201).json({ success: true, invoice: invoice.toObject() });
  }
);

/** Backfill invoices from Completed tender payments and PAID invoice eSewa records (idempotent). */
router.post(
  '/reconcile-from-payments',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (_req: AuthRequest, res) => {
    try {
      const summary = await reconcileInvoicesFromVerifiedPayments();
      res.json({ success: true, ...summary });
    } catch (err) {
      console.error('reconcile-from-payments', err);
      res.status(500).json({ success: false, message: 'Reconciliation failed' });
    }
  },
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

      const baseFilter: Record<string, unknown> = {};
      if (req.user?.role === 'VENDOR' && req.user.vendorProfile) {
        baseFilter.vendor = req.user.vendorProfile;
      }

      let merged: Record<string, unknown>;
      try {
        merged = mergeWithCursorFilter(baseFilter, cursor);
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid cursor' });
      }
      const raw = await Invoice.find(merged)
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageLimit + 1)
        .select(
          'invoiceNumber purchaseOrder purchaseOrderNumber vendor vendorName items issueDate dueDate status totalAmount createdAt updatedAt tenderPayment tender bid paidAt settledByInvoicePayment',
        )
        .populate('purchaseOrder', 'orderNumber')
        .populate('tender', 'title referenceNumber')
        .lean();
      const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
      return res.json({ success: true, invoices: items, nextCursor, hasMore });
    } catch (err) {
      console.error('GET /api/v1/invoice', err);
      return res.status(500).json({
        success: false,
        message: 'Could not load invoices.',
      });
    }
  },
);

router.get(
  '/:invoiceId',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR']),
  async (req: AuthRequest, res) => {
    const invoice = await Invoice.findById(req.params.invoiceId)
      .populate('purchaseOrder', 'orderNumber')
      .populate('tender', 'title referenceNumber status');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (
      req.user?.role === 'VENDOR' &&
      String(invoice.vendor) !== String(req.user.vendorProfile)
    ) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json({ success: true, invoice });
  }
);

router.put(
  '/:invoiceId',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const { items, issueDate, dueDate, status } = req.body || {};
    if (Array.isArray(items)) invoice.items = items;
    if (issueDate) invoice.issueDate = new Date(issueDate);
    if (dueDate) invoice.dueDate = new Date(dueDate);
    if (status) invoice.status = status;

    await invoice.save();
    res.json({ success: true, invoice: invoice.toObject() });
  }
);

export default router;

