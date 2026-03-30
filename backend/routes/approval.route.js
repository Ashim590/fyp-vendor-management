import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  createApproval,
  getAllApprovals,
  getApprovalById,
  getMyPendingApprovals,
  approveRequest,
  rejectRequest,
  returnRequest,
  getMyApprovalRequests,
  getApprovalStats,
} from "../controllers/approval.controller.js";

const router = express.Router();

// Admin only routes - create, approve, reject approvals
router
  .route("/create")
  .post(isAuthenticated, roleAuth("admin"), createApproval);
router
  .route("/stats")
  .get(isAuthenticated, roleAuth("admin", "staff"), getApprovalStats);
router
  .route("/:id/approve")
  .put(isAuthenticated, roleAuth("admin"), approveRequest);
router
  .route("/:id/reject")
  .put(isAuthenticated, roleAuth("admin"), rejectRequest);
router
  .route("/:id/return")
  .put(isAuthenticated, roleAuth("admin"), returnRequest);
router
  .route("/:id")
  .get(isAuthenticated, roleAuth("admin", "staff"), getApprovalById);

// Staff and Admin can view approvals
router
  .route("/")
  .get(isAuthenticated, roleAuth("admin", "staff"), getAllApprovals);
router
  .route("/pending")
  .get(isAuthenticated, roleAuth("admin", "staff"), getMyPendingApprovals);
router
  .route("/my")
  .get(isAuthenticated, roleAuth("admin", "staff"), getMyApprovalRequests);

export default router;
