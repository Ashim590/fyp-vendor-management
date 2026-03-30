import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  getOverview,
  getSummary,
  getTendersPerMonth,
  getVendorParticipation,
} from "../controllers/report.controller.js";

const router = express.Router();

router.use(isAuthenticated, roleAuth("admin", "staff"));

// Summary metrics for admin dashboard
router.get("/summary", getSummary);

// Backwards-compatible overview endpoint
router.get("/overview", getOverview);

// Charts
router.get("/tenders-per-month", getTendersPerMonth);
router.get("/vendor-participation", getVendorParticipation);

export default router;
