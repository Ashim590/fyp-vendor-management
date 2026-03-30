import mongoose from 'mongoose';

/** Opaque cursor: base64url(JSON { t: createdAt ms, i: _id hex }) — sort is always createdAt desc, _id desc */

export function encodeCursor(createdAt: Date, id: string): string {
  const payload = { t: new Date(createdAt).getTime(), i: id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export type DecodedCursor = { createdAt: Date; id: mongoose.Types.ObjectId };

export function decodeCursor(cursor: string | undefined): DecodedCursor | null {
  if (!cursor || typeof cursor !== 'string') return null;
  const trimmed = cursor.trim();
  if (!trimmed) return null;
  try {
    const json = Buffer.from(trimmed, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as { t?: unknown; i?: unknown };
    if (typeof parsed.t !== 'number' || typeof parsed.i !== 'string') return null;
    if (!mongoose.isValidObjectId(parsed.i)) return null;
    return {
      createdAt: new Date(parsed.t),
      id: new mongoose.Types.ObjectId(parsed.i),
    };
  } catch {
    return null;
  }
}

/**
 * Stable descending pagination: newer-first (createdAt, _id).
 * Merges an optional cursor seek with an arbitrary Mongo filter using $and.
 */
export function mergeWithCursorFilter(
  baseFilter: Record<string, unknown>,
  cursor: string | undefined,
): Record<string, unknown> {
  const decoded = decodeCursor(cursor);
  if (!decoded) {
    if (cursor != null && String(cursor).trim()) {
      const err = new Error('INVALID_CURSOR');
      (err as Error & { status?: number }).status = 400;
      throw err;
    }
    return { ...baseFilter };
  }
  const { createdAt, id } = decoded;
  const cursorBranch = {
    $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: id } }],
  };
  const hasBase = Object.keys(baseFilter).length > 0;
  if (!hasBase) return cursorBranch;
  return { $and: [baseFilter, cursorBranch] };
}

export function parseListLimit(
  raw: unknown,
  defaultLimit = 25,
  maxLimit = 100,
): number {
  const n = parseInt(String(raw ?? defaultLimit), 10);
  if (Number.isNaN(n) || n < 1) return defaultLimit;
  return Math.min(maxLimit, n);
}

export interface CursorPageResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Assumes `docs` was fetched with limit = pageLimit + 1 */
export function trimExtraDoc<T extends { createdAt?: Date; _id: unknown }>(
  docs: T[],
  pageLimit: number,
): CursorPageResult<T> {
  const hasMore = docs.length > pageLimit;
  const items = hasMore ? docs.slice(0, pageLimit) : docs;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last?.createdAt != null && last._id != null
      ? encodeCursor(new Date(last.createdAt as Date), String(last._id))
      : null;
  return { items, nextCursor, hasMore };
}
