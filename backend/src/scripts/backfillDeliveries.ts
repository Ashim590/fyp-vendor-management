import dotenv from 'dotenv';
import mongoose from 'mongoose';

import Payment from '../models/Payment';
import InvoicePayment from '../models/InvoicePayment';
import Invoice from '../models/Invoice';
import { ensureDeliveryForTenderPayment, ensureDeliveryForInvoicePayment } from '../utils/deliveryFromPayment';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/paropakar_vendornet';

async function runBackfill() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  let tenderCreated = 0;
  let tenderSkipped = 0;
  let invoiceCreated = 0;
  let invoiceSkipped = 0;
  let invoiceMissing = 0;

  const completedTenderPayments = await Payment.find({ status: 'Completed' });
  for (const payment of completedTenderPayments) {
    const before = await mongoose.model('Delivery').countDocuments({ payment: payment._id });
    await ensureDeliveryForTenderPayment(payment);
    const after = await mongoose.model('Delivery').countDocuments({ payment: payment._id });
    if (after > before) tenderCreated += 1;
    else tenderSkipped += 1;
  }

  const paidInvoicePayments = await InvoicePayment.find({ status: 'PAID' });
  for (const invoicePayment of paidInvoicePayments) {
    const invoice = await Invoice.findById(invoicePayment.invoice);
    if (!invoice) {
      invoiceMissing += 1;
      continue;
    }
    const before = await mongoose.model('Delivery').countDocuments({ invoicePayment: invoicePayment._id });
    await ensureDeliveryForInvoicePayment(invoicePayment, invoice);
    const after = await mongoose.model('Delivery').countDocuments({ invoicePayment: invoicePayment._id });
    if (after > before) invoiceCreated += 1;
    else invoiceSkipped += 1;
  }

  console.log('Backfill complete');
  console.log(
    JSON.stringify(
      {
        tender: { created: tenderCreated, skipped: tenderSkipped, totalCompletedPayments: completedTenderPayments.length },
        invoice: {
          created: invoiceCreated,
          skipped: invoiceSkipped,
          missingInvoice: invoiceMissing,
          totalPaidInvoicePayments: paidInvoicePayments.length
        }
      },
      null,
      2
    )
  );
}

runBackfill()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
