import mongoose from 'mongoose';
import Invoice from '../models/Invoice';
import Vendor from '../models/Vendor';
import Payment from '../models/Payment';
import InvoicePayment from '../models/InvoicePayment';
import type { IPayment } from '../models/Payment';
import type { IInvoicePayment } from '../models/InvoicePayment';
import type { IInvoice } from '../models/Invoice';

/**
 * After a tender (award) eSewa payment completes, create a paid invoice so it appears
 * under Invoices with PDF download — without requiring an existing purchase order.
 */
export async function ensureInvoiceForTenderPayment(payment: IPayment): Promise<void> {
  if (String(payment.status || '') !== 'Completed') return;

  const existing = await Invoice.findOne({ tenderPayment: payment._id });
  if (existing) return;

  const amt = Number(payment.amount || 0);
  const lineTitle = payment.tenderReference || 'Tender award';
  const items = [
    {
      itemName: lineTitle,
      description: `Tender fee / settlement via eSewa${payment.transactionId ? ` (ref: ${payment.transactionId})` : ''}`,
      quantity: 1,
      unit: 'lot',
      unitPrice: amt,
      totalPrice: amt,
      specifications: payment.paymentNumber || '',
    },
  ];

  const paidAt = payment.paymentDate ? new Date(payment.paymentDate) : new Date();

  const inv = new Invoice({
    vendor: payment.vendor,
    vendorName: payment.vendorName,
    purchaseOrderNumber: payment.tenderReference || payment.paymentNumber || 'TENDER',
    items,
    issueDate: paidAt,
    dueDate: paidAt,
    status: 'paid',
    paidAt,
    tender: payment.tender,
    bid: payment.bid,
    tenderPayment: payment._id,
  });

  try {
    await inv.save();
    console.info('[invoice] Created from tender payment', inv.invoiceNumber, String(payment._id));
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: number }).code : 0;
    if (code === 11000) return;
    throw e;
  }
}

/**
 * After invoice eSewa payment is verified (COMPLETE), finalize the invoice in DB (paid, paidAt,
 * settlement link). If the referenced invoice is missing, create a paid invoice from the gateway
 * record so the Invoices page always has a row.
 */
export async function ensureInvoiceForPaidInvoicePayment(
  invPay: mongoose.HydratedDocument<IInvoicePayment>,
): Promise<mongoose.HydratedDocument<IInvoice> | null> {
  if (String(invPay.status || '') !== 'PAID') return null;

  const paidAt = invPay.verifiedAt ? new Date(invPay.verifiedAt) : new Date();

  const already = await Invoice.findOne({ settledByInvoicePayment: invPay._id });
  if (already) {
    if (already.status !== 'paid') {
      already.status = 'paid';
      already.paidAt = paidAt;
      await already.save();
    }
    return already as mongoose.HydratedDocument<IInvoice>;
  }

  let inv = await Invoice.findById(invPay.invoice);

  if (inv) {
    inv.status = 'paid';
    inv.paidAt = paidAt;
    inv.settledByInvoicePayment = invPay._id;
    await inv.save();
    console.info('[invoice] Marked paid from eSewa', inv.invoiceNumber, String(invPay._id));
    return inv as mongoose.HydratedDocument<IInvoice>;
  }

  const vendor = await Vendor.findById(invPay.vendor).select('name').lean();
  const vendorName = vendor?.name || 'Vendor';
  const amt = Number(invPay.amount || 0);
  const ref = invPay.esewaRefId || invPay.transactionUuid;

  const invNew = new Invoice({
    vendor: invPay.vendor,
    vendorName,
    purchaseOrderNumber: `ESEWA-${String(invPay.transactionUuid).slice(0, 24)}`,
    items: [
      {
        itemName: 'Supplier invoice (eSewa)',
        description: `Verified via eSewa${ref ? ` — ref: ${ref}` : ''}`,
        quantity: 1,
        unit: 'payment',
        unitPrice: amt,
        totalPrice: amt,
        specifications: String(invPay._id),
      },
    ],
    issueDate: paidAt,
    dueDate: paidAt,
    status: 'paid',
    paidAt,
    settledByInvoicePayment: invPay._id,
  });

  try {
    await invNew.save();
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code: number }).code : 0;
    if (code === 11000) {
      const retry = await Invoice.findOne({ settledByInvoicePayment: invPay._id });
      return retry as mongoose.HydratedDocument<IInvoice> | null;
    }
    throw e;
  }

  invPay.invoice = invNew._id;
  await invPay.save();
  console.info('[invoice] Created from verified InvoicePayment (orphan recovery)', invNew.invoiceNumber);
  return invNew as mongoose.HydratedDocument<IInvoice>;
}

/**
 * Backfill: create tender-fee invoices for Completed payments missing one, and finalize invoices for PAID InvoicePayment rows.
 * Use after deploying auto-invoice logic or if a callback failed silently.
 */
export async function reconcileInvoicesFromVerifiedPayments(): Promise<{
  tenderPaymentsScanned: number;
  tenderInvoicesCreated: number;
  invoicePaymentsScanned: number;
  invoiceRowsEnsured: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let tenderInvoicesCreated = 0;

  const completed = await Payment.find({ status: 'Completed' });
  for (const p of completed) {
    const had = await Invoice.findOne({ tenderPayment: p._id });
    try {
      await ensureInvoiceForTenderPayment(p);
      if (!had && (await Invoice.findOne({ tenderPayment: p._id }))) {
        tenderInvoicesCreated += 1;
      }
    } catch (e) {
      errors.push(`Payment ${String(p._id)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  let invoiceRowsEnsured = 0;
  const paidGateways = await InvoicePayment.find({ status: 'PAID' });
  for (const ip of paidGateways) {
    try {
      const out = await ensureInvoiceForPaidInvoicePayment(ip);
      if (out) invoiceRowsEnsured += 1;
    } catch (e) {
      errors.push(`InvoicePayment ${String(ip._id)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    tenderPaymentsScanned: completed.length,
    tenderInvoicesCreated,
    invoicePaymentsScanned: paidGateways.length,
    invoiceRowsEnsured,
    errors,
  };
}
