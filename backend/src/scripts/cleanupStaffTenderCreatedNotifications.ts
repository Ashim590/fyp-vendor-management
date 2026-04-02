/**
 * One-off cleanup:
 * Remove vendor-only "tender_created" notifications accidentally assigned to procurement staff.
 *
 * Run:
 *   npx ts-node src/scripts/cleanupStaffTenderCreatedNotifications.ts
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Notification from '../models/Notification';
import User from '../models/User';

dotenv.config();

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const procurementUserIds = await User.find({
    role: 'PROCUREMENT_OFFICER',
  }).distinct('_id');

  const result = await Notification.deleteMany({
    type: 'tender_created',
    user: { $in: procurementUserIds },
  });

  console.log(
    `Removed tender_created notifications for procurement staff: deleted=${result.deletedCount ?? 0}`
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
