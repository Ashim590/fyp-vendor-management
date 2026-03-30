import { User } from "../models/user.model.js";

/**
 * Middleware to check if user has required role(s)
 * @param {...string} roles - Allowed roles (admin, staff, vendor)
 * @returns Middleware function
 */
export const roleAuth = (...roles) => {
  return async (req, res, next) => {
    try {
      // Get user ID from the authenticated request (set by isAuthenticated middleware)
      const userId = req.id;

      if (!userId) {
        return res.status(401).json({
          message: "User not authenticated",
          success: false,
        });
      }

      // Fetch user from database to get latest role
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          message: "User not found",
          success: false,
        });
      }

      // Check if user's role is in the allowed roles
      if (!roles.includes(user.role)) {
        return res.status(403).json({
          message: `Access denied. Required role: ${roles.join(
            " or "
          )}. Your role: ${user.role}`,
          success: false,
        });
      }

      // Attach user role to request for use in controllers
      req.userRole = user.role;
      req.user = user;

      next();
    } catch (error) {
      console.log("Role Auth Error:", error);
      return res.status(500).json({
        message: "Internal server error in role authorization",
        success: false,
        error: error.message,
      });
    }
  };
};

/**
 * Middleware to check if user has specific permission on a module
 * @param {string} module - Module name
 * @param {string} action - Action (create, read, update, delete)
 * @returns Middleware function
 */
export const permissionAuth = (module, action) => {
  return async (req, res, next) => {
    try {
      const userId = req.id;

      if (!userId) {
        return res.status(401).json({
          message: "User not authenticated",
          success: false,
        });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          message: "User not found",
          success: false,
        });
      }

      // Admins have all permissions
      if (user.role === "admin") {
        req.user = user;
        req.userRole = user.role;
        return next();
      }

      // Check if user has the required permission
      const hasPermission = user.permissions?.some(
        (perm) => perm.module === module && perm.actions.includes(action)
      );

      if (!hasPermission) {
        return res.status(403).json({
          message: `Access denied. Required permission: ${action} on ${module}`,
          success: false,
        });
      }

      req.user = user;
      req.userRole = user.role;
      next();
    } catch (error) {
      console.log("Permission Auth Error:", error);
      return res.status(500).json({
        message: "Internal server error in permission authorization",
        success: false,
        error: error.message,
      });
    }
  };
};

/**
 * Role-based access control configuration
 * Defines which roles can access which routes
 */
export const RBAC_CONFIG = {
  // Vendor Management
  "/api/v1/vendor": {
    GET: ["admin", "staff", "vendor"],
    POST: ["admin", "vendor"],
    PUT: ["admin"],
    DELETE: ["admin"],
  },

  // Purchase Requests
  "/api/v1/purchase-request": {
    GET: ["admin", "staff", "vendor"],
    POST: ["admin", "staff"],
    PUT: ["admin", "staff"],
    DELETE: ["admin"],
  },

  // Quotations
  "/api/v1/quotation": {
    GET: ["admin", "staff", "vendor"],
    POST: ["vendor"],
    PUT: ["admin", "staff"],
    DELETE: ["admin"],
  },

  // Approvals
  "/api/v1/approval": {
    GET: ["admin", "staff"],
    POST: ["admin"],
    PUT: ["admin"],
    DELETE: ["admin"],
  },

  // Purchase Orders
  "/api/v1/purchase-order": {
    GET: ["admin", "staff", "vendor"],
    POST: ["admin", "staff"],
    PUT: ["admin", "vendor"],
    DELETE: ["admin"],
  },

  // Deliveries
  "/api/v1/delivery": {
    GET: ["admin", "staff", "vendor"],
    POST: ["admin", "vendor"],
    PUT: ["admin", "vendor"],
    DELETE: ["admin"],
  },

  // Invoices
  "/api/v1/invoice": {
    GET: ["admin", "staff", "vendor"],
    POST: ["admin"],
    PUT: ["admin", "vendor"],
    DELETE: ["admin"],
  },

  // Payments
  "/api/v1/payment": {
    GET: ["admin", "staff", "vendor"],
    POST: ["admin", "staff"],
    PUT: ["admin", "staff"],
    DELETE: ["admin"],
  },

  // Users (Admin only)
  "/api/v1/user": {
    GET: ["admin"],
    POST: ["admin"],
    PUT: ["admin"],
    DELETE: ["admin"],
  },
};

/**
 * Dynamic role-based middleware based on route configuration
 * @returns Middleware function
 */
export const dynamicRoleAuth = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.id;

      if (!userId) {
        return res.status(401).json({
          message: "User not authenticated",
          success: false,
        });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          message: "User not found",
          success: false,
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
          success: false,
        });
      }

      req.userRole = user.role;
      req.user = user;
      next();
    } catch (error) {
      console.log("Dynamic Role Auth Error:", error);
      return res.status(500).json({
        message: "Internal server error",
        success: false,
      });
    }
  };
};

export default roleAuth;
