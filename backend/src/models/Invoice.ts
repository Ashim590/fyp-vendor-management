import mongoose, { Schema, Document } from 'mongoose';

export type InvoiceStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface IInvoiceItem {
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  specifications?: string;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  vendor: mongoose.Types.ObjectId;
  vendorName: string;
  /** Set when raised from a PO; omitted for tender-payment-generated invoices */
  purchaseOrder?: mongoose.Types.ObjectId;
  purchaseOrderNumber: string;
  items: IInvoiceItem[];
  totalAmount: number;

  issueDate: Date;
  dueDate: Date;

  status: InvoiceStatus;

  /** Paid tender (award) payment that produced this invoice */
  tenderPayment?: mongoose.Types.ObjectId;
  tender?: mongoose.Types.ObjectId;
  bid?: mongoose.Types.ObjectId;

  /** eSewa invoice gateway row that verified this document as paid */
  settledByInvoicePayment?: mongoose.Types.ObjectId;
  /** Set when status becomes paid (tender or supplier payment) */
  paidAt?: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>(
  {
    itemName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    specifications: { type: String, default: '' }
  },
  { _id: false }
);

const InvoiceSchema: Schema<IInvoice> = new Schema(
  {
    invoiceNumber: { type: String, unique: true, index: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorName: { type: String, required: true, trim: true },
    purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', index: true },
    tenderPayment: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      unique: true,
      sparse: true,
      index: true,
    },
    tender: { type: Schema.Types.ObjectId, ref: 'Tender', index: true },
    bid: { type: Schema.Types.ObjectId, ref: 'Bid' },
    settledByInvoicePayment: {
      type: Schema.Types.ObjectId,
      ref: 'InvoicePayment',
      unique: true,
      sparse: true,
      index: true,
    },
    paidAt: { type: Date },
    purchaseOrderNumber: { type: String, required: true, trim: true },
    items: { type: [InvoiceItemSchema], default: [] },
    totalAmount: { type: Number, default: 0, min: 0 },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'sent', 'paid', 'overdue', 'cancelled'],
      default: 'draft'
    }
  },
  { timestamps: true }
);

InvoiceSchema.pre('save', async function (next) {
  try {
    if (!this.invoiceNumber) {
      const count = await mongoose.model('Invoice').countDocuments();
      this.invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;
    }
    if (this.items?.length) {
      this.totalAmount = this.items.reduce((sum, it) => sum + (it.totalPrice || 0), 0);
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

InvoiceSchema.index({ createdAt: -1, _id: -1 });
InvoiceSchema.index({ tender: 1, vendor: 1 });

export default mongoose.model<IInvoice>('Invoice', InvoiceSchema);

