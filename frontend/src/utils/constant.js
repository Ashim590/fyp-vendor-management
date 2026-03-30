/**
 * API base (no trailing slash).
 * - Omit VITE_API_BASE_URL in dev: requests use `/api/...` and Vite proxies to your backend (vite.config.js).
 * - Or set VITE_API_BASE_URL=http://localhost:3000 if the API runs there without a proxy.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const api = (path) => `${API_BASE}${path}`;

// Legacy user API (v1) – only needed if you still use legacy modules
export const USER_API_END_POINT = api("/api/v1/user");

// New auth API used by Paropakar VendorNet backend
export const AUTH_API_END_POINT = api("/api/auth");
export const JOB_API_END_POINT = api("/api/v1/job");
export const APPLICATION_API_END_POINT = api("/api/v1/application");
export const COMPANY_API_END_POINT = api("/api/v1/company");

// VendorNet API End Points
export const VENDOR_API_END_POINT = api("/api/v1/vendor");
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
/** Combined staff (procurement) dashboard + notifications — one round-trip */
export const SESSION_API_END_POINT = api("/api/v1/session");

// User roles for VendorNet
export const USER_ROLES = {
  ADMIN: "admin",
  STAFF: "staff",
  VENDOR: "vendor",
};

// Vendor categories
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
