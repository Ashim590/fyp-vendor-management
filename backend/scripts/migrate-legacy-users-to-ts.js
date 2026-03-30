/* eslint-disable no-console */
/**
 * One-time migration helper:
 * Migrates legacy JS user documents (fields like `fullname`, roles: `admin|staff|vendor`)
 * into the unified TypeScript shape used by this repo:
 *   - `name` (from `fullname`)
 *   - `role` uppercase (`ADMIN|PROCUREMENT_OFFICER|VENDOR`)
 *
 * It updates the existing `users` collection in-place.
 *
 * Usage:
 *   node scripts/migrate-legacy-users-to-ts.js
 *   node scripts/migrate-legacy-users-to-ts.js --dry-run
 *   node scripts/migrate-legacy-users-to-ts.js --uri "mongodb://..."
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.argv.includes('--uri')
  ? process.argv[process.argv.indexOf('--uri') + 1]
  : process.env.MONGO_URI;

const dryRun = process.argv.includes('--dry-run');

if (!uri) {
  console.error('Missing Mongo URI. Set MONGO_URI or pass --uri <mongodb-uri>.');
  process.exit(1);
}

const roleMap = {
  admin: 'ADMIN',
  staff: 'PROCUREMENT_OFFICER',
  vendor: 'VENDOR',
};

async function main() {
  await mongoose.connect(uri);
  const collection = mongoose.connection.collection('users');

  const legacyCursor = collection.find({
    $or: [{ name: { $exists: false } }, { name: null }],
    role: { $in: ['admin', 'staff', 'vendor'] },
    fullname: { $exists: true }
  });

  let touched = 0;
  let unchanged = 0;

  for await (const doc of legacyCursor) {
    const mappedRole = roleMap[doc.role];
    const nextName = doc.fullname || doc.name || '';

    const update = {
      $set: {
        name: nextName,
        role: mappedRole || doc.role,
        email: typeof doc.email === 'string' ? doc.email.toLowerCase() : doc.email,
        isActive: typeof doc.isActive === 'boolean' ? doc.isActive : true,
      }
    };

    if (dryRun) {
      // eslint-disable-next-line no-console
      console.log('[dry-run] would update user:', doc._id, update);
      touched += 1;
      continue;
    }

    const res = await collection.updateOne({ _id: doc._id }, update);
    if (res.modifiedCount > 0) touched += 1;
    else unchanged += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`Migration complete. touched=${touched}, unchanged=${unchanged}, dryRun=${dryRun}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

