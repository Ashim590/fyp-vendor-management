import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setUser, setToken } from "@/redux/authSlice";
import { SESSION_ROLE, normalizeUserRoleFields } from "@/constants/userRoles";

/** `_persist.rehydrated` flips once the auth slice has been replayed from storage. */
function isAuthStorageReady(authState) {
  // Without this guard, the first render sees `user === null` and sends people to /login
  // even though hydration is about to restore a session a moment later.
  return authState?._persist?.rehydrated === true;
}

/**
 * Wraps pages that need a signed-in user and an allowed session role; redirects
 * handle the common “wrong role” and “logged out” cases in one place.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const auth = useSelector((store) => store.auth);
  const { user } = auth;
  const storageReady = isAuthStorageReady(auth);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!storageReady) return;

    // If Redux has no user yet, restore from the same localStorage keys Login writes
    // (handles reload before `persist:auth` flushed or desync with persist).
    if (!user) {
      const token = localStorage.getItem("token");
      const raw = localStorage.getItem("user");
      if (token && raw) {
        try {
          const parsed = JSON.parse(raw);
          if (
            parsed &&
            typeof parsed === "object" &&
            (parsed.role || parsed._id || parsed.id)
          ) {
            dispatch(setToken(token));
            dispatch(setUser(normalizeUserRoleFields(parsed)));
            return;
          }
        } catch {
          /* ignore */
        }
      }
      navigate("/login", { replace: true });
      return;
    }

    if (allowedRoles) {
      const rolesArray = Array.isArray(allowedRoles)
        ? allowedRoles
        : [allowedRoles];
      if (!rolesArray.includes(user.role)) {
        navigate("/", { replace: true });
      }
    }
  }, [user, allowedRoles, navigate, storageReady, dispatch]);

  // Wait for persisted auth to rehydrate so we don't redirect to /login on full page reload.
  if (!storageReady) {
    return null;
  }

  // Don't render anything while checking (prevents flash of unauthorized content)
  if (!user) {
    return null;
  }

  // If allowedRoles is specified and user doesn't have the right role
  if (allowedRoles) {
    const rolesArray = Array.isArray(allowedRoles)
      ? allowedRoles
      : [allowedRoles];

    if (!rolesArray.includes(user.role)) {
      return null;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

/**
 * Higher-Order Component for creating role-protected components
 * @param {React.Component} Component - Component to protect
 * @param {string|string[]} allowedRoles - Allowed roles
 * @returns Protected component
 */
export const withRoleProtection = (Component, allowedRoles) => {
  return (props) => (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <Component {...props} />
    </ProtectedRoute>
  );
};

/**
 * Hook to check if current user has specific role
 * @param {string|string[]} requiredRoles - Role(s) to check
 * @returns {boolean} - True if user has the required role
 */
export const useHasRole = (requiredRoles) => {
  const { user } = useSelector((store) => store.auth);

  if (!user) return false;

  const rolesArray = Array.isArray(requiredRoles)
    ? requiredRoles
    : [requiredRoles];

  return rolesArray.includes(user.role);
};

/**
 * Hook to check if current user is admin
 * @returns {boolean} - True if user is admin
 */
export const useIsAdmin = () => {
  const { user } = useSelector((store) => store.auth);
  return user?.role === SESSION_ROLE.ADMIN;
};

/** Procurement officer session slug; lines up with backend `PROCUREMENT_OFFICER`. */
export const useIsProcurementOfficer = () => {
  const { user } = useSelector((store) => store.auth);
  return user?.role === SESSION_ROLE.PROCUREMENT_OFFICER;
};

/** Older name from when the session slug was still `staff`. */
export const useIsStaff = useIsProcurementOfficer;

/** Vendor marketplace / vendor-dashboard flows. */
export const useIsVendor = () => {
  const { user } = useSelector((store) => store.auth);
  return user?.role === SESSION_ROLE.VENDOR;
};
