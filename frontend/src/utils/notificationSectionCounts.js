/**
 * Unread notification counts per workspace sidebar path (role-aware).
 * Uses notification `type` when known, otherwise matches `link` to a sidebar prefix.
 */

const ORDERED_SIDEBAR_PREFIXES = {
  admin: [
    "/admin/users",
    "/admin",
    "/approvals",
    "/bids-monitor",
    "/purchase-requests",
    "/tenders",
    "/deliveries",
  ],
  staff: [
    "/purchase-requests",
    "/approvals",
    "/bids-monitor",
    "/tenders",
    "/deliveries",
    "/",
  ],
  vendor: ["/my-bids", "/tenders", "/deliveries", "/"],
};

const NON_WORKSPACE_PATHS = new Set([
  "/notifications",
  "/profile",
  "/vendor-profile",
]);

/** @type {Record<string, Partial<Record<'admin' | 'staff' | 'vendor', string[]>>>} */
const TYPE_TO_PATHS = {
  vendor_pending_review: { admin: ["/admin"] },
  vendor_approved_staff: { admin: ["/admin"] },
  vendor_rejected_staff: { admin: ["/admin"] },
  purchase_request_submitted: { admin: ["/approvals"], staff: ["/approvals"] },
  purchase_request_approved: { admin: ["/approvals"], staff: ["/approvals"] },
  purchase_request_rejected: { staff: ["/purchase-requests"] },
  tender_auto_created: { admin: ["/tenders"], staff: ["/tenders"] },
  tender_created: { vendor: ["/tenders"] },
  tender_closed: {
    admin: ["/tenders"],
    staff: ["/tenders"],
    vendor: ["/tenders"],
  },
  bid_submitted: { admin: ["/bids-monitor"], staff: ["/bids-monitor"] },
  bid_accepted: { vendor: ["/tenders"] },
  bid_rejected: { vendor: ["/my-bids"] },
  payment_pending: { vendor: ["/tenders"] },
  payment_completed: { vendor: ["/tenders"] },
  payment_failed: { vendor: ["/tenders"] },
  invoice_payment_pending: { vendor: ["/invoices"] },
  invoice_payment_paid: { vendor: ["/invoices"] },
  delivery_shipped: {
    admin: ["/deliveries"],
    staff: ["/deliveries"],
    vendor: ["/deliveries"],
  },
  delivery_in_transit: {
    admin: ["/deliveries"],
    staff: ["/deliveries"],
    vendor: ["/deliveries"],
  },
  delivery_delivered: {
    admin: ["/deliveries"],
    staff: ["/deliveries"],
    vendor: ["/deliveries"],
  },
  delivery_received: {
    admin: ["/deliveries"],
    staff: ["/deliveries"],
    vendor: ["/deliveries"],
  },
  delivery_delayed: {
    admin: ["/deliveries"],
    staff: ["/deliveries"],
    vendor: ["/deliveries"],
  },
};

function normalizePathname(link) {
  if (link == null || typeof link !== "string") return "";
  const trimmed = link.trim();
  if (!trimmed) return "";
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const u = new URL(trimmed);
      return u.pathname || "/";
    }
  } catch {
    return "";
  }
  const q = trimmed.indexOf("?");
  const h = trimmed.indexOf("#");
  let path = trimmed;
  if (q >= 0) path = path.slice(0, q);
  if (h >= 0 && (q < 0 || h < q)) path = path.slice(0, h);
  if (!path.startsWith("/")) path = `/${path}`;
  const collapsed = path.replace(/\/+/g, "/");
  return collapsed.length > 1 && collapsed.endsWith("/")
    ? collapsed.slice(0, -1)
    : collapsed;
}

function isExcludedWorkspacePath(pathname) {
  if (!pathname) return true;
  if (NON_WORKSPACE_PATHS.has(pathname)) return true;
  for (const p of NON_WORKSPACE_PATHS) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

/**
 * @param {string} link
 * @param {'admin' | 'staff' | 'vendor'} role
 * @returns {string | null}
 */
export function matchNotificationLinkToSidebarPath(link, role) {
  const pathname = normalizePathname(link);
  if (!pathname || isExcludedWorkspacePath(pathname)) return null;

  const prefixes = ORDERED_SIDEBAR_PREFIXES[role];
  if (!prefixes?.length) return null;

  for (const prefix of prefixes) {
    if (prefix === "/") {
      if (pathname === "/" || pathname === "") return "/";
      continue;
    }
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return prefix;
    }
  }
  return null;
}

function pathsForUnreadNotification(notification, role) {
  const type = notification?.type;
  const byType = type && TYPE_TO_PATHS[type]?.[role];
  if (byType?.length) return byType;

  const fromLink = matchNotificationLinkToSidebarPath(notification?.link, role);
  return fromLink ? [fromLink] : [];
}

/**
 * @param {Array<{ read?: boolean, type?: string, link?: string }>} notifications
 * @param {'admin' | 'staff' | 'vendor' | undefined} userRole
 * @returns {Record<string, number>}
 */
export function getUnreadCountsBySidebarPath(notifications, userRole) {
  const role = userRole === "admin" || userRole === "staff" || userRole === "vendor" ? userRole : null;
  if (!role || !Array.isArray(notifications)) return {};

  const counts = {};
  for (const n of notifications) {
    if (n?.read) continue;
    const paths = pathsForUnreadNotification(n, role);
    for (const p of paths) {
      counts[p] = (counts[p] || 0) + 1;
    }
  }
  return counts;
}
