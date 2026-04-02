import mongoose, { Schema, Document } from 'mongoose';

export type TenderStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'AWARDED';

export interface ITender extends Document {
  title: string;
  referenceNumber: string;
  description: string;
  createdBy: mongoose.Types.ObjectId;
  status: TenderStatus;
  openDate: Date;
  closeDate: Date;
  category: string;
  /** Optional single budget figure (NPR) – UI convenience */
  budget?: number;
  budgetRange?: {
    min: number;
    max: number;
  };
  requirements?: string;
  requiredDocuments?: string[];
  awardedVendor?: mongoose.Types.ObjectId;
  purchaseRequest?: mongoose.Types.ObjectId;
}

const TenderSchema: Schema<ITender> = new Schema(
  {
    title: { type: String, required: true },
    referenceNumber: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'CLOSED', 'AWARDED'],
      default: 'DRAFT'
    },
    openDate: { type: Date, required: true },
    closeDate: { type: Date, required: true },
    category: { type: String, required: true },
    budget: { type: Number },
    budgetRange: {
      min: { type: Number },
      max: { type: Number }
    },
    requirements: { type: String, trim: true, default: '' },
    requiredDocuments: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    awardedVendor: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    purchaseRequest: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseRequest',
      sparse: true,
      unique: true,
      index: true
    }
  },
  { timestamps: true }
);

/** Default list: newest first; vendor/staff filters often include status */
TenderSchema.index({ status: 1, createdAt: -1 });
/** Reports: tenders-per-month $match on createdAt range */
TenderSchema.index({ createdAt: -1 });

export default mongoose.model<ITender>('Tender', TenderSchema);

