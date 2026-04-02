/**
 * Short TTL per-vendor cache for GET /dashboard/summary (vendor role) to cut repeat aggregates.
 */

const parsed = parseInt(
  process.env.VENDOR_DASHBOARD_SUMMARY_CACHE_MS || "12000",
  10,
);
const TTL_MS = Number.isFinite(parsed)
  ? Math.min(60_000, Math.max(0, parsed))
  : 12_000;

type Entry = { exp: number; body: Record<string, unknown> };
const cache = new Map<string, Entry>();

export function getVendorDashboardSummaryCached(
  vendorId: string,
): Record<string, unknown> | null {
  if (TTL_MS <= 0) return null;
  const e = cache.get(vendorId);
  if (!e || e.exp <= Date.now()) {
    if (e) cache.delete(vendorId);
    return null;
  }
  return e.body;
}

export function setVendorDashboardSummaryCached(
  vendorId: string,
  body: Record<string, unknown>,
): void {
  if (TTL_MS <= 0) return;
  cache.set(vendorId, { exp: Date.now() + TTL_MS, body });
}

export function bustVendorDashboardSummaryCache(vendorId?: string): void {
  if (vendorId) cache.delete(String(vendorId));
  else cache.clear();
}
