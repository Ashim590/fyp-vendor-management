import type { NotificationRoleTarget } from '../models/Notification';

/**
 * Notification rows tag which role family they were generated for; each user still
 * receives their own document, but this helps reporting and filters stay honest.
 */
export function roleTargetFromUserRole(
  role: string | undefined | null,
): NotificationRoleTarget {
  const r = String(role || '').toUpperCase();
  if (r === 'ADMIN') return 'ADMIN';
  if (r === 'PROCUREMENT_OFFICER') return 'PROCUREMENT_OFFICER';
  return 'VENDOR';
}
