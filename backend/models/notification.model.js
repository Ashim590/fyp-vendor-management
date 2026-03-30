import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false },
    type: {
      type: String,
      enum: [
        "vendor_approved",
        "vendor_rejected",
        "tender_created",
        "tender_closed",
        "bid_submitted",
        "bid_accepted",
        "bid_rejected",
        "announcement",
        "other",
      ],
      default: "other",
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1 });
notificationSchema.index({ read: 1 });

export const Notification = mongoose.model("Notification", notificationSchema);
