import type { Types } from 'mongoose';
import Notification from '../models/Notification';
import {
  mergeWithCursorFilter,
  trimExtraDoc,
} from './cursorPagination';

export type NotificationPageResult = {
  notifications: Array<Record<string, unknown>>;
  unreadCount: number;
  unreadByType: Record<string, number>;
  nextCursor: string | null;
  hasMore: boolean;
};

const notifCacheParsed = parseInt(
  process.env.NOTIFICATION_LIST_CACHE_MS || '30000',
  10,
);
/** Upper bound on cache TTL so env misconfigures don’t freeze stale counts forever. */
const NOTIF_LIST_CACHE_MS = Number.isFinite(notifCacheParsed)
  ? Math.min(120_000, Math.max(0, notifCacheParsed))
  : 30_000;

type NotifCached = { at: number; result: NotificationPageResult };
const notificationPageCache = new Map<string, NotifCached>();
/** Coalesce concurrent identical loads (e.g. React StrictMode double mount + /session/staff-home). */
const notificationPageInflight = new Map<string, Promise<NotificationPageResult>>();

/** Tender “new listing” alerts are vendor-marketplace noise for staff dashboards. */
const VENDOR_ONLY_NOTIFICATION_TYPES = ['tender_created'] as const;

function vendorOnlyTypeFilter(viewerRole: string | undefined) {
  if (!viewerRole || viewerRole === 'VENDOR') return {};
  return { type: { $nin: [...VENDOR_ONLY_NOTIFICATION_TYPES] } };
}

export type LoadNotificationPageOptions = {
  /** Staff accounts filter out vendor-only marketplace types from the shared collection. */
  viewerRole?: string;
};

/**
 * Single implementation behind GET /notifications and the staff-home bundle so counts stay consistent.
 */
export async function loadNotificationPageForUser(
  userId: Types.ObjectId,
  pageLimit: number,
  cursor?: string,
  options?: LoadNotificationPageOptions,
): Promise<NotificationPageResult> {
  const typeExclusion = vendorOnlyTypeFilter(options?.viewerRole);
  const cacheKey = `${userId.toString()}:${pageLimit}:${cursor ?? ''}:${
    options?.viewerRole ?? '_'
  }`;

  if (NOTIF_LIST_CACHE_MS > 0) {
    const hit = notificationPageCache.get(cacheKey);
    if (hit && Date.now() - hit.at < NOTIF_LIST_CACHE_MS) {
      return hit.result;
    }
  }

  const inflight = notificationPageInflight.get(cacheKey);
  if (inflight) return inflight;

  const p = (async (): Promise<NotificationPageResult> => {
    try {
      const base = { user: userId, ...typeExclusion } as Record<string, unknown>;
      const merged = mergeWithCursorFilter(base, cursor);

      const [raw, unreadCount, unreadTypeBuckets] = await Promise.all([
        Notification.find(merged)
          .sort({ createdAt: -1, _id: -1 })
          .limit(pageLimit + 1)
          .select(
            '_id title body link read type createdAt readAt referenceId roleTarget',
          )
          .lean({ virtuals: true }),
        Notification.countDocuments({
          user: userId,
          read: false,
          ...typeExclusion,
        }),
        Notification.aggregate<{ _id: string; count: number }>([
          { $match: { user: userId, read: false, ...typeExclusion } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ]),
      ]);

      const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
      const unreadByType = unreadTypeBuckets.reduce<Record<string, number>>(
        (acc, row) => {
          const key = String(row?._id || '').trim();
          if (!key) return acc;
          acc[key] = Number(row?.count || 0);
          return acc;
        },
        {},
      );

      const result = {
        notifications: items as Array<Record<string, unknown>>,
        unreadCount,
        unreadByType,
        nextCursor,
        hasMore,
      };

      if (NOTIF_LIST_CACHE_MS > 0) {
        notificationPageCache.set(cacheKey, { at: Date.now(), result });
      }

      return result;
    } finally {
      notificationPageInflight.delete(cacheKey);
    }
  })();

  notificationPageInflight.set(cacheKey, p);
  return p;
}

/** Read transitions would otherwise show stale badges until the TTL expires. */
export function bustNotificationListCacheForUser(userId: string): void {
  const prefix = `${userId}:`;
  for (const key of notificationPageCache.keys()) {
    if (key.startsWith(prefix)) notificationPageCache.delete(key);
  }
}
