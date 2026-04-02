import mongoose, { Schema, Document } from "mongoose";

export type PaymentStatus = "Pending" | "Completed" | "Failed";

export type PaymentMethod = "eSewa";

export interface IPayment extends Document {
  paymentNumber: string;
  tender: mongoose.Types.ObjectId;
  tenderReference: string;
  bid?: mongoose.Types.ObjectId;
  vendor: mongoose.Types.ObjectId;
  vendorName: string;
  vendorRegistrationNumber?: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  provider?: string;
  transactionId?: string;
  payerMobileNumber?: string;
  qrImage?: string;
  gatewayProvider?: string;
  gatewayTransactionUuid?: string;
  /** Every UUID sent to eSewa on initiate (latest also in gatewayTransactionUuid). Used to match callback after re-initiate. */
  esewaTransactionUuidHistory?: string[];
  gatewayResponseRaw?: string;
  paymentDate?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  notes?: string;
  /** Set when eSewa checkout is started — controls post-callback redirect */
  esewaReturnTo?: 'vendor' | 'staff';
}

const PaymentSchema: Schema<IPayment> = new Schema(
  {
    paymentNumber: { type: String, unique: true, index: true },
    tender: {
      type: Schema.Types.ObjectId,
      ref: "Tender",
      required: true,
      index: true,
    },
    tenderReference: { type: String, required: true, trim: true },
    bid: { type: Schema.Types.ObjectId, ref: "Bid" },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    vendorName: { type: String, required: true, trim: true },
    vendorRegistrationNumber: { type: String, trim: true, default: "" },
    amount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["Pending", "Completed", "Failed"],
      default: "Pending",
    },
    method: {
      type: String,
      enum: ["eSewa"],
      default: "eSewa",
    },
    provider: { type: String, default: "" },
    transactionId: { type: String, default: "" },
    payerMobileNumber: { type: String, default: "" },
    qrImage: { type: String, default: "" },
    gatewayProvider: { type: String, default: "" },
    gatewayTransactionUuid: { type: String, default: "" },
    esewaTransactionUuidHistory: { type: [String], default: [] },
    gatewayResponseRaw: { type: String, default: "" },
    paymentDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, default: "" },
    esewaReturnTo: { type: String, enum: ['vendor', 'staff'], required: false },
  },
  { timestamps: true },
);

PaymentSchema.pre("save", async function (next) {
  try {
    if (!this.paymentNumber) {
      const count = await mongoose.model("Payment").countDocuments();
      this.paymentNumber = `PAY-${String(count + 1).padStart(6, "0")}`;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

/** List/sort by recency (dashboard, activity feeds) */
PaymentSchema.index({ createdAt: -1 });
/** Staff: pending queue, completed aggregates */
PaymentSchema.index({ status: 1, createdAt: -1 });
/** Vendor revenue + vendor-scoped lists */
PaymentSchema.index({ vendor: 1, status: 1 });
/** Lookup by tender + vendor (award flow, dedup) */
PaymentSchema.index({ tender: 1, vendor: 1 });
/** eSewa callback lookup when gatewayTransactionUuid was superseded */
PaymentSchema.index({ esewaTransactionUuidHistory: 1 });

export default mongoose.model<IPayment>("Payment", PaymentSchema);
