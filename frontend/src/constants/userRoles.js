/**
 * Paropakar VendorNet role model: the backend authoritatively stores three values
 * on `User.role` (`ADMIN` | `PROCUREMENT_OFFICER` | `VENDOR`). The UI keeps a
 * separate **session role key** in Redux — short lowercase slugs — because guards
 * and route checks read those strings everywhere; `mapApiRoleToSession()` bridges
 * JWT/API enums to that shape, and `ROLE_LABELS` is display copy only.
 */

/** Mirrors MongoDB / JWT `User.role` strings. */
export const BACKEND_ROLES = Object.freeze({
  ADMIN: "ADMIN",
  PROCUREMENT_OFFICER: "PROCUREMENT_OFFICER",
  VENDOR: "VENDOR",
});

/**
 * Values persisted in Redux / localStorage after login; the set is fixed to the
 * three backend roles above (no parallel “role system” on the client).
 */
export const SESSION_ROLE = Object.freeze({
  ADMIN: "admin",
  PROCUREMENT_OFFICER: "procurement_officer",
  VENDOR: "vendor",
});

/** Human-readable labels for session keys; authorization remains server-side. */
export const ROLE_LABELS = Object.freeze({
  [SESSION_ROLE.ADMIN]: "Administrator",
  [SESSION_ROLE.PROCUREMENT_OFFICER]: "Procurement officer",
  [SESSION_ROLE.VENDOR]: "Vendor",
});

export const ALL_SESSION_ROLES = Object.freeze([
  SESSION_ROLE.ADMIN,
  SESSION_ROLE.PROCUREMENT_OFFICER,
  SESSION_ROLE.VENDOR,
]);

/** Converts API/JWT role strings into the session slug shape used in the app. */
export function mapApiRoleToSession(apiRole) {
  const u = String(apiRole || "").toUpperCase();
  if (u === BACKEND_ROLES.ADMIN) return SESSION_ROLE.ADMIN;
  if (u === BACKEND_ROLES.PROCUREMENT_OFFICER) return SESSION_ROLE.PROCUREMENT_OFFICER;
  if (u === BACKEND_ROLES.VENDOR) return SESSION_ROLE.VENDOR;
  return SESSION_ROLE.VENDOR;
}

/**
 * Older sessions stored `staff` for procurement officers; this keeps persisted
 * JSON compatible after the slug was renamed.
 */
export function normalizeSessionRole(role) {
  if (role == null || role === "") return role;
  const r = String(role).toLowerCase();
  if (r === "staff") return SESSION_ROLE.PROCUREMENT_OFFICER;
  return r;
}

/** Applies `normalizeSessionRole` to `user.role` when hydrating auth state. */
export function normalizeUserRoleFields(user) {
  if (!user || typeof user !== "object") return user;
  const role = normalizeSessionRole(user.role);
  return role === user.role ? user : { ...user, role };
}

export function getRoleLabel(sessionRole) {
  const r = normalizeSessionRole(sessionRole);
  return (r && ROLE_LABELS[r]) || sessionRole || "";
}
