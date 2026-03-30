import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  createDelivery,
  getAllDeliveries,
  getDeliveryById,
  getDeliveriesByPurchaseOrder,
  updateDeliveryStatus,
  receiveDelivery,
  inspectDelivery,
  cancelDelivery,
  getDeliveryStats,
} from "../controllers/delivery.controller.js";

const router = express.Router();

// Admin and Staff can create deliveries
router
  .route("/create")
  .post(isAuthenticated, roleAuth("admin", "staff"), createDelivery);

// All roles can view deliveries
router
  .route("/")
  .get(isAuthenticated, roleAuth("admin", "staff", "vendor"), getAllDeliveries);
router
  .route("/stats")
  .get(isAuthenticated, roleAuth("admin", "staff"), getDeliveryStats);
router
  .route("/purchase-order/:purchaseOrderId")
  .get(
    isAuthenticated,
    roleAuth("admin", "staff", "vendor"),
    getDeliveriesByPurchaseOrder
  );
router
  .route("/:id")
  .get(isAuthenticated, roleAuth("admin", "staff", "vendor"), getDeliveryById);

// Admin, Staff and Vendor can update deliveries
router
  .route("/:id")
  .put(
    isAuthenticated,
    roleAuth("admin", "staff", "vendor"),
    updateDeliveryStatus
  );
router
  .route("/:id/receive")
  .put(isAuthenticated, roleAuth("admin", "staff"), receiveDelivery);
router
  .route("/:id/inspect")
  .put(isAuthenticated, roleAuth("admin", "staff"), inspectDelivery);
router
  .route("/:id/cancel")
  .put(isAuthenticated, roleAuth("admin", "staff"), cancelDelivery);

export default router;
