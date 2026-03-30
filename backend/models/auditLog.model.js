import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    logNumber: {
      type: String,
      required: true,
      unique: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "create",
        "read",
        "update",
        "delete",
        "login",
        "logout",
        "login_failed",
        "approve",
        "reject",
        "cancel",
        "submit",
        "withdraw",
        "archive",
        "send",
        "receive",
        "download",
        "upload",
        "status_change",
        "role_change",
        "permission_change",
        "password_change",
        "password_reset",
        "export",
        "import",
        "sync",
      ],
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        "user",
        "vendor",
        "purchase_request",
        "quotation",
        "approval",
        "purchase_order",
        "delivery",
        "invoice",
        "payment",
        "audit_log",
        "system",
      ],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    entityName: {
      type: String,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userRole: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    previousValues: {
      type: mongoose.Schema.Types.Mixed,
    },
    newValues: {
      type: mongoose.Schema.Types.Mixed,
    },
    changes: [
      {
        field: { type: String },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    status: {
      type: String,
      enum: ["success", "failed", "pending", "warning"],
      default: "success",
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    requestMethod: {
      type: String,
      trim: true,
    },
    requestUrl: {
      type: String,
      trim: true,
    },
    responseStatus: {
      type: Number,
    },
    executionTime: {
      type: Number, // in milliseconds
    },
    module: {
      type: String,
      trim: true,
    },
    subModule: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
      },
    ],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Index for faster queries
auditLogSchema.index({ logNumber: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ user: 1 });
auditLogSchema.index({ status: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ module: 1 });
auditLogSchema.index({ tags: 1 });

// Compound index for date-based queries
auditLogSchema.index({ createdAt: 1, entityType: 1 });
auditLogSchema.index({ createdAt: 1, user: 1 });
auditLogSchema.index({ createdAt: 1, action: 1 });

// Auto-generate log number before saving
auditLogSchema.pre("save", async function (next) {
  if (!this.logNumber) {
    const count = await mongoose.model("AuditLog").countDocuments();
    this.logNumber = `LOG-${String(count + 1).padStart(8, "0")}`;
  }
  next();
});

// Static method to log an action
auditLogSchema.statics.log = async function (data) {
  try {
    const log = await this.create(data);
    return log;
  } catch (error) {
    console.error("Error creating audit log:", error);
  }
};

// Static method to get entity history
auditLogSchema.statics.getEntityHistory = async function (
  entityType,
  entityId,
  options = {}
) {
  const { limit = 50, skip = 0, startDate, endDate } = options;

  const query = { entityType, entityId };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = startDate;
    if (endDate) query.createdAt.$lte = endDate;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("user", "fullname email");
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = async function (userId, options = {}) {
  const { limit = 50, skip = 0, startDate, endDate } = options;

  const query = { user: userId };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = startDate;
    if (endDate) query.createdAt.$lte = endDate;
  }

  return this.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
};

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
