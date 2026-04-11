/**
 * Resolves the in-app path for a notification so deep links, sidebar badges, and
 * “mark read when you land on the page” all agree on the same target URL.
 */
export function getNotificationLinkTarget(n) {
  const raw = String(n?.link || "").trim();
  if (n?.type === "bid_accepted") {
    const bidParam = raw.match(/[?&]openBid=([a-f\d]{24})/i)?.[1];
    return bidParam ? `/my-bids?openBid=${bidParam}` : "/my-bids";
  }
  return raw;
}
