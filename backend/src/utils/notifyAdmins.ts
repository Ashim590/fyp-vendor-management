import type { Types } from "mongoose";
import User from "../models/User";
import Notification, { NotificationType } from "../models/Notification";

const DEFAULT_ADMIN_LINK = "/admin?tab=vendors";

export async function notifyAllAdmins(params: {
  title: string;
  body: string;
  link?: string;
  type: NotificationType;
  /** Omit notifications to this user (e.g. the admin who performed the action). */
  excludeUserId?: Types.ObjectId | string | null;
}): Promise<void> {
  try {
    const admins = await User.find({ role: "ADMIN", isActive: true })
      .select("_id")
      .lean();
    if (!admins.length) return;

    const exclude = params.excludeUserId
      ? String(params.excludeUserId)
      : null;
    const targets = exclude
      ? admins.filter((a) => String(a._id) !== exclude)
      : admins;
    if (!targets.length) return;

    const link = params.link ?? DEFAULT_ADMIN_LINK;
    await Notification.insertMany(
      targets.map((a) => ({
        user: a._id,
        title: params.title,
        body: params.body,
        link,
        read: false,
        type: params.type,
      })),
    );
  } catch (e) {
    console.error("notifyAllAdmins:", e);
  }
}
