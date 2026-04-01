import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, X } from "lucide-react";
import { motion } from "framer-motion";
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
    dismissNotification,
  } = useNotificationSummary();

  useEffect(() => {
    refresh({ silent: true });
  }, [refresh]);

  const handleMarkRead = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    markAsRead(id);
  };

  const handleOpenNotification = (id) => {
    if (id != null) markAsRead(id);
  };

  const handleDismiss = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    dismissNotification(id);
  };

  const targetFor = (n) => {
    const raw = String(n?.link || "").trim();
    if (n?.type === "bid_accepted") {
      const bidParam = raw.match(/[?&]openBid=([a-f\d]{24})/i)?.[1];
      return bidParam ? `/my-bids?openBid=${bidParam}` : "/my-bids";
    }
    return raw;
  };

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
              {unreadCount > 0 ? (
                <>
                  <span className="font-semibold text-slate-800">
                    {unreadCount} unread
                  </span>
                  {" — "}
                  Use <span className="font-medium">Mark as read</span> or{" "}
                  <span className="font-medium">Dismiss</span> (×) to remove it.
                  Opening a notification marks it as read automatically.
                </>
              ) : (
                "You are all caught up."
              )}
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
          <p className="py-8 text-center text-sm text-slate-500">
            No notifications yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => {
              const unread = !n.read;
              const time = formatRelativeTime(n.createdAt);
              return (
                <motion.li
                  key={n._id}
                  layout
                  initial={false}
                  animate={{
                    opacity: unread ? 1 : 0.72,
                  }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div
                    className={cn(
                      "flex gap-2 rounded-xl py-1 pl-1 pr-2 transition-colors",
                      unread
                        ? "border border-teal-200/90 border-l-4 border-l-teal-500 bg-teal-50/95 shadow-sm shadow-teal-900/[0.04]"
                        : "border border-transparent bg-slate-50/40",
                    )}
                  >
                    <div className="min-w-0 flex-1 px-3 py-2.5">
                      {targetFor(n) && targetFor(n) !== "#" ? (
                        <Link
                          to={targetFor(n)}
                          onClick={() => handleOpenNotification(n._id)}
                          className="block text-left outline-none ring-[#0b1f4d] focus-visible:rounded-md focus-visible:ring-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p
                              className={cn(
                                "min-w-0 flex-1 leading-snug text-slate-900",
                                unread
                                  ? "text-sm font-semibold"
                                  : "text-sm font-medium",
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
                            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                              {n.body}
                            </p>
                          ) : null}
                          {time ? (
                            <p className="mt-2 text-xs font-medium text-slate-400">
                              {time}
                            </p>
                          ) : null}
                        </Link>
                      ) : (
                        <div className="text-left">
                          <div className="flex items-start justify-between gap-3">
                            <p
                              className={cn(
                                "min-w-0 flex-1 leading-snug text-slate-900",
                                unread
                                  ? "text-sm font-semibold"
                                  : "text-sm font-medium",
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
                            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                              {n.body}
                            </p>
                          ) : null}
                          {time ? (
                            <p className="mt-2 text-xs font-medium text-slate-400">
                              {time}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                    {unread ? (
                      <div className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-teal-200/80 py-2 pl-2">
                        <button
                          type="button"
                          aria-label="Mark as read"
                          title="Mark as read"
                          onClick={(e) => handleMarkRead(e, n._id)}
                          className="rounded-lg p-2 text-teal-800 transition-colors hover:bg-teal-200/70"
                        >
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          aria-label="Dismiss notification"
                          title="Dismiss"
                          onClick={(e) => handleDismiss(e, n._id)}
                          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-200/80"
                        >
                          <X className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </WorkspacePageLayout>
  );
};

export default NotificationsPage;
