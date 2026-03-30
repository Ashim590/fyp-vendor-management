import mongoose, { Schema, Document } from 'mongoose';

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'issued'
  | 'partial'
  | 'completed'
  | 'cancelled';

export interface IPurchaseOrderItem {
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  specifications?: string;
}

export interface IPurchaseOrder extends Document {
  orderNumber: string;
  purchaseRequest: mongoose.Types.ObjectId;
  vendor: mongoose.Types.ObjectId;
  vendorName: string;
  items: IPurchaseOrderItem[];
  totalAmount: number;
  deliveryDate: Date;
  status: PurchaseOrderStatus;
}

const PurchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
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

const PurchaseOrderSchema: Schema<IPurchaseOrder> = new Schema(
  {
    orderNumber: { type: String, unique: true, index: true },
    purchaseRequest: { type: Schema.Types.ObjectId, ref: 'PurchaseRequest', index: true, required: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorName: { type: String, required: true, trim: true },
    items: { type: [PurchaseOrderItemSchema], default: [] },
    totalAmount: { type: Number, default: 0, min: 0 },
    deliveryDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'issued', 'partial', 'completed', 'cancelled'],
      default: 'draft'
    }
  },
  { timestamps: true }
);

PurchaseOrderSchema.pre('save', async function (next) {
  try {
    if (!this.orderNumber) {
      const count = await mongoose.model('PurchaseOrder').countDocuments();
      this.orderNumber = `PO-${String(count + 1).padStart(6, '0')}`;
    }
    if (this.items?.length) {
      this.totalAmount = this.items.reduce((sum, it) => sum + (it.totalPrice || 0), 0);
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

/** Dashboard & filters: count by lifecycle status */
PurchaseOrderSchema.index({ status: 1 });
PurchaseOrderSchema.index({ createdAt: -1, _id: -1 });

export default mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);

