/**
 * API base (no trailing slash). Empty string means same-origin `/api/...` (Vite dev proxy).
 * Production builds should set VITE_API_BASE_URL to the public backend so the SPA never
 * embeds localhost — that value is baked in at `npm run build` time.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const api = (path) => `${API_BASE}${path}`;

// Legacy user API (v1) – only needed if you still use legacy modules
export const USER_API_END_POINT = api("/api/v1/user");

// New auth API used by Paropakar VendorNet backend
export const AUTH_API_END_POINT = api("/api/auth");
/** Current user (backend `user.routes` — must respect VITE_API_BASE_URL in production) */
export const USERS_ME_API_END_POINT = api("/api/users/me");
export const USERS_ME_PASSWORD_API_END_POINT = api("/api/users/me/password");
/** Vendor self-service profile */
export const VENDOR_ME_API_END_POINT = api("/api/v1/vendor/me");
export const JOB_API_END_POINT = api("/api/v1/job");
export const APPLICATION_API_END_POINT = api("/api/v1/application");
export const COMPANY_API_END_POINT = api("/api/v1/company");

// VendorNet API End Points
export const VENDOR_API_END_POINT = api("/api/v1/vendor");
/** Transaction / performance reviews (procurement → vendor) */
export const VENDOR_REVIEW_API_END_POINT = api("/api/v1/vendor-reviews");
export const ADMIN_VENDORS_API_END_POINT = api("/api/admin/vendors");
export const PURCHASE_REQUEST_API_END_POINT = api("/api/v1/purchase-request");
export const QUOTATION_API_END_POINT = api("/api/v1/quotation");
export const APPROVAL_API_END_POINT = api("/api/v1/approval");
export const PURCHASE_ORDER_API_END_POINT = api("/api/v1/purchase-order");
export const DELIVERY_API_END_POINT = api("/api/v1/delivery");
export const INVOICE_API_END_POINT = api("/api/v1/invoice");
export const AUDIT_LOG_API_END_POINT = api("/api/v1/audit-log");
export const TENDER_API_END_POINT = api("/api/v1/tenders");
export const BID_API_END_POINT = api("/api/v1/bids");
export const NOTIFICATION_API_END_POINT = api("/api/v1/notifications");
export const REPORT_API_END_POINT = api("/api/v1/reports");
export const DASHBOARD_API_END_POINT = api("/api/v1/dashboard");
/** Tender (award) payments — eSewa */
export const PAYMENT_API_END_POINT = api("/api/v1/payment");
/** Invoice payments — eSewa */
export const INVOICE_PAYMENT_API_END_POINT = api("/api/v1/invoice-payment");
/** One request bundles procurement dashboard + notifications to cut latency on staff home. */
export const SESSION_API_END_POINT = api("/api/v1/session");

// Re-exports live in userRoles.js so role naming stays in one place.
export {
  BACKEND_ROLES,
  SESSION_ROLE,
  ROLE_LABELS,
  mapApiRoleToSession,
  normalizeSessionRole,
  getRoleLabel,
} from "@/constants/userRoles";

/** Legacy export name; SESSION_ROLE is the current shape. */
export const USER_ROLES = {
  ADMIN: "admin",
  PROCUREMENT_OFFICER: "procurement_officer",
  VENDOR: "vendor",
};

/** Canonical vendor business categories (values stored on Vendor.category; labels shown in UI). */
export const VENDOR_CATEGORIES = [
  { value: "office_supplies", label: "Office Supplies" },
  { value: "it_equipment", label: "IT Equipment" },
  { value: "furniture", label: "Furniture" },
  { value: "food_supplies", label: "Food Supplies" },
  { value: "medical_supplies", label: "Medical Supplies" },
  { value: "cleaning_supplies", label: "Cleaning Supplies" },
  { value: "printing", label: "Printing Services" },
  { value: "other", label: "Other" },
];

const VENDOR_CATEGORY_LABEL_MAP = Object.fromEntries(
  VENDOR_CATEGORIES.map(({ value, label }) => [value, label]),
);

/** Display label for a stored category slug (e.g. office_supplies → "Office Supplies"). */
export function getVendorCategoryLabel(slug) {
  if (slug == null || slug === "") return "—";
  const key = String(slug).trim();
  return (
    VENDOR_CATEGORY_LABEL_MAP[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// Purchase Request statuses
export const PR_STATUS = {
  DRAFT: "draft",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  QUOTATION_RECEIVED: "quotation_received",
  PO_CREATED: "po_created",
  COMPLETED: "completed",
};

// Priority levels
export const PRIORITY_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};
