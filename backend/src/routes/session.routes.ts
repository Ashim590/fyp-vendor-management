import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { resolveStaffDashboardForApi } from '../utils/staffDashboardData';
import { loadNotificationPageForUser } from '../utils/notificationListForUser';
import { parseListLimit } from '../utils/cursorPagination';
import { perfLabel } from '../utils/perfTiming';

const router = Router();

/**
 * One HTTP round-trip for staff workspace shell: dashboard summary + notification list + unread count.
 * Dashboard half may be served from Staff summary cache; notifications use the same short list cache as GET /notifications.
 */
router.get(
  '/staff-home',
  authenticate,
  /** Procurement workspace only — admins use /reports/admin-dashboard instead. */
  authorize(['PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const mark = perfLabel('GET /api/v1/session/staff-home');
    console.time(mark);
    try {
      const bypassCache =
        req.query.refresh === '1' ||
        req.query.refresh === 'true' ||
        req.query.nocache === '1';

      const pageLimit = parseListLimit(req.query.notificationLimit, 24, 100);
      const cursor =
        typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

      let notifPage: Awaited<ReturnType<typeof loadNotificationPageForUser>>;
      let body: Awaited<ReturnType<typeof resolveStaffDashboardForApi>>['body'];
      let cacheHit: boolean;

      try {
        const nMark = perfLabel('staff-home:notifications');
        const dMark = perfLabel('staff-home:dashboard');
        console.time(nMark);
        console.time(dMark);
        const notifP = loadNotificationPageForUser(
          req.user!._id,
          pageLimit,
          cursor,
          { viewerRole: req.user!.role },
        ).finally(
          () => console.timeEnd(nMark),
        );
        const dashP = resolveStaffDashboardForApi(bypassCache).finally(() =>
          console.timeEnd(dMark),
        );
        [notifPage, { body, cacheHit }] = await Promise.all([notifP, dashP]);
      } catch (e) {
        if (e instanceof Error && e.message === 'INVALID_CURSOR') {
          return res.status(400).json({ success: false, message: 'Invalid cursor' });
        }
        throw e;
      }

      res.setHeader('X-Dashboard-Cache', cacheHit ? 'hit' : 'miss');
      res.json({
        success: true,
        dashboard: body,
        notifications: notifPage,
      });
    } catch (err: unknown) {
      console.error('GET /session/staff-home', err);
      return res.status(500).json({
        success: false,
        message: 'Could not load staff workspace data.',
      });
    } finally {
      console.timeEnd(mark);
    }
  },
);

export default router;
