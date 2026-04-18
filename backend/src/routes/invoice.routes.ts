import express from "express";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import Invoice from "../models/Invoice";
import PurchaseOrder from "../models/PurchaseOrder";
import Tender from "../models/Tender";
import Vendor from "../models/Vendor";
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from "../utils/cursorPagination";
import { reconcileInvoicesFromVerifiedPayments } from "../utils/invoiceFromTenderPayment";

const router = express.Router();

async function aggregateInvoiceListPage(
  merged: Record<string, unknown>,
  pageLimit: number
) {
  const poColl = PurchaseOrder.collection.collectionName;
  const tenderColl = Tender.collection.collectionName;
  const raw = await Invoice.aggregate([
    { $match: merged },
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: pageLimit + 1 },
    {
      $project: {
        invoiceNumber: 1,
        purchaseOrder: 1,
        purchaseOrderNumber: 1,
        vendor: 1,
        vendorName: 1,
        issueDate: 1,
        dueDate: 1,
        status: 1,
        totalAmount: 1,
        createdAt: 1,
        updatedAt: 1,
        tenderPayment: 1,
        tender: 1,
        bid: 1,
        paidAt: 1,
        settledByInvoicePayment: 1,
        itemsCount: { $size: { $ifNull: ["$items", []] } },
      },
    },
    {
      $lookup: {
        from: poColl,
        localField: "purchaseOrder",
        foreignField: "_id",
        as: "_po",
        pipeline: [{ $project: { orderNumber: 1 } }],
      },
    },
    {
      $lookup: {
        from: tenderColl,
        localField: "tender",
        foreignField: "_id",
        as: "_tend",
        pipeline: [{ $project: { title: 1, referenceNumber: 1 } }],
      },
    },
    {
      $addFields: {
        purchaseOrder: { $arrayElemAt: ["$_po", 0] },
        tender: { $arrayElemAt: ["$_tend", 0] },
      },
    },
    { $project: { _po: 0, _tend: 0 } },
  ]);
  return trimExtraDoc(
    raw as Array<{ createdAt?: Date; _id: unknown }>,
    pageLimit
  );
}

router.post(
  "/create",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    const { purchaseOrderId, vendorId, items, issueDate, dueDate, status } =
      req.body || {};
    const po = await PurchaseOrder.findById(purchaseOrderId);
    if (!po)
      return res.status(404).json({ message: "Purchase order not found" });
    const vendor = vendorId
      ? await Vendor.findById(vendorId)
      : await Vendor.findById(po.vendor);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const invoice = new Invoice({
      purchaseOrder: po._id,
      purchaseOrderNumber: po.orderNumber,
      vendor: vendor._id,
      vendorName: vendor.name,
      items: Array.isArray(items) ? items : [],
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(),
      status: status ?? "draft",
    });

    await invoice.save();
    res.status(201).json({ success: true, invoice: invoice.toObject() });
  }
);

/** Backfill invoices from Completed tender payments and PAID invoice eSewa records (idempotent). */
router.post(
  "/reconcile-from-payments",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (_req: AuthRequest, res) => {
    try {
      const summary = await reconcileInvoicesFromVerifiedPayments();
      res.json({ success: true, ...summary });
    } catch (err) {
      console.error("reconcile-from-payments", err);
      res
        .status(500)
        .json({ success: false, message: "Reconciliation failed" });
    }
  }
);

router.get(
  "/",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  async (req: AuthRequest, res) => {
    try {
      const pageLimit = parseListLimit(req.query.limit, 40, 100);
      const cursor =
        typeof req.query.cursor === "string" ? req.query.cursor : undefined;

      const baseFilter: Record<string, unknown> = {};
      if (req.user?.role === "VENDOR" && req.user.vendorProfile) {
        baseFilter.vendor = req.user.vendorProfile;
      }

      let merged: Record<string, unknown>;
      try {
        merged = mergeWithCursorFilter(baseFilter, cursor);
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid cursor" });
      }
      const { items, nextCursor, hasMore } = await aggregateInvoiceListPage(
        merged,
        pageLimit
      );
      return res.json({ success: true, invoices: items, nextCursor, hasMore });
    } catch (err) {
      console.error("GET /api/v1/invoice", err);
      return res.status(500).json({
        success: false,
        message: "Could not load invoices.",
      });
    }
  }
);

router.get(
  "/:invoiceId",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  async (req: AuthRequest, res) => {
    const invoice = await Invoice.findById(req.params.invoiceId)
      .populate("purchaseOrder", "orderNumber")
      .populate("tender", "title referenceNumber status");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (
      req.user?.role === "VENDOR" &&
      String(invoice.vendor) !== String(req.user.vendorProfile)
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json({ success: true, invoice });
  }
);

router.put(
  "/:invoiceId",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    const invoice = await Invoice.findById(req.params.invoiceId);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

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
