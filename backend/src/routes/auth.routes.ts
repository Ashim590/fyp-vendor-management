import { Router } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import User, { UserRole } from "../models/User";
import Vendor from "../models/Vendor";
import Bid from "../models/Bid";
import Payment from "../models/Payment";
import Invoice from "../models/Invoice";
import InvoicePayment from "../models/InvoicePayment";
import Notification from "../models/Notification";
import AuditLog from "../models/AuditLog";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { createAudit } from "../utils/auditLog";
import { emailMatchFilter } from "../utils/emailQuery";
import { generateVendorRegistrationNumber } from "../utils/vendorRegistrationNumber";
import { notifyAllAdmins } from "../utils/notifyAdmins";
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from "../utils/cursorPagination";
import { bustAuthUserCache } from "../utils/authUserCache";
import { safeClientProfilePhoto } from "../utils/safeClientProfilePhoto";
import { getJwtExpiresIn, getJwtSecret } from "../config/secrets";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const VENDOR_CATEGORY_SET = new Set([
  "office_supplies",
  "it_equipment",
  "furniture",
  "food_supplies",
  "medical_supplies",
  "cleaning_supplies",
  "printing",
  "other",
]);

function fileToDataUrl(file: Express.Multer.File): string {
  const b64 = file.buffer.toString("base64");
  return `data:${file.mimetype};base64,${b64}`;
}


// Public vendor signup (used by frontend Signup.jsx) — full vendor form + pending user (no login until admin approves)
router.post(
  "/register",
  upload.fields([{ name: "logo", maxCount: 1 }]),
  async (req, res) => {
    try {
      const body = req.body as Record<string, string | undefined>;
      const {
        fullname,
        email,
        phoneNumber,
        password,
        organizationName,
        department,
        designation,
        address,
        province,
        district,
        description,
        website,
        category: categoryRaw,
        panNumber,
        taxId,
        registrationNumber,
        businessLicense,
        contactPersonName,
        contactPersonEmail,
        contactPersonPhone,
      } = body;

      if (!email?.trim() || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required.",
        });
      }
      if (!String(phoneNumber || "").trim()) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required.",
        });
      }
      const orgName = String(organizationName || department || "").trim();
      if (!orgName) {
        return res.status(400).json({
          success: false,
          message: "Organization or company name is required.",
        });
      }
      const panNorm = String(panNumber || taxId || "").trim();
      if (!panNorm) {
        return res.status(400).json({
          success: false,
          message: "PAN number is required.",
        });
      }
      const regNorm = String(
        registrationNumber || businessLicense || "",
      ).trim();
      if (!regNorm) {
        return res.status(400).json({
          success: false,
          message: "Registration number is required.",
        });
      }
      const provinceNorm = String(province || "").trim();
      const districtNorm = String(district || "").trim();
      if (!provinceNorm || !districtNorm) {
        return res.status(400).json({
          success: false,
          message: "Province and district are required.",
        });
      }
      const addrNorm = String(address || "").trim();
      if (!addrNorm) {
        return res.status(400).json({
          success: false,
          message: "Address is required.",
        });
      }

      const categoryTrim = String(categoryRaw || "other").trim();
      const category = VENDOR_CATEGORY_SET.has(categoryTrim)
        ? categoryTrim
        : "other";

      const contactName =
        String(designation || "").trim() || String(fullname).trim();
      const cpName = String(contactPersonName || "").trim();
      const cpEmail = String(contactPersonEmail || "").trim();
      const cpPhone = String(contactPersonPhone || "").trim();
      if (!cpName || !cpPhone) {
        return res.status(400).json({
          success: false,
          message: "Authorized person name and contact number are required.",
        });
      }
      const contactPersonDoc =
        cpName || cpEmail || cpPhone
          ? {
              name: cpName || contactName,
              ...(cpEmail ? { email: cpEmail } : {}),
              ...(cpPhone ? { phone: cpPhone } : {}),
            }
          : { name: contactName };

      const files = req.files as { logo?: Express.Multer.File[] } | undefined;
      const logoFile = files?.logo?.[0];
      const logoData = logoFile ? fileToDataUrl(logoFile) : undefined;

      const emailNorm = String(email).toLowerCase().trim();
      const emailQuery = emailMatchFilter(emailNorm);
      const existingReg = await Vendor.findOne({
        registrationNumber: regNorm,
      }).select("_id");
      if (existingReg) {
        return res.status(400).json({
          success: false,
          message: "Registration number already exists.",
        });
      }

      const existing = await User.findOne(emailQuery);
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: "Email already in use" });
      }

      const vendorWithEmail = await Vendor.findOne(emailQuery);
      if (vendorWithEmail) {
        const linkedUser = await User.findOne({
          vendorProfile: vendorWithEmail._id,
        });
        if (!linkedUser) {
          await Vendor.deleteOne({ _id: vendorWithEmail._id });
        } else {
          return res.status(400).json({
            success: false,
            message:
              "This email is already registered. If you are waiting for approval, sign in only after an administrator approves your vendor account.",
          });
        }
      }

      const hashed = await bcrypt.hash(String(password), 10);

      let rollbackVendorId: string | null = null;
      let registeredVendorId: mongoose.Types.ObjectId | null = null;
      try {
        const vendorDoc: Record<string, unknown> = {
          name: orgName,
          email: emailNorm,
          phoneNumber: String(phoneNumber).trim(),
          address: addrNorm,
          province: provinceNorm,
          district: districtNorm,
          contactPerson: contactPersonDoc,
          status: "pending",
          isVerified: false,
          category,
          registrationNumber: regNorm,
          panNumber: panNorm,
          taxId: panNorm,
        };
        const desc = String(description || "").trim();
        if (desc) vendorDoc.description = desc;
        const web = String(website || "").trim();
        if (web) vendorDoc.website = web;
        vendorDoc.businessLicense = regNorm;
        if (logoData) vendorDoc.logo = logoData;

        const vendor = await Vendor.create(vendorDoc);
        registeredVendorId = vendor._id as mongoose.Types.ObjectId;
        rollbackVendorId = String(vendor._id);

        const fallbackUserName =
          cpName || String(designation || "").trim() || orgName;
        const user = await User.create({
          name: String(fullname || "").trim() || fallbackUserName,
          email: emailNorm,
          password: hashed,
          role: "VENDOR" as UserRole,
          vendorProfile: vendor._id,
          isActive: false,
        });

        await Vendor.findByIdAndUpdate(vendor._id, { registeredBy: user._id });
        rollbackVendorId = null;
      } catch (createErr) {
        if (rollbackVendorId) {
          await Vendor.deleteOne({ _id: rollbackVendorId }).catch(() => {});
        }
        throw createErr;
      }

      await notifyAllAdmins({
        title: "New vendor pending review",
        body: `${orgName} (${emailNorm}) submitted a registration and awaits approval.`,
        type: "vendor_pending_review",
        referenceId: registeredVendorId ?? undefined,
      });

      return res.status(201).json({
        success: true,
        message:
          "Registration received. You can sign in only after an administrator approves your vendor account.",
      });
    } catch (err: unknown) {
      console.error(err);
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        const anyErr = err as {
          keyPattern?: Record<string, number>;
          keyValue?: Record<string, unknown>;
        };
        const kp = anyErr.keyPattern || {};
        const dupMsg =
          "email" in kp
            ? "This email is already registered."
            : "registrationNumber" in kp
              ? "Registration could not be completed due to a data conflict. Please try again."
              : "Registration could not be completed. Please check your details or contact support.";
        return res.status(400).json({
          success: false,
          message: dupMsg,
        });
      }
      if (
        err &&
        typeof err === "object" &&
        "name" in err &&
        (err as { name: string }).name === "ValidationError"
      ) {
        const ve = err as { errors?: Record<string, { message: string }> };
        const msg = Object.values(ve.errors || {})
          .map((e) => e.message)
          .join(" ");
        return res.status(400).json({
          success: false,
          message: msg || "Invalid registration data.",
        });
      }
      return res.status(500).json({
        success: false,
        message: "Failed to register account. Please try again later.",
      });
    }
  },
);

const VENDOR_CATEGORIES = new Set([
  "office_supplies",
  "it_equipment",
  "furniture",
  "food_supplies",
  "medical_supplies",
  "cleaning_supplies",
  "printing",
  "other",
]);

router.post("/register-vendor", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      organizationName,
      contactPerson,
      phone,
      address,
      registrationNumber,
      categories,
    } = req.body;

    const emailNorm = String(email || "")
      .toLowerCase()
      .trim();
    const emailQuery = emailMatchFilter(emailNorm);

    const existing = await User.findOne(emailQuery);
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const vendorWithEmail = await Vendor.findOne(emailQuery);
    if (vendorWithEmail) {
      const linkedUser = await User.findOne({
        vendorProfile: vendorWithEmail._id,
      });
      if (!linkedUser) {
        await Vendor.deleteOne({ _id: vendorWithEmail._id });
      } else {
        return res.status(400).json({
          message:
            "This email is already registered. If you are waiting for approval, sign in only after an administrator approves your vendor account.",
        });
      }
    }

    const hashed = await bcrypt.hash(String(password), 10);

    const catRaw = categories;
    const catList = Array.isArray(catRaw)
      ? catRaw.map((c: string) => String(c).trim()).filter(Boolean)
      : String(catRaw || "")
          .split(",")
          .map((c: string) => c.trim())
          .filter(Boolean);
    const firstCat = catList[0] || "other";
    const category = VENDOR_CATEGORIES.has(firstCat) ? firstCat : "other";

    const orgName = String(organizationName || name || "Vendor").trim();
    const phoneNumber = String(phone || "").trim() || "0000000000";

    let contact: { name?: string; email?: string; phone?: string } | undefined;
    if (typeof contactPerson === "string" && contactPerson.trim()) {
      contact = { name: contactPerson.trim() };
    } else if (contactPerson && typeof contactPerson === "object") {
      contact = contactPerson as {
        name?: string;
        email?: string;
        phone?: string;
      };
    }

    let rollbackVendorId: string | null = null;
    let vendorProfile: InstanceType<typeof Vendor>;
    let user: InstanceType<typeof User>;

    try {
      vendorProfile = await Vendor.create({
        name: orgName,
        email: emailNorm,
        phoneNumber,
        address: address ? String(address) : undefined,
        businessLicense: registrationNumber
          ? String(registrationNumber)
          : undefined,
        registrationNumber: generateVendorRegistrationNumber(),
        category,
        contactPerson: contact,
        status: "pending",
        isVerified: false,
      });
      rollbackVendorId = String(vendorProfile._id);

      user = await User.create({
        name: String(name || orgName),
        email: emailNorm,
        password: hashed,
        role: "VENDOR" as UserRole,
        vendorProfile: vendorProfile._id,
        isActive: false,
      });

      await Vendor.findByIdAndUpdate(vendorProfile._id, {
        registeredBy: user._id,
      });
      rollbackVendorId = null;
    } catch (createErr) {
      if (rollbackVendorId) {
        await Vendor.deleteOne({ _id: rollbackVendorId }).catch(() => {});
      }
      throw createErr;
    }

    // Audit log (register-vendor)
    (req as any).user = user;
    await createAudit({
      req,
      action: "register-vendor",
      entityType: "vendor",
      entityId: vendorProfile._id,
      entityName: String(vendorProfile._id),
      description: "Vendor account registered (pending admin verification).",
      status: "success",
      module: "vendors",
      subModule: "register-vendor",
      details: { email: user.email },
    });

    await notifyAllAdmins({
      title: "New vendor pending review",
      body: `${orgName} (${emailNorm}) registered via API and awaits approval.`,
      type: "vendor_pending_review",
      referenceId: vendorProfile._id,
    });

    return res
      .status(201)
      .json({ id: user._id, email: user.email, role: user.role });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to register vendor" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const emailNorm = String(email || "")
      .toLowerCase()
      .trim();
    /** Exclude profilePhoto — often multi-MB data URLs; loading it from Atlas dominated login time. */
    const user = await User.findOne(emailMatchFilter(emailNorm)).select(
      "-profilePhoto",
    );
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    let match = false;
    try {
      match = await bcrypt.compare(password, user.password);
    } catch (compareErr) {
      if (process.env.NODE_ENV !== "production") {
        console.error("login bcrypt.compare failed", compareErr);
      } else {
        console.error("login bcrypt.compare failed");
      }
      return res.status(400).json({ message: "Invalid credentials" });
    }
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    /* Keep stored email normalized going forward (legacy rows may differ only by case). */
    if (user.email !== emailNorm) {
      user.email = emailNorm;
      await user.save().catch(() => {});
    }

    const vendorId = user.vendorProfile;
    if (user.role === "VENDOR" && vendorId) {
      const vdoc = await Vendor.findById(vendorId).select("status");
      if (vdoc && vdoc.status !== "approved") {
        if (vdoc.status === "pending") {
          return res.status(403).json({
            message:
              "Your vendor application is pending admin approval. You will be notified when your account is activated.",
          });
        }
        if (vdoc.status === "rejected") {
          return res.status(403).json({
            message:
              "Your vendor application was not approved. Contact the organization if you believe this is an error.",
          });
        }
        if (vdoc.status === "suspended") {
          return res.status(403).json({
            message:
              "Your vendor account has been suspended. Contact an administrator.",
          });
        }
        return res
          .status(403)
          .json({ message: "Your vendor account is not active." });
      }
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Account is disabled. Contact an administrator.",
      });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      getJwtSecret(),
      {
        expiresIn:
          rememberMe === true
            ? process.env.JWT_REMEMBER_EXPIRES_IN?.trim() || "30d"
            : getJwtExpiresIn(),
      },
    );

    const responsePayload = {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: (user as any).phoneNumber || "",
        profilePhoto: safeClientProfilePhoto((user as any).profilePhoto),
        role: user.role,
        vendorProfile: user.vendorProfile,
      },
    };

    // Audit log (successful login). `req.user` is not set because we don't run `authenticate`.
    // Create it from the loaded user so the audit logger can write.
    (req as any).user = user;
    void createAudit({
      req: req as any,
      action: "login",
      entityType: "user",
      entityId: user._id,
      entityName: user.name,
      description: "User logged in",
      status: "success",
      module: "auth",
      subModule: "login",
    }).catch((err) => console.error("login audit log failed", err));

    bustAuthUserCache(String(user._id));
    return res.json(responsePayload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to login" });
  }
});


// Temporary bootstrap endpoint to create an initial admin user
const ensureBootstrapAdmin = async (_req: any, res: any) => {
  try {
    const allow =
      String(process.env.ALLOW_BOOTSTRAP_ADMIN || "").toLowerCase() ===
        "true" || process.env.NODE_ENV !== "production";
    if (!allow) {
      return res.status(404).json({ message: "Not found" });
    }
    const hashed = await bcrypt.hash("Admin@123", 10);
    const admin = await User.findOneAndUpdate(
      { email: "adminparopakarorg@gmail.com" },
      {
        name: "System Administrator",
        email: "adminparopakarorg@gmail.com",
        password: hashed,
        role: "ADMIN" as UserRole,
        isActive: true,
      },
      { new: true, upsert: true },
    );

    return res.json({
      message: "Admin user ensured with default password",
      email: admin.email,
      password: "Admin@123",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to bootstrap admin" });
  }
};

// Allow both POST (for curl/client) and GET (for quick browser call)
router.post("/bootstrap-admin", ensureBootstrapAdmin);
router.get("/bootstrap-admin", ensureBootstrapAdmin);

// ==============================
// Admin user management (Phase 2)
// ==============================

// List all users (admin only)
router.get("/users", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const pageLimit = parseListLimit(req.query.limit, 50, 100);
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    let merged: Record<string, unknown>;
    try {
      merged = mergeWithCursorFilter({}, cursor);
    } catch {
      return res.status(400).json({ message: "Invalid cursor" });
    }
    /** Keep list payload small: exclude password + large profile photo data URLs. */
    const raw = await User.find(merged)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageLimit + 1)
      .select("-password -profilePhoto")
      .lean();
    const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
    return res.json({ users: items, nextCursor, hasMore });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to load users" });
  }
});

// Create Procurement Officer account
router.post("/users", authenticate, authorize(["ADMIN"]), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      role: "PROCUREMENT_OFFICER" as UserRole,
      isActive: true,
    });

    /** First list page so the client can sync cursor state without a follow-up GET. */
    const pageLimit = parseListLimit(req.query.limit, 25, 100);
    const listRaw = await User.find({})
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageLimit + 1)
      .select("-password -profilePhoto")
      .lean();
    const { items, nextCursor, hasMore } = trimExtraDoc(listRaw, pageLimit);

    return res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      listPage: {
        users: items,
        nextCursor,
        hasMore,
        limit: pageLimit,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to create user" });
  }
});

// Single user detail (admin) — used by Admin Users "View"
router.get(
  "/users/:id",
  authenticate,
  authorize(["ADMIN"]),
  async (req, res) => {
    try {
      const u = await User.findById(req.params.id).select("-password").lean();
      if (!u) {
        return res.status(404).json({ message: "User not found" });
      }
      const userOut = {
        ...u,
        profilePhoto: safeClientProfilePhoto(
          (u as { profilePhoto?: string }).profilePhoto,
        ),
      };

      if (u.role === "VENDOR" && u.vendorProfile) {
        const vdoc = await Vendor.findById(u.vendorProfile)
          .select("-documents -logo")
          .lean();
        (userOut as { vendorProfile?: unknown }).vendorProfile = vdoc || {
          _id: u.vendorProfile,
        };
      }

      return res.json({ user: userOut });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to load user" });
    }
  },
);

/** Update procurement officer profile only (vendors must be changed via vendor workflows). */
router.patch(
  "/users/:id",
  authenticate,
  authorize(["ADMIN"]),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.role !== "PROCUREMENT_OFFICER") {
        return res.status(403).json({
          message:
            "Only procurement officer accounts can be edited here. Vendor profiles are read-only in this view.",
        });
      }

      const { name, email, phoneNumber } = req.body as {
        name?: string;
        email?: string;
        phoneNumber?: string;
      };

      if (typeof email === "string" && email.trim()) {
        const normalizedEmail = email.trim().toLowerCase();
        const existing = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: user._id },
        });
        if (existing) {
          return res.status(400).json({ message: "Email already in use" });
        }
        user.email = normalizedEmail;
      }
      if (typeof name === "string" && name.trim()) {
        user.name = name.trim();
      }
      if (typeof phoneNumber === "string") {
        (user as { phoneNumber?: string }).phoneNumber = phoneNumber.trim();
      }

      await user.save();
      bustAuthUserCache(String(user._id));

      const fresh = await User.findById(user._id).select("-password").lean();
      if (!fresh) {
        return res.status(500).json({ message: "Failed to load updated user" });
      }
      return res.json({
        user: {
          ...fresh,
          profilePhoto: safeClientProfilePhoto(
            (fresh as { profilePhoto?: string }).profilePhoto,
          ),
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to update user" });
    }
  },
);

// Toggle active / inactive user
router.patch(
  "/users/:id/toggle-active",
  authenticate,
  authorize(["ADMIN"]),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      user.isActive = !user.isActive;
      await user.save();
      return res.json({ id: user._id, isActive: user.isActive });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to update user" });
    }
  },
);

/**
 * Admin utility: purge all Vendors + Procurement Officers (demo reset).
 * Safety: requires `?confirm=PURGE_VENDORS_AND_OFFICERS`.
 */
router.delete(
  "/admin/purge-vendors-and-officers",
  authenticate,
  authorize(["ADMIN"]),
  async (req: AuthRequest, res) => {
    try {
      const confirm = String(req.query.confirm || "");
      if (confirm !== "PURGE_VENDORS_AND_OFFICERS") {
        return res.status(400).json({
          message:
            "Confirmation required. Pass ?confirm=PURGE_VENDORS_AND_OFFICERS to run this purge.",
        });
      }

      const vendors = await Vendor.find().select("_id");
      const vendorIds = vendors.map((v) => v._id);

      const vendorUsers = await User.find({ role: "VENDOR" }).select("_id");
      const officerUsers = await User.find({
        role: "PROCUREMENT_OFFICER",
      }).select("_id");
      const userIds = [...vendorUsers, ...officerUsers].map((u) => u._id);

      const results = await Promise.all([
        // Vendor-facing / procurement artifacts
        Bid.deleteMany({ vendor: { $in: vendorIds } }),
        Payment.deleteMany({ vendor: { $in: vendorIds } }),
        Invoice.deleteMany({ vendor: { $in: vendorIds } }),
        InvoicePayment.deleteMany({ vendor: { $in: vendorIds } }),

        // People + vendor profiles
        Vendor.deleteMany({ _id: { $in: vendorIds } }),
        User.deleteMany({ role: { $in: ["VENDOR", "PROCUREMENT_OFFICER"] } }),

        // Notifications & audit logs for purged users
        Notification.deleteMany({ user: { $in: userIds } }),
        AuditLog.deleteMany({ user: { $in: userIds } }),
      ]);

      await createAudit({
        req: req as any,
        action: "purge",
        entityType: "system",
        entityId: req.user!._id,
        entityName: req.user!.email,
        description:
          "Purged all vendors and procurement officers (demo reset).",
        status: "success",
        module: "admin",
        subModule: "purge-vendors-and-officers",
        details: {
          purgedVendors: vendorIds.length,
          purgedUsers: userIds.length,
          deletes: results.map((r: any) => r?.deletedCount ?? null),
        },
      });

      return res.json({
        success: true,
        purged: {
          vendors: vendorIds.length,
          users: userIds.length,
        },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to purge demo data" });
    }
  },
);

export default router;
