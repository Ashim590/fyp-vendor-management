import { useSelector } from "react-redux";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";

/**
 * Role-Based Button Component
 *
 * Conditionally renders a button based on user's role.
 * If user doesn't have the required role, the button is not rendered.
 *
 * @param {React.ReactNode} children - Button content
 * @param {string|string[]} allowedRoles - Role(s) allowed to see this button
 * @param {string} variant - Button variant (default, outline, ghost, etc.)
 * @param {string} size - Button size (default, sm, lg, icon)
 * @param {boolean} loading - Show loading state
 * @param {function} onClick - Click handler
 * @param {string} className - Additional CSS classes
 * @param {object} props - Additional button props
 *
 * Usage:
 * <RoleBasedButton allowedRoles="admin" onClick={handleDelete}>
 *   Delete Item
 * </RoleBasedButton>
 *
 * <RoleBasedButton allowedRoles={["admin", "staff"]} variant="outline">
 *   Edit Item
 * </RoleBasedButton>
 */
const RoleBasedButton = ({
  children,
  allowedRoles,
  variant = "default",
  size = "default",
  loading = false,
  onClick,
  className = "",
  ...props
}) => {
  const { user } = useSelector((store) => store.auth);

  // If no role restriction, show button to everyone
  if (!allowedRoles) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={onClick}
        className={className}
        disabled={loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </Button>
    );
  }

  // Convert single role to array
  const rolesArray = Array.isArray(allowedRoles)
    ? allowedRoles
    : [allowedRoles];

  // Check if user has the required role
  if (!user || !rolesArray.includes(user.role)) {
    return null; // Don't render if user doesn't have permission
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      className={className}
      disabled={loading}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
};

export default RoleBasedButton;

/**
 * Role-Based Icon Button Component
 *
 * Conditionally renders an icon button based on user's role.
 *
 * @param {React.ReactNode} icon - Icon component
 * @param {string|string[]} allowedRoles - Role(s) allowed to see this button
 * @param {string} variant - Button variant
 * @param {string} size - Button size
 * @param {function} onClick - Click handler
 * @param {string} title - Tooltip title
 * @param {string} className - Additional CSS classes
 */
export const RoleBasedIconButton = ({
  icon: Icon,
  allowedRoles,
  variant = "ghost",
  size = "icon",
  onClick,
  title,
  className = "",
  ...props
}) => {
  const { user } = useSelector((store) => store.auth);

  if (!allowedRoles) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={onClick}
        className={className}
        title={title}
        {...props}
      >
        <Icon className="h-4 w-4" />
      </Button>
    );
  }

  const rolesArray = Array.isArray(allowedRoles)
    ? allowedRoles
    : [allowedRoles];

  if (!user || !rolesArray.includes(user.role)) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      className={className}
      title={title}
      {...props}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
};

/**
 * Role-Based Action Wrapper Component
 *
 * Wraps any component and only renders it if user has the required role.
 * Useful for wrapping complex JSX elements or groups of elements.
 *
 * @param {React.ReactNode} children - Content to render if authorized
 * @param {string|string[]} allowedRoles - Role(s) allowed to see this content
 *
 * Usage:
 * <RoleBasedAction allowedRoles="admin">
 *   <div className="admin-only-actions">
 *     <Button>Delete</Button>
 *     <Button>Approve</Button>
 *   </div>
 * </RoleBasedAction>
 */
export const RoleBasedAction = ({ children, allowedRoles }) => {
  const { user } = useSelector((store) => store.auth);

  if (!allowedRoles) {
    return <>{children}</>;
  }

  const rolesArray = Array.isArray(allowedRoles)
    ? allowedRoles
    : [allowedRoles];

  if (!user || !rolesArray.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
};

/**
 * Role-Based Conditional Render Component
 *
 * Renders different content based on user's role.
 *
 * @param {object} render - Object with role as key and content as value
 * @param {React.ReactNode} fallback - Content to render if no role matches
 *
 * Usage:
 * <RoleBasedRender
 *   render={{
 *     admin: <AdminPanel />,
 *     staff: <StaffPanel />,
 *     vendor: <VendorPanel />
 *   }}
 *   fallback={<DefaultView />}
 * />
 */
export const RoleBasedRender = ({ render, fallback = null }) => {
  const { user } = useSelector((store) => store.auth);

  if (!user) {
    return <>{fallback}</>;
  }

  // Check if there's specific content for this role
  if (render[user.role]) {
    return <>{render[user.role]}</>;
  }

  return <>{fallback}</>;
};
