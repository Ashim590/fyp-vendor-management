import type { Types } from "mongoose";
import User from "../models/User";
import Notification, { NotificationType } from "../models/Notification";

const DEFAULT_ADMIN_LINK = "/admin?tab=vendors";

export async function notifyAllAdmins(params: {
  title: string;
  body: string;
  link?: string;
  type: NotificationType;
  /** Links the row back to a domain object when the alert is about a specific record. */
  referenceId?: Types.ObjectId | string | null;
  /** Stops the acting admin from getting pinged about their own action. */
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
    const ref =
      params.referenceId != null && params.referenceId !== ""
        ? params.referenceId
        : undefined;
    await Notification.insertMany(
      targets.map((a) => ({
        user: a._id,
        title: params.title,
        body: params.body,
        link,
        read: false,
        type: params.type,
        roleTarget: "ADMIN" as const,
        ...(ref ? { referenceId: ref } : {}),
      })),
    );
  } catch (e) {
    console.error("notifyAllAdmins:", e);
  }
}
