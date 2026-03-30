import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import { Vendor } from "../models/vendor.model.js";
import { User } from "../models/user.model.js";
import { Notification } from "../models/notification.model.js";

const router = express.Router();

// All admin vendor routes require admin role
router.use(isAuthenticated, roleAuth("admin"));

// GET /api/admin/vendors?status=pending|verified|approved (verified = approved)
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status === "pending") filter.status = "pending";
    if (status === "verified" || status === "approved") filter.status = "approved";

    const vendors = await Vendor.find(filter)
      .sort({ createdAt: -1 })
      .populate("registeredBy", "fullname email");
    res.json(vendors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load vendors" });
  }
});

// PATCH /api/admin/vendors/:id/verify  { isVerified: true|false }
router.patch("/:id/verify", async (req, res) => {
  try {
    const { isVerified } = req.body;

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      {
        isVerified: !!isVerified,
        status: isVerified ? "approved" : "pending",
      },
      { new: true }
    );
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const owner = await User.findOne({ vendorProfile: vendor._id });
    if (owner) {
      await Notification.create({
        user: owner._id,
        title: isVerified ? "Vendor approved" : "Vendor application rejected",
        body: `Your vendor profile "${vendor.name}" has been ${isVerified ? "approved" : "rejected"}.`,
        link: "/vendor-profile",
        type: isVerified ? "vendor_approved" : "vendor_rejected",
      });
    }

    res.json(vendor);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update vendor status" });
  }
});

export default router;

