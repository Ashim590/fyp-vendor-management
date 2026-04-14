import express from "express";
import mongoose from "mongoose";
import multer from "multer";
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
import { invalidateStaffSummaryCache } from "../utils/staffDashboardCache";
import {
  DELIVERY_PATCH_FORWARD,
  DELIVERY_STATUS,
  DeliveryWorkflowStatus,
  canProcurementGeoConfirm,
  normalizeDeliveryStatus,
} from "../constants/deliveryWorkflow";
import { serializeDeliveryLean } from "../utils/deliverySerialize";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const MAX_CONFIRM_ACCURACY_METERS = Number(
  process.env.DELIVERY_CONFIRM_MAX_ACCURACY_METERS || 50,
);

function fileToDataUrl(file: Express.Multer.File): string {
  const b64 = file.buffer.toString("base64");
  return `data:${file.mimetype};base64,${b64}`;
}

function toDeliveryJson(d: IDelivery) {
  const o = d.toObject() as Record<string, unknown>;
  return serializeDeliveryLean(o);
}

function mapLeanList(items: Record<string, unknown>[]) {
  return items.map((x) => serializeDeliveryLean(x));
}

const VENDOR_FORWARD: Record<DeliveryWorkflowStatus, DeliveryWorkflowStatus[]> =
  {
    PENDING: [DELIVERY_STATUS.ACCEPTED],
    ACCEPTED: [DELIVERY_STATUS.IN_TRANSIT],
    IN_TRANSIT: [DELIVERY_STATUS.READY_FOR_CONFIRMATION],
    READY_FOR_CONFIRMATION: [],
    VERIFIED: [],
    INSPECTED: [],
    REJECTED: [],
  };

function vendorOwnsDelivery(
  req: AuthRequest,
  d: { vendor?: unknown },
): boolean {
  const vid = req.user?.vendorProfile;
  if (!vid) return false;
  return String(d.vendor) === String(vid);
}

function appendHistory(
  d: IDelivery,
  status: string,
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

function applyOptionalVendorProofFromBody(
  delivery: IDelivery,
  proofImage: unknown,
): void {
  if (
    typeof proofImage === "string" &&
    proofImage.startsWith("data:image/") &&
    proofImage.length < 6 * 1024 * 1024
  ) {
    delivery.vendorProofImage = proofImage;
  }
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

    const initial = normalizeDeliveryStatus(status) as DeliveryStatus;

    const delivery = new Delivery({
      purchaseOrder: po._id,
      purchaseOrderNumber: po.orderNumber,
      orderReference: po.orderNumber,
      orderRef: po.orderNumber,
      vendor: vendor._id,
      vendorName: vendor.name,
      items: Array.isArray(items) ? items : [],
      expectedDate: expectedDate ? new Date(expectedDate) : new Date(),
      status: initial,
      statusHistory: [
        {
          status: initial,
          note: "Created from purchase order",
          at: new Date(),
          byUser: req.user?._id,
          byName: req.user?.name,
        },
      ],
    });

    await delivery.save();
    invalidateStaffSummaryCache();
    res.status(201).json({ success: true, delivery: toDeliveryJson(delivery) });
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
        return res
          .status(400)
          .json({ success: false, message: "Invalid cursor" });
      }
      const raw = await Delivery.find(merged)
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageLimit + 1)
        .select("-statusHistory -items")
        .lean();
      const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
      res.json({
        success: true,
        deliveries: mapLeanList(items as Record<string, unknown>[]),
        nextCursor,
        hasMore,
      });
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
        return res
          .status(400)
          .json({ success: false, message: "Invalid cursor" });
      }
      const raw = await Delivery.find(merged)
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageLimit + 1)
        .select("-statusHistory -items")
        .lean();
      const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
      res.json({
        success: true,
        deliveries: mapLeanList(items as Record<string, unknown>[]),
        nextCursor,
        hasMore,
      });
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
    const delivery = await Delivery.findById(req.params.deliveryId).lean();
    if (!delivery)
      return res.status(404).json({ message: "Delivery not found" });
    if (req.user!.role === "VENDOR" && !vendorOwnsDelivery(req, delivery)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json({
      success: true,
      delivery: serializeDeliveryLean(delivery as Record<string, unknown>),
    });
  },
);

router.patch(
  "/:deliveryId/status",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  async (req: AuthRequest, res) => {
    const { status: nextRaw, note, proofImage } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.deliveryId)) {
      return res.status(400).json({ message: "Invalid delivery id" });
    }
    const delivery = await Delivery.findById(req.params.deliveryId);
    if (!delivery)
      return res.status(404).json({ message: "Delivery not found" });
    if (req.user!.role === "VENDOR" && !vendorOwnsDelivery(req, delivery)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const cur = normalizeDeliveryStatus(delivery.status as string);
    const next = normalizeDeliveryStatus(nextRaw as string);

    if (next === DELIVERY_STATUS.VERIFIED) {
      return res.status(400).json({
        message: "Use PATCH /confirm with GPS — procurement officer only",
      });
    }

    const allowed =
      req.user!.role === "VENDOR"
        ? VENDOR_FORWARD[cur]?.includes(next)
        : DELIVERY_PATCH_FORWARD[cur]?.includes(next);

    if (!nextRaw || !allowed) {
      return res.status(400).json({
        message: `Invalid transition from ${cur} to ${nextRaw || "undefined"}`,
      });
    }

    if (req.user!.role === "VENDOR" && next === DELIVERY_STATUS.REJECTED) {
      return res
        .status(403)
        .json({ message: "Vendors cannot reject via this endpoint" });
    }

    if (next === DELIVERY_STATUS.INSPECTED && req.user!.role === "VENDOR") {
      return res
        .status(403)
        .json({ message: "Only staff can record inspection" });
    }

    applyOptionalVendorProofFromBody(delivery, proofImage);

    delivery.status = next as DeliveryStatus;
    if (next === DELIVERY_STATUS.READY_FOR_CONFIRMATION) {
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
    if (next === DELIVERY_STATUS.ACCEPTED) {
      ntype = "delivery_shipped";
      title = "Delivery accepted";
      body = `${ref} — ${vendorName} accepted the delivery.`;
    } else if (next === DELIVERY_STATUS.IN_TRANSIT) {
      ntype = "delivery_in_transit";
      title = "Delivery in transit";
      body = `${ref} — ${vendorName} marked the delivery in transit.`;
    } else if (next === DELIVERY_STATUS.READY_FOR_CONFIRMATION) {
      ntype = "delivery_delivered";
      title = "Ready for confirmation";
      body = `${ref} — ${vendorName} marked goods ready. Procurement: confirm receipt with GPS.`;
    }
    await notifyDeliveryEvent({
      title,
      body,
      vendorId: delivery.vendor as mongoose.Types.ObjectId,
      deliveryId: delivery._id as mongoose.Types.ObjectId,
      type: ntype,
      excludeUserId: req.user!._id,
    }).catch(() => {});

    invalidateStaffSummaryCache();
    res.json({ success: true, delivery: toDeliveryJson(delivery) });
  },
);

async function runGeoConfirm(
  req: AuthRequest,
  res: express.Response,
  delivery: IDelivery,
  opts: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
    capturedAt?: Date;
    notes?: string;
    receivedBy?: string;
    proofDataUrl?: string;
  },
) {
  if (!canProcurementGeoConfirm(delivery.status as string)) {
    return res.status(400).json({
      message:
        "Delivery must be READY_FOR_CONFIRMATION (vendor must complete prior steps)",
    });
  }

  const {
    lat,
    lng,
    accuracyMeters,
    capturedAt,
    notes,
    receivedBy,
    proofDataUrl,
  } = opts;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res
      .status(400)
      .json({ message: "Valid latitude and longitude are required" });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res
      .status(400)
      .json({ message: "Latitude/longitude out of valid range" });
  }
  if (
    Number.isFinite(accuracyMeters) &&
    Number(accuracyMeters) > MAX_CONFIRM_ACCURACY_METERS
  ) {
    return res.status(400).json({
      message: `Location accuracy is too low (${Math.round(
        Number(accuracyMeters),
      )} m). Move to an open area and retry (required: <= ${MAX_CONFIRM_ACCURACY_METERS} m).`,
    });
  }

  delivery.deliveryLocation = {
    type: "Point",
    coordinates: [lng, lat],
  };
  if (proofDataUrl) {
    delivery.deliveryProofImage = proofDataUrl;
  }

  const confirmedAt = new Date();
  const forwardedFor = String(req.headers["x-forwarded-for"] || "");
  const proxyIp = forwardedFor.split(",")[0]?.trim();
  const confirmedFromIp = proxyIp || req.ip || "";
  delivery.deliveredAt = confirmedAt;
  delivery.receivedData = {
    receivedDate: confirmedAt,
    receivedBy: receivedBy ?? req.user!.name ?? "Procurement officer",
    notes: notes ?? "",
    latitude: lat,
    longitude: lng,
    ...(Number.isFinite(accuracyMeters)
      ? { accuracyMeters: Number(accuracyMeters) }
      : {}),
    ...(capturedAt instanceof Date && !Number.isNaN(capturedAt.getTime())
      ? { capturedAt }
      : {}),
    ...(confirmedFromIp ? { confirmedFromIp } : {}),
  };
  delivery.actualDate = confirmedAt;
  delivery.status = DELIVERY_STATUS.VERIFIED as DeliveryStatus;

  appendHistory(
    delivery,
    DELIVERY_STATUS.VERIFIED,
    `Geo-verified receipt (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
    {
      _id: req.user!._id,
      name: req.user!.name,
    },
  );
  await delivery.save();

  const ref = delivery.orderReference || delivery.deliveryNumber;
  await notifyDeliveryEvent({
    title: "Delivery geo-verified",
    body: `${ref} — ${delivery.vendorName} confirmed with GPS audit trail.`,
    vendorId: delivery.vendor as mongoose.Types.ObjectId,
    deliveryId: delivery._id as mongoose.Types.ObjectId,
    type: "delivery_received",
    excludeUserId: req.user!._id,
  }).catch(() => {});

  invalidateStaffSummaryCache();
  return res.json({ success: true, delivery: toDeliveryJson(delivery) });
}

router.patch(
  "/:deliveryId/confirm",
  authenticate,
  authorize(["PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    if (!mongoose.isValidObjectId(req.params.deliveryId)) {
      return res.status(400).json({ message: "Invalid delivery id" });
    }
    const delivery = await Delivery.findById(req.params.deliveryId);
    if (!delivery)
      return res.status(404).json({ message: "Delivery not found" });

    const {
      latitude,
      longitude,
      accuracy,
      capturedAt,
      notes,
      receivedBy,
      proofImage,
    } = req.body || {};
    const lat = Number(latitude);
    const lng = Number(longitude);
    const accuracyMeters = Number(accuracy);
    const capturedAtDate = capturedAt ? new Date(capturedAt) : undefined;
    let proofDataUrl: string | undefined;
    if (
      typeof proofImage === "string" &&
      proofImage.startsWith("data:image/") &&
      proofImage.length < 6 * 1024 * 1024
    ) {
      proofDataUrl = proofImage;
    }

    return runGeoConfirm(req, res, delivery, {
      lat,
      lng,
      accuracyMeters,
      capturedAt: capturedAtDate,
      notes,
      receivedBy,
      proofDataUrl,
    });
  },
);

router.post(
  "/:deliveryId/confirm-delivery",
  authenticate,
  authorize(["PROCUREMENT_OFFICER"]),
  upload.single("deliveryProofImage"),
  async (req: AuthRequest, res) => {
    if (!mongoose.isValidObjectId(req.params.deliveryId)) {
      return res.status(400).json({ message: "Invalid delivery id" });
    }
    const delivery = await Delivery.findById(req.params.deliveryId);
    if (!delivery)
      return res.status(404).json({ message: "Delivery not found" });

    const { latitude, longitude, accuracy, capturedAt, notes, receivedBy } =
      req.body || {};
    const lat = Number(latitude);
    const lng = Number(longitude);
    const accuracyMeters = Number(accuracy);
    const capturedAtDate = capturedAt ? new Date(capturedAt) : undefined;
    const photoFile = req.file as Express.Multer.File | undefined;
    const proofDataUrl = photoFile ? fileToDataUrl(photoFile) : undefined;

    return runGeoConfirm(req, res, delivery, {
      lat,
      lng,
      accuracyMeters,
      capturedAt: capturedAtDate,
      notes,
      receivedBy,
      proofDataUrl,
    });
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
    const s = normalizeDeliveryStatus(delivery.status as string);
    const noDelay = new Set<DeliveryWorkflowStatus>([
      DELIVERY_STATUS.VERIFIED,
      DELIVERY_STATUS.INSPECTED,
      DELIVERY_STATUS.REJECTED,
    ]);
    if (noDelay.has(s)) {
      return res
        .status(400)
        .json({ message: "Cannot record delay after verification" });
    }
    delivery.delayReason = String(reason || "").trim() || "Delay recorded";
    delivery.delayRecordedAt = new Date();
    delivery.delayRecordedBy = req.user!._id;
    appendHistory(delivery, s, `Delay: ${delivery.delayReason}`, {
      _id: req.user!._id,
      name: req.user!.name,
    });
    await delivery.save();

    const ref = delivery.orderReference || delivery.deliveryNumber;
    await notifyDeliveryEvent({
      title: "Delivery delay recorded",
      body: `${ref} — ${delivery.vendorName}: ${delivery.delayReason}`,
      vendorId: delivery.vendor as mongoose.Types.ObjectId,
      deliveryId: delivery._id as mongoose.Types.ObjectId,
      type: "delivery_delayed",
      excludeUserId: req.user!._id,
    }).catch(() => {});

    invalidateStaffSummaryCache();
    res.json({ success: true, delivery: toDeliveryJson(delivery) });
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
      normalizeDeliveryStatus(delivery.status as string),
      `Comment: ${cleanNote}`,
      {
        _id: req.user!._id,
        name: req.user!.name,
      },
    );
    await delivery.save();

    res.json({ success: true, delivery: toDeliveryJson(delivery) });
  },
);

router.put(
  "/:deliveryId/receive",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (_req: AuthRequest, res) => {
    return res.status(403).json({
      message:
        "Receipt without GPS is disabled. Procurement officers must use PATCH /delivery/:id/confirm with browser geolocation.",
    });
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
    const s = normalizeDeliveryStatus(delivery.status as string);
    if (s !== DELIVERY_STATUS.VERIFIED) {
      return res.status(400).json({
        message: "Inspection is only allowed after geo-verification (VERIFIED)",
      });
    }
    const body = req.body || {};
    const inspectionData = body.inspectionData || body;
    delivery.inspectionData = {
      status: inspectionData.status ?? "inspected",
      notes: inspectionData.notes ?? "",
    };
    delivery.status = DELIVERY_STATUS.INSPECTED as DeliveryStatus;
    appendHistory(
      delivery,
      DELIVERY_STATUS.INSPECTED,
      inspectionData.notes ?? "Inspection recorded",
      {
        _id: req.user!._id,
        name: req.user!.name,
      },
    );
    await delivery.save();
    invalidateStaffSummaryCache();
    res.json({ success: true, delivery: toDeliveryJson(delivery) });
  },
);

export default router;
