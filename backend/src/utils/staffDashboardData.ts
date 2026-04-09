import Tender from '../models/Tender';
import PurchaseOrder from '../models/PurchaseOrder';
import Delivery from '../models/Delivery';
import Approval from '../models/Approval';
import Payment from '../models/Payment';
import InvoicePayment from '../models/InvoicePayment';
import {
  getCachedStaffSummary,
  setCachedStaffSummary,
} from './staffDashboardCache';

export type StaffTopVendor = {
  vendorId: string;
  vendorName: string;
  completedPaymentCount: number;
  totalAmountNpr: number;
};

/** Same shape as GET /dashboard/summary for staff roles. */
export type StaffDashboardBody = {
  success: true;
  kind: 'staff';
  activeTenders: number;
  pendingPayments: number;
  totalSpend: number;
  completedPaymentsCount: number;
  recentCompletedPayments: Array<Record<string, unknown>>;
  recentPayments: Array<Record<string, unknown>>;
  activeOrders: number;
  delayedDeliveries: number;
  onTimeRate: number;
  /** Approvals awaiting decision */
  pendingApprovals: number;
  /** Deliveries scheduled for today still in vendor/staff handoff (not closed out). */
  deliveriesDueToday: number;
  /** Sum of completed tender payments + paid invoice payments this calendar month (NPR). */
  monthlySpendNpr: number;
  /** Org monthly cap from env; null when unset. */
  monthlyBudgetNpr: number | null;
  monthlyBudgetConfigured: boolean;
  /** 0–100+ when budget set; over 100 means over budget. */
  budgetUtilizationPercent: number | null;
  /** Top vendors by completed tender payment count (last 12 months). */
  topVendors: StaffTopVendor[];
  dashboardAsOf: string;
};

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0);
}

function endOfTodayExclusive(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 0, 0);
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonthExclusive(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}

function parseMonthlyBudgetNpr(): {
  configured: boolean;
  value: number | null;
} {
  const raw = process.env.PROCUREMENT_MONTHLY_BUDGET_NPR;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { configured: false, value: null };
  }
  const n = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) {
    return { configured: false, value: null };
  }
  return { configured: true, value: n };
}

/**
 * Procurement/staff home surfaces ops metrics + live procurement widgets.
 */
let staffDashboardComputeInflight: Promise<StaffDashboardBody> | null = null;

function getOrComputeStaffDashboardBody(): Promise<StaffDashboardBody> {
  if (staffDashboardComputeInflight) return staffDashboardComputeInflight;
  staffDashboardComputeInflight = computeStaffDashboardBody().finally(() => {
    staffDashboardComputeInflight = null;
  });
  return staffDashboardComputeInflight;
}

function onTimeWindowStart(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - 18);
  return d;
}

export async function computeStaffDashboardBody(): Promise<StaffDashboardBody> {
  const since = onTimeWindowStart();
  const som = startOfMonth();
  const eom = endOfMonthExclusive();
  const dayStart = startOfToday();
  const dayEnd = endOfTodayExclusive();
  const topVendorSince = new Date();
  topVendorSince.setMonth(topVendorSince.getMonth() - 12);

  const monthTenderPayAgg = Payment.aggregate([
    { $match: { status: 'Completed' } },
    {
      $addFields: {
        effDate: { $ifNull: ['$paymentDate', '$createdAt'] },
      },
    },
    { $match: { effDate: { $gte: som, $lt: eom } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const monthInvoicePayAgg = InvoicePayment.aggregate([
    { $match: { status: 'PAID' } },
    {
      $addFields: {
        effDate: { $ifNull: ['$verifiedAt', '$createdAt'] },
      },
    },
    { $match: { effDate: { $gte: som, $lt: eom } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const [
    activeTenders,
    activeOrders,
    delayedDeliveries,
    onTimeAgg,
    pendingApprovals,
    deliveriesDueToday,
    pendingPayments,
    monthTenderRows,
    monthInvoiceRows,
    topVendorRows,
  ] = await Promise.all([
    Tender.countDocuments({ status: { $in: ['PUBLISHED', 'DRAFT'] } }),
    PurchaseOrder.countDocuments({
      status: { $in: ['draft', 'pending', 'approved', 'issued', 'partial'] },
    }),
    Delivery.countDocuments({
      delayReason: { $exists: true, $nin: [null, ''] },
    }),
    Delivery.aggregate([
      {
        $match: {
          status: { $in: ['delivered', 'received', 'inspected'] },
          actualDate: { $exists: true, $ne: null, $gte: since },
          expectedDate: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          onTime: {
            $sum: {
              $cond: [{ $lte: ['$actualDate', '$expectedDate'] }, 1, 0],
            },
          },
        },
      },
    ]),
    Approval.countDocuments({ status: 'pending' }),
    Delivery.countDocuments({
      expectedDate: { $gte: dayStart, $lt: dayEnd },
      status: {
        $in: ['pending', 'shipped', 'in_transit', 'delivered'],
      },
    }),
    Payment.countDocuments({ status: 'Pending' }),
    monthTenderPayAgg,
    monthInvoicePayAgg,
    Payment.aggregate([
      { $match: { status: 'Completed' } },
      {
        $addFields: {
          effDate: { $ifNull: ['$paymentDate', '$createdAt'] },
        },
      },
      { $match: { effDate: { $gte: topVendorSince } } },
      {
        $group: {
          _id: '$vendor',
          vendorName: { $first: '$vendorName' },
          completedPaymentCount: { $sum: 1 },
          totalAmountNpr: { $sum: '$amount' },
        },
      },
      { $sort: { completedPaymentCount: -1, totalAmountNpr: -1 } },
      { $limit: 3 },
    ]),
  ]);

  const o = onTimeAgg[0];
  const onTimeRate =
    o && o.total > 0
      ? Math.round((Number(o.onTime) / Number(o.total)) * 100)
      : 0;

  const monthlyTender =
    monthTenderRows[0] && monthTenderRows[0].total != null
      ? Number(monthTenderRows[0].total)
      : 0;
  const monthlyInvoice =
    monthInvoiceRows[0] && monthInvoiceRows[0].total != null
      ? Number(monthInvoiceRows[0].total)
      : 0;
  const monthlySpendNpr = Math.round((monthlyTender + monthlyInvoice) * 100) / 100;

  const { configured: monthlyBudgetConfigured, value: monthlyBudgetNpr } =
    parseMonthlyBudgetNpr();

  let budgetUtilizationPercent: number | null = null;
  if (
    monthlyBudgetConfigured &&
    monthlyBudgetNpr != null &&
    monthlyBudgetNpr > 0
  ) {
    budgetUtilizationPercent = Math.round(
      (monthlySpendNpr / monthlyBudgetNpr) * 1000,
    ) / 10;
  }

  const topVendors: StaffTopVendor[] = (
    topVendorRows as Array<{
      _id: unknown;
      vendorName?: string;
      completedPaymentCount?: number;
      totalAmountNpr?: number;
    }>
  ).map((row) => ({
    vendorId: String(row._id),
    vendorName: String(row.vendorName || 'Vendor'),
    completedPaymentCount: Number(row.completedPaymentCount || 0),
    totalAmountNpr:
      Math.round(Number(row.totalAmountNpr || 0) * 100) / 100,
  }));

  return {
    success: true,
    kind: 'staff',
    activeTenders,
    pendingPayments,
    totalSpend: monthlySpendNpr,
    completedPaymentsCount: 0,
    recentCompletedPayments: [],
    recentPayments: [],
    activeOrders,
    delayedDeliveries,
    onTimeRate,
    pendingApprovals,
    deliveriesDueToday,
    monthlySpendNpr,
    monthlyBudgetNpr,
    monthlyBudgetConfigured,
    budgetUtilizationPercent,
    topVendors,
    dashboardAsOf: new Date().toISOString(),
  };
}

export async function resolveStaffDashboardForApi(
  bypassCache: boolean,
): Promise<{ body: StaffDashboardBody; cacheHit: boolean }> {
  if (!bypassCache) {
    const cached = getCachedStaffSummary();
    if (cached) {
      return { body: cached as StaffDashboardBody, cacheHit: true };
    }
  }
  const body = await getOrComputeStaffDashboardBody();
  setCachedStaffSummary(body);
  return { body, cacheHit: false };
}
