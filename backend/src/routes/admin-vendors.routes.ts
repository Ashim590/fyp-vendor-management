import { Router } from "express";
import Vendor from "../models/Vendor";
import User from "../models/User";
import Notification from "../models/Notification";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { notifyAllAdmins } from "../utils/notifyAdmins";
import { createAudit } from "../utils/auditLog";
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from "../utils/cursorPagination";
import { bustAuthUserCache } from "../utils/authUserCache";
import { invalidateAdminDashboardCache } from "../utils/adminDashboardCache";

const router = Router();

router.use(authenticate, authorize(["ADMIN"]));

/** Legacy filter: pending | verified | approved | all */
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {};

    if (status === "pending") {
      filter.status = "pending";
    } else if (status === "verified" || status === "approved") {
      filter.status = "approved";
    }

    const pageLimit = parseListLimit(req.query.limit, 40, 100);
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    let merged: Record<string, unknown>;
    try {
      merged = mergeWithCursorFilter(filter, cursor);
    } catch {
      return res.status(400).json({ message: "Invalid cursor" });
    }

    const raw = await Vendor.find(merged)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageLimit + 1)
      .select("-documents -logo")
      .lean();

    const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);

    const shaped = items.map((v) => ({
      ...v,
      name: v.name,
      status: v.status,
      contactPerson: v.contactPerson || { name: "", email: v.email },
    }));

    return res.json({ vendors: shaped, nextCursor, hasMore });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load vendors" });
  }
});

router.patch("/:id/verify", async (req: AuthRequest, res) => {
  try {
    const { isVerified } = req.body;
    const verified = !!isVerified;

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      {
        isVerified: verified,
        status: verified ? "approved" : "pending",
      },
      { new: true },
    );

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const owner = await User.findOne({ vendorProfile: vendor._id });
    if (owner) {
      owner.isActive = verified;
      await owner.save();
      bustAuthUserCache(String(owner._id));
      await Notification.create({
        user: owner._id,
        title: isVerified ? "Vendor approved" : "Vendor application update",
        body: `Your vendor profile "${vendor.name}" has been ${
          isVerified ? "approved" : "set to pending"
        }.`,
        link: "/vendor-profile",
        type: isVerified ? "vendor_approved" : "vendor_rejected",
      });
    }

    const actor = req.user?.name?.trim();
    if (verified) {
      await notifyAllAdmins({
        title: "Vendor approved",
        body: `“${vendor.name}” was verified on the admin panel.${actor ? ` Action: ${actor}.` : ""}`,
        type: "vendor_approved_staff",
        excludeUserId: req.user?._id ?? null,
      });
    } else {
      await notifyAllAdmins({
        title: "Vendor needs review again",
        body: `“${vendor.name}” was set back to pending.${actor ? ` Action: ${actor}.` : ""}`,
        type: "vendor_pending_review",
        excludeUserId: req.user?._id ?? null,
      });
    }

    // Audit entry for admin decision
    await createAudit({
      req,
      action: isVerified ? "approve" : "reject",
      entityType: "vendor",
      entityId: vendor._id,
      entityName: vendor.name,
      description: `Vendor verification ${isVerified ? "approved" : "rejected"}`,
      module: "vendors",
      subModule: "verify",
      status: "success",
      details: { isVerified },
    });

    invalidateAdminDashboardCache();

    return res.json({
      ...vendor.toObject(),
      name: vendor.name,
      status: vendor.status,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update vendor status" });
  }
});

export default router;
