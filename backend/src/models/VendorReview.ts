import mongoose, { Document, Schema } from 'mongoose';
import Vendor from './Vendor';

export interface IVendorReview extends Document {
  vendor: mongoose.Types.ObjectId;
  purchaseOrder?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  deliveryScore: number;
  qualityScore: number;
  communicationScore: number;
  comment: string;
}

const VendorReviewSchema = new Schema<IVendorReview>(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deliveryScore: { type: Number, required: true, min: 1, max: 5 },
    qualityScore: { type: Number, required: true, min: 1, max: 5 },
    communicationScore: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', trim: true },
  },
  { timestamps: true },
);

VendorReviewSchema.index({ vendor: 1, createdAt: -1 });

const VendorReview = mongoose.model<IVendorReview>(
  'VendorReview',
  VendorReviewSchema,
);

export async function refreshVendorRatingFromReviews(
  vendorId: mongoose.Types.ObjectId | string,
): Promise<number> {
  const oid = new mongoose.Types.ObjectId(String(vendorId));
  const agg = await VendorReview.aggregate<{ avg: number; count: number }>([
    { $match: { vendor: oid } },
    {
      $project: {
        overall: {
          $avg: ['$deliveryScore', '$qualityScore', '$communicationScore'],
        },
      },
    },
    {
      $group: {
        _id: null,
        avg: { $avg: '$overall' },
        count: { $sum: 1 },
      },
    },
  ]);
  const row = agg[0];
  const rating =
    row && row.count > 0 ? Math.round(Number(row.avg) * 10) / 10 : 0;
  await Vendor.updateOne({ _id: vendorId }, { $set: { rating } });
  return rating;
}

export default VendorReview;
