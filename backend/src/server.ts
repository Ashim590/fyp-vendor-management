/** Patches Express to forward rejected Promises from async route handlers to error middleware. */
import "express-async-errors";
/** Side effect: wrap Notification.insertMany so optional SMTP emails fire (runs before routes). */
import "./utils/notificationInsertManyEmailPatch";
import fs from "fs";
import path from "path";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { Server } from "http";
import cors, { type CorsOptions } from "cors";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import vendorRoutes from "./routes/vendor.routes";
import tenderRoutes from "./routes/tender.routes";
import bidRoutes from "./routes/bid.routes";
import settingsRoutes from "./routes/settings.routes";
import notificationRoutes from "./routes/notification.routes";
import reportRoutes from "./routes/report.routes";
import adminVendorsRoutes from "./routes/admin-vendors.routes";
import auditLogRoutes from "./routes/audit-log.routes";
import purchaseRequestRoutes from "./routes/purchaseRequest.routes";
import quotationRoutes from "./routes/quotation.routes";
import approvalRoutes from "./routes/approval.routes";
import purchaseOrderRoutes from "./routes/purchaseOrder.routes";
import deliveryRoutes from "./routes/delivery.routes";
import invoiceRoutes from "./routes/invoice.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import sessionRoutes from "./routes/session.routes";
import paymentRoutes from "./routes/payment.routes";
import invoicePaymentRoutes from "./routes/invoicePayment.routes";
import vendorReviewRoutes from "./routes/vendorReview.routes";
import { apiPerfLogMiddleware } from "./middleware/apiPerfLog";
import { swaggerSpec } from "./docs/swagger";

dotenv.config();

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

const app = express();
/** Behind Render/nginx: correct client IP + sane express-rate-limit keying. */
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
/** Avoid 304 Not Modified on JSON APIs — Axios treats 304 as an error by default. */
app.set("etag", false);

const PORT = Number(process.env.PORT) || 5000;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.MONGO_URI?.trim()) {
  console.error(
    "FATAL: MONGO_URI must be set in production (e.g. MongoDB Atlas connection string).",
  );
  process.exit(1);
}

const MONGO_URI =
  process.env.MONGO_URI?.trim() ||
  "mongodb://localhost:27017/paropakar_vendornet";

const defaultClientOrigins =
  "http://localhost:5173,http://localhost:5174,http://localhost:5175";

function normalizeClientOrigins(raw: string): string[] {
  const parsed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parsed.length === 0) return defaultClientOrigins.split(",");
  return parsed;
}

const clientOrigins = normalizeClientOrigins(
  process.env.CLIENT_ORIGINS || defaultClientOrigins,
);

/** JSON API: relax CSP (no HTML); allow cross-origin fetches from separate Vercel origin. */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

/**
 * CORS: allow only listed origins; allow requests with no Origin (curl, mobile apps, server-to-server).
 */
const corsOptions: CorsOptions = {
  origin(
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (clientOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(isProduction ? "tiny" : "dev"));
/** Optional: set API_PERF_LOG=1 for request timing + JSON response size in logs. */
app.use(apiPerfLogMiddleware);

if (isProduction && !process.env.JWT_SECRET?.trim()) {
  console.error("FATAL: JWT_SECRET must be set in production.");
  process.exit(1);
}

/**
 * Broad API rate limit (Render/Railway). Set API_GLOBAL_RATE_LIMIT_MAX=0 to disable.
 * Auth routes still use stricter per-path limits below.
 */
const globalLimitMax = parseInt(
  process.env.API_GLOBAL_RATE_LIMIT_MAX || (isProduction ? "400" : "0"),
  10,
);
if (globalLimitMax > 0) {
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: globalLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many requests, please try again later." },
      skip: (req) => {
        const p = req.originalUrl.split("?")[0];
        return req.method === "OPTIONS" || p === "/api/health";
      },
    }),
  );
}

function logDeployConfigHints() {
  const isLocalhost = (v: string) =>
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(v);

  if (isProduction && clientOrigins.every(isLocalhost)) {
    console.warn(
      "[deploy] CLIENT_ORIGINS looks localhost-only; browser CORS calls from your real frontend domain may fail.",
    );
  }
  if (isProduction && /localhost|127\.0\.0\.1/i.test(MONGO_URI)) {
    console.warn(
      "[deploy] MONGO_URI points to localhost. Use Atlas or another reachable Mongo instance on hosted environments.",
    );
  }

  const backendUrl = process.env.BACKEND_URL || process.env.SERVER_BASE_URL;
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_BASE_URL;
  if (isProduction && (!backendUrl || !frontendUrl)) {
    console.warn(
      "[deploy] BACKEND_URL/FRONTEND_URL are not fully set. Payment callbacks and redirects may fail in production.",
    );
  }
  if (
    isProduction &&
    backendUrl &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(backendUrl.trim())
  ) {
    console.warn(
      "[deploy] BACKEND_URL still looks like localhost — eSewa callbacks and webhooks need your public API URL.",
    );
  }
  if (
    isProduction &&
    String(process.env.ALLOW_BOOTSTRAP_ADMIN || "").toLowerCase() === "true"
  ) {
    console.warn(
      "[deploy] ALLOW_BOOTSTRAP_ADMIN=true — ensure bootstrap admin routes are not exposed long-term.",
    );
  }
}
logDeployConfigHints();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/register-vendor", authLimiter);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Paropakar VendorNet API",
    time: new Date().toISOString(),
  });
});

app.get("/api-docs.json", (_req, res) => {
  res.json(swaggerSpec);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/** Friendly root when API-only (e.g. Render); skip if CLIENT_DIST_PATH serves the SPA. */
if (!process.env.CLIENT_DIST_PATH?.trim()) {
  app.get("/", (_req, res) => {
    res.json({
      service: "Paropakar VendorNet API",
      message: "JSON API — routes are under /api and /api/v1.",
      health: "/api/health",
    });
  });
}

/**
 * Route versioning: `/api/v1/*` is what the current frontend uses.
 * `/api/*` (without v1) remains mounted for older clients or direct testing — same router instances.
 * Prefer new integrations against `/api/v1/*` only.
 */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/tenders", tenderRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/settings", settingsRoutes);

app.use("/api/v1/tenders", tenderRoutes);
app.use("/api/v1/bids", bidRoutes);
app.use("/api/v1/vendor", vendorRoutes);
app.use("/api/v1/purchase-request", purchaseRequestRoutes);
app.use("/api/v1/quotation", quotationRoutes);
app.use("/api/v1/approval", approvalRoutes);
app.use("/api/v1/purchase-order", purchaseOrderRoutes);
app.use("/api/v1/delivery", deliveryRoutes);
/** Alias kept for client compatibility: POST /api/orders/:id/confirm-delivery */
app.use("/api/orders", deliveryRoutes);
app.use("/api/v1/invoice", invoiceRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/session", sessionRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/invoice-payment", invoicePaymentRoutes);
app.use("/api/v1/audit-log", auditLogRoutes);
app.use("/api/v1/vendor-reviews", vendorReviewRoutes);
app.use("/api/admin/vendors", adminVendorsRoutes);

/**
 * Optional: serve Vite build from the same process (Railway single service).
 * Set CLIENT_DIST_PATH to absolute or repo-relative path containing index.html.
 * For Vercel + Render split, leave unset.
 */
const clientDistPath = process.env.CLIENT_DIST_PATH?.trim();
if (clientDistPath) {
  const abs = path.resolve(clientDistPath);
  const indexFile = path.join(abs, "index.html");
  if (fs.existsSync(indexFile)) {
    app.use(
      express.static(abs, {
        index: false,
        maxAge: isProduction ? "1h" : 0,
      }),
    );
    app.get(/^\/(?!api\b).*/, (req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      res.sendFile(indexFile);
    });
  } else {
    console.warn(
      `[deploy] CLIENT_DIST_PATH=${abs} missing index.html — static hosting skipped.`,
    );
  }
}

function getHttpErrorStatus(err: unknown): number {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: number }).status;
    if (typeof s === "number" && s >= 400 && s < 600) return s;
  }
  if (err && typeof err === "object" && "statusCode" in err) {
    const s = (err as { statusCode?: number }).statusCode;
    if (typeof s === "number" && s >= 400 && s < 600) return s;
  }
  return 500;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Internal Server Error";
}

/** 404 — must be after all route mounts, before error handler. */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
  });
});

/** Global error handler — must be last; 4-arg signature required. */
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status = getHttpErrorStatus(err);
  const publicMessage =
    status === 500 && isProduction
      ? "Internal Server Error"
      : getErrorMessage(err);
  if (status >= 500) {
    console.error(err);
  } else {
    console.warn(getErrorMessage(err));
  }
  res.status(status).json({ message: publicMessage });
});

/** Wire compression helps on high-latency links to Atlas (disable with MONGO_DISABLE_COMPRESSION=1). */
const mongoOptions: mongoose.ConnectOptions = {
  maxPoolSize: 50,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 15_000,
  socketTimeoutMS: 60_000,
};
if (process.env.MONGO_DISABLE_COMPRESSION !== "1") {
  mongoOptions.compressors = ["zlib"];
  mongoOptions.zlibCompressionLevel = 6;
}

let httpServer: Server | null = null;

function shutdown(signal: string): void {
  console.info(`${signal} received, shutting down gracefully`);
  if (!httpServer) {
    void mongoose.disconnect().finally(() => process.exit(0));
    return;
  }
  httpServer.close((closeErr) => {
    if (closeErr) console.error("HTTP server close error:", closeErr);
    mongoose
      .disconnect()
      .then(() => {
        console.info("MongoDB disconnected");
        process.exit(0);
      })
      .catch((e) => {
        console.error("MongoDB disconnect error:", e);
        process.exit(1);
      });
  });
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 15_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose
  .connect(MONGO_URI, mongoOptions)
  .then(async () => {
    if (!isProduction) {
      console.log("Connected to MongoDB");
    }
    try {
      const db = mongoose.connection.getClient().db();
      await db.admin().command({ ping: 1 });
    } catch (e) {
      console.warn(
        "Mongo warm-up ping failed (non-fatal):",
        (e as Error)?.message,
      );
    }
    httpServer = app.listen(PORT, () => {
      if (isProduction) {
        console.info(
          `Paropakar VendorNet API · listening on :${PORT} · CORS ${clientOrigins.length} origin(s)`,
        );
      } else {
        console.log(`Server running on port ${PORT}`);
        console.log(`Allowed CORS origins: ${clientOrigins.join(", ")}`);
      }
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
