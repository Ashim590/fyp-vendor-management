/**
 * Cuts repeated Mongo round-trips on remote clusters (e.g. Atlas): each request
 * otherwise does User.findById (+ Vendor lookup for vendors).
 */
import type { IUser } from '../models/User';

const ttlParsed = parseInt(process.env.AUTH_USER_CACHE_MS || '20000', 10);
const TTL_MS = Number.isFinite(ttlParsed)
  ? Math.min(120_000, Math.max(5_000, ttlParsed))
  : 20_000;
const SHORT_TTL_MS = 5_000;

type Entry = { exp: number; user: IUser };

const cache = new Map<string, Entry>();
const MAX_ENTRIES = 2_000;

export function getCachedAuthUser(userId: string): IUser | null {
  const e = cache.get(userId);
  if (!e || e.exp <= Date.now()) {
    if (e) cache.delete(userId);
    return null;
  }
  return e.user;
}

export function setCachedAuthUser(userId: string, user: IUser, shortTtl: boolean) {
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(userId, {
    exp: Date.now() + (shortTtl ? SHORT_TTL_MS : TTL_MS),
    user,
  });
}

export function bustAuthUserCache(userId?: string) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

export { TTL_MS, SHORT_TTL_MS };
