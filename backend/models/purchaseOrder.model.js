import mongoose from "mongoose";

const purchaseOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    purchaseRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseRequest",
    },
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quotation",
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    vendorName: {
      type: String,
      required: true,
    },
    vendorAddress: {
      type: String,
    },
    vendorContact: {
      type: String,
    },
    orderDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expectedDeliveryDate: {
      type: Date,
      required: true,
    },
    items: [
      {
        itemName: { type: String, required: true },
        description: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        unit: { type: String, required: true },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        specifications: { type: String },
        deliveredQuantity: { type: Number, default: 0 },
      },
    ],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    discountRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    currency: {
      type: String,
      default: "USD",
    },
    paymentTerms: {
      type: String,
      trim: true,
    },
    deliveryTerms: {
      type: String,
      trim: true,
    },
    deliveryLocation: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "ordered",
        "partial_delivered",
        "delivered",
        "cancelled",
        "closed",
      ],
      default: "draft",
    },
    approval: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Approval",
    },
    orderedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    approvals: [
      {
        approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: { type: String, enum: ["approved", "rejected"] },
        comments: { type: String },
        approvedAt: { type: Date },
      },
    ],
    isApproved: {
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
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
    },
    payments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],
    deliveries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Delivery",
      },
    ],
    notes: {
      type: String,
      trim: true,
    },
    termsAndConditions: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for faster queries
purchaseOrderSchema.index({ orderNumber: 1 });
purchaseOrderSchema.index({ purchaseRequest: 1 });
purchaseOrderSchema.index({ vendor: 1 });
purchaseOrderSchema.index({ status: 1 });
purchaseOrderSchema.index({ orderedBy: 1 });
purchaseOrderSchema.index({ orderDate: -1 });

// Auto-generate order number before saving
purchaseOrderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model("PurchaseOrder").countDocuments();
    this.orderNumber = `PO-${String(count + 1).padStart(6, "0")}`;
  }
  // Calculate totals
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  }
  const discountAmount = this.subtotal * (this.discountRate / 100);
  const afterDiscount = this.subtotal - discountAmount;
  const taxAmount = afterDiscount * (this.taxRate / 100);
  this.totalAmount = afterDiscount + taxAmount + this.shippingCost;
  this.discountAmount = discountAmount;
  this.taxAmount = taxAmount;
  next();
});

export const PurchaseOrder = mongoose.model(
  "PurchaseOrder",
  purchaseOrderSchema
);
