import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  createPayment,
  getAllPayments,
  getPaymentById,
  updatePayment,
  approvePayment,
  rejectPayment,
  processPayment,
  completePayment,
  cancelPayment,
  getMyPayments,
  getPendingPaymentApprovals,
  getPaymentStats,
} from "../controllers/payment.controller.js";

const router = express.Router();

// Admin and Staff can create payments
router
  .route("/create")
  .post(isAuthenticated, roleAuth("admin", "staff"), createPayment);

// All roles can view payments
router
  .route("/")
  .get(isAuthenticated, roleAuth("admin", "staff", "vendor"), getAllPayments);
router
  .route("/my")
  .get(isAuthenticated, roleAuth("admin", "staff", "vendor"), getMyPayments);
router
  .route("/pending-approvals")
  .get(isAuthenticated, roleAuth("admin", "staff"), getPendingPaymentApprovals);
router
  .route("/stats")
  .get(isAuthenticated, roleAuth("admin", "staff"), getPaymentStats);
router
  .route("/:id")
  .get(isAuthenticated, roleAuth("admin", "staff", "vendor"), getPaymentById);

// Admin and Staff can update payments
router
  .route("/:id")
  .put(isAuthenticated, roleAuth("admin", "staff"), updatePayment);
router
  .route("/:id/approve")
  .put(isAuthenticated, roleAuth("admin"), approvePayment);
router
  .route("/:id/reject")
  .put(isAuthenticated, roleAuth("admin"), rejectPayment);
router
  .route("/:id/process")
  .put(isAuthenticated, roleAuth("admin", "staff"), processPayment);
router
  .route("/:id/complete")
  .put(isAuthenticated, roleAuth("admin", "staff"), completePayment);
router
  .route("/:id/cancel")
  .put(isAuthenticated, roleAuth("admin"), cancelPayment);

export default router;
