import Tender from '../models/Tender';
import PurchaseOrder from '../models/PurchaseOrder';
import Delivery from '../models/Delivery';
import {
  getCachedStaffSummary,
  setCachedStaffSummary,
} from './staffDashboardCache';

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
};

/**
 * Procurement/staff home only surfaces ops metrics (tenders, POs, deliveries).
 * Payment rollups were unused by the app and added a heavy $facet on every
 * `/session/staff-home` and `/dashboard/summary` — omit until a UI needs them.
 */
/** One compute at a time when cache is cold (avoids stampede on /session/staff-home). */
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
  const [activeTenders, activeOrders, delayedDeliveries, onTimeAgg] =
    await Promise.all([
    Tender.countDocuments({ status: { $in: ['PUBLISHED', 'DRAFT'] } }),
    PurchaseOrder.countDocuments({
      status: { $in: ['draft', 'pending', 'approved', 'issued', 'partial'] },
    }),
    Delivery.countDocuments({ delayReason: { $exists: true, $nin: [null, ''] } }),
    /** Bounded window keeps aggregate fast as the delivery collection grows. */
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
  ]);

  const o = onTimeAgg[0];
  const onTimeRate =
    o && o.total > 0 ? Math.round((Number(o.onTime) / Number(o.total)) * 100) : 0;

  return {
    success: true,
    kind: 'staff',
    activeTenders,
    pendingPayments: 0,
    totalSpend: 0,
    completedPaymentsCount: 0,
    recentCompletedPayments: [],
    recentPayments: [],
    activeOrders,
    delayedDeliveries,
    onTimeRate,
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
