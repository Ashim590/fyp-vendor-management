import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Bell, Check, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNotificationSummary } from "@/context/NotificationSummaryContext";

/**
 * Bell shows recent notifications (unread + read). Opening a linked notification marks it as read.
 *
 * @param {{ variant?: "default" | "onDark" }} props
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
    dismissNotification,
  } = useNotificationSummary();
  const [open, setOpen] = useState(false);

  const recentList = useMemo(
    () => notifications.slice(0, 20),
    [notifications],
  );

  const handleMarkRead = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    markAsRead(id);
  };

  const handleOpenNotification = (id) => {
    if (id != null) markAsRead(id);
    setOpen(false);
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
              Opening marks as read. Dismiss removes it from your list.
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
            <p className="py-8 text-center text-sm font-medium text-slate-500">
              Loading…
            </p>
          ) : recentList.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-slate-600">
              No notifications yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {recentList.map((n) => (
                  <motion.li
                    key={n._id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      height: 0,
                      marginTop: 0,
                      marginBottom: 0,
                      paddingTop: 0,
                      paddingBottom: 0,
                    }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div
                      className={cn(
                        "flex gap-1 rounded-lg py-2 pl-2 pr-1",
                        !n.read
                          ? "border-l-4 border-teal-500 bg-teal-50/90 hover:bg-teal-100/90"
                          : "border-l-4 border-slate-200 bg-slate-50/80 hover:bg-slate-100/80",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        {targetFor(n) && targetFor(n) !== "#" ? (
                          <Link
                            to={targetFor(n)}
                            onClick={() => handleOpenNotification(n._id)}
                            className="block rounded-md px-2 py-1 text-left outline-none ring-teal-600 focus-visible:ring-2"
                          >
                            <p
                              className={cn(
                                "text-sm leading-snug",
                                n.read
                                  ? "font-medium text-slate-700"
                                  : "font-semibold text-slate-900",
                              )}
                            >
                              {n.title}
                            </p>
                            {n.body && (
                              <p
                                className={cn(
                                  "mt-1 text-sm leading-relaxed line-clamp-3",
                                  n.read ? "text-slate-500" : "text-slate-600",
                                )}
                              >
                                {n.body}
                              </p>
                            )}
                          </Link>
                        ) : (
                          <div className="px-2 py-1">
                            <p
                              className={cn(
                                "text-sm leading-snug",
                                n.read
                                  ? "font-medium text-slate-700"
                                  : "font-semibold text-slate-900",
                              )}
                            >
                              {n.title}
                            </p>
                            {n.body && (
                              <p
                                className={cn(
                                  "mt-1 text-sm leading-relaxed line-clamp-3",
                                  n.read ? "text-slate-500" : "text-slate-600",
                                )}
                              >
                                {n.body}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {!n.read && (
                        <div className="flex shrink-0 flex-col items-center justify-start gap-0.5 border-l border-teal-200/80 pl-1">
                        <button
                          type="button"
                          aria-label="Mark as read"
                          title="Mark as read"
                          onClick={(e) => handleMarkRead(e, n._id)}
                          className="rounded-md p-1.5 text-teal-800 transition-colors hover:bg-teal-200/80 hover:text-teal-950"
                        >
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          aria-label="Dismiss notification"
                          title="Dismiss"
                          onClick={(e) => handleDismiss(e, n._id)}
                          className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-200/90 hover:text-slate-900"
                        >
                          <X className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                        </div>
                      )}
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
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
