import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
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
    vendorBankAccount: {
      bankName: { type: String },
      accountNumber: { type: String },
      accountName: { type: String },
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    exchangeRate: {
      type: Number,
      default: 1,
    },
    amountInBaseCurrency: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: [
        "cash",
        "bank_transfer",
        "cheque",
        "credit_card",
        "mobile_payment",
        "other",
      ],
      required: true,
    },
    paymentType: {
      type: String,
      enum: ["full", "partial", "advance"],
      default: "full",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "approved",
        "rejected",
        "completed",
        "failed",
        "cancelled",
        "refunded",
      ],
      default: "pending",
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    transactionId: {
      type: String,
      trim: true,
    },
    bankReference: {
      type: String,
      trim: true,
    },
    chequeDetails: {
      chequeNumber: { type: String },
      chequeDate: { type: Date },
      bankName: { type: String },
      branchName: { type: String },
    },
    approval: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Approval",
    },
    approvalStatus: {
      required: { type: Boolean, default: false },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      approvedAt: { type: Date },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestedByName: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedByName: {
      type: String,
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    processedAt: {
      type: Date,
    },
    completedDate: {
      type: Date,
    },
    attachments: [
      {
        name: { type: String },
        url: { type: String },
        type: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    proofOfPayment: {
      type: String,
    },
    remarks: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    dueDate: {
      type: Date,
    },
    isEarlyPayment: {
      type: Boolean,
      default: false,
    },
    earlyPaymentDiscount: {
      type: Number,
      default: 0,
    },
    latePaymentPenalty: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for faster queries
paymentSchema.index({ paymentNumber: 1 });
paymentSchema.index({ invoice: 1 });
paymentSchema.index({ purchaseOrder: 1 });
paymentSchema.index({ vendor: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ requestedBy: 1 });

// Auto-generate payment number before saving
paymentSchema.pre("save", async function (next) {
  if (!this.paymentNumber) {
    const count = await mongoose.model("Payment").countDocuments();
    this.paymentNumber = `PAY-${String(count + 1).padStart(6, "0")}`;
  }
  // Calculate amount in base currency
  this.amountInBaseCurrency = this.amount * this.exchangeRate;
  next();
});

export const Payment = mongoose.model("Payment", paymentSchema);
