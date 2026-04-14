import React, { useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotificationSummary } from "@/context/NotificationSummaryContext";
import { WorkspacePageLayout } from "../layout/WorkspacePageLayout";
import { NotificationListRow } from "./NotificationListRow";
import { EmptyState } from "../ui/empty-state";
import { LoadingState } from "../ui/loading-state";

function formatRelativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 45) return "Just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

const NotificationsPage = () => {
  const {
    notifications,
    unreadCount,
    loading,
    refresh,
    markAsRead,
    markAllRead,
  } = useNotificationSummary();
  const [daysFilter, setDaysFilter] = React.useState("15");

  useEffect(() => {
    refresh({ silent: true });
  }, [refresh]);

  const filteredNotifications = React.useMemo(() => {
    if (daysFilter === "all") return notifications;
    const days = Number(daysFilter);
    if (!Number.isFinite(days) || days <= 0) return notifications;
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    return notifications.filter((n) => {
      const ts = new Date(n?.createdAt || "").getTime();
      return Number.isFinite(ts) && ts >= cutoffMs;
    });
  }, [notifications, daysFilter]);

  return (
    <WorkspacePageLayout className="max-w-3xl pb-10">
      <div className="mb-8 flex flex-col gap-4 border-b border-slate-200/70 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef5ff]">
            <Bell className="h-5 w-5 text-[#0f9f90]" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0b1f4d]">
              Notifications
            </h1>
            {unreadCount > 0 ? (
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">
                  {unreadCount} unread
                </span>
              </p>
            ) : null}
          </div>
        </div>
        {unreadCount > 0 ? (
          <div className="flex items-center gap-2 self-start">
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
              aria-label="Filter notifications by date range"
            >
              <option value="7">Last 7 days</option>
              <option value="15">Last 15 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <button
              type="button"
              onClick={markAllRead}
              className="shrink-0 text-sm font-semibold text-[#0b1f4d] hover:underline"
            >
              Mark all read
            </button>
          </div>
        ) : (
          <div className="self-start">
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
              aria-label="Filter notifications by date range"
            >
              <option value="7">Last 7 days</option>
              <option value="15">Last 15 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
        {loading ? (
          <LoadingState variant="page" className="py-8 sm:py-10" />
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications in this range"
            description="Try a wider date range to view older alerts."
            action={{ label: "Go to dashboard", to: "/" }}
          />
        ) : (
          <ul className="space-y-2">
            {filteredNotifications.map((n) => (
              <NotificationListRow
                key={n._id}
                n={n}
                variant="page"
                relativeTime={formatRelativeTime(n.createdAt)}
                onMarkRead={markAsRead}
              />
            ))}
          </ul>
        )}
      </div>
    </WorkspacePageLayout>
  );
};

export default NotificationsPage;
