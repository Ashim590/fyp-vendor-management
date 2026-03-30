import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  createPurchaseOrder,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  submitForApproval,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  markAsOrdered,
  cancelPurchaseOrder,
  getMyPurchaseOrders,
  getPurchaseOrderStats,
} from "../controllers/purchaseOrder.controller.js";

const router = express.Router();

// Staff and Admin can create purchase orders
router
  .route("/create")
  .post(isAuthenticated, roleAuth("admin", "staff"), createPurchaseOrder);

// All roles can view POs (with role-based filtering in controller)
router
  .route("/")
  .get(
    isAuthenticated,
    roleAuth("admin", "staff", "vendor"),
    getAllPurchaseOrders
  );
router
  .route("/my")
  .get(
    isAuthenticated,
    roleAuth("admin", "staff", "vendor"),
    getMyPurchaseOrders
  );
router
  .route("/stats")
  .get(isAuthenticated, roleAuth("admin", "staff"), getPurchaseOrderStats);
router
  .route("/:id")
  .get(
    isAuthenticated,
    roleAuth("admin", "staff", "vendor"),
    getPurchaseOrderById
  );

// Staff and Admin can update POs
router
  .route("/:id")
  .put(isAuthenticated, roleAuth("admin", "staff"), updatePurchaseOrder);
router
  .route("/:id/submit")
  .put(isAuthenticated, roleAuth("admin", "staff"), submitForApproval);
router
  .route("/:id/ordered")
  .put(isAuthenticated, roleAuth("admin", "vendor"), markAsOrdered);
router
  .route("/:id/cancel")
  .put(isAuthenticated, roleAuth("admin", "staff"), cancelPurchaseOrder);

// Admin only can approve/reject
router
  .route("/:id/approve")
  .put(isAuthenticated, roleAuth("admin"), approvePurchaseOrder);
router
  .route("/:id/reject")
  .put(isAuthenticated, roleAuth("admin"), rejectPurchaseOrder);

export default router;
