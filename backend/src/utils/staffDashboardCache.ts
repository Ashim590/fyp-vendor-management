/**
 * Staff /dashboard/summary runs several counts + aggregates; results are identical
 * for all admins/officers. Short TTL cache avoids hammering Mongo on every navigation.
 */

/** Default 2m — staff metrics are org-wide counts; slightly stale is OK for speed. */
const parsed = parseInt(process.env.STAFF_DASHBOARD_CACHE_MS || '120000', 10);
const DEFAULT_TTL_MS = Number.isFinite(parsed)
  ? Math.min(600_000, Math.max(10_000, parsed))
  : 120_000;

type Cached = { at: number; ttlMs: number; payload: Record<string, unknown> };

let staffSummary: Cached | null = null;

export function getCachedStaffSummary(): Record<string, unknown> | null {
  if (!staffSummary) return null;
  if (Date.now() - staffSummary.at > staffSummary.ttlMs) {
    staffSummary = null;
    return null;
  }
  return staffSummary.payload;
}

export function setCachedStaffSummary(
  payload: Record<string, unknown>,
  ttlMs = DEFAULT_TTL_MS,
) {
  staffSummary = { at: Date.now(), ttlMs, payload };
}

/** Call after writes that materially change org-wide dashboard metrics (optional). */
export function invalidateStaffSummaryCache() {
  staffSummary = null;
}
