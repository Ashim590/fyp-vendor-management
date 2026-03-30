import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNotificationSummary } from "@/context/NotificationSummaryContext";

/**
 * @param {{ variant?: "default" | "onDark" }} props
 * Use variant="onDark" when the bell sits on the navy workspace header.
 */
const NotificationBell = ({ variant = "default" }) => {
  const onDark = variant === "onDark";
  const { notifications, unreadCount, loading, refresh, markAsRead, markAllRead } =
    useNotificationSummary();
  const [open, setOpen] = useState(false);

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
          <span className="text-base font-semibold tracking-tight text-slate-900">
            Notifications
          </span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-semibold text-teal-700 underline-offset-2 hover:text-teal-800 hover:underline"
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
          ) : notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600">
              No notifications yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {notifications.slice(0, 20).map((n) => (
                  <motion.li
                    key={n._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Link
                      to={n.link || "#"}
                      onClick={() => {
                        if (!n.read) markAsRead(n._id);
                        setOpen(false);
                      }}
                      className={cn(
                        "block rounded-lg px-3 py-2.5 text-left transition-colors",
                        !n.read
                          ? "border-l-4 border-teal-500 bg-teal-50/90 hover:bg-teal-100/90"
                          : "hover:bg-slate-100",
                      )}
                    >
                      <p className="text-sm font-semibold leading-snug text-slate-900">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-1 text-sm leading-relaxed text-slate-600 line-clamp-3">
                          {n.body}
                        </p>
                      )}
                    </Link>
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
