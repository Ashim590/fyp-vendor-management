/**
 * One-off: delete all tender Payment and InvoicePayment documents.
 * Run: npx ts-node src/scripts/clearPaymentCollections.ts
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Payment from '../models/Payment';
import InvoicePayment from '../models/InvoicePayment';

dotenv.config();

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const [pRes, iRes] = await Promise.all([
    Payment.deleteMany({}),
    InvoicePayment.deleteMany({}),
  ]);
  console.log(
    `Cleared collections: Payment deleted=${pRes.deletedCount}, InvoicePayment deleted=${iRes.deletedCount}`,
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
