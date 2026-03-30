import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  sendInvoice,
  markAsViewed,
  recordPayment,
  cancelInvoice,
  getMyInvoices,
  getInvoiceStats,
} from "../controllers/invoice.controller.js";

const router = express.Router();

// Admin only can create invoices
router.route("/create").post(isAuthenticated, roleAuth("admin"), createInvoice);

// All roles can view invoices
router
  .route("/")
  .get(isAuthenticated, roleAuth("admin", "staff", "vendor"), getAllInvoices);
router
  .route("/my")
  .get(isAuthenticated, roleAuth("admin", "staff", "vendor"), getMyInvoices);
router
  .route("/stats")
  .get(isAuthenticated, roleAuth("admin", "staff"), getInvoiceStats);
router
  .route("/:id")
  .get(isAuthenticated, roleAuth("admin", "staff", "vendor"), getInvoiceById);

// Admin and Staff can update invoices
router
  .route("/:id")
  .put(isAuthenticated, roleAuth("admin", "staff"), updateInvoice);
router
  .route("/:id/send")
  .put(isAuthenticated, roleAuth("admin", "staff"), sendInvoice);
router
  .route("/:id/view")
  .put(isAuthenticated, roleAuth("admin", "staff", "vendor"), markAsViewed);
router
  .route("/:id/payment")
  .put(isAuthenticated, roleAuth("admin", "staff"), recordPayment);
router
  .route("/:id/cancel")
  .put(isAuthenticated, roleAuth("admin"), cancelInvoice);

export default router;
