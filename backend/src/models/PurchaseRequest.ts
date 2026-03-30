import mongoose, { Schema, Document } from 'mongoose';

export type PurchaseRequestStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'quotation_received'
  | 'po_created'
  | 'completed';

export type PurchaseRequestPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface IPurchaseRequestItem {
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  totalPrice?: number;
  specifications?: string;
  category: string;
}

export interface IPurchaseRequest extends Document {
  requestNumber: string;
  title: string;
  description: string;
  requester: mongoose.Types.ObjectId;
  department: string;
  items: IPurchaseRequestItem[];
  totalEstimatedAmount: number;
  priority: PurchaseRequestPriority;
  status: PurchaseRequestStatus;
  requiredDate: Date;
  deliveryLocation: string;
  justification?: string;
  notes?: string;
  linkedTender?: mongoose.Types.ObjectId;
}

const PurchaseRequestItemSchema = new Schema<IPurchaseRequestItem>(
  {
    itemName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, trim: true },
    estimatedUnitPrice: { type: Number, default: 0, min: 0 },
    totalPrice: { type: Number, default: 0, min: 0 },
    specifications: { type: String, default: '' },
    category: { type: String, default: 'other' }
  },
  { _id: false }
);

const PurchaseRequestSchema: Schema<IPurchaseRequest> = new Schema(
  {
    requestNumber: { type: String, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    department: { type: String, required: true, trim: true, index: true },
    items: { type: [PurchaseRequestItemSchema], default: [] },
    totalEstimatedAmount: { type: Number, default: 0 },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: [
        'draft',
        'pending_approval',
        'approved',
        'rejected',
        'cancelled',
        'quotation_received',
        'po_created',
        'completed'
      ],
      default: 'draft'
    },
    requiredDate: { type: Date, required: true },
    deliveryLocation: { type: String, required: true, trim: true },
    justification: { type: String, default: '' },
    notes: { type: String, default: '' },
    linkedTender: { type: Schema.Types.ObjectId, ref: 'Tender', sparse: true, index: true }
  },
  { timestamps: true }
);

PurchaseRequestSchema.index({ createdAt: -1 });
PurchaseRequestSchema.index({ requester: 1, createdAt: -1 });
PurchaseRequestSchema.index({ status: 1, createdAt: -1 });

PurchaseRequestSchema.pre('save', async function (next) {
  try {
    if (!this.requestNumber) {
      const count = await mongoose.model('PurchaseRequest').countDocuments();
      const padded = String(count + 1).padStart(6, '0');
      this.requestNumber = `PR-${padded}`;
    }

    if (this.items?.length) {
      this.items = this.items.map((it) => ({
        ...it,
        totalPrice: (it.quantity || 0) * (it.estimatedUnitPrice || 0)
      }));
      this.totalEstimatedAmount = this.items.reduce(
        (sum, it) => sum + (it.totalPrice || 0),
        0
      );
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

export default mongoose.model<IPurchaseRequest>('PurchaseRequest', PurchaseRequestSchema);

