import mongoose from "mongoose";

const purchaseRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    items: [
      {
        itemName: { type: String, required: true },
        description: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        unit: { type: String, required: true },
        estimatedUnitPrice: { type: Number, default: 0 },
        totalPrice: { type: Number, default: 0 },
        specifications: { type: String },
        category: {
          type: String,
          enum: [
            "office_supplies",
            "it_equipment",
            "furniture",
            "food_supplies",
            "medical_supplies",
            "cleaning_supplies",
            "printing",
            "other",
          ],
          default: "other",
        },
      },
    ],
    totalEstimatedAmount: {
      type: Number,
      default: 0,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "cancelled",
        "quotation_received",
        "po_created",
        "completed",
      ],
      default: "draft",
    },
    requiredDate: {
      type: Date,
      required: true,
    },
    deliveryLocation: {
      type: String,
      required: true,
      trim: true,
    },
    justification: {
      type: String,
      trim: true,
    },
    attachedDocuments: [
      {
        name: { type: String },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    quotations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Quotation",
      },
    ],
    selectedQuotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },
    approvalStatus: {
      currentApprover: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      approvalLevel: { type: Number, default: 1 },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      approvedAt: { type: Date },
      rejectionReason: { type: String },
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for faster queries
purchaseRequestSchema.index({ requestNumber: 1 });
purchaseRequestSchema.index({ status: 1 });
purchaseRequestSchema.index({ requester: 1 });
purchaseRequestSchema.index({ department: 1 });
purchaseRequestSchema.index({ createdAt: -1 });

// Auto-generate request number before saving
purchaseRequestSchema.pre("save", async function (next) {
  if (!this.requestNumber) {
    const count = await mongoose.model("PurchaseRequest").countDocuments();
    this.requestNumber = `PR-${String(count + 1).padStart(6, "0")}`;
  }
  // Calculate total estimated amount
  if (this.items && this.items.length > 0) {
    this.totalEstimatedAmount = this.items.reduce((sum, item) => {
      return sum + item.quantity * item.estimatedUnitPrice;
    }, 0);
  }
  next();
});

export const PurchaseRequest = mongoose.model(
  "PurchaseRequest",
  purchaseRequestSchema
);
