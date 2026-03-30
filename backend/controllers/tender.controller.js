import { Tender } from "../models/tender.model.js";
import { Notification } from "../models/notification.model.js";

const generateRef = () =>
  "TDR-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

export const createTender = async (req, res) => {
  try {
    const {
      title,
      description,
      openDate,
      closeDate,
      category,
      budget,
      budgetRange,
      requirements,
      status,
    } = req.body;

    if (!title || !description || !openDate || !closeDate || !category) {
      return res.status(400).json({
        message: "Title, description, open date, close date, and category are required.",
        success: false,
      });
    }

    const referenceNumber = generateRef();
    const tender = await Tender.create({
      title,
      referenceNumber,
      description,
      createdBy: req.id,
      openDate,
      closeDate,
      category,
      budget: budget ? Number(budget) : undefined,
      budgetRange: budgetRange ? JSON.parse(budgetRange) : undefined,
      requirements: requirements || "",
      status: status || "DRAFT",
    });

    return res.status(201).json({
      message: "Tender created successfully.",
      tender,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error creating tender.",
      success: false,
      error: error.message,
    });
  }
};

export const getAllTenders = async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { referenceNumber: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const tenders = await Tender.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "fullname email")
      .populate("awardedVendor", "name email");

    const total = await Tender.countDocuments(query);

    return res.status(200).json({
      tenders,
      success: true,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error fetching tenders.",
      success: false,
      error: error.message,
    });
  }
};

export const getTenderById = async (req, res) => {
  try {
    const tender = await Tender.findById(req.params.id)
      .populate("createdBy", "fullname email")
      .populate("awardedVendor", "name email category");

    if (!tender) {
      return res.status(404).json({
        message: "Tender not found.",
        success: false,
      });
    }

    return res.status(200).json({
      tender,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error fetching tender.",
      success: false,
      error: error.message,
    });
  }
};

export const updateTender = async (req, res) => {
  try {
    const {
      title,
      description,
      openDate,
      closeDate,
      category,
      budget,
      budgetRange,
      requirements,
      status,
    } = req.body;

    const tender = await Tender.findByIdAndUpdate(
      req.params.id,
      {
        ...(title && { title }),
        ...(description && { description }),
        ...(openDate && { openDate }),
        ...(closeDate && { closeDate }),
        ...(category && { category }),
        ...(budget !== undefined && { budget: Number(budget) }),
        ...(budgetRange && { budgetRange: typeof budgetRange === "string" ? JSON.parse(budgetRange) : budgetRange }),
        ...(requirements !== undefined && { requirements }),
        ...(status && { status }),
      },
      { new: true }
    )
      .populate("createdBy", "fullname email")
      .populate("awardedVendor", "name email");

    if (!tender) {
      return res.status(404).json({
        message: "Tender not found.",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Tender updated successfully.",
      tender,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error updating tender.",
      success: false,
      error: error.message,
    });
  }
};

export const publishTender = async (req, res) => {
  try {
    const tender = await Tender.findByIdAndUpdate(
      req.params.id,
      { status: "PUBLISHED" },
      { new: true }
    );

    if (!tender) {
      return res.status(404).json({
        message: "Tender not found.",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Tender published.",
      tender,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error publishing tender.",
      success: false,
      error: error.message,
    });
  }
};

export const closeTender = async (req, res) => {
  try {
    const tender = await Tender.findByIdAndUpdate(
      req.params.id,
      { status: "CLOSED" },
      { new: true }
    );

    if (!tender) {
      return res.status(404).json({
        message: "Tender not found.",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Tender closed.",
      tender,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error closing tender.",
      success: false,
      error: error.message,
    });
  }
};
