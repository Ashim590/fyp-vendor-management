import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    tender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tender",
      required: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    amount: { type: Number, required: true },
    technicalProposal: { type: String, default: "" },
    financialProposal: { type: String, default: "" },
    documents: [
      { name: { type: String }, url: { type: String }, uploadedAt: { type: Date, default: Date.now } },
    ],
    status: {
      type: String,
      enum: ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED"],
      default: "SUBMITTED",
    },
    score: { type: Number },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

bidSchema.index({ tender: 1 });
bidSchema.index({ vendor: 1 });
bidSchema.index({ status: 1 });

export const Bid = mongoose.model("Bid", bidSchema);
