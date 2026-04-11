import mongoose, { Schema, Document } from 'mongoose';
import { maybeSendNotificationEmail } from '../utils/notifyEmail';

export type NotificationType =
  | 'vendor_pending_review'
  | 'vendor_approved_staff'
  | 'vendor_rejected_staff'
  | 'vendor_approved'
  | 'vendor_rejected'
  | 'tender_created'
  | 'tender_closed'
  | 'bid_submitted'
  | 'bid_accepted'
  | 'bid_rejected'
  | 'payment_pending'
  | 'payment_completed'
  | 'payment_failed'
  | 'invoice_payment_pending'
  | 'invoice_payment_paid'
  | 'delivery_shipped'
  | 'delivery_in_transit'
  | 'delivery_delivered'
  | 'delivery_received'
  | 'delivery_delayed'
  | 'purchase_request_submitted'
  | 'purchase_request_approved'
  | 'purchase_request_rejected'
  | 'tender_auto_created'
  | 'announcement'
  | 'other';

export type NotificationRoleTarget =
  | 'ADMIN'
  | 'PROCUREMENT_OFFICER'
  | 'VENDOR';

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  body: string;
  /** Virtual mirror of `body` for clients that expect a `message` field. */
  message?: string;
  link: string;
  read: boolean;
  /** Filled when the row transitions to read (supports later reporting / forensics). */
  readAt?: Date;
  type: NotificationType;
  /** Optional pointer into tenders, bids, deliveries, PRs, etc., for correlation. */
  referenceId?: mongoose.Types.ObjectId;
  /** Which role bucket this row was generated for (each user still has their own doc). */
  roleTarget?: NotificationRoleTarget;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, required: false },
    referenceId: { type: Schema.Types.ObjectId, required: false, index: true },
    roleTarget: {
      type: String,
      enum: ['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR'],
      required: false,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'vendor_pending_review',
        'vendor_approved_staff',
        'vendor_rejected_staff',
        'vendor_approved',
        'vendor_rejected',
        'tender_created',
        'tender_closed',
        'bid_submitted',
        'bid_accepted',
        'bid_rejected',
        'payment_pending',
        'payment_completed',
        'payment_failed',
        'invoice_payment_pending',
        'invoice_payment_paid',
        'delivery_shipped',
        'delivery_in_transit',
        'delivery_delivered',
        'delivery_received',
        'delivery_delayed',
        'purchase_request_submitted',
        'purchase_request_approved',
        'purchase_request_rejected',
        'tender_auto_created',
        'announcement',
        'other'
      ],
      default: 'other'
    }
  },
  { timestamps: true }
);

NotificationSchema.virtual('message').get(function () {
  return this.body;
});

NotificationSchema.set('toJSON', { virtuals: true });
NotificationSchema.set('toObject', { virtuals: true });

NotificationSchema.index({ user: 1, createdAt: -1, _id: -1 });
NotificationSchema.index({ user: 1, read: 1 });

/** Email hooks piggyback on inserts; updates to read state should stay silent. */
NotificationSchema.pre('save', function (next) {
  if (this.isNew) {
    (this as INotification & { $locals?: { __notifyEmail?: boolean } }).$locals =
      (this as INotification & { $locals?: { __notifyEmail?: boolean } }).$locals || {};
    (this as INotification & { $locals?: { __notifyEmail?: boolean } }).$locals!.__notifyEmail = true;
  }
  next();
});

NotificationSchema.post('save', function (doc) {
  const locals = (doc as INotification & { $locals?: { __notifyEmail?: boolean } }).$locals;
  if (!locals?.__notifyEmail) return;
  void maybeSendNotificationEmail({
    user: doc.user,
    title: doc.title,
    body: doc.body,
    link: doc.link,
    type: doc.type,
  });
});

export default mongoose.model<INotification>('Notification', NotificationSchema);
