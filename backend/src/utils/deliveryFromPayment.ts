import Delivery from '../models/Delivery';
import type { IPayment } from '../models/Payment';
import type { IInvoicePayment } from '../models/InvoicePayment';
import type { IInvoice } from '../models/Invoice';

const DEFAULT_EXPECTED_DAYS = 14;

export async function ensureDeliveryForTenderPayment(payment: IPayment): Promise<void> {
  if (String(payment.status || '') !== 'Completed') return;
  const existing = await Delivery.findOne({ payment: payment._id });
  if (existing) return;

  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + DEFAULT_EXPECTED_DAYS);

  const d = new Delivery({
    payment: payment._id,
    tender: payment.tender,
    orderReference: payment.paymentNumber || String(payment._id),
    purchaseOrderNumber: payment.paymentNumber || '',
    orderRef: payment.paymentNumber || String(payment._id),
    vendor: payment.vendor,
    vendorName: payment.vendorName,
    items: [],
    expectedDate,
    status: 'PENDING',
    statusHistory: [
      {
        status: 'PENDING',
        note: 'Delivery record created after payment completed',
        at: new Date()
      }
    ]
  });
  await d.save();
}

export async function ensureDeliveryForInvoicePayment(
  invPay: IInvoicePayment,
  invoice: IInvoice
): Promise<void> {
  if (String(invPay.status || '') !== 'PAID') return;
  const existing = await Delivery.findOne({ invoicePayment: invPay._id });
  if (existing) return;

  const expectedDate = new Date();
  expectedDate.setDate(expectedDate.getDate() + DEFAULT_EXPECTED_DAYS);

  const plainItems = (invoice.items || []).map((it) => ({
    itemName: it.itemName,
    description: it.description || '',
    quantity: it.quantity,
    unit: it.unit,
    unitPrice: it.unitPrice,
    totalPrice: it.totalPrice,
    specifications: it.specifications || ''
  }));

  const d = new Delivery({
    invoicePayment: invPay._id,
    orderReference: invoice.invoiceNumber || String(invPay._id),
    purchaseOrderNumber: invoice.purchaseOrderNumber || invoice.invoiceNumber || '',
    orderRef: invoice.invoiceNumber || String(invPay._id),
    vendor: invoice.vendor,
    vendorName: invoice.vendorName,
    items: plainItems,
    expectedDate,
    status: 'PENDING',
    statusHistory: [
      {
        status: 'PENDING',
        note: 'Delivery record created after invoice payment',
        at: new Date()
      }
    ]
  });
  await d.save();
}
