import express from "express";
import mongoose from "mongoose";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import PurchaseRequest, {
  PurchaseRequestStatus,
  PurchaseRequestPriority,
} from "../models/PurchaseRequest";
import Approval from "../models/Approval";
import User, { IUser } from "../models/User";
import Notification from "../models/Notification";
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from "../utils/cursorPagination";

const router = express.Router();
const TRASH_RETENTION_DAYS = 5;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

async function purgeExpiredPurchaseRequestTrash(): Promise<void> {
  const now = new Date();
  await PurchaseRequest.deleteMany({
    isDeleted: true,
    trashPurgeAt: { $lte: now },
  });
}

const shapeRequester = (user: IUser | null) => {
  if (!user) return null;
  return {
    _id: user._id,
    fullname: user.name,
    email: user.email,
    role: user.role,
  };
};

/** Prefer an ADMIN; if none, assign another PROCUREMENT_OFFICER (not the requester). */
async function resolveApprovalAssignee(
  prRequesterId: unknown,
): Promise<
  | { assignee: IUser; approverRole: "ADMIN" | "PROCUREMENT_OFFICER" }
  | { error: string }
> {
  const admin = await User.findOne({ role: "ADMIN" }).sort({ createdAt: 1 });
  if (admin) {
    return { assignee: admin as IUser, approverRole: "ADMIN" };
  }
  const otherOfficer = await User.findOne({
    role: "PROCUREMENT_OFFICER",
    _id: { $ne: prRequesterId },
  }).sort({ createdAt: 1 });
  if (otherOfficer) {
    return {
      assignee: otherOfficer as IUser,
      approverRole: "PROCUREMENT_OFFICER",
    };
  }
  return {
    error:
      "No approver available. Create an admin (run `npm run seed` in backend) or add another procurement officer.",
  };
}

async function notifyPrSubmitted(pr: any, actorUserId: any): Promise<void> {
  const recipients = await User.find({
    _id: { $ne: actorUserId },
    $or: [{ role: "ADMIN" }, { role: "PROCUREMENT_OFFICER" }],
  }).select("_id");
  if (!recipients.length) return;
  await Notification.insertMany(
    recipients.map((u) => ({
      user: u._id,
      title: "Purchase request submitted",
      body: `${pr.requestNumber}: ${pr.title} is waiting for admin approval.`,
      link: "/approvals",
      type: "purchase_request_submitted",
    })),
  );
}

type ResolvedApprover = {
  assignee: IUser;
  approverRole: "ADMIN" | "PROCUREMENT_OFFICER";
};

/** Shared by `/:id/submit`, `POST /create` + `PUT /:id` when `submitForApproval` is true. */
async function finalizePurchaseRequestSubmission(
  pr: InstanceType<typeof PurchaseRequest>,
  actorUserId: mongoose.Types.ObjectId,
  resolved: ResolvedApprover,
) {
  const { assignee, approverRole } = resolved;

  pr.status = "pending_approval";
  await pr.save();

  const requesterDoc = await User.findById(pr.requester);

  const existingApproval = await Approval.findOne({
    purchaseRequest: pr._id,
    status: "pending",
  });
  if (existingApproval) {
    await notifyPrSubmitted(pr, actorUserId);
    return { approval: existingApproval.toObject() };
  }

  const approval = new Approval({
    entityType: "purchase_request",
    entityId: pr._id,
    purchaseRequest: pr._id,
    requester: pr.requester,
    requesterName: requesterDoc?.name ?? "Unknown",
    requesterDepartment: pr.department,
    title: pr.title,
    description: pr.description,
    amount: pr.totalEstimatedAmount,
    currency: "NPR",
    priority: pr.priority,
    approverRole,
    currentApprover: assignee._id,
    status: "pending",
  });
  await approval.save();

  await notifyPrSubmitted(pr, actorUserId);

  return { approval: approval.toObject() };
}

function wantsSubmitFlag(raw: unknown): boolean {
  return raw === true || raw === "true" || raw === 1 || raw === "1";
}

// Create purchase request
router.post(
  "/create",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    const {
      title,
      description,
      department,
      items,
      requiredDate,
      deliveryLocation,
      justification,
      priority,
      notes,
      status,
      submitForApproval,
    } = req.body || {};

    const pr = new PurchaseRequest({
      title,
      description,
      requester: req.user?._id,
      department,
      items: Array.isArray(items) ? items : [],
      requiredDate: requiredDate ? new Date(requiredDate) : new Date(),
      deliveryLocation,
      justification,
      priority: priority as PurchaseRequestPriority,
      notes,
      status: (status as PurchaseRequestStatus) || "draft",
    });

    await pr.save();

    let approval: object | undefined;
    if (wantsSubmitFlag(submitForApproval)) {
      const resolved = await resolveApprovalAssignee(pr.requester);
      if ("error" in resolved) {
        return res.status(400).json({
          success: false,
          message: resolved.error,
        });
      }
      const out = await finalizePurchaseRequestSubmission(
        pr,
        req.user!._id,
        resolved,
      );
      approval = out.approval;
    }

    const requesterDoc = await User.findById(pr.requester);
    return res.status(201).json({
      success: true,
      purchaseRequest: {
        ...pr.toObject(),
        requester: shapeRequester(requesterDoc),
      },
      ...(approval ? { approval } : {}),
    });
  },
);

async function listPurchaseRequestsHandler(req: AuthRequest, res: express.Response) {
  try {
    await purgeExpiredPurchaseRequestTrash();
    const pageLimit = parseListLimit(req.query.limit, 50, 100);
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const status =
      typeof req.query.status === "string" && req.query.status
        ? req.query.status
        : undefined;
    const trashMode =
      req.query.trash === "1" ||
      req.query.trash === "true" ||
      req.query.view === "trash";

    const filter: Record<string, unknown> = status ? { status } : {};
    filter.isDeleted = trashMode ? true : { $ne: true };
    if (req.user?.role === "VENDOR") {
      filter.requester = req.user._id;
      filter.isDeleted = { $ne: true };
    }

    let merged: Record<string, unknown>;
    try {
      merged = mergeWithCursorFilter(filter, cursor);
    } catch {
      return res
        .status(400)
        .json({ success: false, message: "Invalid cursor" });
    }

    const raw = await PurchaseRequest.find(merged)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageLimit + 1)
      .select(
        "requestNumber title description department status priority requiredDate deliveryLocation totalEstimatedAmount requester createdAt updatedAt items isDeleted deletedAt trashPurgeAt",
      )
      .lean();

    const { items: prs, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);

    const requesterIds = Array.from(
      new Set(prs.map((p) => String(p.requester))),
    );
    const users = await User.find({ _id: { $in: requesterIds } }).select(
      "name email role",
    );
    const userById = new Map(users.map((u) => [String(u._id), u]));

    const purchaseRequests = prs.map((p) => {
      const { items: lineItems, ...rest } = p as typeof p & {
        items?: unknown[];
      };
      const itemsCount = Array.isArray(lineItems) ? lineItems.length : 0;
      return {
        ...rest,
        itemsCount,
        requester: shapeRequester(userById.get(String(p.requester)) ?? null),
      };
    });

    res.json({
      success: true,
      purchaseRequests,
      nextCursor,
      hasMore,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("GET purchase-requests list", err);
    return res.status(500).json({ success: false, message });
  }
}

router.get(
  "/list",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  listPurchaseRequestsHandler,
);

// List purchase requests
router.get(
  "/",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  listPurchaseRequestsHandler,
);

// My purchase requests (creator)
router.get(
  "/my",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    await purgeExpiredPurchaseRequestTrash();
    const pageLimit = parseListLimit(req.query.limit, 50, 100);
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const base = {
      requester: req.user?._id,
      isDeleted: { $ne: true },
    } as Record<string, unknown>;
    let merged: Record<string, unknown>;
    try {
      merged = mergeWithCursorFilter(base, cursor);
    } catch {
      return res
        .status(400)
        .json({ success: false, message: "Invalid cursor" });
    }

    const raw = await PurchaseRequest.find(merged)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageLimit + 1)
      .select(
        "requestNumber title description department status priority requiredDate deliveryLocation totalEstimatedAmount requester createdAt updatedAt items isDeleted deletedAt trashPurgeAt",
      )
      .lean();

    const { items: prs, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);

    const requesterDoc = await User.findById(req.user?._id).select(
      "name email role",
    );
    res.json({
      success: true,
      purchaseRequests: prs.map((p) => {
        const { items: lineItems, ...rest } = p as typeof p & {
          items?: unknown[];
        };
        const itemsCount = Array.isArray(lineItems) ? lineItems.length : 0;
        return {
          ...rest,
          itemsCount,
          requester: shapeRequester(requesterDoc),
        };
      }),
      nextCursor,
      hasMore,
    });
  },
);

router.get(
  "/stats",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (_req: AuthRequest, res) => {
    await purgeExpiredPurchaseRequestTrash();
    const [total, pending, approved] = await Promise.all([
      PurchaseRequest.countDocuments({ isDeleted: { $ne: true } }),
      PurchaseRequest.countDocuments({
        status: "pending_approval",
        isDeleted: { $ne: true },
      }),
      PurchaseRequest.countDocuments({
        status: "approved",
        isDeleted: { $ne: true },
      }),
    ]);
    res.json({
      success: true,
      stats: {
        total,
        pending,
        approved,
      },
    });
  },
);

router.get(
  "/:id",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  async (req: AuthRequest, res) => {
    try {
      await purgeExpiredPurchaseRequestTrash();
      const id = req.params.id;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid purchase request id" });
      }

      const pr = await PurchaseRequest.findById(id).lean();
      if (!pr)
        return res.status(404).json({ message: "Purchase request not found" });
      if (
        (pr as any).isDeleted &&
        !(req.query.includeTrash === "1" || req.query.includeTrash === "true")
      ) {
        return res.status(404).json({ message: "Purchase request not found" });
      }

      // Basic access control for vendor: only allow their own PR.
      if (req.user?.role === "VENDOR") {
        const isOwner = String(pr.requester) === String(req.user?._id);
        if (!isOwner) return res.status(403).json({ message: "Forbidden" });
      }

      const requesterDoc = await User.findById(pr.requester);

      let pendingApprovalId: string | undefined;
      if (
        pr.status === "pending_approval" &&
        (req.user?.role === "ADMIN" || req.user?.role === "PROCUREMENT_OFFICER")
      ) {
        const pending = await Approval.findOne({
          purchaseRequest: pr._id,
          status: "pending",
        })
          .select("_id")
          .lean();
        if (pending?._id) pendingApprovalId = String(pending._id);
      }

      return res.json({
        success: true,
        purchaseRequest: {
          ...pr,
          requester: shapeRequester(requesterDoc),
          pendingApprovalId,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Internal error";
      console.error("GET purchase-request :id", err);
      return res.status(500).json({ message: "Could not load purchase request", error: message });
    }
  },
);

router.put(
  "/:id",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    const pr = await PurchaseRequest.findById(req.params.id);
    if ((pr as any).isDeleted) {
      return res.status(400).json({ message: "Cannot edit an item in trash" });
    }
    if (!pr)
      return res.status(404).json({ message: "Purchase request not found" });
    if (req.user?.role === "PROCUREMENT_OFFICER") {
      if (String(pr.requester) !== String(req.user?._id)) {
        return res
          .status(403)
          .json({ message: "You can only edit your own requests" });
      }
      if (!["draft", "rejected", "pending_approval"].includes(pr.status)) {
        return res
          .status(400)
          .json({
            message: "Only draft, rejected, or pending requests can be edited",
          });
      }
    }
    const wasPending = pr.status === "pending_approval";

    const {
      title,
      description,
      department,
      items,
      requiredDate,
      deliveryLocation,
      justification,
      priority,
      notes,
      status,
      submitForApproval,
    } = req.body || {};

    pr.title = title ?? pr.title;
    pr.description = description ?? pr.description;
    pr.department = department ?? pr.department;
    pr.items = Array.isArray(items) ? items : pr.items;
    if (requiredDate) pr.requiredDate = new Date(requiredDate);
    pr.deliveryLocation = deliveryLocation ?? pr.deliveryLocation;
    pr.justification = justification ?? pr.justification;
    pr.priority = (priority as PurchaseRequestPriority) ?? pr.priority;
    pr.notes = notes ?? pr.notes;
    if (status) pr.status = status as PurchaseRequestStatus;
    if (wasPending) {
      // Any edit to pending request moves it back to draft.
      pr.status = "draft";
    }

    await pr.save();
    if (wasPending) {
      await Approval.updateMany(
        { purchaseRequest: pr._id, status: "pending" },
        {
          status: "cancelled",
          comments: "Auto-cancelled because PR was edited",
        },
      );
    }

    let approval: object | undefined;
    if (wantsSubmitFlag(submitForApproval)) {
      const resolved = await resolveApprovalAssignee(pr.requester);
      if ("error" in resolved) {
        return res.status(400).json({
          success: false,
          message: resolved.error,
        });
      }
      const out = await finalizePurchaseRequestSubmission(
        pr,
        req.user!._id,
        resolved,
      );
      approval = out.approval;
    }

    const requesterDoc = await User.findById(pr.requester);
    return res.json({
      success: true,
      purchaseRequest: {
        ...pr.toObject(),
        requester: shapeRequester(requesterDoc),
      },
      ...(approval ? { approval } : {}),
    });
  },
);

router.put(
  "/:id/submit",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    const pr = await PurchaseRequest.findById(req.params.id);
    if ((pr as any).isDeleted) {
      return res
        .status(400)
        .json({ message: "Cannot submit an item that is in trash" });
    }
    if (!pr)
      return res.status(404).json({ message: "Purchase request not found" });

    const resolved = await resolveApprovalAssignee(pr.requester);
    if ("error" in resolved) {
      return res.status(400).json({ message: resolved.error });
    }

    const { approval } = await finalizePurchaseRequestSubmission(
      pr,
      req.user!._id,
      resolved,
    );

    return res.json({
      success: true,
      purchaseRequest: pr.toObject(),
      approval,
    });
  },
);

router.put(
  "/:id/cancel",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    const pr = await PurchaseRequest.findById(req.params.id);
    if ((pr as any).isDeleted) {
      return res
        .status(400)
        .json({ message: "Cannot cancel an item that is in trash" });
    }
    if (!pr)
      return res.status(404).json({ message: "Purchase request not found" });

    pr.status = "cancelled";
    await pr.save();
    return res.json({ success: true, purchaseRequest: pr.toObject() });
  },
);

router.delete(
  "/:id",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    await purgeExpiredPurchaseRequestTrash();
    const pr = await PurchaseRequest.findById(req.params.id);
    if (!pr)
      return res.status(404).json({ message: "Purchase request not found" });
    if (req.user?.role === "PROCUREMENT_OFFICER") {
      if (String(pr.requester) !== String(req.user?._id)) {
        return res
          .status(403)
          .json({ message: "You can only delete your own requests" });
      }
    }
    if ((pr as any).isDeleted) {
      const forceDelete =
        req.query.force === "1" ||
        req.query.force === "true" ||
        req.query.permanent === "1" ||
        req.query.permanent === "true";
      if (forceDelete) {
        await Approval.deleteMany({ purchaseRequest: pr._id });
        await PurchaseRequest.deleteOne({ _id: pr._id });
        return res.json({
          success: true,
          message: "Permanently deleted from trash.",
        });
      }
      return res.json({
        success: true,
        message: `Already in trash. It will be permanently deleted after ${TRASH_RETENTION_DAYS} days.`,
      });
    }
    const now = new Date();
    (pr as any).isDeleted = true;
    (pr as any).deletedAt = now;
    (pr as any).trashPurgeAt = new Date(now.getTime() + TRASH_RETENTION_MS);
    (pr as any).deletedBy = req.user?._id;
    await pr.save();
    await Approval.updateMany(
      { purchaseRequest: pr._id, status: "pending" },
      {
        status: "cancelled",
        comments: "Auto-cancelled because PR was moved to trash",
      },
    );
    res.json({
      success: true,
      message: `Moved to trash. Auto-delete in ${TRASH_RETENTION_DAYS} days.`,
      purchaseRequest: pr.toObject(),
    });
  },
);

router.put(
  "/:id/restore",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    await purgeExpiredPurchaseRequestTrash();
    const pr = await PurchaseRequest.findById(req.params.id);
    if (!pr) {
      return res.status(404).json({ message: "Purchase request not found" });
    }
    if (!(pr as any).isDeleted) {
      return res.status(400).json({ message: "Purchase request is not in trash" });
    }
    if (req.user?.role === "PROCUREMENT_OFFICER") {
      if (String(pr.requester) !== String(req.user?._id)) {
        return res
          .status(403)
          .json({ message: "You can only restore your own requests" });
      }
    }
    (pr as any).isDeleted = false;
    (pr as any).deletedAt = undefined;
    (pr as any).trashPurgeAt = undefined;
    (pr as any).deletedBy = undefined;
    await pr.save();
    return res.json({
      success: true,
      message: "Purchase request restored from trash.",
      purchaseRequest: pr.toObject(),
    });
  },
);

export default router;
