import mongoose, { Schema, Document } from 'mongoose';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'cancelled';

export type ApprovalPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface IApprovalHistoryItem {
  level: number;
  approver?: mongoose.Types.ObjectId;
  approverName?: string;
  status: 'approved' | 'rejected' | 'returned';
  comments?: string;
  actionDate: Date;
}

export interface IApproval extends Document {
  approvalNumber: string;
  entityType: 'purchase_request' | 'purchase_order' | 'payment' | 'vendor';
  entityId: mongoose.Types.ObjectId;

  purchaseRequest?: mongoose.Types.ObjectId;
  purchaseOrder?: mongoose.Types.ObjectId;
  payment?: mongoose.Types.ObjectId;
  vendor?: mongoose.Types.ObjectId;

  requester: mongoose.Types.ObjectId;
  requesterName: string;
  requesterDepartment: string;

  title: string;
  description?: string;
  amount: number;
  currency: string;

  priority: ApprovalPriority;
  approverRole?: string;

  currentApprover?: mongoose.Types.ObjectId;
  status: ApprovalStatus;
  rejectionReason?: string;
  comments?: string;
  approvalHistory?: IApprovalHistoryItem[];

  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
}

const ApprovalHistorySchema = new Schema<IApprovalHistoryItem>(
  {
    level: { type: Number },
    approver: { type: Schema.Types.ObjectId, ref: 'User' },
    approverName: { type: String },
    status: { type: String, enum: ['approved', 'rejected', 'returned'] },
    comments: { type: String, default: '' },
    actionDate: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ApprovalSchema: Schema<IApproval> = new Schema(
  {
    approvalNumber: { type: String, unique: true, index: true },
    entityType: {
      type: String,
      enum: ['purchase_request', 'purchase_order', 'payment', 'vendor'],
      required: true
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true
    },

    purchaseRequest: { type: Schema.Types.ObjectId, ref: 'PurchaseRequest' },
    purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor' },

    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requesterName: { type: String, required: true, trim: true },
    requesterDepartment: { type: String, required: true, trim: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    amount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },

    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    approverRole: { type: String, default: '' },

    currentApprover: { type: Schema.Types.ObjectId, ref: 'User', index: true },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'returned', 'cancelled'],
      default: 'pending'
    },
    rejectionReason: { type: String, default: '', trim: true },
    comments: { type: String, default: '', trim: true },

    approvalHistory: { type: [ApprovalHistorySchema], default: [] },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date }
  },
  { timestamps: true }
);

ApprovalSchema.pre('save', async function (next) {
  try {
    if (!this.approvalNumber) {
      const count = await mongoose.model('Approval').countDocuments();
      this.approvalNumber = `APR-${String(count + 1).padStart(6, '0')}`;
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

ApprovalSchema.index({ createdAt: -1, _id: -1 });
ApprovalSchema.index({ status: 1, currentApprover: 1, createdAt: -1, _id: -1 });

export default mongoose.model<IApproval>('Approval', ApprovalSchema);

