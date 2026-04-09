import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import axios from "axios";
import { DASHBOARD_API_END_POINT } from "@/utils/constant";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import { useNotificationSummary } from "@/context/NotificationSummaryContext";
import {
  Package,
  FileText,
  Quote,
  CheckCircle,
  Gavel,
  ClipboardList,
  Users,
  TrendingUp,
  Building2,
  Truck,
  AlertTriangle,
  Banknote,
  ClipboardCheck,
  CalendarClock,
  Scale,
  Award,
} from "lucide-react";

const MotionLink = motion(Link);

const procurementSectionVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const widgetGridVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.08 },
  },
};

const widgetCardVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 420, damping: 32 },
  },
};

export const AdminDashboard = () => {
  const { user } = useSelector((store) => store.auth);

  const stats = [
    {
      title: "Total Vendors",
      value: "—",
      icon: Users,
      accent: "border-l-teal-500",
    },
    {
      title: "Active Tenders",
      value: "—",
      icon: Gavel,
      accent: "border-l-sky-500",
    },
    {
      title: "Total Bids",
      value: "—",
      icon: ClipboardList,
      accent: "border-l-emerald-500",
    },
  ];

  const modules = [
    {
      name: "Users",
      icon: Users,
      link: "/admin/users",
    },
    {
      name: "Vendor Approvals",
      icon: Package,
      link: "/admin",
    },
    {
      name: "Vendor directory",
      icon: Building2,
      link: "/vendors",
    },
    {
      name: "Tenders",
      icon: Gavel,
      link: "/tenders",
    },
    {
      name: "Bids",
      icon: ClipboardList,
      link: "/bids-monitor",
    },
  ];

  const recentActivities = [
    {
      id: 1,
      action: "New vendor registered",
      time: "2 hours ago",
      type: "info",
    },
    {
      id: 2,
      action: "Purchase order approved",
      time: "4 hours ago",
      type: "success",
    },
    {
      id: 3,
      action: "New bid submitted on Tender",
      time: "6 hours ago",
      type: "info",
    },
    {
      id: 4,
      action: "New delivery marked in transit",
      time: "1 day ago",
      type: "success",
    },
  ];

  return (
    <div className="w-full flex-1 bg-gradient-to-b from-slate-50 via-white to-sky-50/40 py-6 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-10">
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/70 px-5 py-6 text-slate-900 shadow-sm shadow-indigo-100/40 sm:px-6 sm:py-7">
          <div
            className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-sky-200/30 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-8 left-1/3 h-24 w-40 rounded-full bg-teal-100/40 blur-2xl"
            aria-hidden
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700/80">
              Admin
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-base text-slate-600">
              Welcome back, {user?.name || user?.fullname}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`rounded-2xl border border-sky-100/90 border-l-4 bg-gradient-to-br from-white via-white to-sky-50/30 p-4 shadow-sm shadow-slate-200/50 transition-shadow duration-300 hover:shadow-md sm:p-5 ${stat.accent}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-500 sm:text-sm">
                    {stat.title}
                  </p>
                  <p className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl md:text-3xl">
                    {stat.value}
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-sky-50 text-teal-700/80 ring-1 ring-teal-100/60 sm:h-12 sm:w-12">
                  <stat.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-md shadow-slate-200/40 backdrop-blur-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="h-1 w-9 rounded-full bg-gradient-to-r from-teal-400 to-sky-500" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Procurement modules
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {modules.map((module, index) => (
                  <Link
                    key={index}
                    to={module.link}
                    className="group flex items-center gap-4 rounded-xl border border-sky-100/90 bg-gradient-to-br from-white to-sky-50/20 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200/70 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-sky-50 ring-1 ring-teal-100/70 transition group-hover:from-teal-100/80 group-hover:to-sky-100/50">
                      <module.icon className="h-5 w-5 text-teal-700 transition group-hover:text-teal-800" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-800 transition group-hover:text-slate-900">
                        {module.name}
                      </h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-emerald-100/80 bg-gradient-to-b from-white to-emerald-50/25 p-5 shadow-md shadow-emerald-100/20 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="h-1 w-9 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Recent activity
                </h2>
              </div>
              <div className="divide-y divide-slate-100/90">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${activity.type === "success" ? "bg-emerald-400" : "bg-sky-400"}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700">{activity.action}</p>
                      <p className="text-xs text-slate-400">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const StaffDashboard = () => {
  const { user } = useSelector((store) => store.auth);
  const { staffWorkspace } = useNotificationSummary();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [activeTenders, setActiveTenders] = React.useState(0);
  const [activeOrders, setActiveOrders] = React.useState(0);
  const [delayedDeliveries, setDelayedDeliveries] = React.useState(0);
  const [onTimeRate, setOnTimeRate] = React.useState(0);
  const [pendingApprovals, setPendingApprovals] = React.useState(0);
  const [deliveriesDueToday, setDeliveriesDueToday] = React.useState(0);
  const [monthlySpendNpr, setMonthlySpendNpr] = React.useState(0);
  const [monthlyBudgetNpr, setMonthlyBudgetNpr] = React.useState(null);
  const [monthlyBudgetConfigured, setMonthlyBudgetConfigured] =
    React.useState(false);
  const [budgetUtilizationPercent, setBudgetUtilizationPercent] =
    React.useState(null);
  const [topVendors, setTopVendors] = React.useState([]);
  const [dashboardAsOf, setDashboardAsOf] = React.useState("");

  const formatNpr = (n) =>
    `NPR ${Number(n || 0).toLocaleString("en-NP", {
      maximumFractionDigits: 2,
    })}`;

  const applyStaffDashboard = React.useCallback((data) => {
    setActiveTenders(data.activeTenders ?? 0);
    setActiveOrders(data.activeOrders ?? 0);
    setDelayedDeliveries(data.delayedDeliveries ?? 0);
    setOnTimeRate(data.onTimeRate ?? 0);
    setPendingApprovals(data.pendingApprovals ?? 0);
    setDeliveriesDueToday(data.deliveriesDueToday ?? 0);
    setMonthlySpendNpr(Number(data.monthlySpendNpr ?? 0));
    const bud = data.monthlyBudgetNpr;
    setMonthlyBudgetNpr(
      bud === undefined || bud === null ? null : Number(bud),
    );
    setMonthlyBudgetConfigured(Boolean(data.monthlyBudgetConfigured));
    const util = data.budgetUtilizationPercent;
    setBudgetUtilizationPercent(
      util === undefined || util === null ? null : Number(util),
    );
    setTopVendors(Array.isArray(data.topVendors) ? data.topVendors : []);
    setDashboardAsOf(
      typeof data.dashboardAsOf === "string" ? data.dashboardAsOf : "",
    );
  }, []);

  const silentRefreshStaffDashboard = React.useCallback(async () => {
    try {
      const headers = getAuthHeaderFromStorage();
      const { data } = await axios.get(`${DASHBOARD_API_END_POINT}/summary`, {
        withCredentials: true,
        headers,
        params: { refresh: "1" },
      });
      if (data?.success && data.kind === "staff") {
        applyStaffDashboard(data);
      }
    } catch {
      /* keep last good snapshot */
    }
  }, [applyStaffDashboard]);

  React.useEffect(() => {
    const id = setInterval(() => {
      silentRefreshStaffDashboard();
    }, 45_000);
    return () => clearInterval(id);
  }, [silentRefreshStaffDashboard]);

  React.useEffect(() => {
    const d = staffWorkspace?.dashboard;
    if (d?.success && d.kind === "staff") {
      applyStaffDashboard(d);
      setError("");
      setLoading(false);
      return undefined;
    }
    if (!staffWorkspace?.ready) {
      setLoading(true);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const headers = getAuthHeaderFromStorage();
        const { data } = await axios.get(`${DASHBOARD_API_END_POINT}/summary`, {
          withCredentials: true,
          headers,
        });
        if (cancelled) return;
        if (!data?.success || data.kind !== "staff") {
          throw new Error(data?.message || "Unexpected dashboard response");
        }
        applyStaffDashboard(data);
      } catch (e) {
        if (!cancelled) {
          setError(
            e?.response?.data?.message ||
              e?.message ||
              "Could not load dashboard data. Please refresh.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Narrow deps: avoids extra /dashboard/summary calls when only loading flag flips on poll.
  }, [
    staffWorkspace?.ready,
    staffWorkspace?.dashboard,
    staffWorkspace?.error,
    applyStaffDashboard,
  ]);

  const stats = [
    {
      title: "Active Tenders",
      value: String(activeTenders),
      icon: Gavel,
      accent: "border-l-teal-500",
    },
    {
      title: "Active Orders",
      value: String(activeOrders),
      icon: ClipboardList,
      accent: "border-l-sky-500",
    },
    {
      title: "Delayed Deliveries",
      value: String(delayedDeliveries),
      icon: AlertTriangle,
      accent: "border-l-rose-500",
    },
    {
      title: "On-time Deliveries",
      value: `${onTimeRate}%`,
      icon: Truck,
      accent: "border-l-emerald-500",
    },
  ];

  const modules = [
    {
      name: "Purchase Requests",
      icon: FileText,
      link: "/purchase-requests",
    },
    {
      name: "Vendors",
      icon: Building2,
      link: "/vendors",
    },
    {
      name: "Approvals",
      icon: CheckCircle,
      link: "/approvals",
    },
    {
      name: "Tenders",
      icon: Gavel,
      link: "/tenders",
    },
    {
      name: "Bids Monitor",
      icon: ClipboardList,
      link: "/bids-monitor",
    },
    {
      name: "Payments",
      icon: Banknote,
      link: "/procurement/payments",
    },
    {
      name: "Deliveries",
      icon: Truck,
      link: "/deliveries",
    },
  ];

  return (
    <div className="w-full flex-1 bg-gradient-to-b from-slate-50 via-white to-sky-50/40 py-5 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-6 px-4">
        <div className="relative overflow-hidden rounded-2xl border border-sky-200/60 bg-gradient-to-br from-sky-100/80 via-white to-teal-50/70 px-5 py-6 text-slate-900 shadow-sm shadow-sky-200/30 sm:px-6">
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-teal-200/25 blur-2xl"
            aria-hidden
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700/85">
              Staff
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              Staff Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-700 sm:text-base">
              Welcome back, {user?.name || user?.fullname}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`overflow-hidden rounded-2xl border border-sky-100/90 border-l-4 bg-gradient-to-br from-white via-white to-sky-50/25 p-4 shadow-sm shadow-slate-200/50 transition-shadow duration-300 hover:shadow-md sm:p-5 ${stat.accent}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-500 sm:text-sm">
                    {stat.title}
                  </p>
                  <p className="break-words text-lg font-bold leading-tight text-slate-900 sm:text-2xl md:text-3xl">
                    {loading ? "…" : stat.value}
                  </p>
                </div>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 sm:h-11 sm:w-11 ${
                    stat.accent.includes("violet")
                      ? "bg-gradient-to-br from-violet-50 to-sky-50 text-violet-700/80 ring-violet-100/60"
                      : "bg-gradient-to-br from-teal-50 to-sky-50 text-teal-700/75 ring-teal-100/60"
                  }`}
                >
                  <stat.icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <motion.section
          className="rounded-2xl border border-teal-100/90 bg-white/95 p-5 shadow-md ring-1 ring-slate-900/[0.03] sm:p-6"
          variants={procurementSectionVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <motion.span
                  className="inline-flex items-center rounded-full bg-teal-600/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-800 ring-1 ring-teal-600/20"
                  animate={{
                    opacity: [0.72, 1, 0.72],
                    boxShadow: [
                      "0 0 0 0 rgba(13,148,136,0)",
                      "0 0 0 4px rgba(13,148,136,0.12)",
                      "0 0 0 0 rgba(13,148,136,0)",
                    ],
                  }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  Live
                </motion.span>
              </div>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-[#0b1f4d]">
                Procurement overview
              </h2>
            </div>
            {!loading && dashboardAsOf ? (
              <motion.p
                key={dashboardAsOf}
                className="text-xs text-slate-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35 }}
              >
                Snapshot:{" "}
                {new Date(dashboardAsOf).toLocaleString("en-NP", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </motion.p>
            ) : null}
          </div>

          <motion.div
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
            variants={widgetGridVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={widgetCardVariants} className="h-full">
              <MotionLink
                to="/approvals"
                className="group flex h-full gap-4 rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-sky-50/30 p-4 shadow-sm transition-colors hover:border-teal-200"
                whileHover={{
                  y: -4,
                  boxShadow: "0 12px 28px -8px rgba(15, 23, 42, 0.12)",
                }}
                whileTap={{ scale: 0.992 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              >
                <motion.div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 ring-1 ring-teal-100"
                  whileHover={{ rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 0.45 }}
                >
                  <ClipboardCheck
                    className="h-6 w-6 text-teal-700"
                    strokeWidth={2}
                  />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pending approvals
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                    {loading ? "…" : pendingApprovals}
                  </p>
                  <p className="mt-1 text-xs font-medium text-teal-800 group-hover:underline">
                    Open approvals →
                  </p>
                </div>
              </MotionLink>
            </motion.div>

            <motion.div variants={widgetCardVariants} className="h-full">
              <MotionLink
                to="/deliveries"
                className="group flex h-full gap-4 rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-sky-50/30 p-4 shadow-sm transition-colors hover:border-teal-200"
                whileHover={{
                  y: -4,
                  boxShadow: "0 12px 28px -8px rgba(15, 23, 42, 0.12)",
                }}
                whileTap={{ scale: 0.992 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              >
                <motion.div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 ring-1 ring-sky-100"
                  whileHover={{ rotate: [0, 6, -6, 0] }}
                  transition={{ duration: 0.45 }}
                >
                  <CalendarClock
                    className="h-6 w-6 text-sky-700"
                    strokeWidth={2}
                  />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Due today
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                    {loading ? "…" : deliveriesDueToday}
                  </p>
                  <p className="mt-1 text-xs font-medium text-teal-800 group-hover:underline">
                    View deliveries →
                  </p>
                </div>
              </MotionLink>
            </motion.div>

            <motion.div
              variants={widgetCardVariants}
              className="flex gap-4 rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-emerald-50/20 p-4 shadow-sm lg:col-span-1"
              whileHover={{
                y: -3,
                boxShadow: "0 10px 26px -10px rgba(5, 150, 105, 0.18)",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
                <Scale className="h-6 w-6 text-emerald-700" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  This month · spend vs budget
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {loading ? "…" : formatNpr(monthlySpendNpr)}
                  {!loading && monthlyBudgetConfigured && monthlyBudgetNpr != null ? (
                    <span className="font-normal text-slate-500">
                      {" "}
                      / {formatNpr(monthlyBudgetNpr)}
                    </span>
                  ) : null}
                </p>
                {!loading && monthlyBudgetConfigured && budgetUtilizationPercent != null ? (
                  <>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <motion.div
                        key={`bar-${budgetUtilizationPercent}-${monthlySpendNpr}`}
                        className={`h-full rounded-full ${
                          budgetUtilizationPercent > 100
                            ? "bg-rose-500"
                            : budgetUtilizationPercent > 90
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }`}
                        initial={{ width: 0, opacity: 0.6 }}
                        animate={{
                          width: `${Math.min(100, Math.max(0, budgetUtilizationPercent))}%`,
                          opacity: 1,
                        }}
                        transition={{
                          width: {
                            duration: 0.85,
                            ease: [0.22, 1, 0.36, 1],
                          },
                          opacity: { duration: 0.35 },
                        }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {budgetUtilizationPercent}% of monthly budget
                      {budgetUtilizationPercent > 100
                        ? " (over budget)"
                        : ""}
                    </p>
                  </>
                ) : null}
              </div>
            </motion.div>

            <motion.div
              variants={widgetCardVariants}
              className="flex gap-4 rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-amber-50/20 p-4 shadow-sm lg:col-span-1"
              whileHover={{
                y: -3,
                boxShadow: "0 10px 26px -10px rgba(217, 119, 6, 0.15)",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-100">
                <Award className="h-6 w-6 text-amber-700" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Top vendors
                </p>
                {loading ? (
                  <p className="mt-2 text-sm text-slate-500">…</p>
                ) : topVendors.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">—</p>
                ) : (
                  <ol className="mt-2 space-y-2">
                    {topVendors.map((v, i) => (
                      <motion.li
                        key={v.vendorId || i}
                        className="text-sm"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.35 + i * 0.06,
                          type: "spring",
                          stiffness: 380,
                          damping: 28,
                        }}
                      >
                        <Link
                          to={`/vendors/${v.vendorId}`}
                          className="font-medium text-[#0b1f4d] hover:underline"
                        >
                          {i + 1}. {v.vendorName}
                        </Link>
                        <span className="text-slate-600">
                          {" "}
                          · {v.completedPaymentCount} payment
                          {v.completedPaymentCount === 1 ? "" : "s"},{" "}
                          {formatNpr(v.totalAmountNpr)}
                        </span>
                      </motion.li>
                    ))}
                  </ol>
                )}
                {!loading && topVendors.length > 0 ? (
                  <Link
                    to="/vendors"
                    className="mt-3 inline-block text-xs font-semibold text-amber-900/90 underline-offset-2 hover:underline"
                  >
                    View all vendors →
                  </Link>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        </motion.section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-sky-100/80 bg-white/90 p-5 shadow-md shadow-slate-200/40 backdrop-blur-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="h-1 w-9 rounded-full bg-gradient-to-r from-teal-400 to-sky-500" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Quick actions
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {modules.map((module, index) => (
                  <Link
                    key={index}
                    to={module.link}
                    className="group flex min-w-0 flex-col items-center gap-2 rounded-xl border border-sky-100/90 bg-gradient-to-b from-white to-sky-50/20 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200/80 hover:shadow-md"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-sky-50 ring-1 ring-teal-100/70 transition group-hover:from-teal-100/70 group-hover:to-sky-100/40">
                      <module.icon className="h-5 w-5 text-teal-700 transition group-hover:text-teal-800" />
                    </div>
                    <span className="break-words text-center text-sm font-medium text-slate-800 transition group-hover:text-slate-900">
                      {module.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-2xl border border-violet-100/90 bg-gradient-to-b from-white to-violet-50/15 p-5 shadow-md sm:p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="h-1 w-9 rounded-full bg-gradient-to-r from-violet-400 to-teal-400" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Vendors
                </h2>
              </div>
              <Link
                to="/vendors"
                className="mt-4 inline-block text-sm font-semibold text-violet-900 underline-offset-2 hover:text-violet-950 hover:underline"
              >
                Open vendor directory →
              </Link>
            </div>
            <div className="rounded-2xl border border-sky-100/80 bg-gradient-to-b from-white to-sky-50/20 p-5 shadow-md sm:p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="h-1 w-9 rounded-full bg-gradient-to-r from-sky-400 to-teal-400" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Deliveries
                </h2>
              </div>
              <Link
                to="/deliveries"
                className="mt-4 inline-block text-sm font-semibold text-teal-800 underline-offset-2 hover:text-teal-900 hover:underline"
              >
                Open deliveries →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VendorDashboard = () => {
  const { user } = useSelector((store) => store.auth);
  const [loading, setLoading] = React.useState(true);
  const [openTenders, setOpenTenders] = React.useState(0);
  const [myBidsCount, setMyBidsCount] = React.useState(0);
  const [totalRevenue, setTotalRevenue] = React.useState(0);
  const [recentBids, setRecentBids] = React.useState([]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency: "NPR",
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const headers = getAuthHeaderFromStorage();
        const { data } = await axios.get(`${DASHBOARD_API_END_POINT}/summary`, {
          withCredentials: true,
          headers,
        });
        if (data?.success && data.kind === "vendor") {
          setOpenTenders(data.openTenders ?? 0);
          setMyBidsCount(data.myBidsCount ?? 0);
          setTotalRevenue(Number(data.totalRevenue ?? 0));
          setRecentBids(data.recentBids || []);
        }
      } catch {
        // silently handle
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = [
    {
      title: "Tender quotations",
      value: String(myBidsCount),
      icon: Quote,
      accent: "border-l-teal-500",
    },
    {
      title: "Open Tenders",
      value: String(openTenders),
      icon: Gavel,
      accent: "border-l-sky-500",
    },
    {
      title: "Total Revenue",
      value: formatCurrency(totalRevenue),
      icon: TrendingUp,
      accent: "border-l-emerald-500",
    },
  ];

  const modules = [
    {
      name: "Profile",
      icon: Building2,
      link: "/profile",
    },
    {
      name: "Tenders",
      icon: Gavel,
      link: "/tenders",
    },
    {
      name: "Tender quotations",
      icon: ClipboardList,
      link: "/my-bids",
    },
  ];

  return (
    <div className="w-full flex-1 bg-gradient-to-b from-slate-50 via-white to-teal-50/35 py-5 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-6 px-4">
        <div className="relative overflow-hidden rounded-2xl border border-teal-200/50 bg-gradient-to-br from-teal-50/90 via-white to-cyan-50/70 px-5 py-6 text-slate-900 shadow-sm shadow-teal-100/40 sm:px-6">
          <div
            className="pointer-events-none absolute -left-6 -bottom-10 h-28 w-36 rounded-full bg-cyan-200/25 blur-2xl"
            aria-hidden
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700/85">
              Vendor
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              Vendor Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-700 sm:text-base">
              Welcome back, {user?.name || user?.fullname}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`overflow-hidden rounded-2xl border border-teal-100/90 border-l-4 bg-gradient-to-br from-white via-white to-teal-50/20 p-4 shadow-sm shadow-slate-200/50 transition-shadow duration-300 hover:shadow-md sm:p-5 ${stat.accent}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-500 sm:text-sm">
                    {stat.title}
                  </p>
                  <p className="break-words text-lg font-bold leading-tight text-slate-900 sm:text-2xl md:text-3xl">
                    {loading ? "…" : stat.value}
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 text-teal-700/80 ring-1 ring-teal-100/60 sm:h-11 sm:w-11">
                  <stat.icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-teal-100/80 bg-white/90 p-5 shadow-md shadow-slate-200/40 backdrop-blur-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="h-1 w-9 rounded-full bg-gradient-to-r from-teal-400 to-cyan-500" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Quick actions
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {modules.map((module, index) => (
                  <Link
                    key={index}
                    to={module.link}
                    className="group flex min-w-0 flex-col items-center gap-2 rounded-xl border border-teal-100/80 bg-gradient-to-b from-white to-teal-50/15 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200/90 hover:shadow-md sm:p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 ring-1 ring-teal-100/70 transition group-hover:from-teal-100/70 sm:h-11 sm:w-11">
                      <module.icon className="h-5 w-5 text-teal-700 transition group-hover:text-teal-800" />
                    </div>
                    <span className="break-words text-center text-sm font-medium text-slate-800 transition group-hover:text-slate-900">
                      {module.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-amber-100/80 bg-gradient-to-b from-white to-amber-50/25 p-5 shadow-md shadow-amber-100/20 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="h-1 w-9 rounded-full bg-gradient-to-r from-amber-400 to-orange-400" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Recent tender bids
                </h2>
              </div>
              <div className="space-y-2.5">
                {loading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : recentBids.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No bids submitted yet.
                  </p>
                ) : (
                  recentBids.map((bid) => (
                    <div
                      key={bid._id}
                      className="rounded-xl border border-amber-100/60 bg-white/75 p-3 shadow-sm transition hover:border-amber-200/70"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">
                            {bid.tender?.title || "Tender"}
                          </p>
                          <p className="text-sm text-slate-500">
                            {formatCurrency(bid.totalPrice || bid.amount)} •{" "}
                            {bid.createdAt
                              ? new Date(bid.createdAt).toLocaleDateString(
                                  "en-NP",
                                )
                              : "-"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                            String(bid.status || "")
                              .toLowerCase()
                              .includes("accept")
                              ? "bg-emerald-100/90 text-emerald-800 ring-emerald-200/60"
                              : String(bid.status || "")
                                    .toLowerCase()
                                    .includes("reject")
                                ? "bg-rose-100/90 text-rose-800 ring-rose-200/60"
                                : "bg-amber-100/90 text-amber-900 ring-amber-200/60"
                          }`}
                        >
                          {bid.status || "Submitted"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Link
                to="/my-bids"
                className="mt-4 block text-center text-sm font-semibold text-teal-800 underline-offset-2 hover:text-teal-900 hover:underline"
              >
                View all bids →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardSelector = () => {
  const { user } = useSelector((store) => store.auth);
  switch (user?.role) {
    case "admin":
      return <AdminDashboard />;
    case "staff":
      return <StaffDashboard />;
    case "vendor":
      return <VendorDashboard />;
    default:
      return <AdminDashboard />;
  }
};

export default DashboardSelector;
