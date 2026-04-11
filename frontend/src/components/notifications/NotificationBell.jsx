import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Bell } from "lucide-react";
import { EmptyState } from "../ui/empty-state";
import { LoadingState } from "../ui/loading-state";
import { cn } from "@/lib/utils";
import { useNotificationSummary } from "@/context/NotificationSummaryContext";
import { NotificationListRow } from "./NotificationListRow";

/**
 * Navbar bell: a quick slice of the same list as /notifications, tuned for the popover.
 * Linked items mark as read on navigation; nothing is deleted here so history stays intact.
 */
const NotificationBell = ({ variant = "default" }) => {
  const onDark = variant === "onDark";
  const {
    notifications,
    unreadCount,
    loading,
    refresh,
    markAsRead,
    markAllRead,
  } = useNotificationSummary();
  const [open, setOpen] = useState(false);

  const recentList = useMemo(
    () => notifications.slice(0, 20),
    [notifications],
  );

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) refresh({ silent: true, limit: 80 });
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative rounded-full p-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            onDark
              ? "text-slate-100 hover:bg-white/15 hover:text-white focus-visible:ring-[#5eead4] focus-visible:ring-offset-[#0b1f4d]"
              : "text-slate-600 hover:bg-slate-100 focus-visible:ring-teal-500 focus-visible:ring-offset-white",
          )}
          aria-label="Notifications"
        >
          <Bell className="h-6 w-6" strokeWidth={onDark ? 2.25 : 2} />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-sm ring-2",
                onDark ? "bg-red-500 ring-[#0b1f4d]" : "bg-red-500 ring-white",
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="flex max-h-[min(24rem,70vh)] w-[min(100vw-1.5rem,22rem)] sm:w-96 flex-col overflow-hidden border-slate-200/90 p-0 shadow-2xl shadow-slate-900/20"
        align="end"
        sideOffset={10}
        collisionPadding={16}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/95 px-4 py-3">
          <div className="min-w-0">
            <span className="text-base font-semibold tracking-tight text-slate-900">
              Notifications
            </span>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              Unread items are highlighted. Opening a link marks it read — history is kept for audit.
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="ml-2 shrink-0 text-xs font-semibold text-teal-700 underline-offset-2 hover:text-teal-800 hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {loading ? (
            <LoadingState variant="compact" />
          ) : recentList.length === 0 ? (
            <EmptyState
              compact
              icon={Bell}
              title="No notifications yet"
              description="Alerts for tenders, approvals, and deliveries will show here."
            />
          ) : (
            <ul className="space-y-1.5">
              {recentList.map((n) => (
                <NotificationListRow
                  key={n._id}
                  n={n}
                  variant="popover"
                  onMarkRead={markAsRead}
                  onAfterNavigate={() => setOpen(false)}
                />
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-2.5">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-semibold text-[#0b1f4d] underline-offset-2 hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
