import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
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
    vendorAddress: {
      type: String,
    },
    vendorTaxId: {
      type: String,
    },
    invoiceDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueDate: {
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
        taxRate: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
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
    currency: {
      type: String,
      default: "USD",
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
    status: {
      type: String,
      enum: [
        "draft",
        "pending",
        "sent",
        "viewed",
        "paid",
        "partial_payment",
        "overdue",
        "cancelled",
        "disputed",
      ],
      default: "draft",
    },
    invoiceType: {
      type: String,
      enum: ["standard", "proforma", "credit_note", "debit_note"],
      default: "standard",
    },
    relatedInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
    },
    payments: [
      {
        payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
        amount: { type: Number, min: 0 },
        paymentDate: { type: Date },
      },
    ],
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceDue: {
      type: Number,
      default: 0,
      min: 0,
    },
    billingAddress: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      postalCode: { type: String },
    },
    shippingAddress: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      postalCode: { type: String },
    },
    paymentTerms: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    termsAndConditions: {
      type: String,
      trim: true,
    },
    bankDetails: {
      bankName: { type: String },
      accountNumber: { type: String },
      routingNumber: { type: String },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sentDate: {
      type: Date,
    },
    viewedDate: {
      type: Date,
    },
    paidDate: {
      type: Date,
    },
    attachments: [
      {
        name: { type: String },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Index for faster queries
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ purchaseOrder: 1 });
invoiceSchema.index({ vendor: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ dueDate: 1 });

// Auto-generate invoice number before saving
invoiceSchema.pre("save", async function (next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model("Invoice").countDocuments();
    this.invoiceNumber = `INV-${String(count + 1).padStart(6, "0")}`;
  }
  // Calculate totals
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.taxAmount = this.items.reduce((sum, item) => sum + item.taxAmount, 0);
  }
  const discountAmount = this.subtotal * (this.discountRate / 100);
  const afterDiscount = this.subtotal - discountAmount;
  this.totalAmount = afterDiscount + this.taxAmount + this.shippingCost;
  this.discountAmount = discountAmount;
  this.balanceDue = this.totalAmount - this.totalPaid;
  next();
});

export const Invoice = mongoose.model("Invoice", invoiceSchema);
