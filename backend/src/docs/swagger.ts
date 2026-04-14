const backendUrl =
  process.env.BACKEND_URL?.trim() || `http://localhost:${process.env.PORT || 5000}`;

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

type EndpointDoc = {
  path: string;
  method: HttpMethod;
  tag: string;
  summary: string;
  auth?: boolean;
  requestBodyType?: "json" | "multipart";
};

const endpointDocs: EndpointDoc[] = [
  { path: "/api/health", method: "get", tag: "System", summary: "Health check" },

  { path: "/api/auth/register", method: "post", tag: "Auth", summary: "Register account" },
  { path: "/api/auth/register-vendor", method: "post", tag: "Auth", summary: "Register vendor account" },
  { path: "/api/auth/login", method: "post", tag: "Auth", summary: "Login and get JWT token" },
  { path: "/api/auth/bootstrap-admin", method: "get", tag: "Auth", summary: "Bootstrap admin (dev use)" },
  { path: "/api/auth/bootstrap-admin", method: "post", tag: "Auth", summary: "Bootstrap admin (dev use)" },
  { path: "/api/auth/users", method: "get", tag: "Auth", summary: "List users (admin)", auth: true },
  { path: "/api/auth/users", method: "post", tag: "Auth", summary: "Create procurement user (admin)", auth: true, requestBodyType: "json" },
  { path: "/api/auth/users/{id}", method: "get", tag: "Auth", summary: "Get user detail (admin)", auth: true },
  { path: "/api/auth/users/{id}", method: "patch", tag: "Auth", summary: "Update user profile (admin)", auth: true, requestBodyType: "json" },
  { path: "/api/auth/users/{id}/toggle-active", method: "patch", tag: "Auth", summary: "Toggle user active status (admin)", auth: true, requestBodyType: "json" },
  { path: "/api/auth/admin/purge-vendors-and-officers", method: "delete", tag: "Auth", summary: "Purge vendors/officers (admin utility)", auth: true },

  { path: "/api/users/me", method: "get", tag: "Users", summary: "Get current user", auth: true },
  { path: "/api/users/me", method: "patch", tag: "Users", summary: "Update current user profile", auth: true, requestBodyType: "multipart" },
  { path: "/api/users/me/password", method: "patch", tag: "Users", summary: "Change current user password", auth: true, requestBodyType: "json" },
  { path: "/api/users", method: "get", tag: "Users", summary: "List users (admin)", auth: true },
  { path: "/api/users/{id}/role", method: "patch", tag: "Users", summary: "Update user role (admin)", auth: true, requestBodyType: "json" },
  { path: "/api/users/{id}/status", method: "patch", tag: "Users", summary: "Update user status (admin)", auth: true, requestBodyType: "json" },

  { path: "/api/vendors/register", method: "post", tag: "Vendors", summary: "Vendor register (legacy)", auth: true, requestBodyType: "multipart" },
  { path: "/api/vendors", method: "get", tag: "Vendors", summary: "List vendors (legacy)", auth: true },
  { path: "/api/vendors/me", method: "get", tag: "Vendors", summary: "Get current vendor (legacy)", auth: true },
  { path: "/api/vendors/me", method: "put", tag: "Vendors", summary: "Update current vendor (legacy)", auth: true, requestBodyType: "multipart" },
  { path: "/api/vendors/stats", method: "get", tag: "Vendors", summary: "Vendor stats (legacy)", auth: true },
  { path: "/api/vendors/{id}", method: "get", tag: "Vendors", summary: "Get vendor by id (legacy)", auth: true },
  { path: "/api/vendors/{id}", method: "put", tag: "Vendors", summary: "Update vendor by id (legacy)", auth: true, requestBodyType: "multipart" },
  { path: "/api/vendors/{id}/approve", method: "put", tag: "Vendors", summary: "Approve vendor (legacy)", auth: true, requestBodyType: "json" },
  { path: "/api/vendors/{id}/reject", method: "put", tag: "Vendors", summary: "Reject vendor (legacy)", auth: true, requestBodyType: "json" },

  { path: "/api/v1/vendor", method: "get", tag: "Vendors", summary: "List vendors", auth: true },
  { path: "/api/v1/vendor/me", method: "get", tag: "Vendors", summary: "Get current vendor", auth: true },
  { path: "/api/v1/vendor/me", method: "put", tag: "Vendors", summary: "Update current vendor", auth: true, requestBodyType: "multipart" },
  { path: "/api/v1/vendor/stats", method: "get", tag: "Vendors", summary: "Vendor stats", auth: true },
  { path: "/api/v1/vendor/{id}", method: "get", tag: "Vendors", summary: "Get vendor by id", auth: true },
  { path: "/api/v1/vendor/{id}", method: "put", tag: "Vendors", summary: "Update vendor by id", auth: true, requestBodyType: "multipart" },
  { path: "/api/v1/vendor/{id}/approve", method: "put", tag: "Vendors", summary: "Approve vendor", auth: true, requestBodyType: "json" },
  { path: "/api/v1/vendor/{id}/reject", method: "put", tag: "Vendors", summary: "Reject vendor", auth: true, requestBodyType: "json" },

  { path: "/api/admin/vendors", method: "get", tag: "Admin Vendors", summary: "List admin vendors", auth: true },
  { path: "/api/admin/vendors/{id}/verify", method: "patch", tag: "Admin Vendors", summary: "Verify vendor", auth: true, requestBodyType: "json" },

  { path: "/api/tenders", method: "post", tag: "Tenders", summary: "Create tender", auth: true, requestBodyType: "json" },
  { path: "/api/tenders", method: "get", tag: "Tenders", summary: "List tenders", auth: true },
  { path: "/api/tenders/{id}", method: "get", tag: "Tenders", summary: "Get tender", auth: true },
  { path: "/api/tenders/{id}/withdraw", method: "patch", tag: "Tenders", summary: "Withdraw tender", auth: true, requestBodyType: "json" },
  { path: "/api/tenders/{id}", method: "delete", tag: "Tenders", summary: "Delete tender", auth: true },
  { path: "/api/tenders/{id}/quotation-comparison", method: "get", tag: "Tenders", summary: "Get quotation comparison", auth: true },
  { path: "/api/tenders/{id}/clarifications", method: "get", tag: "Tenders", summary: "List clarifications", auth: true },
  { path: "/api/tenders/{id}/clarifications", method: "post", tag: "Tenders", summary: "Create clarification", auth: true, requestBodyType: "json" },
  { path: "/api/tenders/{id}/clarifications/{clarificationId}/answer", method: "patch", tag: "Tenders", summary: "Answer clarification", auth: true, requestBodyType: "json" },
  { path: "/api/tenders/{id}/publish", method: "patch", tag: "Tenders", summary: "Publish tender", auth: true, requestBodyType: "json" },
  { path: "/api/tenders/{id}/close", method: "patch", tag: "Tenders", summary: "Close tender", auth: true, requestBodyType: "json" },
  { path: "/api/tenders/{id}/status", method: "patch", tag: "Tenders", summary: "Update tender status", auth: true, requestBodyType: "json" },
  { path: "/api/tenders/{id}/award", method: "patch", tag: "Tenders", summary: "Award tender", auth: true, requestBodyType: "json" },

  { path: "/api/v1/tenders", method: "post", tag: "Tenders", summary: "Create tender", auth: true, requestBodyType: "json" },
  { path: "/api/v1/tenders", method: "get", tag: "Tenders", summary: "List tenders", auth: true },
  { path: "/api/v1/tenders/{id}", method: "get", tag: "Tenders", summary: "Get tender", auth: true },
  { path: "/api/v1/tenders/{id}/withdraw", method: "patch", tag: "Tenders", summary: "Withdraw tender", auth: true, requestBodyType: "json" },
  { path: "/api/v1/tenders/{id}", method: "delete", tag: "Tenders", summary: "Delete tender", auth: true },
  { path: "/api/v1/tenders/{id}/quotation-comparison", method: "get", tag: "Tenders", summary: "Get quotation comparison", auth: true },
  { path: "/api/v1/tenders/{id}/clarifications", method: "get", tag: "Tenders", summary: "List clarifications", auth: true },
  { path: "/api/v1/tenders/{id}/clarifications", method: "post", tag: "Tenders", summary: "Create clarification", auth: true, requestBodyType: "json" },
  { path: "/api/v1/tenders/{id}/clarifications/{clarificationId}/answer", method: "patch", tag: "Tenders", summary: "Answer clarification", auth: true, requestBodyType: "json" },
  { path: "/api/v1/tenders/{id}/publish", method: "patch", tag: "Tenders", summary: "Publish tender", auth: true, requestBodyType: "json" },
  { path: "/api/v1/tenders/{id}/close", method: "patch", tag: "Tenders", summary: "Close tender", auth: true, requestBodyType: "json" },
  { path: "/api/v1/tenders/{id}/status", method: "patch", tag: "Tenders", summary: "Update tender status", auth: true, requestBodyType: "json" },
  { path: "/api/v1/tenders/{id}/award", method: "patch", tag: "Tenders", summary: "Award tender", auth: true, requestBodyType: "json" },

  { path: "/api/bids", method: "post", tag: "Bids", summary: "Submit bid", auth: true, requestBodyType: "multipart" },
  { path: "/api/bids/draft", method: "post", tag: "Bids", summary: "Save bid draft", auth: true, requestBodyType: "multipart" },
  { path: "/api/bids/draft/{tenderId}", method: "get", tag: "Bids", summary: "Get bid draft", auth: true },
  { path: "/api/bids/my", method: "get", tag: "Bids", summary: "List my bids", auth: true },
  { path: "/api/bids/me", method: "get", tag: "Bids", summary: "List my bids (alias)", auth: true },
  { path: "/api/bids", method: "get", tag: "Bids", summary: "List bids", auth: true },
  { path: "/api/bids/tender/{tenderId}", method: "get", tag: "Bids", summary: "List bids by tender", auth: true },
  { path: "/api/bids/{id}", method: "get", tag: "Bids", summary: "Get bid", auth: true },
  { path: "/api/bids/{id}/evaluate", method: "patch", tag: "Bids", summary: "Evaluate bid", auth: true, requestBodyType: "json" },
  { path: "/api/bids/{id}/accept", method: "patch", tag: "Bids", summary: "Accept bid", auth: true, requestBodyType: "json" },
  { path: "/api/bids/{id}/reject", method: "patch", tag: "Bids", summary: "Reject bid", auth: true, requestBodyType: "json" },
  { path: "/api/bids/{id}", method: "delete", tag: "Bids", summary: "Delete bid", auth: true },

  { path: "/api/v1/bids", method: "post", tag: "Bids", summary: "Submit bid", auth: true, requestBodyType: "multipart" },
  { path: "/api/v1/bids/draft", method: "post", tag: "Bids", summary: "Save bid draft", auth: true, requestBodyType: "multipart" },
  { path: "/api/v1/bids/draft/{tenderId}", method: "get", tag: "Bids", summary: "Get bid draft", auth: true },
  { path: "/api/v1/bids/my", method: "get", tag: "Bids", summary: "List my bids", auth: true },
  { path: "/api/v1/bids/me", method: "get", tag: "Bids", summary: "List my bids (alias)", auth: true },
  { path: "/api/v1/bids", method: "get", tag: "Bids", summary: "List bids", auth: true },
  { path: "/api/v1/bids/tender/{tenderId}", method: "get", tag: "Bids", summary: "List bids by tender", auth: true },
  { path: "/api/v1/bids/{id}", method: "get", tag: "Bids", summary: "Get bid", auth: true },
  { path: "/api/v1/bids/{id}/evaluate", method: "patch", tag: "Bids", summary: "Evaluate bid", auth: true, requestBodyType: "json" },
  { path: "/api/v1/bids/{id}/accept", method: "patch", tag: "Bids", summary: "Accept bid", auth: true, requestBodyType: "json" },
  { path: "/api/v1/bids/{id}/reject", method: "patch", tag: "Bids", summary: "Reject bid", auth: true, requestBodyType: "json" },
  { path: "/api/v1/bids/{id}", method: "delete", tag: "Bids", summary: "Delete bid", auth: true },

  { path: "/api/v1/purchase-request/create", method: "post", tag: "Purchase Requests", summary: "Create purchase request", auth: true, requestBodyType: "json" },
  { path: "/api/v1/purchase-request/list", method: "get", tag: "Purchase Requests", summary: "List purchase requests", auth: true },
  { path: "/api/v1/purchase-request", method: "get", tag: "Purchase Requests", summary: "List purchase requests (alias)", auth: true },
  { path: "/api/v1/purchase-request/my", method: "get", tag: "Purchase Requests", summary: "List my purchase requests", auth: true },
  { path: "/api/v1/purchase-request/stats", method: "get", tag: "Purchase Requests", summary: "Purchase request stats", auth: true },
  { path: "/api/v1/purchase-request/{id}", method: "get", tag: "Purchase Requests", summary: "Get purchase request", auth: true },
  { path: "/api/v1/purchase-request/{id}", method: "put", tag: "Purchase Requests", summary: "Update purchase request", auth: true, requestBodyType: "json" },
  { path: "/api/v1/purchase-request/{id}/submit", method: "put", tag: "Purchase Requests", summary: "Submit purchase request", auth: true, requestBodyType: "json" },
  { path: "/api/v1/purchase-request/{id}/cancel", method: "put", tag: "Purchase Requests", summary: "Cancel purchase request", auth: true, requestBodyType: "json" },
  { path: "/api/v1/purchase-request/{id}", method: "delete", tag: "Purchase Requests", summary: "Delete purchase request", auth: true },
  { path: "/api/v1/purchase-request/{id}/restore", method: "put", tag: "Purchase Requests", summary: "Restore purchase request", auth: true, requestBodyType: "json" },

  { path: "/api/v1/quotation/create", method: "post", tag: "Quotations", summary: "Create quotation", auth: true, requestBodyType: "json" },
  { path: "/api/v1/quotation", method: "get", tag: "Quotations", summary: "List quotations", auth: true },
  { path: "/api/v1/quotation/my", method: "get", tag: "Quotations", summary: "List my quotations", auth: true },
  { path: "/api/v1/quotation/request/{requestId}", method: "get", tag: "Quotations", summary: "List quotations by request", auth: true },
  { path: "/api/v1/quotation/{quotationId}", method: "get", tag: "Quotations", summary: "Get quotation", auth: true },
  { path: "/api/v1/quotation/{quotationId}/accept", method: "put", tag: "Quotations", summary: "Accept quotation", auth: true, requestBodyType: "json" },
  { path: "/api/v1/quotation/{quotationId}/reject", method: "put", tag: "Quotations", summary: "Reject quotation", auth: true, requestBodyType: "json" },

  { path: "/api/v1/approval/create", method: "post", tag: "Approvals", summary: "Create approval request", auth: true, requestBodyType: "json" },
  { path: "/api/v1/approval/my-pending", method: "get", tag: "Approvals", summary: "List my pending approvals", auth: true },
  { path: "/api/v1/approval/list", method: "get", tag: "Approvals", summary: "List approvals", auth: true },
  { path: "/api/v1/approval", method: "get", tag: "Approvals", summary: "List approvals (alias)", auth: true },
  { path: "/api/v1/approval/{id}", method: "get", tag: "Approvals", summary: "Get approval detail", auth: true },
  { path: "/api/v1/approval/{approvalId}/approve", method: "put", tag: "Approvals", summary: "Approve request", auth: true, requestBodyType: "json" },
  { path: "/api/v1/approval/{approvalId}/reject", method: "put", tag: "Approvals", summary: "Reject request", auth: true, requestBodyType: "json" },

  { path: "/api/v1/purchase-order/create", method: "post", tag: "Purchase Orders", summary: "Create purchase order", auth: true, requestBodyType: "json" },
  { path: "/api/v1/purchase-order", method: "get", tag: "Purchase Orders", summary: "List purchase orders", auth: true },
  { path: "/api/v1/purchase-order/{orderId}", method: "get", tag: "Purchase Orders", summary: "Get purchase order", auth: true },
  { path: "/api/v1/purchase-order/{orderId}", method: "put", tag: "Purchase Orders", summary: "Update purchase order", auth: true, requestBodyType: "json" },

  { path: "/api/v1/delivery/create", method: "post", tag: "Deliveries", summary: "Create delivery", auth: true, requestBodyType: "json" },
  { path: "/api/v1/delivery/my", method: "get", tag: "Deliveries", summary: "List my deliveries", auth: true },
  { path: "/api/v1/delivery", method: "get", tag: "Deliveries", summary: "List deliveries", auth: true },
  { path: "/api/v1/delivery/{deliveryId}", method: "get", tag: "Deliveries", summary: "Get delivery", auth: true },
  { path: "/api/v1/delivery/{deliveryId}/status", method: "patch", tag: "Deliveries", summary: "Update delivery status", auth: true, requestBodyType: "json" },
  { path: "/api/v1/delivery/{deliveryId}/confirm", method: "patch", tag: "Deliveries", summary: "Confirm delivery with GPS", auth: true, requestBodyType: "json" },
  { path: "/api/v1/delivery/{deliveryId}/confirm-delivery", method: "post", tag: "Deliveries", summary: "Confirm delivery (multipart proof)", auth: true, requestBodyType: "multipart" },
  { path: "/api/v1/delivery/{deliveryId}/delay", method: "patch", tag: "Deliveries", summary: "Record delivery delay", auth: true, requestBodyType: "json" },
  { path: "/api/v1/delivery/{deliveryId}/comment", method: "patch", tag: "Deliveries", summary: "Add delivery comment", auth: true, requestBodyType: "json" },
  { path: "/api/v1/delivery/{deliveryId}/receive", method: "put", tag: "Deliveries", summary: "Legacy receive endpoint", auth: true, requestBodyType: "json" },
  { path: "/api/v1/delivery/{deliveryId}/inspect", method: "put", tag: "Deliveries", summary: "Inspect verified delivery", auth: true, requestBodyType: "json" },

  { path: "/api/orders/{deliveryId}/confirm-delivery", method: "post", tag: "Deliveries", summary: "Alias confirm-delivery endpoint", auth: true, requestBodyType: "multipart" },

  { path: "/api/v1/invoice/create", method: "post", tag: "Invoices", summary: "Create invoice", auth: true, requestBodyType: "json" },
  { path: "/api/v1/invoice/reconcile-from-payments", method: "post", tag: "Invoices", summary: "Reconcile invoices from payments", auth: true, requestBodyType: "json" },
  { path: "/api/v1/invoice", method: "get", tag: "Invoices", summary: "List invoices", auth: true },
  { path: "/api/v1/invoice/{invoiceId}", method: "get", tag: "Invoices", summary: "Get invoice", auth: true },
  { path: "/api/v1/invoice/{invoiceId}", method: "put", tag: "Invoices", summary: "Update invoice", auth: true, requestBodyType: "json" },

  { path: "/api/v1/payment/create", method: "post", tag: "Payments", summary: "Create payment", auth: true, requestBodyType: "json" },
  { path: "/api/v1/payment", method: "get", tag: "Payments", summary: "List payments", auth: true },
  { path: "/api/v1/payment/my", method: "get", tag: "Payments", summary: "List my payments", auth: true },
  { path: "/api/v1/payment/summary", method: "get", tag: "Payments", summary: "Payment summary", auth: true },
  { path: "/api/v1/payment/{paymentId}", method: "get", tag: "Payments", summary: "Get payment", auth: true },
  { path: "/api/v1/payment/{paymentId}/status", method: "patch", tag: "Payments", summary: "Update payment status", auth: true, requestBodyType: "json" },
  { path: "/api/v1/payment/{paymentId}/esewa/initiate", method: "post", tag: "Payments", summary: "Initiate eSewa payment", auth: true, requestBodyType: "json" },

  { path: "/api/v1/invoice-payment/create", method: "post", tag: "Invoice Payments", summary: "Create invoice payment", auth: true, requestBodyType: "json" },
  { path: "/api/v1/invoice-payment/by-invoice/{invoiceId}", method: "get", tag: "Invoice Payments", summary: "List invoice payments by invoice", auth: true },
  { path: "/api/v1/invoice-payment/{paymentId}", method: "get", tag: "Invoice Payments", summary: "Get invoice payment", auth: true },
  { path: "/api/v1/invoice-payment/{paymentId}/esewa/initiate", method: "post", tag: "Invoice Payments", summary: "Initiate invoice eSewa payment", auth: true, requestBodyType: "json" },

  { path: "/api/v1/notifications", method: "get", tag: "Notifications", summary: "List notifications", auth: true },
  { path: "/api/v1/notifications/{id}/read", method: "patch", tag: "Notifications", summary: "Mark notification read", auth: true, requestBodyType: "json" },
  { path: "/api/v1/notifications/read-all", method: "patch", tag: "Notifications", summary: "Mark all notifications read", auth: true, requestBodyType: "json" },
  { path: "/api/v1/notifications/{id}", method: "delete", tag: "Notifications", summary: "Delete notification", auth: true },

  { path: "/api/v1/reports/admin-dashboard-quick", method: "get", tag: "Reports", summary: "Admin dashboard quick report", auth: true },
  { path: "/api/v1/reports/admin-dashboard", method: "get", tag: "Reports", summary: "Admin dashboard report", auth: true },
  { path: "/api/v1/reports/summary", method: "get", tag: "Reports", summary: "Summary report", auth: true },
  { path: "/api/v1/reports/overview", method: "get", tag: "Reports", summary: "Overview report", auth: true },
  { path: "/api/v1/reports/payment-summary", method: "get", tag: "Reports", summary: "Payment summary report", auth: true },
  { path: "/api/v1/reports/tenders-per-month", method: "get", tag: "Reports", summary: "Tenders per month report", auth: true },
  { path: "/api/v1/reports/vendor-participation", method: "get", tag: "Reports", summary: "Vendor participation report", auth: true },
  { path: "/api/v1/reports/bid-status", method: "get", tag: "Reports", summary: "Bid status report", auth: true },
  { path: "/api/v1/reports/tender-quotations", method: "get", tag: "Reports", summary: "Tender quotations report", auth: true },

  { path: "/api/v1/dashboard/summary", method: "get", tag: "Dashboard", summary: "Dashboard summary", auth: true },
  { path: "/api/v1/session/staff-home", method: "get", tag: "Session", summary: "Staff home payload", auth: true },

  { path: "/api/v1/audit-log", method: "get", tag: "Audit Logs", summary: "List audit logs", auth: true },
  { path: "/api/v1/audit-log/my", method: "get", tag: "Audit Logs", summary: "List my audit logs", auth: true },
  { path: "/api/v1/audit-log/stats", method: "get", tag: "Audit Logs", summary: "Audit log stats", auth: true },

  { path: "/api/v1/vendor-reviews", method: "post", tag: "Vendor Reviews", summary: "Create vendor review", auth: true, requestBodyType: "json" },
  { path: "/api/v1/vendor-reviews/vendor/{vendorId}", method: "get", tag: "Vendor Reviews", summary: "List reviews by vendor", auth: true },

  { path: "/api/settings/theme", method: "get", tag: "Settings", summary: "Get theme setting" },
  { path: "/api/settings/theme", method: "put", tag: "Settings", summary: "Update theme setting (admin)", auth: true, requestBodyType: "json" },
];

const tags = [
  "System",
  "Auth",
  "Users",
  "Vendors",
  "Admin Vendors",
  "Tenders",
  "Bids",
  "Purchase Requests",
  "Quotations",
  "Approvals",
  "Purchase Orders",
  "Deliveries",
  "Invoices",
  "Payments",
  "Invoice Payments",
  "Notifications",
  "Reports",
  "Dashboard",
  "Session",
  "Audit Logs",
  "Vendor Reviews",
  "Settings",
];

const paths: Record<string, Record<string, unknown>> = {};
for (const ep of endpointDocs) {
  if (!paths[ep.path]) paths[ep.path] = {};
  const operation: Record<string, unknown> = {
    tags: [ep.tag],
    summary: ep.summary,
    responses: {
      "200": { description: "Success" },
      "400": { description: "Bad Request" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "404": { description: "Not Found" },
      "500": { description: "Internal Server Error" },
    },
  };
  if (ep.auth) operation.security = [{ bearerAuth: [] }];
  if (ep.path.includes("{")) {
    const params = [...ep.path.matchAll(/\{([^}]+)\}/g)].map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));
    if (params.length) operation.parameters = params;
  }
  if (ep.requestBodyType) {
    operation.requestBody = {
      required: true,
      content:
        ep.requestBodyType === "multipart"
          ? { "multipart/form-data": { schema: { type: "object" } } }
          : { "application/json": { schema: { type: "object" } } },
    };
  }
  paths[ep.path][ep.method] = operation;
}

export const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "Paropakar VendorNet API",
    version: "1.0.0",
    description:
      "Complete API documentation for Paropakar VendorNet backend.",
  },
  servers: [
    { url: backendUrl, description: "Current environment" },
    { url: "http://localhost:5001", description: "Local development" },
  ],
  tags: tags.map((name) => ({ name })),
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  paths,
};

