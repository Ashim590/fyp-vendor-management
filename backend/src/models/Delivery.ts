import mongoose, { Schema, Document } from "mongoose";

export type DeliveryStatus =
  | "pending"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "received"
  | "inspected"
  | "rejected";

export interface IDeliveryStatusEntry {
  status: DeliveryStatus;
  note?: string;
  at: Date;
  byUser?: mongoose.Types.ObjectId;
  byName?: string;
}

export interface IDeliveryItem {
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  specifications?: string;
}

export interface IDelivery extends Document {
  deliveryNumber: string;
  /** Legacy PO-based delivery */
  purchaseOrder?: mongoose.Types.ObjectId;
  purchaseOrderNumber: string;
  /** Tender payment (eSewa tender payment) */
  payment?: mongoose.Types.ObjectId;
  /** Invoice eSewa payment */
  invoicePayment?: mongoose.Types.ObjectId;
  tender?: mongoose.Types.ObjectId;
  /** Display reference: PAY-xxxx, INV-xxxx, or PO number */
  orderReference: string;
  vendor: mongoose.Types.ObjectId;
  vendorName: string;
  items: IDeliveryItem[];

  expectedDate: Date;
  actualDate?: Date;
  status: DeliveryStatus;

  statusHistory: IDeliveryStatusEntry[];

  delayReason?: string;
  delayRecordedAt?: Date;
  delayRecordedBy?: mongoose.Types.ObjectId;

  receivedData?: {
    receivedDate: Date;
    receivedBy: string;
    notes?: string;
  };

  inspectionData?: {
    status: string;
    notes: string;
  };
}

const DeliveryItemSchema = new Schema<IDeliveryItem>(
  {
    itemName: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    specifications: { type: String, default: "" },
  },
  { _id: false },
);

const StatusHistorySchema = new Schema<IDeliveryStatusEntry>(
  {
    status: {
      type: String,
      enum: [
        "pending",
        "shipped",
        "in_transit",
        "delivered",
        "received",
        "inspected",
        "rejected",
      ],
      required: true,
    },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    byUser: { type: Schema.Types.ObjectId, ref: "User" },
    byName: { type: String, default: "" },
  },
  { _id: false },
);

const DeliverySchema: Schema<IDelivery> = new Schema(
  {
    deliveryNumber: { type: String, unique: true, index: true },
    purchaseOrder: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      index: true,
    },
    purchaseOrderNumber: { type: String, default: "", trim: true },
    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      sparse: true,
      index: true,
    },
    invoicePayment: {
      type: Schema.Types.ObjectId,
      ref: "InvoicePayment",
      sparse: true,
      index: true,
    },
    tender: { type: Schema.Types.ObjectId, ref: "Tender", index: true },
    orderReference: { type: String, default: "", trim: true, index: true },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    vendorName: { type: String, required: true, trim: true },
    items: { type: [DeliveryItemSchema], default: [] },

    expectedDate: { type: Date },
    actualDate: { type: Date },
    status: {
      type: String,
      enum: [
        "pending",
        "shipped",
        "in_transit",
        "delivered",
        "received",
        "inspected",
        "rejected",
      ],
      default: "pending",
    },

    statusHistory: { type: [StatusHistorySchema], default: [] },

    delayReason: { type: String, default: "" },
    delayRecordedAt: { type: Date },
    delayRecordedBy: { type: Schema.Types.ObjectId, ref: "User" },

    receivedData: {
      receivedDate: { type: Date, default: Date.now },
      receivedBy: { type: String, default: "Unknown" },
      notes: { type: String, default: "" },
    },
    inspectionData: {
      status: { type: String, default: "inspected" },
      notes: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

DeliverySchema.pre("validate", function (next) {
  const hasSource = this.purchaseOrder || this.payment || this.invoicePayment;
  if (!hasSource) {
    return next(
      new Error(
        "Delivery must reference a purchase order, tender payment, or invoice payment",
      ),
    );
  }
  if (!this.expectedDate) {
    this.expectedDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  }
  if (!this.orderReference) {
    if (this.purchaseOrderNumber)
      this.orderReference = this.purchaseOrderNumber;
  }
  next();
});

DeliverySchema.pre("save", async function (next) {
  try {
    if (!this.deliveryNumber) {
      const count = await mongoose.model("Delivery").countDocuments();
      this.deliveryNumber = `DL-${String(count + 1).padStart(6, "0")}`;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

DeliverySchema.index({ status: 1 });
/** Vendor delivery history / dashboards */
DeliverySchema.index({ vendor: 1, createdAt: -1 });
/** On-time delivery aggregate: status + both dates present */
DeliverySchema.index({ status: 1, actualDate: 1, expectedDate: 1 });
/** Dashboard: deliveries with a recorded delay (prefer $ne: '' over regex) */
DeliverySchema.index({ delayReason: 1 }, { sparse: true });

export default mongoose.model<IDelivery>("Delivery", DeliverySchema);
