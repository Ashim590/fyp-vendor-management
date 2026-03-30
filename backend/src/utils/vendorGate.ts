/**
 * Whether a vendor may use marketplace features (tenders, bids, etc.).
 * `status === 'approved'` is the source of truth (kept in sync with isVerified on approve).
 */
export function isVendorApprovedForMarketplace(
  v: { status?: string } | null | undefined
): boolean {
  return !!v && v.status === "approved";
}
