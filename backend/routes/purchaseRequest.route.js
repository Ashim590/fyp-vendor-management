import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  createPurchaseRequest,
  getAllPurchaseRequests,
  getPurchaseRequestById,
  updatePurchaseRequest,
  submitForApproval,
  cancelPurchaseRequest,
  getMyPurchaseRequests,
  getPurchaseRequestStats,
  deletePurchaseRequest,
} from "../controllers/purchaseRequest.controller.js";

const router = express.Router();

// Staff and Admin can create purchase requests
router
  .route("/create")
  .post(isAuthenticated, roleAuth("admin", "staff"), createPurchaseRequest);

// All authenticated users can view PRs (with role-based filtering in controller)
router
  .route("/")
  .get(
    isAuthenticated,
    roleAuth("admin", "staff", "vendor"),
    getAllPurchaseRequests
  );
router
  .route("/my")
  .get(isAuthenticated, roleAuth("admin", "staff"), getMyPurchaseRequests);
router
  .route("/stats")
  .get(isAuthenticated, roleAuth("admin", "staff"), getPurchaseRequestStats);
router
  .route("/:id")
  .get(
    isAuthenticated,
    roleAuth("admin", "staff", "vendor"),
    getPurchaseRequestById
  );

// Staff and Admin can update PRs
router
  .route("/:id")
  .put(isAuthenticated, roleAuth("admin", "staff"), updatePurchaseRequest);
router
  .route("/:id/submit")
  .put(isAuthenticated, roleAuth("admin", "staff"), submitForApproval);
router
  .route("/:id/cancel")
  .put(isAuthenticated, roleAuth("admin", "staff"), cancelPurchaseRequest);

// Admin only can delete
router
  .route("/:id")
  .delete(isAuthenticated, roleAuth("admin"), deletePurchaseRequest);

export default router;
