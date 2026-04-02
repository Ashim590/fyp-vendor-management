import mongoose, { Schema, Document } from 'mongoose';

export type VendorStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export interface IVendor extends Document {
  name: string;
  email: string;
  phoneNumber: string;
  address?: string;
  province?: string;
  district?: string;
  description?: string;
  website?: string;
  category: string;
  panNumber?: string;
  taxId?: string;
  businessLicense?: string;
  logo?: string;
  status: VendorStatus;
  rating: number;
  totalOrders: number;
  bankDetails?: {
    esewaId?: string;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    routingNumber?: string;
  };
  contactPerson?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  isVerified: boolean;
  settlementVerified?: boolean;
  documents: Array<{
    name: string;
    url: string;
    uploadedAt?: Date;
  }>;
  registeredBy?: mongoose.Types.ObjectId;
  /** Present on some DBs with a legacy unique index; must be unique per vendor. */
  registrationNumber?: string;
}

const VendorSchema: Schema<IVendor> = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    province: { type: String, trim: true },
    district: { type: String, trim: true },
    description: { type: String, trim: true },
    website: { type: String, trim: true },
    category: {
      type: String,
      enum: [
        'office_supplies',
        'it_equipment',
        'furniture',
        'food_supplies',
        'medical_supplies',
        'cleaning_supplies',
        'printing',
        'other'
      ],
      default: 'other'
    },
    panNumber: { type: String, trim: true },
    taxId: { type: String, trim: true },
    businessLicense: { type: String, trim: true },
    registrationNumber: { type: String, trim: true },
    logo: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'suspended', 'rejected'],
      default: 'pending'
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalOrders: { type: Number, default: 0 },
    bankDetails: {
      esewaId: { type: String, trim: true },
      bankName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      accountName: { type: String, trim: true },
      routingNumber: { type: String, trim: true }
    },
    contactPerson: {
      name: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
      phone: { type: String, trim: true }
    },
    isVerified: { type: Boolean, default: false },
    settlementVerified: { type: Boolean, default: false },
    documents: [
      {
        name: { type: String },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    registeredBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

VendorSchema.index({ status: 1 });
VendorSchema.index({ category: 1 });
VendorSchema.index({ status: 1, createdAt: -1, _id: -1 });
VendorSchema.index({ createdAt: -1, _id: -1 });

export default mongoose.model<IVendor>('Vendor', VendorSchema);

