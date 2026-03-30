import React, { useRef, useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import {
  LogOut,
  User2,
  Package,
  FileText,
  LayoutDashboard,
  Gavel,
  ClipboardList,
  Users as UsersIcon,
  Menu,
  X,
  Truck,
  CheckCircle,
} from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setUser, setToken } from "@/redux/authSlice";
import { toast } from "sonner";
import NotificationBell from "../notifications/NotificationBell";
import { WorkspaceSidebarLinks } from "../layout/AppSidebar";

const NAV_CONFIG = {
  admin: [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Users", path: "/admin/users", icon: UsersIcon },
    { name: "Vendors", path: "/admin?tab=vendors", icon: Package },
    { name: "Approvals", path: "/approvals", icon: CheckCircle },
    { name: "Tenders", path: "/tenders", icon: Gavel },
    { name: "Bids", path: "/bids-monitor", icon: ClipboardList },
    { name: "Deliveries", path: "/deliveries", icon: Truck },
    { name: "Reports", path: "/admin?tab=overview", icon: FileText },
  ],
  staff: [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Purchase Requests", path: "/purchase-requests", icon: FileText },
    { name: "Tenders", path: "/tenders", icon: Gavel },
    { name: "Bids Monitor", path: "/bids-monitor", icon: ClipboardList },
    { name: "Deliveries", path: "/deliveries", icon: Truck },
  ],
  vendor: [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Tenders", path: "/tenders", icon: Gavel },
    { name: "Tender quotations", path: "/my-bids", icon: ClipboardList },
    { name: "Deliveries", path: "/deliveries", icon: Truck },
  ],
};

const Navbar = () => {
  const { user } = useSelector((store) => store.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navRef = useRef(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  const isRouteActive = (to) => {
    const [rawPath, queryString] = to.split("?");
    const { pathname } = location;
    const tab = searchParams.get("tab");

    const pathMatches =
      pathname === rawPath ||
      (rawPath !== "/" && pathname.startsWith(`${rawPath}/`));

    if (!queryString) return pathMatches;

    const q = new URLSearchParams(queryString);
    const needTab = q.get("tab");
    if (!pathMatches) return false;
    if (needTab == null) return true;
    if (pathname === "/admin" && needTab === "overview") {
      return tab === null || tab === "overview";
    }
    return tab === needTab;
  };

  const scrollToPublicSection = (path) => {
    if (!path?.startsWith("/#")) return;
    const id = path.replace("/#", "");
    navigate(path);
    setMobileOpen(false);

    requestAnimationFrame(() => {
      const target = id ? document.getElementById(id) : null;
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const getNavItems = () => {
    if (!user?.role) return [];
    return NAV_CONFIG[user.role] || [];
  };

  const publicNavItems = [
    { name: "Home", path: "/#home" },
    { name: "About", path: "/#about" },
    { name: "Features", path: "/#features" },
    { name: "Contact", path: "/#contact" },
  ];

  const getRoleDisplayName = (role) => {
    const roleNames = {
      admin: "Administrator",
      staff: "Procurement Officer",
      vendor: "Vendor",
    };
    return roleNames[role] || role;
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
      staff: "bg-teal-50 text-teal-800 ring-1 ring-teal-100",
      vendor: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
    };
    return colors[role] || "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  };

  const logoutHandler = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch {
      // ignore
    }
    dispatch(setToken(null));
    dispatch(setUser(null));
    navigate("/login");
    toast.success("Logged out successfully");
  };

  const displayName = user?.name || user?.fullname || user?.email || "User";
  const displayPhoto = user?.profilePhoto || user?.profile?.profilePhoto || "";
  return (
    <header
      ref={navRef}
      className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0b1f4d]/95 shadow-[0_8px_24px_rgba(11,31,77,0.24)] backdrop-blur-xl"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:h-[72px] lg:px-8">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <img
            src="/Logo.png"
            alt="Paropakar VendorNet"
            className="h-8 w-8 rounded-lg object-contain"
          />
          <h1 className="text-sm font-semibold leading-tight tracking-tight sm:text-base lg:text-lg">
            <span className="text-slate-100">Paropakar </span>
            <span className="text-[#5eead4]">VendorNet</span>
          </h1>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-4 lg:flex">
          {!user && (
            <ul className="flex items-center gap-1 text-sm">
              {publicNavItems.map((item) => {
                const hash = item.path.replace("/#", "");
                const active =
                  location.pathname === "/" && location.hash === `#${hash}`;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToPublicSection(item.path);
                      }}
                      className={`rounded-lg px-3 py-2 font-medium transition ${
                        active
                          ? "bg-[#12306b] text-white shadow-sm"
                          : "text-slate-200 hover:bg-[#17366f] hover:text-white"
                      }`}
                    >
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {user && null}

          {!user ? (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 border-teal-100 bg-white text-[#0b1f4d] hover:bg-teal-50 hover:text-[#0b1f4d]"
                >
                  Login
                </Button>
              </Link>
              <Link to="/signup">
                <Button
                  size="sm"
                  className="h-10 bg-[#14b8a6] text-white hover:bg-[#0f9f90]"
                >
                  Vendor Registration
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <NotificationBell variant="onDark" />
              <Popover>
                <PopoverTrigger asChild>
                  <Avatar className="cursor-pointer bg-[#12306b] text-white shadow-md ring-2 ring-white transition hover:ring-teal-200">
                    <AvatarImage src={displayPhoto} alt={displayName} />
                    <AvatarFallback className="bg-transparent text-white">
                      {displayName?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={displayPhoto} alt={displayName} />
                        <AvatarFallback>
                          {displayName?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {user?.email}
                        </p>
                        {user?.role && (
                          <span
                            className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getRoleBadgeColor(
                              user.role,
                            )}`}
                          >
                            {getRoleDisplayName(user.role)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="flex flex-col gap-1 text-sm text-slate-700">
                      <Link
                        to="/profile"
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
                      >
                        <User2 className="h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                      <button
                        type="button"
                        onClick={logoutHandler}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>

        {/* Mobile: right-side controls */}
        <div className="flex items-center gap-3 lg:hidden">
          {user && <NotificationBell variant="onDark" />}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-100 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5eead4]"
            aria-label={user ? "Open workspace menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-primary-nav"
          >
            {mobileOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        id="mobile-primary-nav"
        className={`overflow-hidden border-t border-slate-200/80 bg-white transition-all duration-300 ease-in-out lg:hidden ${
          mobileOpen
            ? "max-h-[85vh] opacity-100"
            : "max-h-0 opacity-0 border-t-0"
        }`}
      >
        <nav className="mx-auto max-h-[85vh] max-w-7xl space-y-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3 lg:hidden">
          {!user && (
            <>
              {publicNavItems.map((item) => {
                const hash = item.path.replace("/#", "");
                const active =
                  location.pathname === "/" && location.hash === `#${hash}`;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToPublicSection(item.path);
                    }}
                    className={`block rounded-lg px-3 py-3 text-sm font-medium transition ${
                      active
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}

              <div className="my-3 h-px bg-slate-100" />

              <div className="flex flex-col gap-2">
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button
                    variant="outline"
                    className="h-11 w-full border-slate-300 text-slate-700"
                  >
                    Login
                  </Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)}>
                  <Button className="h-11 w-full bg-[#0b1f4d] hover:bg-[#12306b]">
                    Vendor Registration
                  </Button>
                </Link>
              </div>
            </>
          )}

          {user && (
            <>
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3">
                <Avatar className="h-10 w-10 bg-slate-800 text-white">
                  <AvatarImage src={displayPhoto} alt={displayName} />
                  <AvatarFallback className="bg-transparent text-white">
                    {displayName?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {displayName}
                  </p>
                  <span
                    className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getRoleBadgeColor(
                      user.role,
                    )}`}
                  >
                    {getRoleDisplayName(user.role)}
                  </span>
                </div>
              </div>

              <div className="my-2 h-px bg-slate-100" />

              <div className="rounded-xl border border-[#e7eef9] bg-[#f8fbff] p-4">
                <WorkspaceSidebarLinks
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  logoutHandler();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
