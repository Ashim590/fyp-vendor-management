import { Router } from "express";
import multer from "multer";
import Vendor, { VendorStatus } from "../models/Vendor";
import User from "../models/User";
import Notification from "../models/Notification";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { generateVendorRegistrationNumber } from "../utils/vendorRegistrationNumber";
import { notifyAllAdmins } from "../utils/notifyAdmins";
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from "../utils/cursorPagination";
import { bustVendorMarketplaceGateCache } from "../utils/vendorGate";
import { bustVendorDashboardSummaryCache } from "../utils/vendorDashboardSummaryCache";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

function fileToDataUrl(file: Express.Multer.File): string {
  const b64 = file.buffer.toString("base64");
  return `data:${file.mimetype};base64,${b64}`;
}

function parseContactPerson(input: unknown) {
  if (!input) return undefined;
  if (typeof input === "string") {
    try {
      return JSON.parse(input) as {
        name?: string;
        email?: string;
        phone?: string;
      };
    } catch {
      return undefined;
    }
  }
  return input as { name?: string; email?: string; phone?: string };
}

function normalizeStatus(status: unknown): VendorStatus | undefined {
  if (
    status === "pending" ||
    status === "approved" ||
    status === "suspended" ||
    status === "rejected"
  ) {
    return status;
  }
  return undefined;
}

// POST /api/v1/vendor/register (legacy frontend compatibility)
router.post(
  "/register",
  authenticate,
  authorize(["VENDOR"]),
  upload.single("logo"),
  async (req: AuthRequest, res) => {
    try {
      const {
        name,
        email,
        phoneNumber,
        address,
        province,
        district,
        description,
        website,
        category,
        panNumber,
        taxId,
        registrationNumber,
        businessLicense,
        contactPerson,
      } = req.body;

      const emailNorm = String(email || "")
        .toLowerCase()
        .trim();

      if (!name || !emailNorm || !phoneNumber) {
        return res.status(400).json({
          message: "Name, email, and phone number are required.",
          success: false,
        });
      }

      let vendor = await Vendor.findOne({ email: emailNorm });
      const wasRejected = vendor?.status === "rejected";
      const logoData = req.file ? fileToDataUrl(req.file) : undefined;

      const payload: any = {
        name,
        email: emailNorm,
        phoneNumber,
        address: address || undefined,
        province: province || undefined,
        district: district || undefined,
        description: description || undefined,
        website: website || undefined,
        category: category || undefined,
        panNumber: panNumber || taxId || undefined,
        taxId: taxId || undefined,
        businessLicense:
          registrationNumber || businessLicense || undefined,
        registrationNumber: registrationNumber || undefined,
        contactPerson: parseContactPerson(contactPerson),
        registeredBy: req.user!._id,
        status: "pending",
        isVerified: false,
      };
      if (logoData) payload.logo = logoData;

      if (vendor) {
        vendor = await Vendor.findByIdAndUpdate(vendor._id, payload, {
          new: true,
        });
        if (wasRejected) {
          await notifyAllAdmins({
            title: "Vendor resubmitted for review",
            body: `“${String(name).trim()}” (${emailNorm}) updated their profile after rejection and is pending review again.`,
            type: "vendor_pending_review",
          });
        }
      } else {
        payload.registrationNumber = generateVendorRegistrationNumber();
        vendor = await Vendor.create(payload);
        await notifyAllAdmins({
          title: "New vendor pending review",
          body: `“${String(name).trim()}” (${emailNorm}) completed the vendor profile form and awaits approval.`,
          type: "vendor_pending_review",
        });
      }

      await User.findByIdAndUpdate(req.user!._id, {
        vendorProfile: vendor!._id,
        isActive: false,
      });

      return res.status(201).json({
        message: "Vendor registered successfully.",
        vendor,
        success: true,
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Error registering vendor", success: false });
    }
  },
);

// GET /api/v1/vendor (legacy frontend compatibility)
router.get(
  "/",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res) => {
    try {
      const { status, category, search, limit = "10" } = req.query;
      const query: any = {};

      const normalized = normalizeStatus(status);
      if (normalized) query.status = normalized;
      if (typeof category === "string") query.category = category;

      if (typeof search === "string" && search.trim().length > 0) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      const pageLimit = parseListLimit(limit, 10, 100);
      const cursorParam =
        typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      let merged: Record<string, unknown>;
      try {
        merged = mergeWithCursorFilter(query, cursorParam);
      } catch {
        return res
          .status(400)
          .json({ message: "Invalid cursor", success: false });
      }

      const raw = await Vendor.find(merged)
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageLimit + 1)
        .select("-documents -logo")
        .lean();

      const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);

      return res.status(200).json({
        vendors: items,
        success: true,
        nextCursor,
        hasMore,
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Error fetching vendors", success: false });
    }
  },
);

router.get(
  "/me",
  authenticate,
  authorize(["VENDOR"]),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user?.vendorProfile) {
        return res
          .status(404)
          .json({ message: "No vendor profile found", success: false });
      }
      const vendor = await Vendor.findById(req.user.vendorProfile);
      if (!vendor)
        return res
          .status(404)
          .json({ message: "Vendor not found", success: false });
      return res.json({ vendor, success: true });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Failed to load vendor profile", success: false });
    }
  },
);

router.put(
  "/me",
  authenticate,
  authorize(["VENDOR"]),
  upload.single("logo"),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user?.vendorProfile) {
        return res
          .status(404)
          .json({ message: "Vendor profile not found", success: false });
      }
      const vendorId = req.user.vendorProfile;
      const {
        name,
        email,
        phoneNumber,
        address,
        province,
        district,
        description,
        website,
        category,
        panNumber,
        taxId,
        registrationNumber,
        businessLicense,
        contactPerson,
        settlementEsewaId,
      } = req.body;

      const payload: any = {
        name,
        email,
        phoneNumber,
        address: address || undefined,
        province: province || undefined,
        district: district || undefined,
        description: description || undefined,
        website: website || undefined,
        category: category || undefined,
        panNumber: panNumber || taxId || undefined,
        taxId: taxId || panNumber || undefined,
        businessLicense:
          registrationNumber || businessLicense || undefined,
        registrationNumber: registrationNumber || undefined,
        contactPerson: parseContactPerson(contactPerson),
      };
      if (typeof settlementEsewaId === "string") {
        payload.bankDetails = {
          ...(payload.bankDetails || {}),
          esewaId: settlementEsewaId.trim() || undefined,
        };
      }
      if (req.file) payload.logo = fileToDataUrl(req.file);

      const updated = await Vendor.findByIdAndUpdate(vendorId, payload, {
        new: true,
      });
      return res.json({ vendor: updated, success: true });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Failed to update vendor profile", success: false });
    }
  },
);

// Keep static routes above parameterized `/:id` routes.
router.get(
  "/stats",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (_req: AuthRequest, res) => {
    try {
      const [totalVendors, pendingVendors, approvedVendors, rejectedVendors] =
        await Promise.all([
          Vendor.countDocuments(),
          Vendor.countDocuments({ status: "pending" }),
          Vendor.countDocuments({ status: "approved" }),
          Vendor.countDocuments({ status: "rejected" }),
        ]);

      return res.json({
        stats: {
          totalVendors,
          pendingVendors,
          approvedVendors,
          rejectedVendors,
        },
        success: true,
      });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Error fetching vendor stats", success: false });
    }
  },
);

router.get(
  "/:id",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  async (req: AuthRequest, res) => {
    try {
      const vendor = await Vendor.findById(req.params.id);
      if (!vendor)
        return res
          .status(404)
          .json({ message: "Vendor not found", success: false });

      if (
        req.user?.role === "VENDOR" &&
        String(req.user.vendorProfile) !== String(vendor._id)
      ) {
        return res.status(403).json({ message: "Forbidden", success: false });
      }

      return res.json({ vendor, success: true });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Error fetching vendor", success: false });
    }
  },
);

router.put(
  "/:id",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  upload.single("logo"),
  async (req: AuthRequest, res) => {
    try {
      const vendor = await Vendor.findById(req.params.id);
      if (!vendor)
        return res
          .status(404)
          .json({ message: "Vendor not found", success: false });

      if (
        req.user?.role === "VENDOR" &&
        String(req.user.vendorProfile) !== String(vendor._id)
      ) {
        return res.status(403).json({ message: "Forbidden", success: false });
      }

      const {
        name,
        email,
        phoneNumber,
        address,
        province,
        district,
        description,
        website,
        category,
        panNumber,
        taxId,
        registrationNumber,
        businessLicense,
        contactPerson,
        settlementEsewaId,
      } = req.body;

      const payload: any = {
        name: name || vendor.name,
        email: email || vendor.email,
        phoneNumber: phoneNumber || vendor.phoneNumber,
        address: address || vendor.address,
        province: province || vendor.province,
        district: district || vendor.district,
        description: description || vendor.description,
        website: website || vendor.website,
        category: category || vendor.category,
        panNumber: panNumber || taxId || vendor.panNumber,
        taxId: taxId || panNumber || vendor.taxId,
        businessLicense:
          registrationNumber || businessLicense || vendor.businessLicense,
        registrationNumber: registrationNumber || vendor.registrationNumber,
        contactPerson:
          parseContactPerson(contactPerson) || vendor.contactPerson,
      };
      if (typeof settlementEsewaId === "string") {
        payload.bankDetails = {
          ...(vendor.bankDetails || {}),
          esewaId: settlementEsewaId.trim() || undefined,
        };
      }
      if (req.file) payload.logo = fileToDataUrl(req.file);

      const updated = await Vendor.findByIdAndUpdate(vendor._id, payload, {
        new: true,
      });
      return res.json({ vendor: updated, success: true });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Error updating vendor", success: false });
    }
  },
);

router.put(
  "/:id/approve",
  authenticate,
  authorize(["ADMIN"]),
  async (req: AuthRequest, res) => {
    try {
      const vendor = await Vendor.findByIdAndUpdate(
        req.params.id,
        { status: "approved", isVerified: true },
        { new: true },
      );
      if (!vendor)
        return res
          .status(404)
          .json({ message: "Vendor not found", success: false });

      const owner = await User.findOne({ vendorProfile: vendor._id });
      if (owner) {
        owner.isActive = true;
        await owner.save();
        await Notification.create({
          user: owner._id,
          title: "Vendor approved",
          body: `Your vendor profile "${vendor.name}" has been approved.`,
          link: "/vendor-profile",
          type: "vendor_approved",
        });
      }

      const actor = req.user?.name?.trim();
      await notifyAllAdmins({
        title: "Vendor approved",
        body: `“${vendor.name}” is now approved.${actor ? ` Action: ${actor}.` : ""}`,
        type: "vendor_approved_staff",
        excludeUserId: req.user?._id ?? null,
      });

      bustVendorMarketplaceGateCache(String(vendor._id));
      bustVendorDashboardSummaryCache(String(vendor._id));

      return res.json({ vendor, success: true });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Failed to approve vendor", success: false });
    }
  },
);

router.put(
  "/:id/reject",
  authenticate,
  authorize(["ADMIN"]),
  async (req: AuthRequest, res) => {
    try {
      const { rejectionReason } = req.body;
      const vendor = await Vendor.findByIdAndUpdate(
        req.params.id,
        { status: "rejected", isVerified: false },
        { new: true },
      );
      if (!vendor)
        return res
          .status(404)
          .json({ message: "Vendor not found", success: false });

      const owner = await User.findOne({ vendorProfile: vendor._id });
      if (owner) {
        owner.isActive = false;
        await owner.save();
        await Notification.create({
          user: owner._id,
          title: "Vendor application rejected",
          body: `Your vendor profile "${vendor.name}" was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
          link: "/vendor-profile",
          type: "vendor_rejected",
        });
      }

      const actor = req.user?.name?.trim();
      await notifyAllAdmins({
        title: "Vendor rejected",
        body: `“${vendor.name}” was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}${actor ? ` Action: ${actor}.` : ""}`,
        type: "vendor_rejected_staff",
        excludeUserId: req.user?._id ?? null,
      });

      bustVendorMarketplaceGateCache(String(vendor._id));
      bustVendorDashboardSummaryCache(String(vendor._id));

      return res.json({ vendor, success: true });
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ message: "Failed to reject vendor", success: false });
    }
  },
);

export default router;
