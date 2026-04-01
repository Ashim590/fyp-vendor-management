import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import {
  NOTIFICATION_API_END_POINT,
  SESSION_API_END_POINT,
} from "@/utils/constant";
import { getAuthHeaderFromStorage } from "@/utils/authHeader";

const NotificationSummaryContext = createContext(null);

const initialState = {
  notifications: [],
  unreadCount: 0,
  unreadByType: {},
};

function notificationReducer(state, action) {
  switch (action.type) {
    case "setFromServer":
      return {
        notifications: action.notifications,
        unreadCount: action.unreadCount,
        unreadByType: action.unreadByType || {},
      };
    case "markOneRead": {
      const idStr = String(action.id);
      let dec = 0;
      let decType = "";
      const notifications = state.notifications.map((n) => {
        if (String(n._id) !== idStr) return n;
        if (!n.read) {
          dec = 1;
          decType = String(n.type || "");
        }
        return { ...n, read: true };
      });
      const unreadByType = { ...(state.unreadByType || {}) };
      if (dec === 1 && decType) {
        unreadByType[decType] = Math.max(0, Number(unreadByType[decType] || 0) - 1);
      }
      return {
        notifications,
        unreadCount: Math.max(0, state.unreadCount - dec),
        unreadByType,
      };
    }
    case "markAllRead":
      return {
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
        unreadByType: {},
      };
    case "dismissOne": {
      const idStr = String(action.id);
      const target = state.notifications.find((n) => String(n._id) === idStr);
      const wasUnread = target && !target.read ? 1 : 0;
      const targetType = String(target?.type || "");
      const unreadByType = { ...(state.unreadByType || {}) };
      if (wasUnread && targetType) {
        unreadByType[targetType] = Math.max(
          0,
          Number(unreadByType[targetType] || 0) - 1,
        );
      }
      return {
        notifications: state.notifications.filter((n) => String(n._id) !== idStr),
        unreadCount: Math.max(0, state.unreadCount - wasUnread),
        unreadByType,
      };
    }
    case "reset":
      return initialState;
    default:
      return state;
  }
}

function isProcurementStaffRole(role) {
  return role === "staff";
}

/** Polling interval — higher = less DB/API load (staff-home is one heavier round-trip). */
const STAFF_WORKSPACE_POLL_MS = 240_000;

/**
 * Shared notification list + unread count for navbar bell and sidebar badge.
 * Procurement staff: first load uses /session/staff-home (dashboard + notifications in one request).
 */
export function NotificationSummaryProvider({ children }) {
  const location = useLocation();
  const { user } = useSelector((store) => store.auth);
  const userId = user?._id ?? user?.id ?? null;
  const isStaff = isProcurementStaffRole(user?.role);
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const [loading, setLoading] = useState(false);
  const [staffWorkspace, setStaffWorkspace] = useState({
    dashboard: null,
    loading: false,
    error: null,
    /** True after first /staff-home attempt finishes (success or failure). */
    ready: false,
  });

  const fetchNotificationsOnly = useCallback((silent, limit) => {
    if (!userId) return Promise.resolve();
    if (!silent) setLoading(true);
    return axios
      .get(NOTIFICATION_API_END_POINT, {
        withCredentials: true,
        headers: getAuthHeaderFromStorage(),
        params: { limit },
      })
      .then((res) => {
        dispatch({
          type: "setFromServer",
          notifications: res.data.notifications || [],
          unreadCount: res.data.unreadCount ?? 0,
          unreadByType: res.data.unreadByType || {},
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [userId]);

  const loadStaffHome = useCallback(
    async (options = {}) => {
      const silent = options.silent === true;
      const notificationLimit =
        options.notificationLimit != null ? options.notificationLimit : 24;
      if (!userId || !isStaff) return;
      if (!silent) {
        setLoading(true);
        setStaffWorkspace((s) => ({
          ...s,
          loading: true,
          error: null,
          ready: false,
        }));
      }
      try {
        const { data } = await axios.get(`${SESSION_API_END_POINT}/staff-home`, {
          withCredentials: true,
          headers: getAuthHeaderFromStorage(),
          params: { notificationLimit },
        });
        if (!data?.success) {
          throw new Error(data?.message || "Failed to load workspace");
        }
        dispatch({
          type: "setFromServer",
          notifications: data.notifications?.notifications || [],
          unreadCount: data.notifications?.unreadCount ?? 0,
          unreadByType: data.notifications?.unreadByType || {},
        });
        setStaffWorkspace({
          dashboard: data.dashboard,
          loading: false,
          error: null,
          ready: true,
        });
      } catch (e) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Could not load workspace";
        if (!silent) {
          setStaffWorkspace({
            dashboard: null,
            loading: false,
            error: msg,
            ready: true,
          });
        } else {
          setStaffWorkspace((s) => ({ ...s, loading: false }));
        }
        await fetchNotificationsOnly(true, notificationLimit);
      } finally {
        if (!silent) setLoading(false);
        setStaffWorkspace((s) => ({ ...s, loading: false }));
      }
    },
    [userId, isStaff, fetchNotificationsOnly],
  );

  const refresh = useCallback(
    (options = {}) => {
      const silent = options.silent === true;
      const limit = options.limit != null ? options.limit : 80;
      if (!userId) return Promise.resolve();
      if (isStaff && limit <= 30) {
        return loadStaffHome({ silent, notificationLimit: limit });
      }
      return fetchNotificationsOnly(silent, limit);
    },
    [userId, isStaff, loadStaffHome, fetchNotificationsOnly],
  );

  useEffect(() => {
    if (!userId) {
      dispatch({ type: "reset" });
      setStaffWorkspace({
        dashboard: null,
        loading: false,
        error: null,
        ready: false,
      });
      return undefined;
    }
    if (isStaff) {
      loadStaffHome({ silent: false, notificationLimit: 24 });
      const t = setInterval(
        () => loadStaffHome({ silent: true, notificationLimit: 24 }),
        STAFF_WORKSPACE_POLL_MS,
      );
      return () => clearInterval(t);
    }
    setStaffWorkspace({
      dashboard: null,
      loading: false,
      error: null,
      ready: false,
    });
    /** Defer slightly so primary route (e.g. admin dashboard report) can start first. */
    const boot = window.setTimeout(() => {
      fetchNotificationsOnly(false, 24);
    }, 120);
    const t = setInterval(
      () => fetchNotificationsOnly(true, 24),
      STAFF_WORKSPACE_POLL_MS,
    );
    return () => {
      window.clearTimeout(boot);
      clearInterval(t);
    };
  }, [userId, isStaff, loadStaffHome, fetchNotificationsOnly]);

  const markAsRead = useCallback(
    (id) => {
      dispatch({ type: "markOneRead", id });
      axios
        .patch(
          `${NOTIFICATION_API_END_POINT}/${id}/read`,
          {},
          { withCredentials: true, headers: getAuthHeaderFromStorage() },
        )
        .catch(() => {
          if (isStaff) {
            loadStaffHome({ silent: true, notificationLimit: 24 });
          } else {
            fetchNotificationsOnly(true, 24);
          }
        });
    },
    [isStaff, loadStaffHome, fetchNotificationsOnly],
  );

  const markAllRead = useCallback(() => {
    dispatch({ type: "markAllRead" });
    axios
      .patch(
        `${NOTIFICATION_API_END_POINT}/read-all`,
        {},
        { withCredentials: true, headers: getAuthHeaderFromStorage() },
      )
      .catch(() => {
        if (isStaff) {
          loadStaffHome({ silent: true, notificationLimit: 24 });
        } else {
          fetchNotificationsOnly(true, 24);
        }
      });
  }, [isStaff, loadStaffHome, fetchNotificationsOnly]);

  const dismissNotification = useCallback(
    (id) => {
      dispatch({ type: "dismissOne", id });
      axios
        .delete(`${NOTIFICATION_API_END_POINT}/${id}`, {
          withCredentials: true,
          headers: getAuthHeaderFromStorage(),
        })
        .catch(() => {
          if (isStaff) {
            loadStaffHome({ silent: true, notificationLimit: 24 });
          } else {
            fetchNotificationsOnly(true, 24);
          }
        });
    },
    [isStaff, loadStaffHome, fetchNotificationsOnly],
  );

  useEffect(() => {
    const currentPath = String(location.pathname || "").trim();
    if (!currentPath) return;

    const currentParams = new URLSearchParams(location.search || "");
    const sectionRoot = (() => {
      const parts = currentPath.split("/").filter(Boolean);
      return parts.length ? `/${parts[0]}` : "/";
    })();

    const idsToRead = state.notifications
      .filter((n) => !n.read)
      .filter((n) => {
        const raw = String(n?.link || "").trim();
        if (!raw || raw === "#") return false;
        const normalized =
          n?.type === "bid_accepted"
            ? (() => {
                const bidParam = raw.match(/[?&]openBid=([a-f\d]{24})/i)?.[1];
                return bidParam ? `/my-bids?openBid=${bidParam}` : "/my-bids";
              })()
            : raw;

        const [targetPathRaw, targetQueryRaw = ""] = normalized.split("?");
        const targetPath = String(targetPathRaw || "").trim();
        if (!targetPath.startsWith("/")) return false;

        if (currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)) {
          if (!targetQueryRaw) return true;
          const targetParams = new URLSearchParams(targetQueryRaw);
          for (const [k, v] of targetParams.entries()) {
            if (currentParams.get(k) !== v) return false;
          }
          return true;
        }

        if (
          currentPath === sectionRoot &&
          sectionRoot !== "/" &&
          (targetPath === sectionRoot || targetPath.startsWith(`${sectionRoot}/`))
        ) {
          return true;
        }

        return false;
      })
      .map((n) => n._id)
      .filter(Boolean);

    if (idsToRead.length === 0) return;
    idsToRead.forEach((id) => markAsRead(id));
  }, [location.pathname, location.search, state.notifications, markAsRead]);

  const value = useMemo(
    () => ({
      notifications: state.notifications,
      unreadCount: state.unreadCount,
      unreadByType: state.unreadByType,
      loading,
      staffWorkspace: isStaff ? staffWorkspace : null,
      refresh,
      markAsRead,
      markAllRead,
      dismissNotification,
    }),
    [
      state.notifications,
      state.unreadCount,
      state.unreadByType,
      loading,
      isStaff,
      staffWorkspace,
      refresh,
      markAsRead,
      markAllRead,
      dismissNotification,
    ],
  );

  return (
    <NotificationSummaryContext.Provider value={value}>
      {children}
    </NotificationSummaryContext.Provider>
  );
}

export function useNotificationSummary() {
  const ctx = useContext(NotificationSummaryContext);
  if (!ctx) {
    return {
      notifications: [],
      unreadCount: 0,
      unreadByType: {},
      loading: false,
      staffWorkspace: null,
      refresh: () => {},
      markAsRead: () => {},
      markAllRead: () => {},
      dismissNotification: () => {},
    };
  }
  return ctx;
}
