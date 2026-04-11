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
import { vendorMayAccessMarketplace } from "../utils/vendorGate";
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from "../utils/cursorPagination";
import { roleTargetFromUserRole } from "../utils/notificationRoleTarget";

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

function hasTenderClosed(tender: { closeDate?: Date | string }): boolean {
  const close = tender?.closeDate ? new Date(tender.closeDate).getTime() : 0;
  return Number.isFinite(close) && close > 0 ? Date.now() > close : false;
}

function normalizeRequiredDocuments(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x || "").trim()).filter(Boolean);
}

function parseOptionalAmount(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Optional non-negative delivery lead time in days (quotation comparison). */
function parseOptionalDeliveryDays(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(Math.round(n), 3650);
}

function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

function missingRequiredDocuments(
  required: string[],
  docs: Array<{ name?: string }>,
): string[] {
  if (!required.length) return [];
  const names = docs.map((d) => String(d?.name || "").toLowerCase());
  return required.filter((need) => {
    const n = need.toLowerCase();
    return !names.some((name) => name.includes(n));
  });
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

      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return res.status(400).json({
          message: "A valid quoted total amount is required.",
          success: false,
        });
      }

      const excl = parseOptionalAmount(
        (req.body as Record<string, unknown>).amountExcludingVat,
      );
      const vatAmt = parseOptionalAmount(
        (req.body as Record<string, unknown>).vatAmount,
      );
      const vatRateVal = parseOptionalAmount(
        (req.body as Record<string, unknown>).vatRate,
      );
      const deliveryDaysOffer = parseOptionalDeliveryDays(
        (req.body as Record<string, unknown>).deliveryDaysOffer,
      );

      let grand = roundMoney2(amountNum);
      if (excl !== undefined && vatAmt !== undefined) {
        const sum = roundMoney2(excl + vatAmt);
        if (Math.abs(sum - grand) > 0.02) {
          return res.status(400).json({
            message:
              "Quoted total does not match amount excluding VAT plus VAT.",
            success: false,
          });
        }
        grand = sum;
      }

      const proposalText = String(proposal || technicalProposal || "").trim();
      if (!proposalText) {
        return res.status(400).json({
          message: "A written proposal is required for your quotation.",
          success: false,
        });
      }

      const tender = await Tender.findById(tenderId).select(
        "_id title referenceNumber status closeDate requiredDocuments",
      );
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
      const mayBid = await vendorMayAccessMarketplace(vendorId);
      if (!mayBid) {
        return res.status(403).json({
          message:
            "Vendor is not approved yet. Ask your NGO administrator to approve your registration.",
          success: false,
        });
      }
      const vendorDoc = await Vendor.findById(vendorId).select("name").lean();
      if (!vendorDoc) {
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

      const files = (req.files as Express.Multer.File[] | undefined) || [];
      const uploadedDocuments = files.map((f) => ({
        name: f.originalname || "attachment",
        url: fileToDataUrl(f),
        uploadedAt: new Date(),
      }));

      const mergedDocuments = existing
        ? uploadedDocuments.length
          ? uploadedDocuments
          : (existing.documents || [])
        : uploadedDocuments;

      const requiredDocs = normalizeRequiredDocuments(
        (tender as unknown as { requiredDocuments?: unknown }).requiredDocuments,
      );
      const missingDocs = missingRequiredDocuments(requiredDocs, mergedDocuments);
      if (missingDocs.length > 0) {
        return res.status(400).json({
          message: `Missing required documents: ${missingDocs.join(", ")}`,
          success: false,
          missingRequiredDocuments: missingDocs,
        });
      }

      let bid;
      let isFirstSubmission = false;
      if (existing) {
        if (hasTenderClosed(tender)) {
          return res.status(400).json({
            message: "Tender deadline has passed. Quotation can no longer be edited.",
            success: false,
          });
        }
        if (existing.status === "ACCEPTED" || existing.status === "REJECTED") {
          return res.status(400).json({
            message: "This quotation is finalized and cannot be edited.",
            success: false,
          });
        }
        existing.versionHistory = existing.versionHistory || [];
        existing.versionHistory.push({
          editedAt: new Date(),
          editedBy: req.user!._id as any,
          amount: Number(existing.amount || 0),
          deliveryDaysOffer: existing.deliveryDaysOffer,
          technicalProposal: String(existing.technicalProposal || ""),
          financialProposal: String(existing.financialProposal || ""),
          documents: (existing.documents || []).map((d) => ({
            name: d.name,
            url: d.url,
            uploadedAt: d.uploadedAt || new Date(),
          })),
        } as any);
        existing.amount = grand;
        if (deliveryDaysOffer !== undefined) {
          existing.deliveryDaysOffer = deliveryDaysOffer;
        }
        existing.amountExcludingVat = excl;
        existing.vatAmount = vatAmt;
        existing.vatRate = vatRateVal;
        existing.technicalProposal = proposalText;
        existing.financialProposal = String(financialProposal || "").trim();
        existing.documents = mergedDocuments as any;
        existing.isDraft = false;
        if (!existing.submittedAt) existing.submittedAt = new Date();
        bid = await existing.save();
      } else {
        isFirstSubmission = true;
        bid = await Bid.create({
          tender: tenderId,
          vendor: vendorId,
          amount: grand,
          amountExcludingVat: excl,
          vatAmount: vatAmt,
          vatRate: vatRateVal,
          technicalProposal: proposalText,
          financialProposal: String(financialProposal || "").trim(),
          documents: mergedDocuments,
          deliveryDaysOffer,
          status: "SUBMITTED",
          isDraft: false,
          submittedAt: new Date(),
        });
      }

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

      // Notify staff only on first submission (not for edits).
      try {
        if (!isFirstSubmission) {
          return res.status(200).json({
            message: "Quotation updated successfully.",
            bid,
            success: true,
          });
        }
        const staffUsers = await User.find({
          role: { $in: ["ADMIN", "PROCUREMENT_OFFICER"] },
          isActive: true,
        })
          .select("_id role")
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
            referenceId: tender._id,
            roleTarget: roleTargetFromUserRole(u.role),
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

router.post(
  "/draft",
  authenticate,
  authorize(["VENDOR"]),
  bidUpload.array("documents", 10),
  async (req: AuthRequest, res) => {
    try {
      const { tenderId, amount, proposal, technicalProposal, financialProposal } =
        req.body as Record<string, string | undefined>;
      const exclDraft = parseOptionalAmount(
        (req.body as Record<string, unknown>).amountExcludingVat,
      );
      const vatAmtDraft = parseOptionalAmount(
        (req.body as Record<string, unknown>).vatAmount,
      );
      const vatRateDraft = parseOptionalAmount(
        (req.body as Record<string, unknown>).vatRate,
      );
      const deliveryDaysDraft = parseOptionalDeliveryDays(
        (req.body as Record<string, unknown>).deliveryDaysOffer,
      );

      let resolvedGrand: number | undefined;
      if (amount !== undefined && String(amount).trim() !== "") {
        const n = Number(amount);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ message: "Invalid amount.", success: false });
        }
        resolvedGrand = roundMoney2(n);
        if (exclDraft !== undefined && vatAmtDraft !== undefined) {
          const sum = roundMoney2(exclDraft + vatAmtDraft);
          if (Math.abs(sum - resolvedGrand) > 0.02) {
            return res.status(400).json({
              message: "Total does not match amount excluding VAT plus VAT.",
              success: false,
            });
          }
          resolvedGrand = sum;
        }
      }

      if (!tenderId) {
        return res.status(400).json({ message: "Tender ID is required.", success: false });
      }
      const tender = await Tender.findById(tenderId).select("_id status closeDate");
      if (!tender) {
        return res.status(404).json({ message: "Tender not found.", success: false });
      }
      if (tender.status !== "PUBLISHED") {
        return res.status(400).json({
          message: "Tender is not open for quotations.",
          success: false,
        });
      }
      if (hasTenderClosed(tender)) {
        return res.status(400).json({
          message: "Tender deadline has passed.",
          success: false,
        });
      }
      if (!req.user?.vendorProfile) {
        return res.status(400).json({
          message: "No vendor profile linked. Complete vendor registration first.",
          success: false,
        });
      }

      const mayBid = await vendorMayAccessMarketplace(req.user.vendorProfile);
      if (!mayBid) {
        return res.status(403).json({
          message: "Vendor is not approved yet.",
          success: false,
        });
      }

      const files = (req.files as Express.Multer.File[] | undefined) || [];
      const uploadedDocuments = files.map((f) => ({
        name: f.originalname || "attachment",
        url: fileToDataUrl(f),
        uploadedAt: new Date(),
      }));
      const proposalText = String(proposal || technicalProposal || "").trim();

      const existing = await Bid.findOne({
        tender: tenderId,
        vendor: req.user.vendorProfile,
      });
      if (existing && (existing.status === "ACCEPTED" || existing.status === "REJECTED")) {
        return res.status(400).json({
          message: "This quotation is finalized and cannot be edited.",
          success: false,
        });
      }

      let draft;
      if (existing) {
        existing.versionHistory = existing.versionHistory || [];
        existing.versionHistory.push({
          editedAt: new Date(),
          editedBy: req.user!._id as any,
          amount: Number(existing.amount || 0),
          deliveryDaysOffer: existing.deliveryDaysOffer,
          technicalProposal: String(existing.technicalProposal || ""),
          financialProposal: String(existing.financialProposal || ""),
          documents: (existing.documents || []).map((d) => ({
            name: d.name,
            url: d.url,
            uploadedAt: d.uploadedAt || new Date(),
          })),
        } as any);
        if (resolvedGrand !== undefined) {
          existing.amount = resolvedGrand;
          existing.amountExcludingVat = exclDraft;
          existing.vatAmount = vatAmtDraft;
          existing.vatRate = vatRateDraft;
        }
        if (deliveryDaysDraft !== undefined) {
          existing.deliveryDaysOffer = deliveryDaysDraft;
        }
        existing.technicalProposal = proposalText || String(existing.technicalProposal || "");
        existing.financialProposal = String(
          financialProposal || existing.financialProposal || "",
        ).trim();
        if (uploadedDocuments.length > 0) {
          existing.documents = uploadedDocuments as any;
        }
        existing.isDraft = true;
        draft = await existing.save();
      } else {
        draft = await Bid.create({
          tender: tenderId,
          vendor: req.user.vendorProfile,
          amount: resolvedGrand ?? Number(amount || 0),
          amountExcludingVat: exclDraft,
          vatAmount: vatAmtDraft,
          vatRate: vatRateDraft,
          technicalProposal: proposalText,
          financialProposal: String(financialProposal || "").trim(),
          documents: uploadedDocuments,
          deliveryDaysOffer: deliveryDaysDraft,
          status: "SUBMITTED",
          isDraft: true,
        });
      }

      return res.json({
        message: "Draft saved.",
        bid: draft,
        success: true,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to save draft.", success: false });
    }
  },
);

router.get(
  "/draft/:tenderId",
  authenticate,
  authorize(["VENDOR"]),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user?.vendorProfile) return res.json({ bid: null, success: true });
      const bid = await Bid.findOne({
        tender: req.params.tenderId,
        vendor: req.user.vendorProfile,
      })
        .select(
          "tender vendor amount amountExcludingVat vatAmount vatRate deliveryDaysOffer technicalProposal financialProposal documents status isDraft versionHistory updatedAt submittedAt",
        )
        .lean();
      if (!bid || !bid.isDraft) {
        return res.json({ bid: null, success: true });
      }
      return res.json({ bid, success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to load draft.", success: false });
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

    const mayBid = await vendorMayAccessMarketplace(req.user.vendorProfile);
    if (!mayBid) {
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
        "tender vendor amount amountExcludingVat vatAmount vatRate status score technicalProposal financialProposal documents isDraft submittedAt versionHistory createdAt updatedAt",
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

    const mayBid = await vendorMayAccessMarketplace(req.user.vendorProfile);
    if (!mayBid) {
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
      .select(
        "tender vendor amount amountExcludingVat vatAmount vatRate status score technicalProposal financialProposal documents isDraft submittedAt versionHistory createdAt updatedAt",
      )
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
          "tender vendor amount amountExcludingVat vatAmount vatRate deliveryDaysOffer status score technicalProposal financialProposal documents createdAt updatedAt rejectionReason",
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
        message: "Use PATCH /:id/accept to select a preferred quotation.",
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

      if (tenderDoc.status === "AWARDED") {
        return res.status(400).json({
          message:
            "This tender is already awarded. Selection cannot be changed here.",
          success: false,
        });
      }

      if (tenderDoc.status !== "PUBLISHED" && tenderDoc.status !== "CLOSED") {
        return res.status(400).json({
          message:
            "Quotations can only be selected while the tender is published or closed.",
          success: false,
        });
      }

      if (
        !["SUBMITTED", "UNDER_REVIEW", "REJECTED", "ACCEPTED"].includes(
          bid.status,
        )
      ) {
        return res.status(400).json({
          message: "This quotation cannot be selected in its current state.",
          success: false,
        });
      }

      const AUTO_REJECT_REASON =
        "Another quotation was selected as the preferred offer.";

      /** All competing quotations that are still in play become rejected when one is selected. */
      const otherActive = await Bid.find({
        tender: tenderDoc._id,
        _id: { $ne: bid._id },
        status: { $in: ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED"] },
      }).lean();

      if (otherActive.length > 0) {
        await Bid.updateMany(
          {
            tender: tenderDoc._id,
            _id: { $ne: bid._id },
            status: { $in: ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED"] },
          },
          {
            $set: {
              status: "REJECTED",
              rejectionReason: AUTO_REJECT_REASON,
            },
          },
        );

        for (const ob of otherActive) {
          const vendorUser = await User.findOne({
            vendorProfile: new mongoose.Types.ObjectId(refId(ob.vendor)),
          });
          if (vendorUser) {
            await Notification.create({
              user: vendorUser._id,
              title: "Quotation not selected",
              body: `Your quotation for "${tenderDoc.title}" was not selected. ${AUTO_REJECT_REASON}`,
              link: `/my-bids`,
              type: "bid_rejected",
              referenceId: ob._id,
              roleTarget: "VENDOR",
            });
          }
        }

        await createAudit({
          req,
          action: "reject",
          entityType: "tender",
          entityId: tenderDoc._id,
          entityName: tenderDoc.title || String(tenderDoc._id),
          description: `Auto-rejected ${otherActive.length} quotation(s) after selecting a preferred offer`,
          module: "bids",
          subModule: "accept_auto_reject",
          status: "success",
          details: {
            tenderId: tenderDoc._id,
            selectedBidId: bid._id,
            rejectedBidIds: otherActive.map((b) => b._id),
          },
        });
      }

      bid.status = "ACCEPTED";
      if (bid.rejectionReason) bid.rejectionReason = "";
      await bid.save();

      const vendorUser = await User.findOne({
        vendorProfile: new mongoose.Types.ObjectId(refId(bid.vendor)),
      });
      if (vendorUser) {
        await Notification.create({
          user: vendorUser._id,
          title: "Quotation selected",
          body: `Your quotation for "${tenderDoc.title}" was selected as the preferred offer. Procurement may finalize the award in a separate step.`,
          link: `/my-bids?openBid=${bid._id}`,
          type: "bid_accepted",
          referenceId: bid._id,
          roleTarget: "VENDOR",
        });
      }

      await createAudit({
        req,
        action: "accept",
        entityType: "bid",
        entityId: bid._id,
        entityName: String(bid._id),
        description: "Preferred quotation selected (tender not awarded yet)",
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
        .json({ message: "Failed to select quotation", success: false });
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
          referenceId: bid._id,
          roleTarget: "VENDOR",
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
