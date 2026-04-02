import mongoose, { Schema, Document } from 'mongoose';

export type BidStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';

export interface IBid extends Document {
  tender: mongoose.Types.ObjectId;
  vendor: mongoose.Types.ObjectId;
  /** Total payable (typically incl. VAT) — used for awards & payments */
  amount: number;
  /** Unit/subtotal excluding VAT (when VAT is modeled separately) */
  amountExcludingVat?: number;
  vatAmount?: number;
  /** e.g. 0.13 */
  vatRate?: number;
  technicalProposal: string;
  financialProposal: string;
  /** Optional supporting files (e.g. PDF) stored as data URLs from upload. */
  documents?: Array<{ name: string; url: string; uploadedAt?: Date }>;
  isDraft?: boolean;
  submittedAt?: Date;
  versionHistory?: Array<{
    editedAt: Date;
    editedBy: mongoose.Types.ObjectId;
    amount: number;
    technicalProposal: string;
    financialProposal: string;
    documents?: Array<{ name: string; url: string; uploadedAt?: Date }>;
  }>;
  status: BidStatus;
  score?: number;
  rejectionReason?: string;
}

const BidSchema: Schema<IBid> = new Schema(
  {
    tender: { type: Schema.Types.ObjectId, ref: 'Tender', required: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    amount: { type: Number, required: true },
    amountExcludingVat: { type: Number },
    vatAmount: { type: Number },
    vatRate: { type: Number },
    technicalProposal: { type: String, default: '' },
    financialProposal: { type: String, default: '' },
    documents: {
      type: [
        {
          name: { type: String, required: true, trim: true },
          url: { type: String, required: true },
          uploadedAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    },
    isDraft: { type: Boolean, default: false },
    submittedAt: { type: Date },
    versionHistory: {
      type: [
        {
          editedAt: { type: Date, default: Date.now },
          editedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          amount: { type: Number, required: true },
          technicalProposal: { type: String, default: '' },
          financialProposal: { type: String, default: '' },
          documents: {
            type: [
              {
                name: { type: String, required: true, trim: true },
                url: { type: String, required: true },
                uploadedAt: { type: Date, default: Date.now },
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'],
      default: 'SUBMITTED'
    },
    score: { type: Number },
    rejectionReason: { type: String, trim: true }
  },
  { timestamps: true }
);

BidSchema.index({ tender: 1, status: 1 });
BidSchema.index({ vendor: 1 });
BidSchema.index({ vendor: 1, createdAt: -1 });
BidSchema.index({ createdAt: -1 });
BidSchema.index({ status: 1 });
/** Admin reports: $match on recent createdAt + $group by status */
BidSchema.index({ createdAt: -1, status: 1 });

export default mongoose.model<IBid>('Bid', BidSchema);

