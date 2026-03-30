import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  submitBid,
  getBidsByTender,
  getMyBids,
  getBidById,
  acceptBid,
  rejectBid,
} from "../controllers/bid.controller.js";

const router = express.Router();

router.use(isAuthenticated);

// Vendor: submit bid
router.post("/", submitBid);

// Vendor: my bids
router.get("/my", getMyBids);

// Officer & Admin: list bids for a tender
router.get("/tender/:id", getBidsByTender);

router.get("/:id", getBidById);

// Officer & Admin: accept / reject
router.patch("/:id/accept", roleAuth("admin", "staff"), acceptBid);
router.patch("/:id/reject", roleAuth("admin", "staff"), rejectBid);

export default router;
