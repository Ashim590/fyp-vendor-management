import React, { Suspense } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import AdminVendorsPanel from "./AdminVendorsPanel";
import { REPORT_API_END_POINT } from "@/utils/constant";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";
import { motion } from "framer-motion";
import { LoadingSkeleton } from "../shared/LoadingSkeleton";
import { Bell, FileText, Users, Activity } from "lucide-react";

const AdminDashboardCharts = React.lazy(() => import("./AdminDashboardCharts"));

const AdminDashboard = () => {
  const { user } = useSelector((store) => store.auth);
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = React.useState(null);
  const [tendersPerMonth, setTendersPerMonth] = React.useState([]);
  const [vendorParticipation, setVendorParticipation] = React.useState([]);
  const [bidStatus, setBidStatus] = React.useState({});
  const [tenderQuotationRows, setTenderQuotationRows] = React.useState([]);
  const [paymentSummary, setPaymentSummary] = React.useState(null);
  /** Single round-trip: /admin-dashboard (fills server cache once; avoids quick+full duplicate DB work). */
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [tab, setTab] = React.useState("overview");
  /** Keep vendor panel mounted after first visit so tab switches do not refetch. */
  const [vendorsTabEverOpened, setVendorsTabEverOpened] = React.useState(false);

  React.useEffect(() => {
    if (tab === "vendors") setVendorsTabEverOpened(true);
  }, [tab]);

  React.useEffect(() => {
    const queryTab = searchParams.get("tab");
    if (queryTab === "vendors" || queryTab === "overview") {
      setTab(queryTab);
    } else {
      setTab("overview");
    }
  }, [searchParams]);

  const setTabAndUrl = (nextTab) => {
    setTab(nextTab);
    setSearchParams({ tab: nextTab });
  };

  React.useEffect(() => {
    const applyMonthlyLabels = (rows) =>
      (rows || []).map((item) => {
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const label = `${monthNames[(item.month || 1) - 1]} ${String(
          item.year,
        ).slice(-2)}`;
        return { ...item, label };
      });

    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        const cfg = {
          withCredentials: true,
          headers: getAuthHeaderFromStorage(),
        };
        const { data } = await axios.get(
          `${REPORT_API_END_POINT}/admin-dashboard`,
          cfg,
        );
        if (!data?.success) {
          throw new Error(data?.message || "Failed to load admin dashboard");
        }
        setSummary(data.summary || null);
        setTendersPerMonth(applyMonthlyLabels(data.tendersPerMonth));
        setPaymentSummary(
          data.paymentSummary !== undefined ? data.paymentSummary : null,
        );
        setVendorParticipation(data.vendors || []);
        setBidStatus(data.bidStatus || {});
        setTenderQuotationRows(data.tenders || []);
      } catch (err) {
        console.error(err);
        setError(
          err.response?.data?.message ||
            "Failed to load admin analytics. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (!user) return null;

  const metrics = summary || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full flex-1 flex flex-col min-h-0 bg-canvas"
    >
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        <div className="rounded-3xl border border-[#dbe7f7] bg-surface p-4 shadow-[0_12px_36px_rgba(11,31,77,0.08)] sm:p-5 lg:p-6">
          <section className="space-y-6">
        {/* Header */}
        <header className="rounded-2xl bg-surface border border-borderBrand shadow-[0_8px_24px_rgba(11,31,77,0.08)] px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-900">
              Admin Dashboard
            </h1>
            <p className="text-xs md:text-sm text-slate-500">
              System Overview &amp; Analytics • Welcome back,{" "}
              {user.name || user.fullname}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 border border-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5" />
              Live environment
            </span>
          </div>
        </header>

        {/* Tab switcher */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setTabAndUrl("overview")}
            className={`px-3 py-1.5 rounded-full border transition ${
              tab === "overview"
                ? "bg-[#0b1f4d] text-white border-[#0b1f4d] shadow-sm"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setTabAndUrl("vendors")}
            className={`px-3 py-1.5 rounded-full border transition ${
              tab === "vendors"
                ? "bg-[#0b1f4d] text-white border-[#0b1f4d] shadow-sm"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Vendor approvals
            {!loading && Number(metrics.pendingVendors) > 0 ? (
              <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {metrics.pendingVendors}
              </span>
            ) : null}
          </button>
        </div>

        {tab === "overview" && (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            {!loading && Number(metrics.pendingVendors) > 0 && (
              <div
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <p>
                  <span className="font-semibold">
                    {metrics.pendingVendors} vendor registration
                    {Number(metrics.pendingVendors) === 1 ? "" : "s"}
                  </span>{" "}
                  waiting for your approval. New vendors cannot log in until you
                  approve them in the Vendors tab.
                </p>
                <button
                  type="button"
                  onClick={() => setTabAndUrl("vendors")}
                  className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                >
                  Review vendor registrations
                </button>
              </div>
            )}

            {/* Metric row styled like reference */}
            <section className="bg-surface rounded-2xl border border-borderBrand shadow-[0_8px_24px_rgba(11,31,77,0.08)] px-5 py-4 space-y-4">
              <p className="text-xs text-slate-500">
                Some quick facts since your last login:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col items-center text-center gap-1">
                  <div className="h-10 w-10 rounded-full border-2 border-[#5eead4] flex items-center justify-center text-[#14b8a6] mb-1">
                    <Bell className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {metrics.activeTenders ?? "—"} active tenders
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {metrics.totalTenders ?? "—"} total tenders
                  </p>
                </div>
                <div className="flex flex-col items-center text-center gap-1">
                  <div className="h-10 w-10 rounded-full border-2 border-[#8ec5ff] flex items-center justify-center text-[#0b1f4d] mb-1">
                    <FileText className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {metrics.totalBids ?? "—"} bids submitted
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Evaluation workload overview
                  </p>
                </div>
                <div className="flex flex-col items-center text-center gap-1">
                  <div className="h-10 w-10 rounded-full border-2 border-[#c9d9f3] flex items-center justify-center text-[#173f72] mb-1">
                    <Users className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {metrics.totalVendors ?? "—"} vendors
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {metrics.approvedVendors ?? "—"} verified &amp; ready
                  </p>
                </div>
                <div className="flex flex-col items-center text-center gap-1">
                  <div className="h-10 w-10 rounded-full border-2 border-[#5eead4] flex items-center justify-center text-[#14b8a6] mb-1">
                    <Activity className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {metrics.totalUsers ?? "—"} system users
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Admins, officers, and vendors
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-surface rounded-2xl border border-borderBrand shadow-[0_8px_24px_rgba(11,31,77,0.08)] px-5 py-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Tender quotations (monitoring)
                </p>
                <p className="text-[11px] text-slate-500">
                  Read-only snapshot per tender. Procurement officers run
                  evaluation from each tender page.
                </p>
              </div>
              {loading ? (
                <LoadingSkeleton className="h-32 w-full" />
              ) : tenderQuotationRows.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No tenders in the system yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="min-w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-2">Tender</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Quotations</th>
                        <th className="px-3 py-2 text-right">Pending</th>
                        <th className="px-3 py-2 text-right">Accepted</th>
                        <th className="px-3 py-2 text-right">Rejected</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {tenderQuotationRows.map((row) => (
                        <tr
                          key={String(row._id)}
                          className="border-t border-slate-100 hover:bg-slate-50/80"
                        >
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-900">
                              {row.title}
                            </span>
                            <span className="block text-[10px] text-slate-500 font-mono">
                              {row.referenceNumber}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {row.tenderStatus}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {row.totalQuotations}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-amber-800">
                            {row.pending}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-800">
                            {row.accepted}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-red-800">
                            {row.rejected}
                          </td>
                          <td className="px-3 py-2">
                            <Link
                              to={`/tenders/${row._id}`}
                              className="text-[#0b1f4d] hover:underline"
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <Suspense
              fallback={
                <section className="bg-surface rounded-2xl border border-borderBrand shadow-[0_8px_24px_rgba(11,31,77,0.08)] px-5 py-4">
                  <LoadingSkeleton className="h-[280px] w-full" />
                </section>
              }
            >
              <AdminDashboardCharts
                loading={loading}
                tendersPerMonth={tendersPerMonth}
                vendorParticipation={vendorParticipation}
                bidStatus={bidStatus}
              />
            </Suspense>

            <section className="bg-surface rounded-2xl border border-borderBrand shadow-[0_8px_24px_rgba(11,31,77,0.08)] px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                Payment Monitoring
              </h3>
              {!paymentSummary ? (
                <p className="text-xs text-slate-500">
                  No payment data available.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Total records</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {paymentSummary.total}
                    </p>
                  </div>
                  <div className="rounded-lg bg-yellow-50 p-3">
                    <p className="text-yellow-700">Pending</p>
                    <p className="text-lg font-semibold text-yellow-800">
                      {paymentSummary.pending}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-emerald-700">Completed</p>
                    <p className="text-lg font-semibold text-emerald-800">
                      {paymentSummary.completed}
                    </p>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-3">
                    <p className="text-rose-700">Failed</p>
                    <p className="text-lg font-semibold text-rose-800">
                      {paymentSummary.failed}
                    </p>
                  </div>
                  <div className="rounded-lg bg-teal-50 p-3">
                    <p className="text-teal-700">Total amount</p>
                    <p className="text-lg font-semibold text-teal-800">
                      NPR{" "}
                      {Number(paymentSummary.totalAmount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {vendorsTabEverOpened ? (
          <div
            className={tab === "vendors" ? "block" : "hidden"}
            aria-hidden={tab !== "vendors"}
          >
            <AdminVendorsPanel />
          </div>
        ) : null}
          </section>
        </div>
      </main>
    </motion.div>
  );
};

export default AdminDashboard;
