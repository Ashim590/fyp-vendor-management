import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import {
  getAllAuditLogs,
  getAuditLogById,
  getEntityHistory,
  getUserActivity,
  getMyActivity,
  getAuditStats,
  exportAuditLogs,
} from "../controllers/auditLog.controller.js";

const router = express.Router();

router.route("/").get(isAuthenticated, getAllAuditLogs);
router.route("/stats").get(isAuthenticated, getAuditStats);
router.route("/export").get(isAuthenticated, exportAuditLogs);
router.route("/my").get(isAuthenticated, getMyActivity);
router
  .route("/entity/:entityType/:entityId")
  .get(isAuthenticated, getEntityHistory);
router.route("/user/:userId").get(isAuthenticated, getUserActivity);
router.route("/:id").get(isAuthenticated, getAuditLogById);

export default router;
