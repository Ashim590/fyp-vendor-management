import mongoose from 'mongoose';
import User from '../models/User';
import Notification from '../models/Notification';
import type { NotificationType } from '../models/Notification';
import { roleTargetFromUserRole } from './notificationRoleTarget';

export async function notifyDeliveryEvent(params: {
  title: string;
  body: string;
  vendorId: mongoose.Types.ObjectId;
  /** Ties the notification back to the delivery record in reporting and deep links. */
  deliveryId: mongoose.Types.ObjectId;
  type: NotificationType;
  excludeUserId?: mongoose.Types.ObjectId;
}): Promise<void> {
  const userIds = new Set<string>();

  const vendorUser = await User.findOne({ vendorProfile: params.vendorId }).select('_id');
  if (vendorUser) userIds.add(String(vendorUser._id));

  const staff = await User.find({
    role: { $in: ['ADMIN', 'PROCUREMENT_OFFICER'] },
    isActive: true
  }).select('_id');
  for (const u of staff) userIds.add(String(u._id));

  if (params.excludeUserId) userIds.delete(String(params.excludeUserId));

  if (userIds.size === 0) return;

  const ids = [...userIds].map((id) => new mongoose.Types.ObjectId(id));
  const users = await User.find({ _id: { $in: ids } })
    .select('_id role')
    .lean();
  if (!users.length) return;

  await Notification.insertMany(
    users.map((u) => ({
      user: u._id,
      title: params.title,
      body: params.body,
      link: '/deliveries',
      read: false,
      type: params.type,
      referenceId: params.deliveryId,
      roleTarget: roleTargetFromUserRole(u.role),
    }))
  );
}
