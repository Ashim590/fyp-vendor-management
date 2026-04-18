import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "ADMIN" | "PROCUREMENT_OFFICER" | "VENDOR";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
  profilePhoto?: string;
  role: UserRole;
  vendorProfile?: mongoose.Types.ObjectId;
  isActive: boolean;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phoneNumber: { type: String, trim: true, default: "" },
    profilePhoto: { type: String, trim: true, default: "" },
    role: {
      type: String,
      enum: ["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"],
      required: true,
    },
    vendorProfile: { type: Schema.Types.ObjectId, ref: "Vendor" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

UserSchema.index({ createdAt: -1, _id: -1 });
/** Role-scoped lookups (notify admins/staff, dashboards) */
UserSchema.index({ role: 1 });
/** Active staff batch (e.g. bid submitted → notify PROCUREMENT + ADMIN) */
UserSchema.index({ role: 1, isActive: 1 });
/** Owner lookup by vendor (approvals, gate checks) */
UserSchema.index({ vendorProfile: 1 }, { sparse: true });

export default mongoose.model<IUser>("User", UserSchema);
