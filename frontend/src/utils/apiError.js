/**
 * Normalize axios / fetch errors into short, user-facing copy.
 * Prefer server `message` / `error`; then status; then network; then fallback.
 */

function sanitizeMessage(s) {
  return String(s)
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, 500);
}

function extractMessageFromResponseData(data) {
  if (typeof data === "string" && data.trim()) return data;
  if (!data || typeof data !== "object") return null;
  const raw = data.message ?? data.error ?? data.msg;
  if (Array.isArray(raw)) return raw.map(String).join(", ");
  if (typeof raw === "string" && raw.trim()) return raw;
  return null;
}

/**
 * @param {unknown} err - Axios error, Error, or already-resolved string from Redux
 * @param {string} [fallback]
 * @param {{ forbiddenHint?: string; serverErrorHint?: string }} [options] - Optional copy for empty 403/5xx bodies (e.g. login)
 */
export function getApiErrorMessage(
  err,
  fallback = "Something went wrong. Please try again.",
  options = {},
) {
  if (typeof err === "string" && err.trim()) return sanitizeMessage(err);

  const status = err?.response?.status;
  const data = err?.response?.data;

  const fromBody = extractMessageFromResponseData(data);
  if (fromBody) return sanitizeMessage(fromBody);

  const { forbiddenHint, serverErrorHint } = options;

  if (status === 403 && forbiddenHint) return forbiddenHint;
  if (status === 401) {
    return "Your session expired. Please sign in again.";
  }
  if (status === 403) {
    return "You don't have permission to do that.";
  }
  if (status === 404) {
    return "The requested resource was not found.";
  }
  if (status === 408) {
    return "The request timed out. Please try again.";
  }
  if (status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (status >= 500 && status < 600) {
    return serverErrorHint || "The server had a problem. Please try again later.";
  }

  const code = err?.code;
  if (code === "ECONNABORTED" || /timeout/i.test(String(err?.message || ""))) {
    return "The request timed out. Check your connection and try again.";
  }
  if (
    code === "ECONNREFUSED" ||
    code === "ERR_NETWORK" ||
    err?.message === "Network Error"
  ) {
    return "Cannot reach the server. Make sure the API is running and try again.";
  }

  const msg = err?.message;
  if (
    typeof msg === "string" &&
    msg &&
    !/^Request failed with status code \d+$/i.test(msg)
  ) {
    return sanitizeMessage(msg);
  }

  return fallback;
}
