import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  submitQuotation,
  getAllQuotations,
  getQuotationById,
  getQuotationsByPurchaseRequest,
  updateQuotation,
  acceptQuotation,
  rejectQuotation,
  compareQuotations,
  getMyQuotations,
} from "../controllers/quotation.controller.js";

const router = express.Router();

// Vendor routes - vendors can submit quotations
router
  .route("/submit")
  .post(isAuthenticated, roleAuth("vendor"), submitQuotation);
router.route("/my").get(isAuthenticated, roleAuth("vendor"), getMyQuotations);

// Admin/Staff can view and manage quotations
router
  .route("/")
  .get(isAuthenticated, roleAuth("admin", "staff"), getAllQuotations);
router
  .route("/purchase-request/:purchaseRequestId")
  .get(
    isAuthenticated,
    roleAuth("admin", "staff", "vendor"),
    getQuotationsByPurchaseRequest
  );
router
  .route("/purchase-request/:purchaseRequestId/compare")
  .get(isAuthenticated, roleAuth("admin", "staff"), compareQuotations);
router
  .route("/:id")
  .get(isAuthenticated, roleAuth("admin", "staff", "vendor"), getQuotationById);
router
  .route("/:id")
  .put(isAuthenticated, roleAuth("admin", "staff", "vendor"), updateQuotation);
router
  .route("/:id/accept")
  .put(isAuthenticated, roleAuth("admin", "staff"), acceptQuotation);
router
  .route("/:id/reject")
  .put(isAuthenticated, roleAuth("admin", "staff"), rejectQuotation);

export default router;
