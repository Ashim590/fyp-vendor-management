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

  useEffect(() => {
    refresh({ silent: true });
  }, [refresh]);

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
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Procurement activity alerts stay in your list for traceability — only read status changes.
            </p>
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
          <button
            type="button"
            onClick={markAllRead}
            className="shrink-0 self-start text-sm font-semibold text-[#0b1f4d] hover:underline"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
        {loading ? (
          <LoadingState variant="page" className="py-8 sm:py-10" />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="When tenders, approvals, deliveries, or payments need your attention, alerts will appear here and in the bell menu."
            action={{ label: "Go to dashboard", to: "/" }}
          />
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
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
