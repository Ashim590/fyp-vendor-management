import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationSummary } from "@/context/NotificationSummaryContext";
import { WorkspacePageLayout } from "../layout/WorkspacePageLayout";

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
            <p className="mt-1 text-sm text-slate-600">
              {unreadCount > 0
                ? `${unreadCount} unread — open an item to mark it read.`
                : "You are all caught up."}
            </p>
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
          <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No notifications yet.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => {
              const unread = !n.read;
              const time = formatRelativeTime(n.createdAt);
              return (
                <li key={n._id}>
                  <Link
                    to={n.link || "#"}
                    onClick={() => {
                      if (unread) markAsRead(n._id);
                    }}
                    className={cn(
                      "block rounded-xl px-4 py-3.5 text-left transition-colors",
                      unread
                        ? "border border-teal-200/90 border-l-4 border-l-teal-500 bg-teal-50/95 shadow-sm shadow-teal-900/[0.04] hover:bg-teal-100/85"
                        : "border border-transparent hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p
                        className={cn(
                          "min-w-0 flex-1 leading-snug text-slate-900",
                          unread ? "text-sm font-semibold" : "text-sm font-medium",
                        )}
                      >
                        {n.title}
                      </p>
                      {unread ? (
                        <span className="shrink-0 rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Unread
                        </span>
                      ) : null}
                    </div>
                    {n.body ? (
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{n.body}</p>
                    ) : null}
                    {time ? (
                      <p className="mt-2 text-xs font-medium text-slate-400">{time}</p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </WorkspacePageLayout>
  );
};

export default NotificationsPage;
