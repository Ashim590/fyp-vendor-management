import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { LoadingSkeleton } from "../shared/LoadingSkeleton";

/**
 * Code-split from AdminDashboard so Recharts loads in a separate chunk.
 */
export default function AdminDashboardCharts({
  loading,
  tendersPerMonth,
  vendorParticipation,
  bidStatus,
}) {
  return (
    <section className="bg-surface rounded-2xl border border-borderBrand shadow-[0_8px_24px_rgba(11,31,77,0.08)] px-5 py-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#0b1f4d]">
            Tenders &amp; vendor activity over time
          </p>
          <p className="text-[11px] text-slate-500">
            Use this view during demos to tell the story of how tenders move
            through the system.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-64">
          <p className="text-xs font-medium text-slate-700 mb-2">
            Tenders per month
          </p>
          {loading ? (
            <LoadingSkeleton className="h-full w-full" />
          ) : tendersPerMonth.length === 0 ? (
            <p className="text-xs text-slate-500">No tender data available yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tendersPerMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="h-64">
          <p className="text-xs font-medium text-slate-700 mb-2">
            Top vendor participation
          </p>
          {loading ? (
            <LoadingSkeleton className="h-full w-full" />
          ) : vendorParticipation.length === 0 ? (
            <p className="text-xs text-slate-500">
              No vendor participation data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={vendorParticipation}
                margin={{ left: 20, right: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="totalBids" fill="#12306b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="h-64">
          <p className="text-xs font-medium text-slate-700 mb-2">
            Bid status distribution
          </p>
          {loading ? (
            <LoadingSkeleton className="h-full w-full" />
          ) : Object.keys(bidStatus || {}).length === 0 ? (
            <p className="text-xs text-slate-500">No bid status data yet.</p>
          ) : (
            (() => {
              const data = Object.entries(bidStatus || {}).map(
                ([status, total]) => ({
                  status,
                  total,
                }),
              );
              return (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="status"
                      tick={{ fontSize: 10 }}
                      interval={0}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-3 text-xs">
        <button
          type="button"
          className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#0b1f4d] text-white font-medium shadow-sm hover:bg-[#12306b] transition"
        >
          Review open tenders
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#14b8a6] text-white font-medium shadow-sm hover:bg-[#0f9f90] transition"
        >
          Check new vendor applications
        </button>
        <button
          type="button"
          className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-white text-slate-700 border border-slate-200 font-medium hover:bg-slate-50 transition"
        >
          Go to reports
        </button>
      </div>
    </section>
  );
}
