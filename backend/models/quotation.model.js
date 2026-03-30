import mongoose from "mongoose";

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: {
      type: String,
      required: true,
      unique: true,
    },
    purchaseRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseRequest",
      required: true,
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
    items: [
      {
        itemName: { type: String, required: true },
        description: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        unit: { type: String, required: true },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        specifications: { type: String },
        available: { type: Boolean, default: true },
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
    validityDate: {
      type: Date,
      required: true,
    },
    deliveryDate: {
      type: Date,
      required: true,
    },
    deliveryTerms: {
      type: String,
      trim: true,
    },
    paymentTerms: {
      type: String,
      trim: true,
    },
    warranty: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "submitted",
        "under_review",
        "accepted",
        "rejected",
        "withdrawn",
        "counter_offered",
      ],
      default: "submitted",
    },
    quotedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      trim: true,
    },
    comparisonNotes: {
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
    isSelected: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for faster queries
quotationSchema.index({ quotationNumber: 1 });
quotationSchema.index({ purchaseRequest: 1 });
quotationSchema.index({ vendor: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ createdAt: -1 });

// Auto-generate quotation number before saving
quotationSchema.pre("save", async function (next) {
  if (!this.quotationNumber) {
    const count = await mongoose.model("Quotation").countDocuments();
    this.quotationNumber = `QT-${String(count + 1).padStart(6, "0")}`;
  }
  // Calculate totals
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountAmount = this.subtotal * (this.discountRate / 100);
    const afterDiscount = this.subtotal - discountAmount;
    const taxAmount = afterDiscount * (this.taxRate / 100);
    this.totalAmount = afterDiscount + taxAmount;
    this.discountAmount = discountAmount;
    this.taxAmount = taxAmount;
  }
  next();
});

export const Quotation = mongoose.model("Quotation", quotationSchema);
