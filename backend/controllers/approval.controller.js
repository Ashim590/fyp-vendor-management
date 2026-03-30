import { Approval } from "../models/approval.model.js";
import { PurchaseRequest } from "../models/purchaseRequest.model.js";
import { PurchaseOrder } from "../models/purchaseOrder.model.js";
import { Payment } from "../models/payment.model.js";
import { Vendor } from "../models/vendor.model.js";
import { User } from "../models/user.model.js";

// Create an approval request
export const createApproval = async (req, res) => {
  try {
    const {
      entityType,
      entityId,
      title,
      description,
      amount,
      priority,
      comments,
    } = req.body;

    if (!entityType || !entityId || !title) {
      return res.status(400).json({
        message: "Entity type, entity ID, and title are required.",
        success: false,
      });
    }

    // Get requester info
    const user = await User.findById(req.id);

    let entity;
    let approverRole = "department_head";

    // Determine approval level based on amount
    let requiredLevels = 1;
    if (amount > 10000) {
      requiredLevels = 2;
      approverRole = "procurement_manager";
    }
    if (amount > 50000) {
      requiredLevels = 3;
      approverRole = "finance_manager";
    }
    if (amount > 100000) {
      requiredLevels = 4;
      approverRole = "director";
    }

    // Get the entity to approve
    switch (entityType) {
      case "purchase_request":
        entity = await PurchaseRequest.findById(entityId);
        break;
      case "purchase_order":
        entity = await PurchaseOrder.findById(entityId);
        break;
      case "payment":
        entity = await Payment.findById(entityId);
        break;
      case "vendor":
        entity = await Vendor.findById(entityId);
        break;
      default:
        return res.status(400).json({
          message: "Invalid entity type.",
          success: false,
        });
    }

    if (!entity) {
      return res.status(404).json({
        message: "Entity not found.",
        success: false,
      });
    }

    const approval = await Approval.create({
      entityType,
      entityId,
      purchaseRequest: entityType === "purchase_request" ? entityId : undefined,
      purchaseOrder: entityType === "purchase_order" ? entityId : undefined,
      payment: entityType === "payment" ? entityId : undefined,
      vendor: entityType === "vendor" ? entityId : undefined,
      requester: req.id,
      requesterName: user.fullname,
      requesterDepartment: user.department || "General",
      title,
      description,
      amount: amount || 0,
      approverRole,
      requiredLevels,
      currentLevel: 1,
      priority: priority || "medium",
      comments,
      status: "pending",
    });

    return res.status(201).json({
      message: "Approval request created successfully.",
      approval,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error creating approval request.",
      success: false,
      error: error.message,
    });
  }
};

// Get all approvals (with filters)
export const getAllApprovals = async (req, res) => {
  try {
    const {
      status,
      entityType,
      requester,
      approverRole,
      priority,
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (entityType) query.entityType = entityType;
    if (requester) query.requester = requester;
    if (approverRole) query.approverRole = approverRole;
    if (priority) query.priority = priority;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const approvals = await Approval.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("requester", "fullname email department")
      .populate("currentApprover", "fullname email")
      .populate("approvedBy", "fullname email");

    const total = await Approval.countDocuments(query);

    return res.status(200).json({
      approvals,
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
      message: "Error fetching approvals.",
      success: false,
      error: error.message,
    });
  }
};

// Get approval by ID
export const getApprovalById = async (req, res) => {
  try {
    const approvalId = req.params.id;
    const approval = await Approval.findById(approvalId)
      .populate("requester", "fullname email department")
      .populate("currentApprover", "fullname email")
      .populate("approvedBy", "fullname email")
      .populate("approvalHistory.approver", "fullname email");

    if (!approval) {
      return res.status(404).json({
        message: "Approval not found.",
        success: false,
      });
    }

    return res.status(200).json({
      approval,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching approval.",
      success: false,
      error: error.message,
    });
  }
};

// Get pending approvals for current user
export const getMyPendingApprovals = async (req, res) => {
  try {
    const user = await User.findById(req.id);
    const { page = 1, limit = 10 } = req.query;

    // Get approvals where user is the current approver or user has the required role
    const query = {
      status: "pending",
      $or: [
        { currentApprover: req.id },
        { approverRole: user.role === "admin" ? { $exists: true } : user.role },
      ],
    };

    const skip = (page - 1) * limit;

    const approvals = await Approval.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("requester", "fullname email department")
      .populate("currentApprover", "fullname email");

    const total = await Approval.countDocuments(query);

    return res.status(200).json({
      approvals,
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
      message: "Error fetching pending approvals.",
      success: false,
      error: error.message,
    });
  }
};

// Approve an approval request
export const approveRequest = async (req, res) => {
  try {
    const approvalId = req.params.id;
    const { comments } = req.body;

    const approval = await Approval.findById(approvalId).populate(
      "requester",
      "fullname email"
    );

    if (!approval) {
      return res.status(404).json({
        message: "Approval not found.",
        success: false,
      });
    }

    if (approval.status !== "pending") {
      return res.status(400).json({
        message: "Approval is not pending.",
        success: false,
      });
    }

    // Add to approval history
    approval.approvalHistory.push({
      level: approval.currentLevel,
      approver: req.id,
      approverName: (await User.findById(req.id)).fullname,
      status: "approved",
      comments,
      actionDate: new Date(),
    });

    // Check if this is the final approval
    if (approval.currentLevel >= approval.requiredLevels) {
      approval.status = "approved";
      approval.isFinalApproval = true;
      approval.approvedBy = req.id;
      approval.approvedAt = new Date();
    } else {
      // Move to next approval level
      approval.currentLevel += 1;
      // Update entity status based on entity type
      await updateEntityStatus(
        approval.entityType,
        approval.entityId,
        "approved"
      );
    }

    await approval.save();

    // Update the original entity
    await updateEntityStatus(
      approval.entityType,
      approval.entityId,
      "approved"
    );

    return res.status(200).json({
      message: "Approval granted successfully.",
      approval,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error approving request.",
      success: false,
      error: error.message,
    });
  }
};

// Reject an approval request
export const rejectRequest = async (req, res) => {
  try {
    const approvalId = req.params.id;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        message: "Rejection reason is required.",
        success: false,
      });
    }

    const approval = await Approval.findById(approvalId);

    if (!approval) {
      return res.status(404).json({
        message: "Approval not found.",
        success: false,
      });
    }

    if (approval.status !== "pending") {
      return res.status(400).json({
        message: "Approval is not pending.",
        success: false,
      });
    }

    // Add to approval history
    approval.approvalHistory.push({
      level: approval.currentLevel,
      approver: req.id,
      approverName: (await User.findById(req.id)).fullname,
      status: "rejected",
      comments: rejectionReason,
      actionDate: new Date(),
    });

    approval.status = "rejected";
    approval.rejectionReason = rejectionReason;
    approval.approvedBy = req.id;
    approval.approvedAt = new Date();

    await approval.save();

    // Update the original entity
    await updateEntityStatus(
      approval.entityType,
      approval.entityId,
      "rejected",
      rejectionReason
    );

    return res.status(200).json({
      message: "Approval rejected.",
      approval,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error rejecting request.",
      success: false,
      error: error.message,
    });
  }
};

// Return an approval request for revision
export const returnRequest = async (req, res) => {
  try {
    const approvalId = req.params.id;
    const { comments } = req.body;

    const approval = await Approval.findById(approvalId);

    if (!approval) {
      return res.status(404).json({
        message: "Approval not found.",
        success: false,
      });
    }

    if (approval.status !== "pending") {
      return res.status(400).json({
        message: "Approval is not pending.",
        success: false,
      });
    }

    // Add to approval history
    approval.approvalHistory.push({
      level: approval.currentLevel,
      approver: req.id,
      approverName: (await User.findById(req.id)).fullname,
      status: "returned",
      comments,
      actionDate: new Date(),
    });

    approval.status = "returned";
    approval.comments = comments;

    await approval.save();

    return res.status(200).json({
      message: "Approval returned for revision.",
      approval,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error returning request.",
      success: false,
      error: error.message,
    });
  }
};

// Get my approval requests (ones I requested)
export const getMyApprovalRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { requester: req.id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const approvals = await Approval.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("currentApprover", "fullname email");

    const total = await Approval.countDocuments(query);

    return res.status(200).json({
      approvals,
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
      message: "Error fetching approval requests.",
      success: false,
      error: error.message,
    });
  }
};

// Helper function to update entity status
async function updateEntityStatus(entityType, entityId, status, reason = null) {
  switch (entityType) {
    case "purchase_request":
      await PurchaseRequest.findByIdAndUpdate(entityId, { status });
      break;
    case "purchase_order":
      await PurchaseOrder.findByIdAndUpdate(entityId, {
        status,
        rejectionReason: reason,
      });
      break;
    case "payment":
      await Payment.findByIdAndUpdate(entityId, { status });
      break;
    case "vendor":
      await Vendor.findByIdAndUpdate(entityId, { status });
      break;
  }
}

// Get approval statistics
export const getApprovalStats = async (req, res) => {
  try {
    const totalApprovals = await Approval.countDocuments();
    const pendingApprovals = await Approval.countDocuments({
      status: "pending",
    });
    const approvedApprovals = await Approval.countDocuments({
      status: "approved",
    });
    const rejectedApprovals = await Approval.countDocuments({
      status: "rejected",
    });

    const entityTypeStats = await Approval.aggregate([
      { $group: { _id: "$entityType", count: { $sum: 1 } } },
    ]);

    return res.status(200).json({
      stats: {
        totalApprovals,
        pendingApprovals,
        approvedApprovals,
        rejectedApprovals,
        entityTypeStats,
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
