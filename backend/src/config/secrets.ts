/**
 * Central JWT secret access — never use a guessable default in production.
 * server.ts exits on boot if JWT_SECRET is missing when NODE_ENV=production.
 */
export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!s) throw new Error("JWT_SECRET is required in production");
    return s;
  }
  return s || "dev_only_change_me";
}

/**
 * Access-token lifetime (`expiresIn` for jsonwebtoken — e.g. `8h`, `7d`).
 * Override with JWT_EXPIRES_IN in production if policy requires shorter sessions.
 */
export function getJwtExpiresIn(): string {
  const v = process.env.JWT_EXPIRES_IN?.trim();
  if (v) return v;
  return "8h";
}
