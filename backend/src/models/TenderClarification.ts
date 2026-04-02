import mongoose, { Schema, Document } from 'mongoose';

export interface ITenderClarification extends Document {
  tender: mongoose.Types.ObjectId;
  vendorUser: mongoose.Types.ObjectId;
  vendor?: mongoose.Types.ObjectId;
  question: string;
  answer?: string;
  isPublic: boolean;
  askedAt: Date;
  answeredAt?: Date;
}

const TenderClarificationSchema: Schema<ITenderClarification> = new Schema(
  {
    tender: { type: Schema.Types.ObjectId, ref: 'Tender', required: true, index: true },
    vendorUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor', index: true },
    question: { type: String, required: true, trim: true },
    answer: { type: String, trim: true, default: '' },
    isPublic: { type: Boolean, default: true },
    askedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date },
  },
  { timestamps: true },
);

TenderClarificationSchema.index({ tender: 1, askedAt: -1, _id: -1 });

export default mongoose.model<ITenderClarification>(
  'TenderClarification',
  TenderClarificationSchema,
);
