import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useNotificationSummary } from "@/context/NotificationSummaryContext";
import { getUnreadCountsBySidebarPath } from "@/utils/notificationSectionCounts";
import {
  Bell,
  CheckCircle,
  ClipboardList,
  FileText,
  Receipt,
  Banknote,
  Gavel,
  LayoutDashboard,
  Truck,
  UserCircle,
  Users,
} from "lucide-react";

const SIDEBAR_CONFIG = {
  admin: [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    {
      name: "Vendor Registrations",
      path: "/admin?tab=vendors",
      icon: Users,
    },
    { name: "Users", path: "/admin/users", icon: Users },
    { name: "Approvals", path: "/approvals", icon: CheckCircle },
    { name: "Tenders", path: "/tenders", icon: Gavel },
    { name: "Bids Monitor", path: "/bids-monitor", icon: ClipboardList },
    { name: "Payments", path: "/procurement/payments", icon: Banknote },
    { name: "Invoices", path: "/invoices", icon: Receipt },
    { name: "Deliveries", path: "/deliveries", icon: Truck },
  ],
  staff: [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Purchase Requests", path: "/purchase-requests", icon: FileText },
    { name: "Approvals", path: "/approvals", icon: CheckCircle },
    { name: "Tenders", path: "/tenders", icon: Gavel },
    { name: "Bids Monitor", path: "/bids-monitor", icon: ClipboardList },
    { name: "Payments", path: "/procurement/payments", icon: Banknote },
    { name: "Invoices", path: "/invoices", icon: Receipt },
    { name: "Deliveries", path: "/deliveries", icon: Truck },
  ],
  vendor: [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Tenders", path: "/tenders", icon: Gavel },
    { name: "Tender quotations", path: "/my-bids", icon: ClipboardList },
    { name: "Invoices", path: "/invoices", icon: Receipt },
    { name: "My payments", path: "/my-payments", icon: Banknote },
    { name: "Deliveries", path: "/deliveries", icon: Truck },
  ],
};

export function useWorkspaceNavIsActive() {
  const location = useLocation();
  return (path) => {
    if (path.startsWith("/admin?")) {
      const q = path.split("?")[1] || "";
      const expected = new URLSearchParams(q).get("tab");
      const current = new URLSearchParams(location.search).get("tab");
      return location.pathname === "/admin" && expected === current;
    }
    if (path === "/") return location.pathname === "/";
    if (path === "/admin") return location.pathname === "/admin";
    if (path === "/purchase-requests") {
      return (
        location.pathname.startsWith("/purchase-requests") ||
        location.pathname.startsWith("/procurement/requests")
      );
    }
    if (path === "/notifications") {
      return (
        location.pathname === "/notifications" ||
        location.pathname.startsWith("/notifications/")
      );
    }
    if (path === "/my-payments") {
      return location.pathname === "/my-payments";
    }
    if (path === "/procurement/payments") {
      return location.pathname.startsWith("/procurement/payments");
    }
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };
}

const unreadPillClassName =
  "ml-auto flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-none text-white tabular-nums shadow-sm ring-2 ring-white";

function UnreadPill({ count, ariaLabel }) {
  if (count <= 0) return null;
  return (
    <span className={unreadPillClassName} aria-label={ariaLabel}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarNavLink({
  to,
  active,
  icon: Icon,
  children,
  onClick,
  trailing,
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group relative flex min-w-0 items-center gap-3 rounded-xl py-2.5 pl-3 pr-2 text-sm transition-all duration-200 ease-out ${
        active
          ? "bg-white text-slate-900 shadow-md shadow-teal-900/5 ring-1 ring-teal-200/60"
          : "text-slate-600 hover:bg-white/90 hover:text-slate-900 hover:shadow-sm hover:ring-1 hover:ring-sky-100"
      }`}
    >
      {active ? (
        <span
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-gradient-to-b from-teal-500 to-sky-500"
          aria-hidden
        />
      ) : null}
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
          active
            ? "bg-gradient-to-br from-teal-50 to-sky-50 text-teal-700 ring-1 ring-teal-100/80"
            : "bg-slate-100/80 text-slate-500 group-hover:bg-sky-50 group-hover:text-teal-700"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 2} />
      </span>
      <span
        className={`min-w-0 flex-1 truncate ${active ? "font-semibold" : "font-medium"}`}
      >
        {children}
      </span>
      {trailing}
    </Link>
  );
}

/**
 * Same links as the desktop sidebar; use onNavigate to close a mobile sheet/drawer.
 */
export function WorkspaceSidebarLinks({ onNavigate, className = "" }) {
  const { user } = useSelector((store) => store.auth);
  const { notifications, unreadCount, unreadByType } = useNotificationSummary();
  const isActive = useWorkspaceNavIsActive();
  const links = SIDEBAR_CONFIG[user?.role] || [];

  const sectionUnreadCounts = useMemo(
    () => getUnreadCountsBySidebarPath(notifications, user?.role, unreadByType),
    [notifications, user?.role, unreadByType],
  );

  if (!user || links.length === 0) return null;

  const accountLinks = [
    { name: "Profile settings", path: "/profile", icon: UserCircle },
    { name: "Notifications", path: "/notifications", icon: Bell },
  ];

  return (
    <div className={className}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-600/70">
        Workspace
      </p>
      <h2 className="mt-1.5 text-lg font-bold tracking-tight text-slate-800">
        {user.role === "admin"
          ? "Admin Panel"
          : user.role === "staff"
            ? "Procurement"
            : "Vendor Portal"}
      </h2>
      <div className="mt-4 space-y-1.5">
        {links.map((item) => {
          const active = isActive(item.path);
          const sectionCount = sectionUnreadCounts[item.path] || 0;
          return (
            <SidebarNavLink
              key={item.path}
              to={item.path}
              active={active}
              icon={item.icon}
              onClick={() => onNavigate?.()}
              trailing={
                <UnreadPill
                  count={sectionCount}
                  ariaLabel={`${sectionCount} unread in ${item.name}`}
                />
              }
            >
              {item.name}
            </SidebarNavLink>
          );
        })}
      </div>
      <div className="mt-6 border-t border-sky-100/90 pt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Account
        </p>
        <div className="mt-3 space-y-1.5">
          {accountLinks.map((item) => {
            const active = isActive(item.path);
            const showCount = item.path === "/notifications";
            return (
              <SidebarNavLink
                key={item.path}
                to={item.path}
                active={active}
                icon={item.icon}
                onClick={() => onNavigate?.()}
                trailing={
                  showCount ? (
                    <UnreadPill
                      count={unreadCount}
                      ariaLabel={`${unreadCount} unread notifications`}
                    />
                  ) : null
                }
              >
                {item.name}
              </SidebarNavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const AppSidebar = () => {
  const { user } = useSelector((store) => store.auth);
  if (!user) return null;

  return (
    <aside className="relative overflow-hidden rounded-2xl border border-sky-100/80 bg-gradient-to-b from-white via-sky-50/25 to-teal-50/20 p-6 shadow-[0_8px_32px_-8px_rgba(15,118,110,0.12),0_2px_8px_-2px_rgba(15,23,42,0.06)]">
      <div
        className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-teal-200/20 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-8 -left-6 h-24 w-24 rounded-full bg-sky-200/25 blur-2xl"
        aria-hidden
      />
      <WorkspaceSidebarLinks className="relative" />
    </aside>
  );
};

export default AppSidebar;
