import { Router, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import Payment from "../models/Payment";
import Tender from "../models/Tender";
import Bid from "../models/Bid";
import Vendor from "../models/Vendor";
import User from "../models/User";
import Notification from "../models/Notification";
import { ensureDeliveryForTenderPayment } from "../utils/deliveryFromPayment";
import { ensureInvoiceForTenderPayment } from "../utils/invoiceFromTenderPayment";
import { invalidateStaffSummaryCache } from "../utils/staffDashboardCache";
import { invalidateAdminDashboardCache } from "../utils/adminDashboardCache";
import {
  assertSandboxCheckoutReachable,
  checkEsewaTransactionStatus,
  getEsewaConfig,
  getPublicBaseUrls,
  signEsewaPayload,
} from "../services/esewa";
import { parseListLimit } from "../utils/cursorPagination";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

function tenderEsewaUrls(): { successUrl: string; failureUrl: string } {
  const { serverBaseUrl, clientBaseUrl } = getPublicBaseUrls();
  return {
    successUrl:
      process.env.ESEWA_TENDER_SUCCESS_URL ||
      `${serverBaseUrl}/api/v1/payment/esewa/callback`,
    failureUrl:
      process.env.ESEWA_TENDER_FAILURE_URL ||
      `${clientBaseUrl}/my-payments?paymentStatus=cancelled`,
  };
}

/**
 * eSewa redirects with ?data=<base64> appended to success_url. If success_url already
 * contained ?paymentId=..., the result is ...?paymentId=x?data=y and `data` is never parsed.
 * Use path: .../callback/<paymentId> so eSewa produces .../callback/<id>?data=... .
 */
function buildTenderEsewaSuccessUrl(paymentId: string): string {
  const raw = process.env.ESEWA_TENDER_SUCCESS_URL?.trim();
  const { serverBaseUrl } = getPublicBaseUrls();
  const fallbackBase = `${serverBaseUrl.replace(/\/+$/, "")}/api/v1/payment/esewa/callback`;
  const base = (raw || fallbackBase).split("?")[0].replace(/\/+$/, "");
  return `${base}/${encodeURIComponent(paymentId)}`;
}

function getEsewaConfigForTenderPayment() {
  const cfg = getEsewaConfig();
  const { successUrl, failureUrl } = tenderEsewaUrls();
  return { ...cfg, successUrl, failureUrl };
}

function normalizeAmountString(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const fixed = value.toFixed(2);
  return fixed.endsWith(".00") ? String(Math.trunc(value)) : fixed;
}

function amountsEqualForEsewa(a: number, decodedTotal: unknown): boolean {
  if (decodedTotal == null || decodedTotal === "") return true;
  const x = Number(a);
  const y = Number(decodedTotal);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) < 0.005;
}

function generateEsewaTransactionUuid(prefix: string, id: string): string {
  const raw = `${prefix}-${id}-${Date.now()}`;
  return raw.replace(/[^A-Za-z0-9-]/g, "-");
}

function isSandboxAmountOverLimit(mode: string, amount: number): boolean {
  return mode === "sandbox" && Number.isFinite(amount) && amount > 100_000;
}

router.post(
  "/create",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  upload.single("qrImage"),
  async (req: AuthRequest, res: Response) => {
    const { tenderId, vendorId, amount, bidId, notes } = req.body || {};
    if (!tenderId || !vendorId || amount == null) {
      return res.status(400).json({
        message: "tenderId, vendorId and amount are required",
      });
    }
    const tender = await Tender.findById(tenderId);
    if (!tender) return res.status(404).json({ message: "Tender not found" });
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const existing = await Payment.findOne({
      tender: tender._id,
      vendor: vendor._id,
    });
    if (existing) {
      return res.status(400).json({
        message: "Payment already exists for this tender and vendor",
      });
    }

    let selectedBid = null;
    if (bidId) {
      selectedBid = await Bid.findById(bidId);
      if (!selectedBid)
        return res.status(404).json({ message: "Bid not found" });
    }

    const payment = new Payment({
      tender: tender._id,
      tenderReference: tender.referenceNumber || tender.title,
      bid: selectedBid?._id,
      vendor: vendor._id,
      vendorName: vendor.name,
      vendorRegistrationNumber: vendor.registrationNumber || "",
      amount: Number(amount),
      status: "Pending",
      method: "eSewa",
      provider: "eSewa",
      transactionId: "",
      payerMobileNumber: "",
      qrImage: "",
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
      notes: notes || "",
    });
    await payment.save();
    invalidateStaffSummaryCache();
    invalidateAdminDashboardCache();

    const vendorUser = await User.findOne({ vendorProfile: vendor._id });
    if (vendorUser) {
      await Notification.create({
        user: vendorUser._id,
        title: "Tender payment status update",
        body: `Payment status for tender ${payment.tenderReference} is pending (NPR ${payment.amount}). Procurement will complete payment; you can track status in My payments.`,
        link: "/my-payments",
        type: "payment_pending",
      });
    }

    res.status(201).json({ success: true, payment: payment.toObject() });
  },
);

router.get(
  "/",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, tenderId } = req.query || {};
      const query: Record<string, unknown> = {};
      if (status && typeof status === "string") query.status = status;
      if (tenderId && typeof tenderId === "string") query.tender = tenderId;
      const lim = parseListLimit(req.query.limit, 80, 200);

      const payments = await Payment.find(query)
        .sort({ createdAt: -1 })
        .limit(lim)
        .select("-gatewayResponseRaw -qrImage")
        .populate("tender", "title referenceNumber status")
        .populate("vendor", "name email")
        .lean();

      return res.json({ success: true, payments });
    } catch (err) {
      console.error("GET /api/v1/payment", err);
      return res.status(500).json({
        success: false,
        message: "Could not load payments.",
      });
    }
  },
);

router.get(
  "/my",
  authenticate,
  authorize(["VENDOR"]),
  async (req: AuthRequest, res: Response) => {
    if (!req.user?.vendorProfile) {
      return res.json({ success: true, payments: [] });
    }
    const lim = parseListLimit(req.query.limit, 80, 200);
    const payments = await Payment.find({ vendor: req.user.vendorProfile })
      .sort({ createdAt: -1 })
      .limit(lim)
      .select("-gatewayResponseRaw -qrImage")
      .populate("tender", "title referenceNumber status")
      .lean();
    res.json({ success: true, payments });
  },
);

router.get(
  "/summary",
  authenticate,
  authorize(["ADMIN"]),
  async (_req: AuthRequest, res: Response) => {
    const [total, pending, completed, failed, totalAmount] = await Promise.all([
      Payment.countDocuments(),
      Payment.countDocuments({ status: "Pending" }),
      Payment.countDocuments({ status: "Completed" }),
      Payment.countDocuments({ status: "Failed" }),
      Payment.aggregate([{ $group: { _id: null, sum: { $sum: "$amount" } } }]),
    ]);
    res.json({
      success: true,
      summary: {
        total,
        pending,
        completed,
        failed,
        totalAmount: totalAmount?.[0]?.sum || 0,
      },
    });
  },
);

router.get(
  "/:paymentId",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  async (req: AuthRequest, res: Response) => {
    const payment = await Payment.findById(req.params.paymentId)
      .populate("tender", "title referenceNumber status")
      .populate("vendor", "name email");
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (
      req.user?.role === "VENDOR" &&
      String(payment.vendor) !== String(req.user.vendorProfile)
    ) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    res.json({ success: true, payment });
  },
);

router.patch(
  "/:paymentId/status",
  authenticate,
  authorize(["PROCUREMENT_OFFICER"]),
  async (_req: AuthRequest, res: Response) => {
    return res.status(410).json({
      message:
        "Manual payment status updates are disabled. Use eSewa only; status updates occur after server-side verification.",
    });
  },
);

router.post(
  "/:paymentId/esewa/initiate",
  authenticate,
  authorize(["PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res: Response) => {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    if (payment.status !== "Pending") {
      return res.status(400).json({
        message: "Only pending payments can be initiated via eSewa",
      });
    }

    const cfg = getEsewaConfigForTenderPayment();
    if (!cfg.secretKey) {
      return res.status(500).json({
        message:
          "eSewa is not configured. Set ESEWA_SECRET_KEY for production.",
      });
    }

    if (cfg.mode === "sandbox") {
      try {
        await assertSandboxCheckoutReachable(cfg.checkoutUrl);
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "eSewa sandbox checkout is unreachable";
        return res.status(503).json({ success: false, message });
      }
    }

    const amountNumber = Number(payment.amount || 0);
    if (isSandboxAmountOverLimit(cfg.mode, amountNumber)) {
      return res.status(400).json({
        message:
          "Sandbox limit exceeded. Maximum allowed amount is NPR 100000 per transaction.",
      });
    }

    const transactionUuid = generateEsewaTransactionUuid(
      "pay",
      String(payment._id),
    );
    const amount = normalizeAmountString(amountNumber);
    const taxAmount = "0";
    const totalAmount = amount;
    const signedFieldNames = "total_amount,transaction_uuid,product_code";

    const successUrlForForm = buildTenderEsewaSuccessUrl(String(payment._id));

    const payload: Record<string, string> = {
      amount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      transaction_uuid: transactionUuid,
      product_code: cfg.productCode,
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: successUrlForForm,
      failure_url: cfg.failureUrl,
      signed_field_names: signedFieldNames,
    };
    payload.signature = signEsewaPayload(
      cfg.secretKey,
      payload,
      signedFieldNames,
    );

    await Payment.findByIdAndUpdate(payment._id, {
      $set: {
        gatewayProvider: "eSewa",
        gatewayTransactionUuid: transactionUuid,
        method: "eSewa",
        provider: "eSewa",
        updatedBy: req.user?._id,
        esewaReturnTo: "staff",
      },
      $addToSet: { esewaTransactionUuidHistory: transactionUuid },
    });

    return res.json({
      success: true,
      mode: cfg.mode,
      checkoutUrl: cfg.checkoutUrl,
      payload,
    });
  },
);

async function tenderEsewaCallbackHandler(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  try {
    const cfg = getEsewaConfigForTenderPayment();
    if (!cfg.secretKey) {
      res
        .status(500)
        .json({ message: "eSewa not configured", success: false });
      return;
    }

    const params = req.params as { paymentId?: string };
    const paymentIdFromPath =
      typeof params.paymentId === "string" ? params.paymentId.trim() : "";

    const q = req.query as { data?: string; paymentId?: string };
    const bodyData = (req.body as { data?: string } | undefined)?.data;
    let encoded =
      (typeof q.data === "string" ? q.data : "") ||
      (typeof bodyData === "string" ? bodyData : "");

    const rawPid = typeof q.paymentId === "string" ? q.paymentId.trim() : "";
    let paymentIdFromQuery = "";

    if (!encoded && rawPid.includes("?data=")) {
      const idx = rawPid.indexOf("?data=");
      paymentIdFromQuery = rawPid.slice(0, idx).trim();
      encoded = rawPid.slice(idx + "?data=".length).trim();
    } else {
      paymentIdFromQuery = rawPid;
    }

    const paymentIdHint =
      (paymentIdFromPath &&
      mongoose.Types.ObjectId.isValid(paymentIdFromPath)
        ? paymentIdFromPath
        : "") ||
      (paymentIdFromQuery &&
      mongoose.Types.ObjectId.isValid(paymentIdFromQuery)
        ? paymentIdFromQuery
        : "");

    if (!encoded || typeof encoded !== "string") {
      res
        .status(400)
        .json({ message: "Missing callback data", success: false });
      return;
    }

    let decodedString = "";
    let decoded: Record<string, unknown> = {};
    try {
      decodedString = Buffer.from(encoded, "base64").toString("utf8");
      decoded = JSON.parse(decodedString) as Record<string, unknown>;
    } catch {
      res.status(400).json({ message: "Invalid callback payload", success: false });
      return;
    }

    const signedFieldNames = String(
      decoded.signed_field_names ||
        "transaction_uuid,total_amount,product_code",
    );
    const expectedSignature = signEsewaPayload(
      cfg.secretKey,
      Object.fromEntries(
        Object.entries(decoded).map(([k, v]) => [
          k,
          v == null ? "" : String(v),
        ]),
      ),
      signedFieldNames,
    );
    const isVerified = expectedSignature === String(decoded.signature || "");
    if (!isVerified) {
      res.status(400).json({ message: "Invalid signature", success: false });
      return;
    }

    const transactionUuid =
      decoded.transaction_uuid == null
        ? ""
        : String(decoded.transaction_uuid).trim();
    if (!transactionUuid) {
      res
        .status(400)
        .json({ message: "Missing transaction_uuid", success: false });
      return;
    }

    const payment = await Payment.findOne({
      $or: [
        { gatewayTransactionUuid: transactionUuid },
        { esewaTransactionUuidHistory: transactionUuid },
      ],
    });
    if (!payment) {
      res
        .status(404)
        .json({ message: "Payment not found for callback", success: false });
      return;
    }

    if (paymentIdHint && String(payment._id) !== paymentIdHint) {
      res.status(400).json({
        message: "paymentId does not match transaction",
        success: false,
      });
      return;
    }

    const decodedProduct =
      decoded.product_code == null ? "" : String(decoded.product_code).trim();
    if (decodedProduct && decodedProduct !== cfg.productCode) {
      res.status(400).json({ message: "product_code mismatch", success: false });
      return;
    }

    if (
      !amountsEqualForEsewa(Number(payment.amount || 0), decoded.total_amount)
    ) {
      res.status(400).json({ message: "total_amount mismatch", success: false });
      return;
    }

    const amount = normalizeAmountString(Number(payment.amount || 0));

    let statusCheck: Record<string, unknown> | null = null;
    try {
      statusCheck = await checkEsewaTransactionStatus({
        statusUrlBase: cfg.statusUrlBase,
        productCode: cfg.productCode,
        totalAmount: amount,
        transactionUuid,
      });
    } catch {
      res.status(502).json({
        message: "Failed to verify eSewa transaction status",
        success: false,
      });
      return;
    }

    const statusRaw = String(
      statusCheck?.status || decoded.status || "",
    ).toUpperCase();
    const isSuccess = statusRaw === "COMPLETE";

    payment.gatewayProvider = "eSewa";
    payment.gatewayResponseRaw = decodedString;
    payment.transactionId = String(
      statusCheck?.refId ||
        statusCheck?.ref_id ||
        decoded.transaction_code ||
        payment.transactionId ||
        "",
    );
    payment.paymentDate = isSuccess ? new Date() : payment.paymentDate;
    payment.status = isSuccess ? "Completed" : "Failed";
    await payment.save();
    invalidateStaffSummaryCache();

    if (isSuccess) {
      await ensureDeliveryForTenderPayment(payment).catch((e) =>
        console.error("ensureDeliveryForTenderPayment", e),
      );
      await ensureInvoiceForTenderPayment(payment).catch((e) =>
        console.error("ensureInvoiceForTenderPayment", e),
      );
    }

    const vendorUser = await User.findOne({ vendorProfile: payment.vendor });
    if (vendorUser) {
      await Notification.create({
        user: vendorUser._id,
        title: isSuccess ? "Invoice generated" : "Payment failed",
        body: isSuccess
          ? `Payment of NPR ${payment.amount} for tender ${payment.tenderReference} is complete. Your invoice has been generated and is ready under Invoices.`
          : `Payment for tender ${payment.tenderReference} could not be verified.`,
        link: isSuccess ? "/invoices" : "/my-payments",
        type: isSuccess ? "payment_completed" : "payment_failed",
      });
    }

    const { clientBaseUrl } = getPublicBaseUrls();
    const returnPath =
      payment.esewaReturnTo === "vendor"
        ? "/my-payments"
        : "/procurement/payments";
    const redirectUrl = new URL(`${clientBaseUrl}${returnPath}`);
    redirectUrl.searchParams.set(
      "paymentStatus",
      isSuccess ? "completed" : "failed",
    );
    redirectUrl.searchParams.set("paymentId", String(payment._id));
    redirectUrl.searchParams.set("transactionUuid", transactionUuid);
    res.redirect(302, redirectUrl.toString());
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Error processing eSewa callback", success: false });
  }
}

/** Path form must be registered first so `/esewa/callback` does not swallow `/esewa/callback/:id`. */
router.all("/esewa/callback/:paymentId", tenderEsewaCallbackHandler);
router.all("/esewa/callback", tenderEsewaCallbackHandler);

export default router;
