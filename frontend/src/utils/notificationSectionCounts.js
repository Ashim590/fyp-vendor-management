/**
 * Unread notification counts per workspace sidebar path (role-aware).
 * Uses notification `type` when known, otherwise matches `link` to a sidebar prefix.
 */

import { SESSION_ROLE } from "@/constants/userRoles";

const ORDERED_SIDEBAR_PREFIXES = {
  admin: [
    "/admin/users",
    "/admin",
    "/procurement/payments",
    "/invoices",
    "/approvals",
    "/bids-monitor",
    "/purchase-requests",
    "/tenders",
    "/deliveries",
  ],
  [SESSION_ROLE.PROCUREMENT_OFFICER]: [
    "/procurement/payments",
    "/invoices",
    "/purchase-requests",
    "/approvals",
    "/bids-monitor",
    "/tenders",
    "/deliveries",
    "/",
  ],
  vendor: [
    "/my-payments",
    "/my-invoices",
    "/my-bids",
    "/tenders",
    "/deliveries",
    "/",
  ],
};

const NON_WORKSPACE_PATHS = new Set([
  "/notifications",
  "/profile",
  "/vendor-profile",
]);

/** @type {Record<string, Partial<Record<'admin' | 'procurement_officer' | 'vendor', string[]>>>} */
const TYPE_TO_PATHS = {
  vendor_pending_review: { admin: ["/admin"] },
  vendor_approved_staff: { admin: ["/admin"] },
  vendor_rejected_staff: { admin: ["/admin"] },
  purchase_request_submitted: {
    admin: ["/approvals"],
    [SESSION_ROLE.PROCUREMENT_OFFICER]: ["/approvals"],
  },
  purchase_request_approved: {
    admin: ["/approvals"],
    [SESSION_ROLE.PROCUREMENT_OFFICER]: ["/approvals"],
  },
  purchase_request_rejected: {
    [SESSION_ROLE.PROCUREMENT_OFFICER]: ["/purchase-requests"],
  },
  tender_auto_created: {
    admin: ["/tenders"],
    [SESSION_ROLE.PROCUREMENT_OFFICER]: ["/tenders"],
  },
  tender_created: { vendor: ["/tenders"] },
  tender_closed: {
    admin: ["/tenders"],
    [SESSION_ROLE.PROCUREMENT_OFFICER]: ["/tenders"],
    vendor: ["/tenders"],
  },
  bid_submitted: {
    admin: ["/bids-monitor"],
    [SESSION_ROLE.PROCUREMENT_OFFICER]: ["/bids-monitor"],
  },
  bid_accepted: { vendor: ["/my-bids"] },
  bid_rejected: { vendor: ["/my-bids"] },
  payment_pending: { vendor: ["/my-payments"] },
  payment_completed: { vendor: ["/my-payments"] },
  payment_failed: { vendor: ["/my-payments"] },
  invoice_payment_pending: { vendor: ["/my-invoices"] },
  invoice_payment_paid: { vendor: ["/my-invoices"] },
  delivery_shipped: {
    admin: ["/deliveries"],
    [SESSION_ROLE.PROCUREMENT_OFFICER]: ["/deliveries"],
    vendor: ["/deliveries"],
  },
  delivery_in_transit: {
    admin: ["/deliveries"],
    [SESSION_ROLE.PROCUREMENT_OFFICER]: ["/deliveries"],
    vendor: ["/deliveries"],
  },
  delivery_delivered: {
    admin: ["/deliveries"],
    [SESSION_ROLE.PROCUREMENT_OFFICER]: ["/deliveries"],
    vendor: ["/deliveries"],
  },
  delivery_received: {
    admin: ["/deliveries"],
    [SESSION_ROLE.PROCUREMENT_OFFICER]: ["/deliveries"],
    vendor: ["/deliveries"],
  },
  delivery_delayed: {
    admin: ["/deliveries"],
    [SESSION_ROLE.PROCUREMENT_OFFICER]: ["/deliveries"],
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
 * @param {'admin' | 'procurement_officer' | 'vendor'} role
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
 * @param {'admin' | 'procurement_officer' | 'vendor' | 'staff' | undefined} userRole
 * @param {Record<string, number> | undefined} unreadByType
 * @returns {Record<string, number>}
 */
export function getUnreadCountsBySidebarPath(notifications, userRole, unreadByType) {
  const r = String(userRole || "").toLowerCase();
  const role =
    r === SESSION_ROLE.ADMIN
      ? SESSION_ROLE.ADMIN
      : r === SESSION_ROLE.PROCUREMENT_OFFICER || r === "staff"
        ? SESSION_ROLE.PROCUREMENT_OFFICER
        : r === SESSION_ROLE.VENDOR
          ? SESSION_ROLE.VENDOR
          : null;
  if (!role || !Array.isArray(notifications)) return {};

  const counts = {};
  const typeTotals =
    unreadByType && typeof unreadByType === "object" ? unreadByType : null;

  // Exact totals from server for all unread notifications (not limited by page size).
  if (typeTotals) {
    for (const [type, rawCount] of Object.entries(typeTotals)) {
      const c = Number(rawCount || 0);
      if (!Number.isFinite(c) || c <= 0) continue;
      const byType = TYPE_TO_PATHS[type]?.[role];
      if (!byType?.length) continue;
      for (const p of byType) {
        counts[p] = (counts[p] || 0) + c;
      }
    }
  }

  // Fallback/additive mapping via links for types not mapped for this role.
  for (const n of notifications) {
    if (n?.read) continue;
    const type = String(n?.type || "");
    const isAlreadyCountedByType =
      !!typeTotals &&
      Number(typeTotals[type] || 0) > 0 &&
      Array.isArray(TYPE_TO_PATHS[type]?.[role]) &&
      TYPE_TO_PATHS[type][role].length > 0;
    if (isAlreadyCountedByType) continue;
    const paths = pathsForUnreadNotification(n, role);
    for (const p of paths) {
      counts[p] = (counts[p] || 0) + 1;
    }
  }
  return counts;
}
