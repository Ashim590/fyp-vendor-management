import mongoose, { Schema, Document } from "mongoose";
import {
  DELIVERY_STATUS,
  DeliveryWorkflowStatus,
  normalizeDeliveryStatus,
} from "../constants/deliveryWorkflow";

export type DeliveryStatus = DeliveryWorkflowStatus;

export interface IDeliveryStatusEntry {
  status: string;
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
  /** Backward-compatible mirror of `status` for reporting/UI payloads. */
  deliveryStatus?: string;
  deliveryNumber: string;
  /** Duplicate of orderReference for API clarity (audit / integrations). */
  orderRef: string;
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
  /** Timestamp when procurement geo-confirms receipt. */
  deliveredAt?: Date;
  status: DeliveryStatus;
  deliveryLocation?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  /** Optional proof from vendor before procurement verification. */
  vendorProofImage?: string;
  /** Proof image from procurement geo-confirmation (or legacy field name). */
  deliveryProofImage?: string;

  statusHistory: IDeliveryStatusEntry[];

  delayReason?: string;
  delayRecordedAt?: Date;
  delayRecordedBy?: mongoose.Types.ObjectId;

  receivedData?: {
    receivedDate: Date;
    receivedBy: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    capturedAt?: Date;
    confirmedFromIp?: string;
  };

  inspectionData?: {
    status: string;
    notes: string;
  };
}

/** Canonical + legacy lowercase (pre-validate normalizes to uppercase on save). */
const DELIVERY_STATUS_ENUM = [
  ...Object.values(DELIVERY_STATUS),
  "pending",
  "shipped",
  "in_transit",
  "delivered",
  "received",
  "inspected",
  "rejected",
];

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
    status: { type: String, required: true, trim: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    byUser: { type: Schema.Types.ObjectId, ref: "User" },
    byName: { type: String, default: "" },
  },
  { _id: false },
);

const DeliverySchema: Schema<IDelivery> = new Schema(
  {
    deliveryStatus: {
      type: String,
      enum: DELIVERY_STATUS_ENUM,
      default: DELIVERY_STATUS.PENDING,
    },
    deliveryNumber: { type: String, unique: true, index: true },
    orderRef: { type: String, default: "", trim: true, index: true },
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
    deliveredAt: { type: Date },
    status: {
      type: String,
      enum: DELIVERY_STATUS_ENUM,
      default: DELIVERY_STATUS.PENDING,
    },
    deliveryLocation: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },
    vendorProofImage: { type: String, default: "" },
    deliveryProofImage: { type: String, default: "" },

    statusHistory: { type: [StatusHistorySchema], default: [] },

    delayReason: { type: String, default: "" },
    delayRecordedAt: { type: Date },
    delayRecordedBy: { type: Schema.Types.ObjectId, ref: "User" },

    receivedData: {
      receivedDate: { type: Date, default: Date.now },
      receivedBy: { type: String, default: "Unknown" },
      notes: { type: String, default: "" },
      latitude: { type: Number },
      longitude: { type: Number },
      accuracyMeters: { type: Number },
      capturedAt: { type: Date },
      confirmedFromIp: { type: String, default: "" },
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
  if (!this.orderRef && this.orderReference) {
    this.orderRef = this.orderReference;
  }
  if (!this.orderReference && this.orderRef) {
    this.orderReference = this.orderRef;
  }

  this.status = normalizeDeliveryStatus(this.status as string);
  this.deliveryStatus = this.status;

  // Keep geo field optional and valid for 2dsphere index.
  const coords = this.deliveryLocation?.coordinates;
  const hasValidCoords =
    Array.isArray(coords) &&
    coords.length >= 2 &&
    Number.isFinite(coords[0]) &&
    Number.isFinite(coords[1]);
  if (!hasValidCoords) {
    this.deliveryLocation = undefined;
  } else if (this.deliveryLocation) {
    this.deliveryLocation.type = "Point";
    this.deliveryLocation.coordinates = [Number(coords[0]), Number(coords[1])] as [
      number,
      number,
    ];
  }
  next();
});

DeliverySchema.pre("save", async function (next) {
  try {
    this.deliveryStatus = this.status;

    /** After geo-verification, lock proof fields for audit integrity (NGO procurement). */
    if (!this.isNew && this._id) {
      const prev = (await mongoose
        .model("Delivery")
        .findById(this._id)
        .select("status")
        .lean()) as { status?: string } | null;
      if (
        prev &&
        normalizeDeliveryStatus(prev.status as string) === DELIVERY_STATUS.VERIFIED
      ) {
        if (
          this.isModified("deliveryLocation") ||
          this.isModified("deliveredAt") ||
          this.isModified("receivedData")
        ) {
          return next(
            new Error(
              "Verified delivery geo proof (location, deliveredAt, received data) is immutable",
            ),
          );
        }
      }
    }

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
DeliverySchema.index(
  { deliveryLocation: "2dsphere" },
  {
    sparse: true,
    partialFilterExpression: {
      "deliveryLocation.type": "Point",
      "deliveryLocation.coordinates.1": { $exists: true },
    },
  },
);
DeliverySchema.index({ vendor: 1, createdAt: -1 });
DeliverySchema.index({ status: 1, actualDate: 1, expectedDate: 1 });
DeliverySchema.index({ delayReason: 1 }, { sparse: true });

export default mongoose.model<IDelivery>("Delivery", DeliverySchema);
