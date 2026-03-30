import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  createTender,
  getAllTenders,
  getTenderById,
  updateTender,
  publishTender,
  closeTender,
} from "../controllers/tender.controller.js";

const router = express.Router();

router.use(isAuthenticated);

// Officer & Admin: create tender
router.post("/", roleAuth("admin", "staff"), createTender);

// All authenticated: list tenders (vendors see published only in practice; filter in frontend or here)
router.get("/", getAllTenders);
router.get("/:id", getTenderById);

// Officer & Admin: update, publish, close
router.put("/:id", roleAuth("admin", "staff"), updateTender);
router.patch("/:id/publish", roleAuth("admin", "staff"), publishTender);
router.patch("/:id/close", roleAuth("admin", "staff"), closeTender);

export default router;
