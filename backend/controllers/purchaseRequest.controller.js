import { PurchaseRequest } from "../models/purchaseRequest.model.js";
import { Quotation } from "../models/quotation.model.js";
import { User } from "../models/user.model.js";

// Create a new purchase request
export const createPurchaseRequest = async (req, res) => {
  try {
    const {
      title,
      description,
      department,
      items,
      priority,
      requiredDate,
      deliveryLocation,
      justification,
      notes,
    } = req.body;

    if (
      !title ||
      !description ||
      !department ||
      !items ||
      !requiredDate ||
      !deliveryLocation
    ) {
      return res.status(400).json({
        message: "All required fields must be provided.",
        success: false,
      });
    }

    const purchaseRequest = await PurchaseRequest.create({
      title,
      description,
      department,
      items: JSON.parse(items),
      priority: priority || "medium",
      requiredDate,
      deliveryLocation,
      justification,
      notes,
      requester: req.id,
      status: "draft",
    });

    return res.status(201).json({
      message: "Purchase request created successfully.",
      purchaseRequest,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error creating purchase request.",
      success: false,
      error: error.message,
    });
  }
};

// Get all purchase requests (with filters)
export const getAllPurchaseRequests = async (req, res) => {
  try {
    const {
      status,
      department,
      priority,
      search,
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (department) query.department = department;
    if (priority) query.priority = priority;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { requestNumber: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const purchaseRequests = await PurchaseRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("requester", "fullname email department")
      .populate("selectedQuotation");

    const total = await PurchaseRequest.countDocuments(query);

    return res.status(200).json({
      purchaseRequests,
      success: true,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching purchase requests.",
      success: false,
      error: error.message,
    });
  }
};

// Get purchase request by ID
export const getPurchaseRequestById = async (req, res) => {
  try {
    const requestId = req.params.id;
    const purchaseRequest = await PurchaseRequest.findById(requestId)
      .populate("requester", "fullname email department designation")
      .populate("quotations")
      .populate("selectedQuotation")
      .populate("purchaseOrder")
      .populate("approvalStatus.currentApprover", "fullname email")
      .populate("approvalStatus.approvedBy", "fullname email");

    if (!purchaseRequest) {
      return res.status(404).json({
        message: "Purchase request not found.",
        success: false,
      });
    }

    return res.status(200).json({
      purchaseRequest,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching purchase request.",
      success: false,
      error: error.message,
    });
  }
};

// Update purchase request
export const updatePurchaseRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const {
      title,
      description,
      department,
      items,
      priority,
      requiredDate,
      deliveryLocation,
      justification,
      notes,
      status,
    } = req.body;

    const purchaseRequest = await PurchaseRequest.findById(requestId);

    if (!purchaseRequest) {
      return res.status(404).json({
        message: "Purchase request not found.",
        success: false,
      });
    }

    // Only allow editing if in draft status
    if (
      purchaseRequest.status !== "draft" &&
      purchaseRequest.status !== "rejected"
    ) {
      return res.status(400).json({
        message: "Cannot edit purchase request in current status.",
        success: false,
      });
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (department) updateData.department = department;
    if (items) updateData.items = JSON.parse(items);
    if (priority) updateData.priority = priority;
    if (requiredDate) updateData.requiredDate = requiredDate;
    if (deliveryLocation) updateData.deliveryLocation = deliveryLocation;
    if (justification) updateData.justification = justification;
    if (notes) updateData.notes = notes;
    if (status) updateData.status = status;

    const updatedRequest = await PurchaseRequest.findByIdAndUpdate(
      requestId,
      updateData,
      { new: true }
    );

    return res.status(200).json({
      message: "Purchase request updated successfully.",
      purchaseRequest: updatedRequest,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error updating purchase request.",
      success: false,
      error: error.message,
    });
  }
};

// Submit purchase request for approval
export const submitForApproval = async (req, res) => {
  try {
    const requestId = req.params.id;

    const purchaseRequest = await PurchaseRequest.findById(requestId).populate(
      "requester",
      "fullname email department approvalLimit"
    );

    if (!purchaseRequest) {
      return res.status(404).json({
        message: "Purchase request not found.",
        success: false,
      });
    }

    if (purchaseRequest.status !== "draft") {
      return res.status(400).json({
        message: "Purchase request already submitted.",
        success: false,
      });
    }

    // Determine approval workflow based on amount
    let approvalLevel = 1;
    let approverRole = "department_head";

    if (purchaseRequest.totalEstimatedAmount > 10000) {
      approvalLevel = 2;
      approverRole = "procurement_manager";
    }
    if (purchaseRequest.totalEstimatedAmount > 50000) {
      approvalLevel = 3;
      approverRole = "finance_manager";
    }
    if (purchaseRequest.totalEstimatedAmount > 100000) {
      approvalLevel = 4;
      approverRole = "director";
    }

    purchaseRequest.status = "pending_approval";
    purchaseRequest.approvalStatus = {
      approvalLevel,
      currentApprover: null, // Will be assigned by approval workflow
    };

    await purchaseRequest.save();

    return res.status(200).json({
      message: "Purchase request submitted for approval.",
      purchaseRequest,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error submitting purchase request.",
      success: false,
      error: error.message,
    });
  }
};

// Cancel purchase request
export const cancelPurchaseRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const { cancellationReason } = req.body;

    const purchaseRequest = await PurchaseRequest.findById(requestId);

    if (!purchaseRequest) {
      return res.status(404).json({
        message: "Purchase request not found.",
        success: false,
      });
    }

    if (
      purchaseRequest.status === "completed" ||
      purchaseRequest.status === "po_created"
    ) {
      return res.status(400).json({
        message: "Cannot cancel purchase request in current status.",
        success: false,
      });
    }

    purchaseRequest.status = "cancelled";
    purchaseRequest.notes = cancellationReason
      ? `${purchaseRequest.notes || ""}\nCancellation: ${cancellationReason}`
      : purchaseRequest.notes;

    await purchaseRequest.save();

    return res.status(200).json({
      message: "Purchase request cancelled.",
      purchaseRequest,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error cancelling purchase request.",
      success: false,
      error: error.message,
    });
  }
};

// Get my purchase requests (for logged in user)
export const getMyPurchaseRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { requester: req.id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const purchaseRequests = await PurchaseRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("selectedQuotation");

    const total = await PurchaseRequest.countDocuments(query);

    return res.status(200).json({
      purchaseRequests,
      success: true,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching purchase requests.",
      success: false,
      error: error.message,
    });
  }
};

// Get purchase request statistics
export const getPurchaseRequestStats = async (req, res) => {
  try {
    const totalRequests = await PurchaseRequest.countDocuments();
    const pendingRequests = await PurchaseRequest.countDocuments({
      status: "pending_approval",
    });
    const approvedRequests = await PurchaseRequest.countDocuments({
      status: "approved",
    });
    const rejectedRequests = await PurchaseRequest.countDocuments({
      status: "rejected",
    });
    const completedRequests = await PurchaseRequest.countDocuments({
      status: "completed",
    });

    const departmentStats = await PurchaseRequest.aggregate([
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalEstimatedAmount" },
        },
      },
    ]);

    const priorityStats = await PurchaseRequest.aggregate([
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    return res.status(200).json({
      stats: {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        completedRequests,
        departmentStats,
        priorityStats,
      },
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching statistics.",
      success: false,
      error: error.message,
    });
  }
};

// Delete purchase request
export const deletePurchaseRequest = async (req, res) => {
  try {
    const requestId = req.params.id;

    const purchaseRequest = await PurchaseRequest.findById(requestId);

    if (!purchaseRequest) {
      return res.status(404).json({
        message: "Purchase request not found.",
        success: false,
      });
    }

    // Only allow deletion if in draft status
    if (purchaseRequest.status !== "draft") {
      return res.status(400).json({
        message: "Only draft purchase requests can be deleted.",
        success: false,
      });
    }

    await PurchaseRequest.findByIdAndDelete(requestId);

    return res.status(200).json({
      message: "Purchase request deleted successfully.",
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error deleting purchase request.",
      success: false,
      error: error.message,
    });
  }
};
