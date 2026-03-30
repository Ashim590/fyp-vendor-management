import mongoose from "mongoose";

const approvalSchema = new mongoose.Schema(
  {
    approvalNumber: {
      type: String,
      required: true,
      unique: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ["purchase_request", "purchase_order", "payment", "vendor"],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "entityType",
    },
    purchaseRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseRequest",
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requesterName: {
      type: String,
      required: true,
    },
    requesterDepartment: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    approverLevel: {
      type: Number,
      required: true,
      default: 1,
    },
    currentApprover: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approverRole: {
      type: String,
      enum: [
        "department_head",
        "procurement_manager",
        "finance_manager",
        "director",
        "admin",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "returned", "cancelled"],
      default: "pending",
    },
    approvalHistory: [
      {
        level: { type: Number },
        approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        approverName: { type: String },
        status: {
          type: String,
          enum: ["approved", "rejected", "returned"],
        },
        comments: { type: String },
        actionDate: { type: Date, default: Date.now },
      },
    ],
    currentLevel: {
      type: Number,
      default: 1,
    },
    requiredLevels: {
      type: Number,
      default: 1,
    },
    isFinalApproval: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    dueDate: {
      type: Date,
    },
    comments: {
      type: String,
      trim: true,
    },
    attachments: [
      {
        name: { type: String },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for faster queries
approvalSchema.index({ approvalNumber: 1 });
approvalSchema.index({ entityType: 1, entityId: 1 });
approvalSchema.index({ status: 1 });
approvalSchema.index({ requester: 1 });
approvalSchema.index({ currentApprover: 1 });
approvalSchema.index({ createdAt: -1 });

// Auto-generate approval number before saving
approvalSchema.pre("save", async function (next) {
  if (!this.approvalNumber) {
    const count = await mongoose.model("Approval").countDocuments();
    this.approvalNumber = `APR-${String(count + 1).padStart(6, "0")}`;
  }
  next();
});

export const Approval = mongoose.model("Approval", approvalSchema);
