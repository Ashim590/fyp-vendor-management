import mongoose, { Schema, Document } from 'mongoose';

export type InvoicePaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

export interface IInvoicePayment extends Document {
  invoice: mongoose.Types.ObjectId;
  vendor: mongoose.Types.ObjectId;
  vendorRegistrationNumber?: string;
  amount: number;
  status: InvoicePaymentStatus;

  transactionUuid: string;
  productCode: string;

  esewaRefId?: string;
  esewaTransactionCode?: string;
  esewaStatusRaw?: string;
  esewaCallbackRaw?: string;

  verifiedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

const InvoicePaymentSchema: Schema<IInvoicePayment> = new Schema(
  {
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    vendorRegistrationNumber: { type: String, trim: true, default: '' },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING', index: true },

    transactionUuid: { type: String, required: true, unique: true, index: true },
    productCode: { type: String, required: true, trim: true },

    esewaRefId: { type: String, default: '' },
    esewaTransactionCode: { type: String, default: '' },
    esewaStatusRaw: { type: String, default: '' },
    esewaCallbackRaw: { type: String, default: '' },

    verifiedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

InvoicePaymentSchema.index({ invoice: 1, status: 1 });
InvoicePaymentSchema.index({ vendor: 1, createdAt: -1 });

export default mongoose.model<IInvoicePayment>('InvoicePayment', InvoicePaymentSchema);

