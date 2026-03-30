import type { Types } from 'mongoose';
import Notification from '../models/Notification';
import {
  mergeWithCursorFilter,
  trimExtraDoc,
} from './cursorPagination';

export type NotificationPageResult = {
  notifications: Array<Record<string, unknown>>;
  unreadCount: number;
  nextCursor: string | null;
  hasMore: boolean;
};

const notifCacheParsed = parseInt(
  process.env.NOTIFICATION_LIST_CACHE_MS || '5000',
  10,
);
/** Cap raised so admin/procurement polling hits RAM more often (see NOTIFICATION_LIST_CACHE_MS in .env). */
const NOTIF_LIST_CACHE_MS = Number.isFinite(notifCacheParsed)
  ? Math.min(60_000, Math.max(0, notifCacheParsed))
  : 5_000;

type NotifCached = { at: number; result: NotificationPageResult };
const notificationPageCache = new Map<string, NotifCached>();

/**
 * Shared list + unread count (used by GET /notifications and staff bootstrap).
 */
export async function loadNotificationPageForUser(
  userId: Types.ObjectId,
  pageLimit: number,
  cursor?: string,
): Promise<NotificationPageResult> {
  if (NOTIF_LIST_CACHE_MS > 0) {
    const cacheKey = `${userId.toString()}:${pageLimit}:${cursor ?? ''}`;
    const hit = notificationPageCache.get(cacheKey);
    if (hit && Date.now() - hit.at < NOTIF_LIST_CACHE_MS) {
      return hit.result;
    }
  }

  const base = { user: userId } as Record<string, unknown>;
  const merged = mergeWithCursorFilter(base, cursor);

  const [raw, unreadCount] = await Promise.all([
    Notification.find(merged)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageLimit + 1)
      .select('_id title body link read type createdAt')
      .lean(),
    Notification.countDocuments({
      user: userId,
      read: false,
    }),
  ]);

  const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);

  const result = {
    notifications: items as Array<Record<string, unknown>>,
    unreadCount,
    nextCursor,
    hasMore,
  };

  if (NOTIF_LIST_CACHE_MS > 0) {
    const cacheKey = `${userId.toString()}:${pageLimit}:${cursor ?? ''}`;
    notificationPageCache.set(cacheKey, { at: Date.now(), result });
  }

  return result;
}
