import { Router, Response } from 'express';
import Tender from '../models/Tender';
import Bid from '../models/Bid';
import Vendor from '../models/Vendor';
import User from '../models/User';
import Payment from '../models/Payment';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import {
  getCachedAdminDashboard,
  getCachedAdminDashboardQuick,
  getStaleAdminDashboardPayload,
  getCachedBidStatusOnly,
  getCachedPaymentSummaryOnly,
  getCachedReportSummaryOnly,
  getCachedTenderQuotationsOnly,
  getCachedTendersMonthOnly,
  getCachedVendorParticipationOnly,
  setCachedAdminDashboard,
  setCachedAdminDashboardQuick,
  setCachedBidStatusOnly,
  setCachedPaymentSummaryOnly,
  setCachedReportSummaryOnly,
  setCachedTenderQuotationsOnly,
  setCachedTendersMonthOnly,
  setCachedVendorParticipationOnly,
} from '../utils/adminDashboardCache';
import { perfLabel } from '../utils/perfTiming';

const router = Router();

function reportsBypassCache(req: AuthRequest): boolean {
  const q = req.query || {};
  return q.refresh === '1' || q.refresh === 'true' || q.nocache === '1';
}

/** Limit heavy bid aggregations to recent rows so large prod DBs stay responsive. */
function recentBidsOnlyMatch() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return { createdAt: { $gte: d } };
}

type TenderStatusAgg = { _id: string; count: number };

function countFromFacet(arr: Array<{ c?: number }> | undefined): number {
  const n = arr?.[0]?.c;
  return typeof n === 'number' ? n : 0;
}

/**
 * Core payloads for admin-dashboard — fewer round-trips to MongoDB than many parallel counts
 * (helps high-latency Atlas links). Numeric results match the previous countDocuments paths.
 */
async function getSummaryPayload() {
  const [tRow, vRow, bidRow, userRow] = await Promise.all([
    Tender.aggregate<{
      total: Array<{ c?: number }>;
      active: Array<{ c?: number }>;
      byStatus: TenderStatusAgg[];
    }>([
      {
        $facet: {
          total: [{ $count: 'c' }],
          active: [{ $match: { status: 'PUBLISHED' } }, { $count: 'c' }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        },
      },
    ]),
    Vendor.aggregate<{
      total: Array<{ c?: number }>;
      approved: Array<{ c?: number }>;
      pending: Array<{ c?: number }>;
    }>([
      {
        $facet: {
          total: [{ $count: 'c' }],
          approved: [{ $match: { status: 'approved' } }, { $count: 'c' }],
          pending: [{ $match: { status: 'pending' } }, { $count: 'c' }],
        },
      },
    ]),
    Bid.aggregate<{ total: Array<{ c?: number }> }>([
      { $facet: { total: [{ $count: 'c' }] } },
    ]),
    User.aggregate<{ total: Array<{ c?: number }> }>([
      { $facet: { total: [{ $count: 'c' }] } },
    ]),
  ]);

  const t = tRow[0];
  const v = vRow[0];
  const tendersByStatus = (t?.byStatus ?? []).map((item) => ({
    _id: item._id,
    count: Number(item.count),
  }));

  return {
    totalTenders: countFromFacet(t?.total),
    activeTenders: countFromFacet(t?.active),
    totalVendors: countFromFacet(v?.total),
    approvedVendors: countFromFacet(v?.approved),
    pendingVendors: countFromFacet(v?.pending),
    totalBids: countFromFacet(bidRow[0]?.total),
    totalUsers: countFromFacet(userRow[0]?.total),
    tendersByStatus,
  };
}

async function getTendersPerMonthData() {
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const raw = await Tender.aggregate([
    {
      $match: {
        createdAt: { $gte: twelveMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        '_id.year': 1,
        '_id.month': 1,
      },
    },
  ]);

  return raw.map((item) => ({
    year: item._id.year,
    month: item._id.month,
    total: item.count,
  }));
}

async function getVendorParticipationData(limit: number) {
  return Bid.aggregate([
    { $match: recentBidsOnlyMatch() },
    {
      $group: {
        _id: '$vendor',
        totalBids: { $sum: 1 },
      },
    },
    { $sort: { totalBids: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'vendors',
        localField: '_id',
        foreignField: '_id',
        as: 'vendor',
      },
    },
    { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        vendorId: '$_id',
        name: {
          $ifNull: ['$vendor.name', 'Unknown vendor'],
        },
        category: '$vendor.category',
        totalBids: 1,
      },
    },
  ]);
}

async function getBidStatusRecord() {
  const raw = await Bid.aggregate([
    { $match: recentBidsOnlyMatch() },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const counts: Record<string, number> = {};
  raw.forEach((item) => {
    counts[String(item._id)] = Number(item.count);
  });
  return counts;
}

/** One pass over bids + lookup tender — avoids per-tender subpipeline on all tenders. */
async function getTenderQuotationsData() {
  return Bid.aggregate([
    { $match: recentBidsOnlyMatch() },
    {
      $group: {
        _id: '$tender',
        total: { $sum: 1 },
        pending: {
          $sum: {
            $cond: [{ $in: ['$status', ['SUBMITTED', 'UNDER_REVIEW']] }, 1, 0],
          },
        },
        accepted: { $sum: { $cond: [{ $eq: ['$status', 'ACCEPTED'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
      },
    },
    {
      $lookup: {
        from: 'tenders',
        localField: '_id',
        foreignField: '_id',
        as: 't',
      },
    },
    { $unwind: '$t' },
    {
      $project: {
        _id: '$_id',
        title: '$t.title',
        referenceNumber: '$t.referenceNumber',
        tenderStatus: '$t.status',
        totalQuotations: '$total',
        pending: 1,
        accepted: 1,
        rejected: 1,
        updatedAt: '$t.updatedAt',
      },
    },
    { $sort: { updatedAt: -1 } },
    { $limit: 50 },
  ]);
}

async function getPaymentSummaryData() {
  type Facet = {
    total: Array<{ c?: number }>;
    pending: Array<{ c?: number }>;
    completed: Array<{ c?: number }>;
    failed: Array<{ c?: number }>;
    totalAmount: Array<{ sum?: number }>;
  };
  const [row] = await Payment.aggregate<Facet>([
    {
      $facet: {
        total: [{ $count: 'c' }],
        pending: [{ $match: { status: 'Pending' } }, { $count: 'c' }],
        completed: [{ $match: { status: 'Completed' } }, { $count: 'c' }],
        failed: [{ $match: { status: 'Failed' } }, { $count: 'c' }],
        totalAmount: [{ $group: { _id: null, sum: { $sum: '$amount' } } }],
      },
    },
  ]);
  const f = row ?? ({} as Facet);
  return {
    total: countFromFacet(f.total),
    pending: countFromFacet(f.pending),
    completed: countFromFacet(f.completed),
    failed: countFromFacet(f.failed),
    totalAmount: f.totalAmount?.[0]?.sum != null ? Number(f.totalAmount[0].sum) : 0,
  };
}

/**
 * Single-flight: concurrent cold-cache (or bypass) requests for the same role
 * share one Mongo aggregation instead of stampeding the DB (fixes 30–40s × N in dev).
 */
const adminDashboardComputeInflight = new Map<
  string,
  Promise<Record<string, unknown>>
>();

function adminDashboardInflightKey(role: string | undefined): string {
  return role === 'ADMIN' ? 'admin' : 'officer';
}

function getOrComputeAdminDashboard(
  role: string | undefined,
  isAdmin: boolean,
): Promise<Record<string, unknown>> {
  const key = adminDashboardInflightKey(role);
  const existing = adminDashboardComputeInflight.get(key);
  if (existing) return existing;

  const p = computeAndStoreAdminDashboard(role, isAdmin).finally(() => {
    adminDashboardComputeInflight.delete(key);
  });
  adminDashboardComputeInflight.set(key, p);
  return p;
}

async function computeAndStoreAdminDashboard(
  role: string | undefined,
  isAdmin: boolean,
): Promise<Record<string, unknown>> {
  const [
    summary,
    tendersPerMonth,
    vendors,
    bidStatus,
    tenders,
    paymentSummary,
  ] = await Promise.all([
    getSummaryPayload(),
    getTendersPerMonthData(),
    getVendorParticipationData(10),
    getBidStatusRecord(),
    getTenderQuotationsData(),
    isAdmin ? getPaymentSummaryData() : Promise.resolve(null),
  ]);

  const body: Record<string, unknown> = {
    success: true,
    summary,
    tendersPerMonth,
    vendors,
    bidStatus,
    tenders,
    paymentSummary,
  };
  setCachedAdminDashboard(role, body);
  setCachedAdminDashboardQuick(role, {
    success: true,
    summary,
    tendersPerMonth,
    paymentSummary,
  });
  setCachedReportSummaryOnly({ success: true, summary });
  setCachedTendersMonthOnly({ success: true, tendersPerMonth });
  if (isAdmin && paymentSummary != null) {
    setCachedPaymentSummaryOnly({ success: true, paymentSummary });
  }
  setCachedVendorParticipationOnly('10', { success: true, vendors });
  setCachedBidStatusOnly({ success: true, bidStatus });
  setCachedTenderQuotationsOnly({ success: true, tenders });
  return body;
}

function scheduleAdminDashboardRevalidate(
  role: string | undefined,
  isAdmin: boolean,
) {
  void getOrComputeAdminDashboard(role, isAdmin).catch((err) => {
    console.error('admin-dashboard revalidate failed', err);
  });
}

router.use(authenticate, authorize(['ADMIN', 'PROCUREMENT_OFFICER']));

/**
 * Lighter KPI + charts data (no bid lookups / tender quotation table).
 * Used first by the admin UI so the page becomes interactive before heavier chart queries finish.
 */
router.get('/admin-dashboard-quick', async (req: AuthRequest, res) => {
  const routeMark = perfLabel('GET /api/v1/reports/admin-dashboard-quick');
  console.time(routeMark);
  try {
    const role = req.user?.role;
    const isAdmin = role === 'ADMIN';
    const bypassCache =
      req.query.refresh === '1' ||
      req.query.refresh === 'true' ||
      req.query.nocache === '1';
    if (!bypassCache) {
      const cached = getCachedAdminDashboardQuick(role);
      if (cached) {
        res.setHeader('X-Admin-Dashboard-Cache', 'hit-quick');
        return res.json(cached);
      }
    }

    const parallelMark = perfLabel('admin-dashboard-quick:db');
    console.time(parallelMark);
    const [summary, tendersPerMonth, paymentSummary] = await Promise.all([
      getSummaryPayload(),
      getTendersPerMonthData(),
      isAdmin ? getPaymentSummaryData() : Promise.resolve(null),
    ]);
    console.timeEnd(parallelMark);

    const body = {
      success: true,
      summary,
      tendersPerMonth,
      paymentSummary,
    };
    setCachedAdminDashboardQuick(role, body);
    setCachedReportSummaryOnly({ success: true, summary });
    setCachedTendersMonthOnly({ success: true, tendersPerMonth });
    if (isAdmin && paymentSummary != null) {
      setCachedPaymentSummaryOnly({ success: true, paymentSummary });
    }
    res.setHeader('X-Admin-Dashboard-Cache', 'miss-quick');
    return res.json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      message: 'Error loading admin dashboard (quick).',
      success: false,
      error: error.message,
    });
  } finally {
    console.timeEnd(routeMark);
  }
});

/** Single round-trip for admin overview: one auth + parallel DB work (fixes slow 6× parallel client requests). */
router.get('/admin-dashboard', async (req: AuthRequest, res) => {
  const routeMark = perfLabel('GET /api/v1/reports/admin-dashboard');
  console.time(routeMark);
  try {
    const role = req.user?.role;
    const isAdmin = role === 'ADMIN';
    const bypassCache =
      req.query.refresh === '1' ||
      req.query.refresh === 'true' ||
      req.query.nocache === '1';
    if (!bypassCache) {
      const cached = getCachedAdminDashboard(role);
      if (cached) {
        res.setHeader('X-Admin-Dashboard-Cache', 'hit');
        return res.json(cached);
      }
      const stale = getStaleAdminDashboardPayload(role);
      if (stale) {
        res.setHeader('X-Admin-Dashboard-Cache', 'stale');
        scheduleAdminDashboardRevalidate(role, isAdmin);
        return res.json(stale);
      }
    }

    const parallelMark = perfLabel('admin-dashboard:parallel-db');
    console.time(parallelMark);
    const body = await getOrComputeAdminDashboard(role, isAdmin);
    console.timeEnd(parallelMark);
    res.setHeader(
      'X-Admin-Dashboard-Cache',
      bypassCache ? 'miss-bypass' : 'miss',
    );
    return res.json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      message: 'Error loading admin dashboard data.',
      success: false,
      error: error.message,
    });
  } finally {
    console.timeEnd(routeMark);
  }
});

async function sendSummary(req: AuthRequest, res: Response) {
  try {
    if (!reportsBypassCache(req)) {
      const hit = getCachedReportSummaryOnly();
      if (hit) {
        res.setHeader('X-Report-Fragment-Cache', 'hit-summary');
        return res.status(200).json(hit);
      }
    }
    const summary = await getSummaryPayload();
    const body = { success: true, summary };
    setCachedReportSummaryOnly(body);
    res.setHeader('X-Report-Fragment-Cache', 'miss-summary');
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      message: 'Error fetching summary report.',
      success: false,
      error: error.message,
    });
  }
}

router.get('/summary', (req, res) => sendSummary(req as AuthRequest, res));
router.get('/overview', (req, res) => sendSummary(req as AuthRequest, res));

router.get('/payment-summary', async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      res.setHeader('X-Report-Fragment-Cache', 'skip-non-admin');
      return res.json({ success: true, paymentSummary: null });
    }
    if (!reportsBypassCache(req)) {
      const hit = getCachedPaymentSummaryOnly();
      if (hit) {
        res.setHeader('X-Report-Fragment-Cache', 'hit-payment');
        return res.json(hit);
      }
    }
    const paymentSummary = await getPaymentSummaryData();
    const body = { success: true, paymentSummary };
    setCachedPaymentSummaryOnly(body);
    res.setHeader('X-Report-Fragment-Cache', 'miss-payment');
    return res.json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      message: 'Error fetching payment summary.',
      success: false,
      error: error.message,
    });
  }
});

router.get('/tenders-per-month', async (req: AuthRequest, res) => {
  try {
    if (!reportsBypassCache(req)) {
      const hit = getCachedTendersMonthOnly();
      if (hit) {
        res.setHeader('X-Report-Fragment-Cache', 'hit-month');
        return res.status(200).json(hit);
      }
    }
    const data = await getTendersPerMonthData();
    const body = { success: true, tendersPerMonth: data };
    setCachedTendersMonthOnly(body);
    res.setHeader('X-Report-Fragment-Cache', 'miss-month');
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      message: 'Error fetching tenders per month.',
      success: false,
      error: error.message,
    });
  }
});

router.get('/vendor-participation', async (req: AuthRequest, res) => {
  try {
    const parsedLimit = parseInt(String(req.query.limit || '10'), 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(50, Math.max(1, parsedLimit))
      : 10;
    const limitKey = String(limit);
    if (!reportsBypassCache(req)) {
      const hit = getCachedVendorParticipationOnly(limitKey);
      if (hit) {
        res.setHeader('X-Report-Fragment-Cache', 'hit-vendor-part');
        return res.status(200).json(hit);
      }
    }
    const vendors = await getVendorParticipationData(limit);
    const body = { success: true, vendors };
    setCachedVendorParticipationOnly(limitKey, body);
    res.setHeader('X-Report-Fragment-Cache', 'miss-vendor-part');
    return res.status(200).json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      message: 'Error fetching vendor participation.',
      success: false,
      error: error.message,
    });
  }
});

router.get('/bid-status', async (req: AuthRequest, res) => {
  try {
    if (!reportsBypassCache(req)) {
      const hit = getCachedBidStatusOnly();
      if (hit) {
        res.setHeader('X-Report-Fragment-Cache', 'hit-bid-status');
        return res.json(hit);
      }
    }
    const counts = await getBidStatusRecord();
    const body = { success: true, bidStatus: counts };
    setCachedBidStatusOnly(body);
    res.setHeader('X-Report-Fragment-Cache', 'miss-bid-status');
    return res.json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      message: 'Error fetching bid status distribution',
      success: false,
      error: error.message,
    });
  }
});

router.get('/tender-quotations', async (req: AuthRequest, res) => {
  try {
    if (!reportsBypassCache(req)) {
      const hit = getCachedTenderQuotationsOnly();
      if (hit) {
        res.setHeader('X-Report-Fragment-Cache', 'hit-tender-quot');
        return res.json(hit);
      }
    }
    const raw = await getTenderQuotationsData();
    const body = { success: true, tenders: raw };
    setCachedTenderQuotationsOnly(body);
    res.setHeader('X-Report-Fragment-Cache', 'miss-tender-quot');
    return res.json(body);
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({
      message: 'Error fetching tender quotation overview',
      success: false,
      error: error.message,
    });
  }
});

export default router;
