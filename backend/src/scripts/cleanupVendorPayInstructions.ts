/**
 * One-off cleanup: remove old vendor notifications that instruct vendors to pay.
 * Run: npx ts-node src/scripts/cleanupVendorPayInstructions.ts
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Notification from '../models/Notification';

dotenv.config();

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const filter = {
    $or: [
      { title: { $regex: /pay tender fee\s*\(esewa\)/i } },
      {
        body: {
          $regex:
            /your quotation was accepted\.\s*pay npr .* from my payments/i,
        },
      },
    ],
  };

  const result = await Notification.deleteMany(filter);
  console.log(
    `Removed old vendor pay-instruction notifications: deleted=${result.deletedCount ?? 0}`,
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

