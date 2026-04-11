import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNotificationLinkTarget } from "@/utils/notificationNavigation";

/**
 * One stored notification in the panel: visual weight for unread rows and a soft
 * transition when read; rows aren’t removed client-side (audit trail lives on the server).
 */
export function NotificationListRow({
  n,
  variant = "popover",
  relativeTime,
  onMarkRead,
  onAfterNavigate,
}) {
  const unread = !n.read;
  const target = getNotificationLinkTarget(n);
  const hasLink = Boolean(target && target !== "#");
  const text = n.body || n.message || "";

  const shellClass =
    variant === "page"
      ? cn(
          "flex gap-2 rounded-xl py-1 pl-1 pr-2 transition-[background-color,box-shadow,border-color] duration-300 ease-out",
          unread
            ? "border border-teal-200/90 border-l-4 border-l-teal-500 bg-teal-50/95 shadow-sm shadow-teal-900/[0.04]"
            : "border border-transparent bg-slate-50/50",
        )
      : cn(
          "flex gap-1 rounded-lg py-2 pl-2 pr-1 transition-[background-color,border-color] duration-300 ease-out",
          unread
            ? "border-l-4 border-teal-500 bg-teal-50/90 hover:bg-teal-100/90"
            : "border-l-4 border-slate-200 bg-slate-50/80 hover:bg-slate-100/80",
        );

  const linkContent =
    variant === "page" ? (
      <>
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
        {text ? (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
        ) : null}
        {relativeTime ? (
          <p className="mt-2 text-xs font-medium text-slate-400">{relativeTime}</p>
        ) : null}
      </>
    ) : (
      <>
        <p
          className={cn(
            "text-sm leading-snug",
            unread ? "font-semibold text-slate-900" : "font-medium text-slate-700",
          )}
        >
          {n.title}
        </p>
        {text ? (
          <p
            className={cn(
              "mt-1 text-sm leading-relaxed line-clamp-3",
              unread ? "text-slate-600" : "text-slate-500",
            )}
          >
            {text}
          </p>
        ) : null}
      </>
    );

  const mainBlock = hasLink ? (
    <Link
      to={target}
      onClick={() => {
        if (n?._id != null) onMarkRead(n._id);
        onAfterNavigate?.();
      }}
      className={cn(
        "block text-left outline-none",
        variant === "page"
          ? "ring-[#0b1f4d] focus-visible:rounded-md focus-visible:ring-2"
          : "rounded-md px-2 py-1 ring-teal-600 focus-visible:ring-2",
      )}
    >
      {linkContent}
    </Link>
  ) : (
    <div className={variant === "popover" ? "px-2 py-1" : "text-left"}>{linkContent}</div>
  );

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: unread ? 1 : 0.94,
        y: 0,
        scale: unread ? 1 : 0.998,
      }}
      transition={{
        opacity: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
        scale: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
        layout: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
      }}
      className="list-none overflow-hidden"
    >
      <div className={shellClass}>
        <div
          className={cn(
            "min-w-0 flex-1",
            variant === "page" && "px-3 py-2.5",
          )}
        >
          {mainBlock}
        </div>
        {unread ? (
          <div
            className={cn(
              "flex shrink-0 flex-col items-center justify-start border-teal-200/80",
              variant === "page"
                ? "justify-center border-l py-2 pl-2"
                : "border-l pl-1",
            )}
          >
            <button
              type="button"
              aria-label="Mark as read"
              title="Mark as read"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMarkRead(n._id);
              }}
              className={cn(
                "rounded-md p-1.5 text-teal-800 transition-colors hover:bg-teal-200/80 hover:text-teal-950",
                variant === "page" && "rounded-lg p-2 hover:bg-teal-200/70",
              )}
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        ) : null}
      </div>
    </motion.li>
  );
}
