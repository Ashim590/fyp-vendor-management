import express from "express";
import mongoose from "mongoose";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import Delivery, { DeliveryStatus, IDelivery } from "../models/Delivery";
import PurchaseOrder from "../models/PurchaseOrder";
import Vendor from "../models/Vendor";
import { notifyDeliveryEvent } from "../utils/deliveryNotify";
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from "../utils/cursorPagination";

const router = express.Router();

/** Status changes via PATCH (use PUT /receive to confirm receipt after delivered) */
const PATCH_FORWARD: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ["shipped"],
  shipped: ["in_transit"],
  in_transit: ["delivered"],
  delivered: [],
  received: ["inspected"],
  inspected: [],
  rejected: [],
};

function vendorOwnsDelivery(req: AuthRequest, d: IDelivery): boolean {
  const vid = req.user?.vendorProfile;
  if (!vid) return false;
  return String(d.vendor) === String(vid);
}

function appendHistory(
  d: IDelivery,
  status: DeliveryStatus,
  note: string,
  user?: { _id: mongoose.Types.ObjectId; name?: string },
): void {
  const list = d.statusHistory || [];
  list.push({
    status,
    note: note || "",
    at: new Date(),
    byUser: user?._id,
    byName: user?.name || "",
  });
  d.statusHistory = list;
}

router.post(
  "/create",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    const { purchaseOrderId, items, expectedDate, status, vendorId } =
      req.body || {};
    const po = await PurchaseOrder.findById(purchaseOrderId);
    if (!po)
      return res.status(404).json({ message: "Purchase order not found" });
    const vendor = vendorId
      ? await Vendor.findById(vendorId)
      : await Vendor.findById(po.vendor);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const delivery = new Delivery({
      purchaseOrder: po._id,
      purchaseOrderNumber: po.orderNumber,
      orderReference: po.orderNumber,
      vendor: vendor._id,
      vendorName: vendor.name,
      items: Array.isArray(items) ? items : [],
      expectedDate: expectedDate ? new Date(expectedDate) : new Date(),
      status: (status as DeliveryStatus) ?? "pending",
      statusHistory: [
        {
          status: (status as DeliveryStatus) ?? "pending",
          note: "Created from purchase order",
          at: new Date(),
          byUser: req.user?._id,
          byName: req.user?.name,
        },
      ],
    });

    await delivery.save();
    res.status(201).json({ success: true, delivery: delivery.toObject() });
  },
);

router.get(
  "/my",
  authenticate,
  authorize(["VENDOR"]),
  async (req: AuthRequest, res) => {
    try {
      const vid = req.user!.vendorProfile;
      if (!vid) return res.status(403).json({ message: "No vendor profile" });
      const pageLimit = parseListLimit(req.query.limit, 40, 100);
      const cursor =
        typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      const base = { vendor: vid } as Record<string, unknown>;
      let merged: Record<string, unknown>;
      try {
        merged = mergeWithCursorFilter(base, cursor);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid cursor" });
      }
      const raw = await Delivery.find(merged)
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageLimit + 1)
        .select("-statusHistory -items")
        .lean();
      const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
      res.json({ success: true, deliveries: items, nextCursor, hasMore });
    } catch (err) {
      console.error("GET /api/v1/delivery/my", err);
      return res.status(500).json({
        success: false,
        message: "Could not load deliveries.",
      });
    }
  },
);

router.get(
  "/",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  async (req: AuthRequest, res) => {
    try {
      const { status } = req.query;
      const pageLimit = parseListLimit(req.query.limit, 50, 100);
      const cursor =
        typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      const base: Record<string, unknown> = {};
      if (status && typeof status === "string") base.status = status;
      if (req.user!.role === "VENDOR" && req.user!.vendorProfile) {
        base.vendor = req.user!.vendorProfile;
      }
      let merged: Record<string, unknown>;
      try {
        merged = mergeWithCursorFilter(base, cursor);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid cursor" });
      }
      const raw = await Delivery.find(merged)
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageLimit + 1)
        .select("-statusHistory -items")
        .lean();
      const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
      res.json({ success: true, deliveries: items, nextCursor, hasMore });
    } catch (err) {
      console.error("GET /api/v1/delivery", err);
      return res.status(500).json({
        success: false,
        message: "Could not load deliveries.",
      });
    }
  },
);

router.get(
  "/:deliveryId",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  async (req: AuthRequest, res) => {
    if (!mongoose.isValidObjectId(req.params.deliveryId)) {
      return res.status(400).json({ message: "Invalid delivery id" });
    }
    const delivery = await Delivery.findById(req.params.deliveryId);
    if (!delivery)
      return res.status(404).json({ message: "Delivery not found" });
    if (req.user!.role === "VENDOR" && !vendorOwnsDelivery(req, delivery)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json({ success: true, delivery });
  },
);

router.patch(
  "/:deliveryId/status",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  async (req: AuthRequest, res) => {
    const { status: nextStatus, note } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.deliveryId)) {
      return res.status(400).json({ message: "Invalid delivery id" });
    }
    const delivery = await Delivery.findById(req.params.deliveryId);
    if (!delivery)
      return res.status(404).json({ message: "Delivery not found" });
    if (req.user!.role === "VENDOR" && !vendorOwnsDelivery(req, delivery)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const cur = delivery.status as DeliveryStatus;
    const next = nextStatus as DeliveryStatus;
    if (next === "received") {
      return res
        .status(400)
        .json({ message: "Use PUT /receive to confirm receipt" });
    }
    if (!next || !PATCH_FORWARD[cur]?.includes(next)) {
      return res.status(400).json({
        message: `Invalid transition from ${cur} to ${next || "undefined"}`,
      });
    }

    if (req.user!.role === "VENDOR") {
      if (!["shipped", "in_transit", "delivered"].includes(next)) {
        return res
          .status(403)
          .json({
            message: "Vendors cannot set this status via this endpoint",
          });
      }
      if (next === "delivered" && cur !== "in_transit") {
        return res
          .status(400)
          .json({ message: "Must be in transit before marking delivered" });
      }
    }

    if (next === "inspected" && req.user!.role === "VENDOR") {
      return res
        .status(403)
        .json({ message: "Only staff can record inspection" });
    }

    delivery.status = next;
    if (next === "delivered") {
      delivery.actualDate = new Date();
    }
    appendHistory(delivery, next, String(note || ""), {
      _id: req.user!._id,
      name: req.user!.name,
    });
    await delivery.save();

    const ref = delivery.orderReference || delivery.deliveryNumber;
    const vendorName = delivery.vendorName;
    let ntype:
      | "delivery_shipped"
      | "delivery_in_transit"
      | "delivery_delivered" = "delivery_shipped";
    let title = "Delivery updated";
    let body = `${ref} (${vendorName}) status: ${next}.`;
    if (next === "shipped") {
      ntype = "delivery_shipped";
      title = "Order shipped";
      body = `${ref} — ${vendorName} marked the order as shipped.`;
    } else if (next === "in_transit") {
      ntype = "delivery_in_transit";
      title = "Order in transit";
      body = `${ref} — ${vendorName} marked the order as in transit.`;
    } else if (next === "delivered") {
      ntype = "delivery_delivered";
      title = "Order delivered";
      body = `${ref} — ${vendorName} marked the order as delivered. Please confirm receipt.`;
    }
    await notifyDeliveryEvent({
      title,
      body,
      vendorId: delivery.vendor as mongoose.Types.ObjectId,
      type: ntype,
      excludeUserId: req.user!._id,
    }).catch(() => {});

    res.json({ success: true, delivery: delivery.toObject() });
  },
);

router.patch(
  "/:deliveryId/delay",
  authenticate,
  authorize(["VENDOR"]),
  async (req: AuthRequest, res) => {
    const { reason } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.deliveryId)) {
      return res.status(400).json({ message: "Invalid delivery id" });
    }
    const delivery = await Delivery.findById(req.params.deliveryId);
    if (!delivery)
      return res.status(404).json({ message: "Delivery not found" });
    if (!vendorOwnsDelivery(req, delivery)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (["received", "inspected"].includes(delivery.status)) {
      return res
        .status(400)
        .json({ message: "Cannot record delay after receipt" });
    }
    delivery.delayReason = String(reason || "").trim() || "Delay recorded";
    delivery.delayRecordedAt = new Date();
    delivery.delayRecordedBy = req.user!._id;
    appendHistory(
      delivery,
      delivery.status as DeliveryStatus,
      `Delay: ${delivery.delayReason}`,
      {
        _id: req.user!._id,
        name: req.user!.name,
      },
    );
    await delivery.save();

    const ref = delivery.orderReference || delivery.deliveryNumber;
    await notifyDeliveryEvent({
      title: "Delivery delay recorded",
      body: `${ref} — ${delivery.vendorName}: ${delivery.delayReason}`,
      vendorId: delivery.vendor as mongoose.Types.ObjectId,
      type: "delivery_delayed",
      excludeUserId: req.user!._id,
    }).catch(() => {});

    res.json({ success: true, delivery: delivery.toObject() });
  },
);

router.patch(
  "/:deliveryId/comment",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  async (req: AuthRequest, res) => {
    const { note } = req.body || {};
    const cleanNote = String(note || "").trim();
    if (!cleanNote) {
      return res.status(400).json({ message: "Comment is required" });
    }
    if (!mongoose.isValidObjectId(req.params.deliveryId)) {
      return res.status(400).json({ message: "Invalid delivery id" });
    }
    const delivery = await Delivery.findById(req.params.deliveryId);
    if (!delivery)
      return res.status(404).json({ message: "Delivery not found" });
    if (req.user!.role === "VENDOR" && !vendorOwnsDelivery(req, delivery)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    appendHistory(
      delivery,
      delivery.status as DeliveryStatus,
      `Comment: ${cleanNote}`,
      {
        _id: req.user!._id,
        name: req.user!.name,
      },
    );
    await delivery.save();

    res.json({ success: true, delivery: delivery.toObject() });
  },
);

router.put(
  "/:deliveryId/receive",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    if (!mongoose.isValidObjectId(req.params.deliveryId)) {
      return res.status(400).json({ message: "Invalid delivery id" });
    }
    const delivery = await Delivery.findById(req.params.deliveryId);
    if (!delivery)
      return res.status(404).json({ message: "Delivery not found" });
    if (delivery.status !== "delivered") {
      return res
        .status(400)
        .json({
          message:
            "Order must be marked delivered by vendor before receipt confirmation",
        });
    }
    const body = req.body || {};
    const receivedData = body.receivedData || body;
    delivery.receivedData = {
      receivedDate: receivedData.receivedDate
        ? new Date(receivedData.receivedDate)
        : new Date(),
      receivedBy: receivedData.receivedBy ?? req.user!.name ?? "Officer",
      notes: receivedData.notes ?? "",
    };
    delivery.actualDate = delivery.receivedData.receivedDate;
    delivery.status = "received";
    appendHistory(delivery, "received", "Receipt confirmed by procurement", {
      _id: req.user!._id,
      name: req.user!.name,
    });
    await delivery.save();

    const ref = delivery.orderReference || delivery.deliveryNumber;
    await notifyDeliveryEvent({
      title: "Delivery received & verified",
      body: `${ref} — ${delivery.vendorName} was confirmed received by procurement.`,
      vendorId: delivery.vendor as mongoose.Types.ObjectId,
      type: "delivery_received",
      excludeUserId: req.user!._id,
    }).catch(() => {});

    res.json({ success: true, delivery: delivery.toObject() });
  },
);

router.put(
  "/:deliveryId/inspect",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    if (!mongoose.isValidObjectId(req.params.deliveryId)) {
      return res.status(400).json({ message: "Invalid delivery id" });
    }
    const delivery = await Delivery.findById(req.params.deliveryId);
    if (!delivery)
      return res.status(404).json({ message: "Delivery not found" });
    const body = req.body || {};
    const inspectionData = body.inspectionData || body;
    delivery.inspectionData = {
      status: inspectionData.status ?? "inspected",
      notes: inspectionData.notes ?? "",
    };
    delivery.status = "inspected";
    appendHistory(
      delivery,
      "inspected",
      inspectionData.notes ?? "Inspection recorded",
      {
        _id: req.user!._id,
        name: req.user!.name,
      },
    );
    await delivery.save();
    res.json({ success: true, delivery: delivery.toObject() });
  },
);

export default router;
