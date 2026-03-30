import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import Bid from "../models/Bid";
import Tender from "../models/Tender";
import Vendor from "../models/Vendor";
import User from "../models/User";
import Notification from "../models/Notification";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { createAudit } from "../utils/auditLog";
import { ensurePaymentForAwardedBid } from "../utils/tenderAwardPayment";
import { isVendorApprovedForMarketplace } from "../utils/vendorGate";
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from "../utils/cursorPagination";

const router = Router();

const bidUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
});

function fileToDataUrl(file: Express.Multer.File): string {
  const b64 = file.buffer.toString("base64");
  return `data:${file.mimetype};base64,${b64}`;
}

function shapeVendor(v: unknown) {
  if (!v || typeof v !== "object") return null;
  const o =
    "toObject" in v && typeof (v as { toObject: () => unknown }).toObject === "function"
      ? (v as { toObject: () => Record<string, unknown> }).toObject()
      : { ...(v as Record<string, unknown>) };
  return {
    ...o,
    name: o.name,
  };
}

function refId(ref: unknown): string {
  if (ref && typeof ref === "object" && "_id" in ref) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
}

router.post(
  "/",
  authenticate,
  authorize(["VENDOR"]),
  bidUpload.array("documents", 10),
  async (req: AuthRequest, res) => {
    try {
      const {
        tenderId,
        amount,
        proposal,
        technicalProposal,
        financialProposal,
      } = req.body as Record<string, string | undefined>;

      if (!tenderId || amount === undefined) {
        return res.status(400).json({
          message: "Tender ID and amount are required.",
          success: false,
        });
      }

      const proposalText = String(proposal || technicalProposal || "").trim();
      if (!proposalText) {
        return res.status(400).json({
          message: "A written proposal is required for your quotation.",
          success: false,
        });
      }

      const tender = await Tender.findById(tenderId);
      if (!tender) {
        return res
          .status(404)
          .json({ message: "Tender not found.", success: false });
      }
      if (tender.status !== "PUBLISHED") {
        return res.status(400).json({
          message: "Tender is not open for quotations.",
          success: false,
        });
      }

      if (!req.user?.vendorProfile) {
        return res.status(400).json({
          message:
            "No vendor profile linked. Complete vendor registration first.",
          success: false,
        });
      }

      const vendorId = req.user.vendorProfile;
      const vendorDoc = await Vendor.findById(vendorId);
      if (!vendorDoc || !isVendorApprovedForMarketplace(vendorDoc)) {
        return res.status(403).json({
          message:
            "Vendor is not approved yet. Ask your NGO administrator to approve your registration.",
          success: false,
        });
      }

      const existing = await Bid.findOne({
        tender: tenderId,
        vendor: vendorId,
      });
      if (existing) {
        return res.status(400).json({
          message: "You have already submitted a quotation for this tender.",
          success: false,
        });
      }

      const files = (req.files as Express.Multer.File[] | undefined) || [];
      const documents = files.map((f) => ({
        name: f.originalname || "attachment",
        url: fileToDataUrl(f),
        uploadedAt: new Date(),
      }));

      const bid = await Bid.create({
        tender: tenderId,
        vendor: vendorId,
        amount: Number(amount),
        technicalProposal: proposalText,
        financialProposal: String(financialProposal || "").trim(),
        documents,
        status: "SUBMITTED",
      });

      await createAudit({
        req,
        action: "submit",
        entityType: "bid",
        entityId: bid._id,
        entityName: String(bid._id),
        description: "Tender quotation submitted",
        module: "bids",
        subModule: "submit",
        status: "success",
        details: { tenderId: tender._id, amount: bid.amount },
      });

      // Notify all procurement officers + admins (and tender creator if not already included)
      try {
        const staffUsers = await User.find({
          role: { $in: ["ADMIN", "PROCUREMENT_OFFICER"] },
          isActive: true,
        })
          .select("_id")
          .lean();

        const vendorName = vendorDoc.name || "A vendor";
        const link = `/tenders/${tenderId}`;
        const title = "New tender quotation";
        const body = `${vendorName} quoted NPR ${bid.amount.toLocaleString()} for "${tender.title}" (${tender.referenceNumber}).`;

        const seen = new Set<string>();
        const notifs = staffUsers
          .filter((u) => {
            const id = String(u._id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          })
          .map((u) => ({
            user: u._id,
            title,
            body,
            link,
            type: "bid_submitted" as const,
            read: false,
          }));

        if (notifs.length) {
          await Notification.insertMany(notifs);
        }
      } catch (notifyErr) {
        console.error("Bid submitted staff notifications failed", notifyErr);
      }

      return res.status(201).json({
        message: "Quotation submitted successfully.",
        bid,
        success: true,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: "Error submitting quotation.",
        success: false,
      });
    }
  },
);

router.get(
  "/my",
  authenticate,
  authorize(["VENDOR"]),
  async (req: AuthRequest, res) => {
    if (!req.user?.vendorProfile) {
      return res.json({ bids: [], success: true });
    }

    const vendorDoc = await Vendor.findById(req.user.vendorProfile);
    if (!isVendorApprovedForMarketplace(vendorDoc)) {
      return res.json({ bids: [], success: true });
    }

    const pageLimit = parseListLimit(req.query.limit, 25, 100);
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const base = { vendor: req.user.vendorProfile } as Record<string, unknown>;
    let merged: Record<string, unknown>;
    try {
      merged = mergeWithCursorFilter(base, cursor);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid cursor" });
    }
    const raw = await Bid.find(merged)
      .populate("tender", "title referenceNumber status closeDate")
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageLimit + 1)
      .select(
        "tender vendor amount status score technicalProposal financialProposal createdAt updatedAt",
      )
      .lean();
    const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
    return res.json({ bids: items, success: true, nextCursor, hasMore });
  },
);

router.get(
  "/me",
  authenticate,
  authorize(["VENDOR"]),
  async (req: AuthRequest, res) => {
    if (!req.user?.vendorProfile) {
      return res.json([]);
    }

    const vendorDoc = await Vendor.findById(req.user.vendorProfile);
    if (!isVendorApprovedForMarketplace(vendorDoc)) {
      return res.json([]);
    }
    const pageLimit = parseListLimit(req.query.limit, 25, 100);
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const base = { vendor: req.user.vendorProfile } as Record<string, unknown>;
    let merged: Record<string, unknown>;
    try {
      merged = mergeWithCursorFilter(base, cursor);
    } catch {
      return res.status(400).json({ message: "Invalid cursor" });
    }
    const raw = await Bid.find(merged)
      .populate("tender", "title referenceNumber status closeDate")
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageLimit + 1)
      .lean();
    const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
    res.json({ bids: items, nextCursor, hasMore });
  },
);

/** List all bids (Admin + Procurement Officer) — must be registered before GET /:id */
router.get(
  "/",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req, res) => {
    try {
      const pageLimit = parseListLimit(req.query.limit, 25, 100);
      const cursor =
        typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      let merged: Record<string, unknown>;
      try {
        merged = mergeWithCursorFilter({}, cursor);
      } catch {
        return res.status(400).json({
          message: "Invalid cursor",
          success: false,
        });
      }

      /** Staff monitor: no proposals/documents — load full bid on GET /bids/:id or tender page. */
      const raw = await Bid.find(merged)
        .populate("tender", "title referenceNumber status closeDate")
        .populate("vendor", "name")
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageLimit + 1)
        .select("tender vendor amount status createdAt updatedAt")
        .lean();

      const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
      const shaped = items.map((b) => ({
        ...b,
        vendor: shapeVendor(b.vendor),
      }));

      return res.json({
        bids: shaped,
        success: true,
        nextCursor,
        hasMore,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: "Error fetching bids.",
        success: false,
      });
    }
  },
);

router.get(
  "/tender/:tenderId",
  authenticate,
  authorize(["PROCUREMENT_OFFICER", "ADMIN"]),
  async (req, res) => {
    try {
      const bids = await Bid.find({ tender: req.params.tenderId })
        .populate(
          "vendor",
          "name email phoneNumber status category address",
        )
        .sort({ amount: 1, createdAt: -1 })
        .limit(150)
        .select(
          "tender vendor amount status score technicalProposal financialProposal documents createdAt updatedAt rejectionReason",
        )
        .lean();

      const shaped = bids.map((b) => ({
        ...b,
        vendor: shapeVendor(b.vendor),
      }));

      return res.status(200).json({
        bids: shaped,
        success: true,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({
        message: "Error fetching bids.",
        success: false,
      });
    }
  },
);

router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  const bid = await Bid.findById(req.params.id)
    .populate("vendor")
    .populate("tender");
  if (!bid) {
    return res.status(404).json({ message: "Bid not found", success: false });
  }

  const role = req.user?.role;
  if (role === "VENDOR") {
    const vid = req.user?.vendorProfile ? String(req.user.vendorProfile) : "";
    if (!vid || String(refId(bid.vendor)) !== vid) {
      return res.status(403).json({ message: "Forbidden", success: false });
    }
  }

  return res.json({
    ...bid.toObject(),
    vendor: shapeVendor(bid.vendor),
    success: true,
  });
});

router.patch(
  "/:id/evaluate",
  authenticate,
  authorize(["PROCUREMENT_OFFICER", "ADMIN"]),
  async (req, res) => {
    const { status, score } = req.body;
    if (status === "ACCEPTED") {
      return res.status(400).json({
        message: "Use PATCH /:id/accept to award a quotation.",
        success: false,
      });
    }
    const bid = await Bid.findByIdAndUpdate(
      req.params.id,
      { status, score },
      { new: true },
    );
    if (!bid)
      return res.status(404).json({ message: "Bid not found", success: false });
    res.json({ bid, success: true });
  },
);

router.patch(
  "/:id/accept",
  authenticate,
  authorize(["PROCUREMENT_OFFICER", "ADMIN"]),
  async (req: AuthRequest, res) => {
    try {
      const bid = await Bid.findById(req.params.id).populate("tender");
      if (!bid) {
        return res
          .status(404)
          .json({ message: "Bid not found", success: false });
      }

      const tenderDoc = await Tender.findById(refId(bid.tender));
      if (!tenderDoc) {
        return res
          .status(404)
          .json({ message: "Tender not found", success: false });
      }

      await Bid.updateMany(
        { tender: tenderDoc._id, _id: { $ne: bid._id } },
        { status: "REJECTED" },
      );

      bid.status = "ACCEPTED";
      await bid.save();

      tenderDoc.status = "AWARDED";
      tenderDoc.awardedVendor = new mongoose.Types.ObjectId(refId(bid.vendor));
      await tenderDoc.save();

      await ensurePaymentForAwardedBid(bid, tenderDoc, req.user?._id);

      const vendorUser = await User.findOne({
        vendorProfile: new mongoose.Types.ObjectId(refId(bid.vendor)),
      });
      if (vendorUser) {
        await Notification.create({
          user: vendorUser._id,
          title: "Quotation accepted",
          body: `Your quotation for "${tenderDoc.title}" was accepted and the tender has been awarded to you.`,
          link: `/tenders/${tenderDoc._id}`,
          type: "bid_accepted",
        });
      }

      await createAudit({
        req,
        action: "accept",
        entityType: "bid",
        entityId: bid._id,
        entityName: String(bid._id),
        description: "Quotation accepted and tender awarded",
        module: "bids",
        subModule: "accept",
        status: "success",
        details: { tenderId: tenderDoc._id },
      });

      return res.json({ bid, tender: tenderDoc, success: true });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Failed to accept bid", success: false });
    }
  },
);

router.patch(
  "/:id/reject",
  authenticate,
  authorize(["PROCUREMENT_OFFICER", "ADMIN"]),
  async (req: AuthRequest, res) => {
    try {
      const { rejectionReason } = req.body;
      const bid = await Bid.findByIdAndUpdate(
        req.params.id,
        { status: "REJECTED", rejectionReason: rejectionReason || "" },
        { new: true },
      );
      if (!bid) {
        return res
          .status(404)
          .json({ message: "Bid not found", success: false });
      }

      const vendorUser = await User.findOne({
        vendorProfile: new mongoose.Types.ObjectId(refId(bid.vendor)),
      });
      if (vendorUser) {
        await Notification.create({
          user: vendorUser._id,
          title: "Quotation not selected",
          body: `Your quotation was not selected for this tender.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
          link: `/my-bids`,
          type: "bid_rejected",
        });
      }

      await createAudit({
        req,
        action: "reject",
        entityType: "bid",
        entityId: bid._id,
        entityName: String(bid._id),
        description: "Bid rejected",
        module: "bids",
        subModule: "reject",
        status: "success",
        details: { rejectionReason: rejectionReason || "" },
      });

      return res.json({ bid, success: true });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Failed to reject bid", success: false });
    }
  },
);

router.delete("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const bid = await Bid.findById(req.params.id).populate("tender");
    if (!bid) {
      return res.status(404).json({ message: "Bid not found", success: false });
    }

    const tenderDoc = await Tender.findById(refId(bid.tender));
    if (!tenderDoc) {
      return res
        .status(404)
        .json({ message: "Tender not found", success: false });
    }

    const role = req.user?.role;

    if (role === "VENDOR") {
      const vendorId = req.user?.vendorProfile
        ? String(req.user.vendorProfile)
        : "";
      if (!vendorId || String(refId(bid.vendor)) !== vendorId) {
        return res
          .status(403)
          .json({
            message: "You can only delete your own bids.",
            success: false,
          });
      }
      if (tenderDoc.status !== "PUBLISHED") {
        return res.status(400).json({
          message: "You can only withdraw a bid while the tender is published.",
          success: false,
        });
      }
      if (bid.status !== "SUBMITTED") {
        return res.status(400).json({
          message: "Only pending bids can be withdrawn.",
          success: false,
        });
      }
    } else if (role !== "ADMIN" && role !== "PROCUREMENT_OFFICER") {
      return res.status(403).json({ message: "Forbidden", success: false });
    }

    await Bid.deleteOne({ _id: bid._id });

    await createAudit({
      req,
      action: "delete",
      entityType: "bid",
      entityId: bid._id,
      entityName: String(bid._id),
      description: "Bid deleted",
      module: "bids",
      subModule: "delete",
      status: "success",
      details: { tenderId: tenderDoc._id },
    });

    return res.json({ message: "Bid deleted.", success: true });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Failed to delete bid", success: false });
  }
});

export default router;
