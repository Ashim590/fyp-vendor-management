import { Router } from 'express';
import Notification from '../models/Notification';
import { authenticate, AuthRequest } from '../middleware/auth';
import { parseListLimit } from '../utils/cursorPagination';
import { loadNotificationPageForUser } from '../utils/notificationListForUser';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!._id;
    const pageLimit = parseListLimit(req.query.limit, 30, 100);
    const cursor =
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    try {
      const page = await loadNotificationPageForUser(userId, pageLimit, cursor);
      return res.json({
        notifications: page.notifications,
        unreadCount: page.unreadCount,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'INVALID_CURSOR') {
        return res.status(400).json({ message: 'Invalid cursor' });
      }
      throw e;
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to load notifications' });
  }
});

router.patch('/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user!._id },
      { read: true },
      { new: true }
    );
    if (!n) {
      return res.status(404).json({ message: 'Not found' });
    }
    return res.json(n);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to update notification' });
  }
});

router.patch('/read-all', authenticate, async (req: AuthRequest, res) => {
  try {
    await Notification.updateMany({ user: req.user!._id, read: false }, { read: true });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to mark all read' });
  }
});

export default router;
