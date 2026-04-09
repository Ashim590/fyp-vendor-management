/**
 * Public URLs for redirects and webhooks (eSewa, emails).
 * Prefer BACKEND_URL / FRONTEND_URL. SERVER_BASE_URL / CLIENT_BASE_URL are legacy aliases.
 * In production on Render/Railway, set explicit https URLs — do not rely on localhost defaults.
 */
export function getBackendUrl(): string {
  const explicit = process.env.BACKEND_URL || process.env.SERVER_BASE_URL;
  if (explicit) return explicit;
  const port = Number(process.env.PORT) || 5000;
  return `http://localhost:${port}`;
}

export function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || process.env.CLIENT_BASE_URL || 'http://localhost:5173';
}
