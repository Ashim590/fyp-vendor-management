import { Tender } from "../models/tender.model.js";
import { Vendor } from "../models/vendor.model.js";
import { Bid } from "../models/bid.model.js";
import { User } from "../models/user.model.js";

// High-level summary for admin dashboard
export const getSummary = async (req, res) => {
  try {
    const [
      totalTenders,
      activeTenders,
      totalVendors,
      approvedVendors,
      totalBids,
      totalUsers,
    ] = await Promise.all([
      Tender.countDocuments(),
      Tender.countDocuments({ status: "PUBLISHED" }),
      Vendor.countDocuments(),
      Vendor.countDocuments({ status: "approved" }),
      Bid.countDocuments(),
      User.countDocuments(),
    ]);

    const tendersByStatus = await Tender.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        totalTenders,
        activeTenders,
        totalVendors,
        approvedVendors,
        totalBids,
        totalUsers,
        tendersByStatus,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error fetching summary report.",
      success: false,
      error: error.message,
    });
  }
};

// Backwards-compatibility alias for older /overview endpoint
export const getOverview = (req, res) => getSummary(req, res);

// Tenders per month for last 12 months
export const getTendersPerMonth = async (req, res) => {
  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 11,
      1
    );

    const raw = await Tender.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]);

    const data = raw.map((item) => ({
      year: item._id.year,
      month: item._id.month,
      total: item.count,
    }));

    return res.status(200).json({
      success: true,
      tendersPerMonth: data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error fetching tenders per month.",
      success: false,
      error: error.message,
    });
  }
};

// Vendor participation: number of bids per vendor (top N)
export const getVendorParticipation = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "10", 10);

    const raw = await Bid.aggregate([
      {
        $group: {
          _id: "$vendor",
          totalBids: { $sum: 1 },
        },
      },
      { $sort: { totalBids: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "vendors",
          localField: "_id",
          foreignField: "_id",
          as: "vendor",
        },
      },
      { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          vendorId: "$_id",
          name: { $ifNull: ["$vendor.name", "Unknown vendor"] },
          category: "$vendor.category",
          totalBids: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      vendors: raw,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error fetching vendor participation.",
      success: false,
      error: error.message,
    });
  }
};
