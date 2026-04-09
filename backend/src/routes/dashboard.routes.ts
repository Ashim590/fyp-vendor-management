import { Router } from 'express';
import Tender from '../models/Tender';
import Bid from '../models/Bid';
import Payment from '../models/Payment';
import { authenticate, AuthRequest } from '../middleware/auth';
import { vendorMayAccessMarketplace } from '../utils/vendorGate';
import { resolveStaffDashboardForApi } from '../utils/staffDashboardData';
import {
  getVendorDashboardSummaryCached,
  setVendorDashboardSummaryCached,
} from '../utils/vendorDashboardSummaryCache';
import { perfLabel } from '../utils/perfTiming';

const router = Router();

/**
 * Single round-trip metrics for staff/vendor home layouts (avoids loading hundreds
 * of documents per page just for counts and small “recent” lists).
 */
router.get('/summary', authenticate, async (req: AuthRequest, res) => {
  const role = req.user?.role;
  try {
    if (role === 'ADMIN' || role === 'PROCUREMENT_OFFICER') {
      const mark = perfLabel('GET /api/v1/dashboard/summary(staff-admin)');
      console.time(mark);
      try {
        const bypassCache =
          req.query.refresh === '1' ||
          req.query.refresh === 'true' ||
          req.query.nocache === '1';
        const { body, cacheHit } = await resolveStaffDashboardForApi(bypassCache);
        res.setHeader('X-Dashboard-Cache', cacheHit ? 'hit' : 'miss');
        return res.json(body);
      } finally {
        console.timeEnd(mark);
      }
    }

    if (role === 'VENDOR') {
      const vendorProfile = req.user?.vendorProfile;
      const empty = {
        success: true,
        kind: 'vendor',
        openTenders: 0,
        myBidsCount: 0,
        totalRevenue: 0,
        recentBids: [] as unknown[],
      };

      if (!vendorProfile) {
        return res.json(empty);
      }

      const mayBid = await vendorMayAccessMarketplace(vendorProfile);
      if (!mayBid) {
        return res.json(empty);
      }

      const vid = String(vendorProfile);
      const bypassCache =
        req.query.refresh === '1' ||
        req.query.refresh === 'true' ||
        req.query.nocache === '1';
      if (!bypassCache) {
        const cached = getVendorDashboardSummaryCached(vid);
        if (cached) {
          res.setHeader('X-Dashboard-Cache', 'hit');
          return res.json(cached);
        }
      }

      const vidRef = vendorProfile;

      const [openTenders, myBidsCount, revRow, recentBids] = await Promise.all([
          Tender.countDocuments({ status: 'PUBLISHED' }),
          Bid.countDocuments({ vendor: vidRef }),
          Payment.aggregate([
            { $match: { vendor: vidRef, status: 'Completed' } },
            { $group: { _id: null, sum: { $sum: '$amount' } } },
          ]),
          Bid.find({ vendor: vidRef })
            .sort({ createdAt: -1 })
            .limit(4)
            .select('amount status createdAt tender')
            .populate('tender', 'title')
            .lean(),
        ]);

      const totalRevenue = revRow?.[0]?.sum ? Number(revRow[0].sum) : 0;

      const body = {
        success: true,
        kind: 'vendor',
        openTenders,
        myBidsCount,
        /** Same as tender bids; kept for older clients that read this field. */
        myQuotationsCount: myBidsCount,
        totalRevenue,
        recentBids,
      };
      setVendorDashboardSummaryCached(vid, body);
      res.setHeader('X-Dashboard-Cache', 'miss');
      return res.json(body);
    }

    return res.status(403).json({ success: false, message: 'Not allowed' });
  } catch (err: unknown) {
    console.error('GET /dashboard/summary', err);
    return res.status(500).json({
      success: false,
      message: 'Could not load dashboard summary.',
    });
  }
});

export default router;
