import mongoose, { Document, Schema } from 'mongoose';

export type AuditStatus = 'success' | 'failed' | 'pending' | 'warning';

export interface IAuditLog extends Document {
  logNumber: string;
  action: string;
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  entityName?: string;
  user: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  userRole: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  description: string;
  status: AuditStatus;
  module?: string;
  subModule?: string;
  tags?: string[];
  details?: Record<string, unknown>;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

const AuditLogSchema: Schema<IAuditLog> = new Schema(
  {
    logNumber: { type: String, unique: true, index: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    entityName: { type: String, default: '' },

    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    userRole: { type: String, required: true },

    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    location: { type: String, default: '' },

    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending', 'warning'],
      default: 'success'
    },

    module: { type: String, default: '' },
    subModule: { type: String, default: '' },
    tags: [{ type: String }],
    details: { type: Schema.Types.Mixed },
    previousValues: { type: Schema.Types.Mixed },
    newValues: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

AuditLogSchema.pre('save', function (next) {
  if (!this.logNumber) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
    this.logNumber = `LOG-${ts}-${rand}`;
  }
  next();
});

AuditLogSchema.index({ createdAt: -1, _id: -1 });
AuditLogSchema.index({ user: 1, createdAt: -1, _id: -1 });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

