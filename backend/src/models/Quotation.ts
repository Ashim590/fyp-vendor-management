import mongoose, { Schema, Document } from 'mongoose';

export type QuotationStatus =
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'counter_offered';

export type QuotationItem = {
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  specifications?: string;
  available?: boolean;
};

export interface IQuotation extends Document {
  quotationNumber: string;
  purchaseRequest: mongoose.Types.ObjectId;
  vendor: mongoose.Types.ObjectId;
  vendorName: string;
  items: QuotationItem[];
  subtotal: number;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  taxRate: number;
  discountRate: number;
  currency: string;
  validityDate: Date;
  deliveryDate: Date;
  deliveryTerms?: string;
  paymentTerms?: string;
  warranty?: string;
  status: QuotationStatus;
  quotedBy?: mongoose.Types.ObjectId;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  comparisonNotes?: string;
  attachedDocuments?: Array<{
    name: string;
    url: string;
    uploadedAt: Date;
  }>;
  notes?: string;
  rejectionReason?: string;
}

const QuotationItemSchema = new Schema<QuotationItem>(
  {
    itemName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    specifications: { type: String, default: '' },
    available: { type: Boolean, default: true }
  },
  { _id: false }
);

const QuotationSchema: Schema<IQuotation> = new Schema(
  {
    quotationNumber: { type: String, unique: true, index: true },
    purchaseRequest: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseRequest',
      required: true,
      index: true
    },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorName: { type: String, required: true, trim: true },
    items: { type: [QuotationItemSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    discountRate: { type: Number, default: 0, min: 0, max: 100 },
    currency: { type: String, default: 'USD' },
    validityDate: { type: Date, required: true },
    deliveryDate: { type: Date, required: true },
    deliveryTerms: { type: String, default: '' },
    paymentTerms: { type: String, default: '' },
    warranty: { type: String, default: '' },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'accepted', 'rejected', 'withdrawn', 'counter_offered'],
      default: 'submitted'
    },
    quotedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, default: '' },
    comparisonNotes: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    attachedDocuments: [
      {
        name: { type: String },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

QuotationSchema.pre('save', async function (next) {
  try {
    if (!this.quotationNumber) {
      const count = await mongoose.model('Quotation').countDocuments();
      this.quotationNumber = `QT-${String(count + 1).padStart(6, '0')}`;
    }

    if (this.items?.length) {
      const subtotal = this.items.reduce((sum, it) => sum + (it.totalPrice || 0), 0);
      this.subtotal = subtotal;

      const discountAmount = subtotal * (this.discountRate / 100);
      this.discountAmount = discountAmount;
      const afterDiscount = subtotal - discountAmount;

      const taxAmount = afterDiscount * (this.taxRate / 100);
      this.taxAmount = taxAmount;

      this.totalAmount = afterDiscount + taxAmount;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

QuotationSchema.index({ createdAt: -1, _id: -1 });
QuotationSchema.index({ vendor: 1, createdAt: -1, _id: -1 });
QuotationSchema.index({ purchaseRequest: 1, createdAt: -1, _id: -1 });

export default mongoose.model<IQuotation>('Quotation', QuotationSchema);

