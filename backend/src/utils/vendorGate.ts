import Vendor from "../models/Vendor";

/**
 * Whether a vendor may use marketplace features (tenders, bids, etc.).
 * `status === 'approved'` is the source of truth (kept in sync with isVerified on approve).
 */
export function isVendorApprovedForMarketplace(
  v: { status?: string } | null | undefined
): boolean {
  return !!v && v.status === "approved";
}

type GateEntry = { exp: number; approved: boolean };
const marketplaceGateCache = new Map<string, GateEntry>();
const marketplaceGateInflight = new Map<string, Promise<boolean>>();
const MARKETPLACE_GATE_TTL_MS = 45_000;

/**
 * Cached `Vendor.status` check + single-flight (tender list/detail and bid routes call this often).
 */
export async function vendorMayAccessMarketplace(
  vendorProfileId: unknown
): Promise<boolean> {
  if (!vendorProfileId) return false;
  const key = String(vendorProfileId);
  const now = Date.now();
  const hit = marketplaceGateCache.get(key);
  if (hit && hit.exp > now) return hit.approved;

  const inflight = marketplaceGateInflight.get(key);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const vendorDoc = await Vendor.findById(key).select("status").lean();
      const approved = isVendorApprovedForMarketplace(vendorDoc);
      marketplaceGateCache.set(key, {
        exp: Date.now() + MARKETPLACE_GATE_TTL_MS,
        approved,
      });
      return approved;
    } finally {
      marketplaceGateInflight.delete(key);
    }
  })();
  marketplaceGateInflight.set(key, p);
  return p;
}

/** Call when admin changes vendor status so tender/bid gates refresh quickly. */
export function bustVendorMarketplaceGateCache(vendorId?: string) {
  if (vendorId) marketplaceGateCache.delete(String(vendorId));
  else marketplaceGateCache.clear();
}
