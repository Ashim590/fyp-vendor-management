import mongoose from "mongoose";

/** Unique id for legacy DB unique index on `registrationNumber` (missing values collide as null). */
export function generateVendorRegistrationNumber(): string {
  return `VNET-${new mongoose.Types.ObjectId().toString()}`;
}
