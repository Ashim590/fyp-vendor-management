import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser, UserRole } from "../models/User";
import Vendor from "../models/Vendor";
import {
  getCachedAuthUser,
  setCachedAuthUser,
} from "../utils/authUserCache";
import { perfLabel } from "../utils/perfTiming";
import { getJwtSecret } from "../config/secrets";

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

/** Coalesce concurrent cache-miss user lookups (e.g. strict-mode double fetch). */
const authUserLookupInflight = new Map<string, Promise<IUser | null>>();

async function loadUserForAuth(uid: string): Promise<IUser | null> {
  const hit = authUserLookupInflight.get(uid);
  if (hit) return hit;
  const p = User.findById(uid)
    // Exclude heavy fields (e.g. base64 profilePhoto) from auth hot path.
    .select("-password -profilePhoto")
    .lean()
    .then((u) => (u as unknown as IUser) ?? null)
    .finally(() => {
      authUserLookupInflight.delete(uid);
    });
  authUserLookupInflight.set(uid, p);
  return p;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const perfOn =
    process.env.AUTH_PERF_LOG === "1" ||
    process.env.AUTH_PERF_LOG === "true" ||
    process.env.API_PERF_LOG === "1" ||
    process.env.API_PERF_LOG === "true";
  const authPath = (req.originalUrl || req.url || "").split("?")[0];
  const authPerfLabel = perfOn
    ? perfLabel(`AUTH ${req.method} ${authPath}`)
    : "";
  if (perfOn) console.time(authPerfLabel);

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (perfOn) console.timeEnd(authPerfLabel);
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, getJwtSecret()) as { userId: string };
    const uid = String(payload.userId);

    const cached = getCachedAuthUser(uid);
    if (cached) {
      req.user = cached;
      if (perfOn) console.timeEnd(authPerfLabel);
      return next();
    }

    const user = await loadUserForAuth(uid);
    if (!user) {
      if (perfOn) console.timeEnd(authPerfLabel);
      return res.status(401).json({ message: "Invalid or inactive user" });
    }

    const vendorMeAllowlist = isPendingVendorAllowlistRoute(req);
    const vendorId = user.vendorProfile;

    if (user.role === "VENDOR" && vendorId) {
      const vendor = await Vendor.findById(vendorId).select("status").lean();
      if (vendor && vendor.status !== "approved") {
        if (!vendorMeAllowlist) {
          if (perfOn) console.timeEnd(authPerfLabel);
          return res.status(403).json({ message: vendorGateMessage(vendor.status) });
        }
        const u = user as unknown as IUser;
        setCachedAuthUser(uid, u, true);
        req.user = u;
        if (perfOn) console.timeEnd(authPerfLabel);
        return next();
      }
    }

    if (!user.isActive) {
      if (perfOn) console.timeEnd(authPerfLabel);
      return res.status(401).json({ message: "Invalid or inactive user" });
    }

    const u = user as unknown as IUser;
    setCachedAuthUser(uid, u, false);
    req.user = u;
    if (perfOn) console.timeEnd(authPerfLabel);
    next();
  } catch (err) {
    if (perfOn) console.timeEnd(authPerfLabel);
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
