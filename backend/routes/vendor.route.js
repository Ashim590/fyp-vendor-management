import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import { singleUpload } from "../middlewares/mutler.js";
import {
  registerVendor,
  getAllVendors,
  getVendorById,
  getMyVendorProfile,
  updateVendor,
  approveVendor,
  rejectVendor,
  deleteVendor,
  getVendorStats,
} from "../controllers/vendor.controller.js";

const router = express.Router();

// Public vendor registration endpoint (used by vendor-profile form)
router.route("/register").post(singleUpload, registerVendor);

// Protected routes - All authenticated users can view vendors
router.route("/").get(isAuthenticated, getAllVendors);
router
  .route("/stats")
  .get(isAuthenticated, roleAuth("admin", "staff"), getVendorStats);

// Current user's vendor profile (must be before /:id)
router
  .route("/me")
  .get(isAuthenticated, roleAuth("vendor"), getMyVendorProfile);

// Single vendor by ID
router
  .route("/:id")
  .get(isAuthenticated, roleAuth("admin", "staff", "vendor"), getVendorById);
router
  .route("/:id")
  .put(
    isAuthenticated,
    roleAuth("admin", "vendor"),
    singleUpload,
    updateVendor
  );
router
  .route("/:id/approve")
  .put(isAuthenticated, roleAuth("admin"), approveVendor);
router
  .route("/:id/reject")
  .put(isAuthenticated, roleAuth("admin"), rejectVendor);
router.route("/:id").delete(isAuthenticated, roleAuth("admin"), deleteVendor);

export default router;
