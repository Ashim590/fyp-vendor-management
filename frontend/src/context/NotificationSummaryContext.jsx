import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
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
};

function notificationReducer(state, action) {
  switch (action.type) {
    case "setFromServer":
      return {
        notifications: action.notifications,
        unreadCount: action.unreadCount,
      };
    case "markOneRead": {
      const idStr = String(action.id);
      let dec = 0;
      const notifications = state.notifications.map((n) => {
        if (String(n._id) !== idStr) return n;
        if (!n.read) dec = 1;
        return { ...n, read: true };
      });
      return {
        notifications,
        unreadCount: Math.max(0, state.unreadCount - dec),
      };
    }
    case "markAllRead":
      return {
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      };
    case "reset":
      return initialState;
    default:
      return state;
  }
}

function isProcurementStaffRole(role) {
  return role === "staff";
}

/** Polling interval — higher = less DB load for admin/staff notification list. */
const STAFF_WORKSPACE_POLL_MS = 120_000;

/**
 * Shared notification list + unread count for navbar bell and sidebar badge.
 * Procurement staff: first load uses /session/staff-home (dashboard + notifications in one request).
 */
export function NotificationSummaryProvider({ children }) {
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

  const value = useMemo(
    () => ({
      notifications: state.notifications,
      unreadCount: state.unreadCount,
      loading,
      staffWorkspace: isStaff ? staffWorkspace : null,
      refresh,
      markAsRead,
      markAllRead,
    }),
    [
      state.notifications,
      state.unreadCount,
      loading,
      isStaff,
      staffWorkspace,
      refresh,
      markAsRead,
      markAllRead,
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
      loading: false,
      staffWorkspace: null,
      refresh: () => {},
      markAsRead: () => {},
      markAllRead: () => {},
    };
  }
  return ctx;
}
