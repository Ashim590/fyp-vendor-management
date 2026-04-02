/**
 * Profile photos stored as data URLs (base64) can exceed 2MB and blow up login/API JSON.
 * Strip those from client payloads; keep normal https URLs (e.g. Cloudinary).
 */
export function safeClientProfilePhoto(photo: string | undefined | null): string {
  const p = typeof photo === 'string' ? photo.trim() : '';
  if (!p) return '';
  // Allow reasonably small data URLs for direct in-app profile photo uploads.
  if (p.startsWith('data:')) return p.length <= 2_800_000 ? p : '';
  if (p.length > 500_000) return '';
  if (p.length > 8192 && !/^https?:\/\//i.test(p)) return '';
  return p;
}
