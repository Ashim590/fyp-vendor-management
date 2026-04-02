/**
 * One-off: remove ALL tenders and related procurement/tender rows.
 *
 * Run from backend:
 *   npx ts-node src/scripts/deleteAllTenders.ts
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Bid from '../models/Bid';
import Payment from '../models/Payment';
import Tender from '../models/Tender';
import TenderClarification from '../models/TenderClarification';
import Invoice from '../models/Invoice';
import Delivery from '../models/Delivery';
import PurchaseRequest from '../models/PurchaseRequest';

dotenv.config();

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const bidN = (await Bid.deleteMany({})).deletedCount ?? 0;
  const payN = (await Payment.deleteMany({})).deletedCount ?? 0;
  const invN = (await Invoice.deleteMany({ tender: { $exists: true, $ne: null } }))
    .deletedCount ?? 0;
  const delN = (await Delivery.deleteMany({ tender: { $exists: true, $ne: null } }))
    .deletedCount ?? 0;
  const clarN = (await TenderClarification.deleteMany({})).deletedCount ?? 0;
  const prN = (
    await PurchaseRequest.updateMany(
      { linkedTender: { $exists: true, $ne: null } },
      { $unset: { linkedTender: 1 } },
    )
  ).modifiedCount;
  const tenderN = (await Tender.deleteMany({})).deletedCount ?? 0;

  console.log(
    JSON.stringify(
      {
        bidsRemoved: bidN,
        tenderPaymentsRemoved: payN,
        invoicesWithTenderRemoved: invN,
        deliveriesWithTenderRemoved: delN,
        clarificationsRemoved: clarN,
        purchaseRequestsUnlinked: prN,
        tendersRemoved: tenderN,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
