import mongoose from 'mongoose';
import User from '../models/User';
import Notification from '../models/Notification';
import type { NotificationType } from '../models/Notification';

export async function notifyDeliveryEvent(params: {
  title: string;
  body: string;
  vendorId: mongoose.Types.ObjectId;
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

  await Notification.insertMany(
    [...userIds].map((userId) => ({
      user: new mongoose.Types.ObjectId(userId),
      title: params.title,
      body: params.body,
      link: '/deliveries',
      read: false,
      type: params.type
    }))
  );
}
