/**
 * Combined admin analytics: full bundle + lighter "quick" KPI block.
 * TTL cache (per role; payment in quick is ADMIN-only) speeds repeat visits.
 */

/**
 * Fresh TTL — tune with ADMIN_DASHBOARD_CACHE_MS (default 5m, max 10m).
 * After TTL, `/admin-dashboard` can still return the last payload as `stale` while recomputing in background.
 */
const parsed = parseInt(process.env.ADMIN_DASHBOARD_CACHE_MS || '300000', 10);
const DEFAULT_TTL_MS = Number.isFinite(parsed)
  ? Math.min(600_000, Math.max(5_000, parsed))
  : 300_000;

/** How long we may serve a stale dashboard after fresh TTL (tune with ADMIN_DASHBOARD_STALE_MAX_MS). */
const staleParsed = parseInt(
  process.env.ADMIN_DASHBOARD_STALE_MAX_MS || '',
  10,
);
export const STALE_MAX_MS = Number.isFinite(staleParsed) && staleParsed > 0
  ? Math.min(3_600_000, Math.max(60_000, staleParsed))
  : 30 * 60 * 1000;

type Cached = { at: number; ttlMs: number; payload: Record<string, unknown> };

const buckets = new Map<string, Cached>();
/** Summary + monthly + payments — fewer aggregations than full admin-dashboard. */
const quickBuckets = new Map<string, Cached>();

/** Per-route caches (same TTL) so parallel /summary + /tenders-per-month + charts can all hit RAM. */
let summaryOnlyCache: Cached | null = null;
let tendersMonthOnlyCache: Cached | null = null;
let paymentSummaryOnlyCache: Cached | null = null;
const vendorParticipationCache = new Map<string, Cached>();
let bidStatusOnlyCache: Cached | null = null;
let tenderQuotationsOnlyCache: Cached | null = null;

function readEntry(c: Cached | null, clear: () => void): Record<string, unknown> | null {
  if (!c) return null;
  if (Date.now() - c.at > c.ttlMs) {
    clear();
    return null;
  }
  return c.payload;
}

export function getCachedReportSummaryOnly(): Record<string, unknown> | null {
  return readEntry(summaryOnlyCache, () => {
    summaryOnlyCache = null;
  });
}

export function setCachedReportSummaryOnly(
  payload: Record<string, unknown>,
  ttlMs = DEFAULT_TTL_MS,
) {
  summaryOnlyCache = { at: Date.now(), ttlMs, payload };
}

export function getCachedTendersMonthOnly(): Record<string, unknown> | null {
  return readEntry(tendersMonthOnlyCache, () => {
    tendersMonthOnlyCache = null;
  });
}

export function setCachedTendersMonthOnly(
  payload: Record<string, unknown>,
  ttlMs = DEFAULT_TTL_MS,
) {
  tendersMonthOnlyCache = { at: Date.now(), ttlMs, payload };
}

export function getCachedPaymentSummaryOnly(): Record<string, unknown> | null {
  return readEntry(paymentSummaryOnlyCache, () => {
    paymentSummaryOnlyCache = null;
  });
}

export function setCachedPaymentSummaryOnly(
  payload: Record<string, unknown>,
  ttlMs = DEFAULT_TTL_MS,
) {
  paymentSummaryOnlyCache = { at: Date.now(), ttlMs, payload };
}

export function getCachedVendorParticipationOnly(
  limitKey: string,
): Record<string, unknown> | null {
  const c = vendorParticipationCache.get(limitKey) ?? null;
  return readEntry(c, () => {
    vendorParticipationCache.delete(limitKey);
  });
}

export function setCachedVendorParticipationOnly(
  limitKey: string,
  payload: Record<string, unknown>,
  ttlMs = DEFAULT_TTL_MS,
) {
  vendorParticipationCache.set(limitKey, { at: Date.now(), ttlMs, payload });
}

export function getCachedBidStatusOnly(): Record<string, unknown> | null {
  return readEntry(bidStatusOnlyCache, () => {
    bidStatusOnlyCache = null;
  });
}

export function setCachedBidStatusOnly(
  payload: Record<string, unknown>,
  ttlMs = DEFAULT_TTL_MS,
) {
  bidStatusOnlyCache = { at: Date.now(), ttlMs, payload };
}

export function getCachedTenderQuotationsOnly(): Record<string, unknown> | null {
  return readEntry(tenderQuotationsOnlyCache, () => {
    tenderQuotationsOnlyCache = null;
  });
}

export function setCachedTenderQuotationsOnly(
  payload: Record<string, unknown>,
  ttlMs = DEFAULT_TTL_MS,
) {
  tenderQuotationsOnlyCache = { at: Date.now(), ttlMs, payload };
}

function roleCacheKey(role: string | undefined): string {
  return role === 'ADMIN' ? 'admin' : 'officer';
}

export function getCachedAdminDashboard(
  role: string | undefined,
): Record<string, unknown> | null {
  const key = roleCacheKey(role);
  const c = buckets.get(key);
  if (!c) return null;
  if (Date.now() - c.at > c.ttlMs) {
    return null;
  }
  return c.payload;
}

/**
 * Last successful dashboard payload past its fresh TTL but younger than {@link STALE_MAX_MS}.
 * Used for stale-while-revalidate so the UI stays responsive between recomputes.
 */
export function getStaleAdminDashboardPayload(
  role: string | undefined,
): Record<string, unknown> | null {
  const key = roleCacheKey(role);
  const c = buckets.get(key);
  if (!c) return null;
  const age = Date.now() - c.at;
  if (age > STALE_MAX_MS) {
    buckets.delete(key);
    quickBuckets.delete(key);
    return null;
  }
  return c.payload;
}

export function getCachedAdminDashboardQuick(
  role: string | undefined,
): Record<string, unknown> | null {
  const key = roleCacheKey(role);
  const c = quickBuckets.get(key);
  if (!c) return null;
  if (Date.now() - c.at > c.ttlMs) {
    quickBuckets.delete(key);
    return null;
  }
  return c.payload;
}

export function setCachedAdminDashboard(
  role: string | undefined,
  payload: Record<string, unknown>,
  ttlMs = DEFAULT_TTL_MS,
) {
  buckets.set(roleCacheKey(role), { at: Date.now(), ttlMs, payload });
}

export function setCachedAdminDashboardQuick(
  role: string | undefined,
  payload: Record<string, unknown>,
  ttlMs = DEFAULT_TTL_MS,
) {
  quickBuckets.set(roleCacheKey(role), { at: Date.now(), ttlMs, payload });
}

export function invalidateAdminDashboardCache() {
  buckets.clear();
  quickBuckets.clear();
  summaryOnlyCache = null;
  tendersMonthOnlyCache = null;
  paymentSummaryOnlyCache = null;
  vendorParticipationCache.clear();
  bidStatusOnlyCache = null;
  tenderQuotationsOnlyCache = null;
}
