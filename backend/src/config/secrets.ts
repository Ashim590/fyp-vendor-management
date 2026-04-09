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
