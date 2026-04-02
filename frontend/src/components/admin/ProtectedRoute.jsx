import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setUser, setToken } from "@/redux/authSlice";

/** True once redux-persist has finished restoring the `auth` slice from storage. */
function isAuthStorageReady(authState) {
  // Before the inner persistReducer attaches `_persist`, we must not treat auth as "ready"
  // or we redirect to /login while user is still null (same frame as pre-REHYDRATE).
  return authState?._persist?.rehydrated === true;
}

/**
 * Role-Based Access Control (RBAC) Protected Route Component
 *
 * This component protects routes based on user authentication and role.
 *
 * @param {React.ReactNode} children - The child components to render if authorized
 * @param {string|string[]} allowedRoles - Single role or array of roles allowed to access the route
 *
 * Usage:
 * <ProtectedRoute allowedRoles="admin">
 *   <AdminComponent />
 * </ProtectedRoute>
 *
 * <ProtectedRoute allowedRoles={["admin", "staff"]}>
 *   <StaffComponent />
 * </ProtectedRoute>
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
            dispatch(setUser(parsed));
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
  return user?.role === "admin";
};

/**
 * Hook to check if current user is staff
 * @returns {boolean} - True if user is staff
 */
export const useIsStaff = () => {
  const { user } = useSelector((store) => store.auth);
  return user?.role === "staff";
};

/**
 * Hook to check if current user is vendor
 * @returns {boolean} - True if user is vendor
 */
export const useIsVendor = () => {
  const { user } = useSelector((store) => store.auth);
  return user?.role === "vendor";
};
