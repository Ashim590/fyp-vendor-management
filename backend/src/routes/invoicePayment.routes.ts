import { Router, Response } from "express";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import Invoice from "../models/Invoice";
import InvoicePayment from "../models/InvoicePayment";
import Vendor from "../models/Vendor";
import Notification from "../models/Notification";
import User from "../models/User";
import { ensureDeliveryForInvoicePayment } from "../utils/deliveryFromPayment";
import { ensureInvoiceForPaidInvoicePayment } from "../utils/invoiceFromTenderPayment";
import {
  assertSandboxCheckoutReachable,
  getEsewaConfig,
  signEsewaPayload,
  verifyEsewaCallbackSignature,
  decodeEsewaCallbackData,
  checkEsewaTransactionStatus,
} from "../services/esewa";

const router = Router();

function safeRedirect(res: Response, url: string) {
  res.setHeader("Cache-Control", "no-store");
  return res.redirect(302, url);
}

function toTwoDecimals(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
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
  authorize(["PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res: Response) => {
    const { invoiceId } = req.body || {};
    if (!invoiceId)
      return res.status(400).json({ message: "invoiceId is required" });

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.status !== "approved") {
      return res
        .status(400)
        .json({ message: "Invoice must be approved before payment" });
    }

    const existing = await InvoicePayment.findOne({
      invoice: invoice._id,
      status: { $in: ["PENDING", "PAID"] },
    });
    if (existing) {
      return res.status(400).json({
        message: "An active payment already exists for this invoice",
        payment: existing,
      });
    }

    const cfg = getEsewaConfig();
    const transactionUuid = `inv-${String(invoice._id)}-${Date.now()}`.replace(
      /[^A-Za-z0-9-]/g,
      "-",
    );

    const vendor = await Vendor.findById(invoice.vendor).select(
      "registrationNumber",
    );
    const payment = await InvoicePayment.create({
      invoice: invoice._id,
      vendor: invoice.vendor,
      vendorRegistrationNumber: String(vendor?.registrationNumber || ""),
      amount: Number(invoice.totalAmount || 0),
      status: "PENDING",
      transactionUuid,
      productCode: cfg.productCode,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });

    const vendorUser = await User.findOne({ vendorProfile: invoice.vendor });
    if (vendorUser) {
      await Notification.create({
        user: vendorUser._id,
        title: "Invoice payment initiated",
        body: `An eSewa payment has been initiated for invoice ${invoice.invoiceNumber} (NPR ${payment.amount}).`,
        link: "/invoices",
        type: "invoice_payment_pending",
      });
    }

    return res.status(201).json({ success: true, payment });
  },
);

router.get(
  "/by-invoice/:invoiceId",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  async (req: AuthRequest, res: Response) => {
    const { invoiceId } = req.params;
    const invoice = await Invoice.findById(invoiceId).select("vendor");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (
      req.user?.role === "VENDOR" &&
      String(req.user.vendorProfile) !== String(invoice.vendor)
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const payment = await InvoicePayment.findOne({ invoice: invoiceId }).sort({
      createdAt: -1,
    });
    return res.json({ success: true, payment });
  },
);

router.get(
  "/:paymentId",
  authenticate,
  authorize(["ADMIN", "PROCUREMENT_OFFICER", "VENDOR"]),
  async (req: AuthRequest, res: Response) => {
    const payment = await InvoicePayment.findById(req.params.paymentId)
      .populate("invoice")
      .populate("vendor", "name");
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (
      req.user?.role === "VENDOR" &&
      String(req.user.vendorProfile) !== String(payment.vendor)
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return res.json({ success: true, payment });
  },
);

router.post(
  "/:paymentId/esewa/initiate",
  authenticate,
  authorize(["PROCUREMENT_OFFICER"]),
  async (req: AuthRequest, res: Response) => {
    const payment = await InvoicePayment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    if (payment.status !== "PENDING") {
      return res.status(400).json({ message: "Payment is not pending" });
    }

    const cfg = getEsewaConfig();
    if (!cfg.secretKey) {
      return res
        .status(500)
        .json({ message: "eSewa secret key not configured" });
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

    const freshTransactionUuid = generateEsewaTransactionUuid(
      "inv",
      String(payment._id),
    );
    const amount = toTwoDecimals(amountNumber);
    const signedFieldNames = "total_amount,transaction_uuid,product_code";
    const payload: Record<string, string> = {
      amount,
      tax_amount: "0",
      total_amount: amount,
      transaction_uuid: freshTransactionUuid,
      product_code: payment.productCode,
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: cfg.successUrl,
      failure_url: cfg.failureUrl,
      signed_field_names: signedFieldNames,
    };
    payload.signature = signEsewaPayload(
      cfg.secretKey,
      payload,
      signedFieldNames,
    );

    payment.transactionUuid = freshTransactionUuid;
    payment.updatedBy = req.user?._id;
    await payment.save();

    return res.json({ success: true, checkoutUrl: cfg.checkoutUrl, payload });
  },
);

router.all("/esewa/success", async (req: AuthRequest, res: Response) => {
  const cfg = getEsewaConfig();
  const encoded =
    (req.query as { data?: string }).data ||
    (req.body as { data?: string })?.data ||
    "";
  if (!encoded || typeof encoded !== "string") {
    return res.status(400).send("Missing callback data");
  }

  try {
    const { decoded, decodedString } = decodeEsewaCallbackData(encoded);
    if (!verifyEsewaCallbackSignature(cfg.secretKey, decoded)) {
      return res.status(400).send("Invalid signature");
    }

    const transactionUuid = String(decoded.transaction_uuid || "").trim();
    if (!transactionUuid)
      return res.status(400).send("Missing transaction_uuid");

    const payment = await InvoicePayment.findOne({ transactionUuid });
    if (!payment) return res.status(404).send("Payment not found");

    payment.esewaCallbackRaw = decodedString;
    payment.esewaTransactionCode = String(decoded.transaction_code || "");
    payment.esewaStatusRaw = String(decoded.status || "");
    await payment.save();

    const verifyRes = await checkEsewaTransactionStatus({
      statusUrlBase: cfg.statusUrlBase,
      productCode: payment.productCode,
      transactionUuid: payment.transactionUuid,
      totalAmount: toTwoDecimals(Number(payment.amount || 0)),
    });

    const esewaStatus = String(verifyRes.status || "").toUpperCase();

    if (esewaStatus === "COMPLETE") {
      payment.status = "PAID";
      payment.esewaRefId = String(
        verifyRes.refId ?? (verifyRes as { ref_id?: string }).ref_id ?? "",
      );
      payment.verifiedAt = new Date();
      await payment.save();

      const invoice = await ensureInvoiceForPaidInvoicePayment(payment);
      const payFresh = await InvoicePayment.findById(payment._id);
      if (invoice && payFresh) {
        await ensureDeliveryForInvoicePayment(payFresh, invoice).catch((e) =>
          console.error("ensureDeliveryForInvoicePayment", e),
        );
        const vendorUser = await User.findOne({
          vendorProfile: invoice.vendor,
        });
        if (vendorUser) {
          await Notification.create({
            user: vendorUser._id,
            title: "Invoice paid",
            body: `Invoice ${invoice.invoiceNumber} has been paid via eSewa (NPR ${payment.amount}). View it under Invoices.`,
            link: "/invoices",
            type: "invoice_payment_paid",
          });
        }
      }

      const url = new URL(cfg.clientReturnSuccessUrl);
      url.searchParams.set("paymentId", String(payment._id));
      url.searchParams.set("transactionUuid", payment.transactionUuid);
      url.searchParams.set("status", payment.status);
      return safeRedirect(res, url.toString());
    }

    if (
      ["CANCELED", "NOT_FOUND", "FULL_REFUND", "PARTIAL_REFUND"].includes(
        esewaStatus,
      )
    ) {
      payment.status = "FAILED";
      payment.verifiedAt = new Date();
      await payment.save();
    }

    const url = new URL(cfg.clientReturnFailureUrl);
    url.searchParams.set("paymentId", String(payment._id));
    url.searchParams.set("transactionUuid", payment.transactionUuid);
    url.searchParams.set("status", payment.status);
    url.searchParams.set("esewaStatus", esewaStatus || "UNKNOWN");
    return safeRedirect(res, url.toString());
  } catch (err) {
    console.error(err);
    return res.status(500).send("Error processing callback");
  }
});

router.all("/esewa/failure", async (req: AuthRequest, res: Response) => {
  const cfg = getEsewaConfig();
  const encoded =
    (req.query as { data?: string }).data ||
    (req.body as { data?: string })?.data ||
    "";
  let transactionUuid: string | null = null;
  if (encoded) {
    try {
      const { decoded } = decodeEsewaCallbackData(encoded);
      transactionUuid = String(decoded.transaction_uuid || "").trim() || null;
    } catch {
      transactionUuid = null;
    }
  }

  if (transactionUuid) {
    const payment = await InvoicePayment.findOne({ transactionUuid });
    if (payment && payment.status === "PENDING") {
      payment.status = "FAILED";
      payment.verifiedAt = new Date();
      await payment.save();
    }
  }

  const url = new URL(cfg.clientReturnFailureUrl);
  if (transactionUuid) url.searchParams.set("transactionUuid", transactionUuid);
  url.searchParams.set("status", "FAILED");
  return safeRedirect(res, url.toString());
});

export default router;
