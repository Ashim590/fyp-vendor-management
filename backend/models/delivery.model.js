import mongoose from "mongoose";

const deliverySchema = new mongoose.Schema(
  {
    deliveryNumber: {
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
    deliveryDate: {
      type: Date,
      required: true,
    },
    receivedDate: {
      type: Date,
    },
    deliveredBy: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      vehicleNumber: { type: String, trim: true },
    },
    items: [
      {
        itemName: { type: String, required: true },
        orderedQuantity: { type: Number, required: true, min: 0 },
        deliveredQuantity: { type: Number, required: true, min: 0 },
        acceptedQuantity: { type: Number, default: 0, min: 0 },
        rejectedQuantity: { type: Number, default: 0, min: 0 },
        unit: { type: String, required: true },
        unitPrice: { type: Number, min: 0 },
        totalPrice: { type: Number, min: 0 },
        condition: {
          type: String,
          enum: ["pending", "accepted", "rejected", "partially_accepted"],
          default: "pending",
        },
        remarks: { type: String, trim: true },
      },
    ],
    status: {
      type: String,
      enum: [
        "pending",
        "in_transit",
        "delivered",
        "partially_received",
        "received",
        "rejected",
        "cancelled",
      ],
      default: "pending",
    },
    deliveryLocation: {
      type: String,
      required: true,
      trim: true,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    receivedByName: {
      type: String,
      trim: true,
    },
    inspectionStatus: {
      type: String,
      enum: ["pending", "passed", "failed", "conditional"],
      default: "pending",
    },
    inspectionNotes: {
      type: String,
      trim: true,
    },
    inspectionDate: {
      type: Date,
    },
    inspectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isPartialDelivery: {
      type: Boolean,
      default: false,
    },
    remainingItems: [
      {
        itemName: { type: String },
        remainingQuantity: { type: Number, min: 0 },
      },
    ],
    shippingDocuments: [
      {
        name: { type: String },
        url: { type: String },
        type: { type: String },
      },
    ],
    proofOfDelivery: {
      type: String,
    },
    deliveryNotes: {
      type: String,
      trim: true,
    },
    isComplete: {
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
deliverySchema.index({ deliveryNumber: 1 });
deliverySchema.index({ purchaseOrder: 1 });
deliverySchema.index({ vendor: 1 });
deliverySchema.index({ status: 1 });
deliverySchema.index({ deliveryDate: -1 });

// Auto-generate delivery number before saving
deliverySchema.pre("save", async function (next) {
  if (!this.deliveryNumber) {
    const count = await mongoose.model("Delivery").countDocuments();
    this.deliveryNumber = `DLV-${String(count + 1).padStart(6, "0")}`;
  }
  // Calculate total values
  if (this.items && this.items.items && this.items.length > 0) {
    this.items.forEach((item) => {
      item.totalPrice = item.deliveredQuantity * item.unitPrice;
    });
  }
  // Check if delivery is partial
  const totalOrdered = this.items.reduce(
    (sum, item) => sum + item.orderedQuantity,
    0
  );
  const totalDelivered = this.items.reduce(
    (sum, item) => sum + item.deliveredQuantity,
    0
  );
  this.isPartialDelivery = totalDelivered < totalOrdered;
  next();
});

export const Delivery = mongoose.model("Delivery", deliverySchema);
