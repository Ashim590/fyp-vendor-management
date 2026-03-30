import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser, UserRole } from "../models/User";
import Vendor from "../models/Vendor";
import {
  getCachedAuthUser,
  setCachedAuthUser,
} from "../utils/authUserCache";

export interface AuthRequest extends Request {
  user?: IUser;
}

/** Non-approved vendors may only read their own profile (status / details). */
export function isPendingVendorAllowlistRoute(req: Request): boolean {
  if (req.method !== "GET") return false;
  const path = req.originalUrl.split("?")[0];
  return (
    path.endsWith("/api/v1/vendor/me") || path.endsWith("/api/vendors/me")
  );
}

function vendorGateMessage(status: string): string {
  if (status === "pending") {
    return "Your vendor application is pending admin approval.";
  }
  if (status === "rejected") {
    return "Your vendor application was not approved. Contact the organization if you need help.";
  }
  if (status === "suspended") {
    return "Your vendor account is suspended. Contact an administrator.";
  }
  return "Your vendor account is not active.";
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const secret = process.env.JWT_SECRET || "dev_secret";
    const payload = jwt.verify(token, secret) as { userId: string };
    const uid = String(payload.userId);

    const cached = getCachedAuthUser(uid);
    if (cached) {
      req.user = cached;
      return next();
    }

    const user = await User.findById(uid).select("-password").lean();
    if (!user) {
      return res.status(401).json({ message: "Invalid or inactive user" });
    }

    const vendorMeAllowlist = isPendingVendorAllowlistRoute(req);
    const vendorId = user.vendorProfile;

    if (user.role === "VENDOR" && vendorId) {
      const vendor = await Vendor.findById(vendorId).select("status").lean();
      if (vendor && vendor.status !== "approved") {
        if (!vendorMeAllowlist) {
          return res.status(403).json({ message: vendorGateMessage(vendor.status) });
        }
        const u = user as unknown as IUser;
        setCachedAuthUser(uid, u, true);
        req.user = u;
        return next();
      }
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Invalid or inactive user" });
    }

    const u = user as unknown as IUser;
    setCachedAuthUser(uid, u, false);
    req.user = u;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const authorize =
  (roles: UserRole[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
