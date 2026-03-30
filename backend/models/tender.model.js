import mongoose from "mongoose";

const tenderSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    referenceNumber: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "CLOSED", "AWARDED"],
      default: "DRAFT",
    },
    openDate: { type: Date, required: true },
    closeDate: { type: Date, required: true },
    category: { type: String, required: true, trim: true },
    budget: { type: Number },
    budgetRange: {
      min: { type: Number },
      max: { type: Number },
    },
    requirements: { type: String, trim: true },
    awardedVendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
  },
  { timestamps: true }
);

tenderSchema.index({ status: 1 });
tenderSchema.index({ createdBy: 1 });
tenderSchema.index({ closeDate: 1 });

export const Tender = mongoose.model("Tender", tenderSchema);
