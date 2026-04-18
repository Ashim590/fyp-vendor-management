import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/paropakar_vendornet';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const adminEmail = 'adminparopakarorg@gmail.com';
  const staffEmail = 'staff@paropakar.org';

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      name: 'Admin User',
      email: adminEmail,
      phoneNumber: '9800000000',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    });
    console.log('Admin user created (adminparopakarorg@gmail.com / admin123)');
  } else {
    console.log('Admin user already exists');
  }

  const existingStaff = await User.findOne({ email: staffEmail });
  if (!existingStaff) {
    const hashedPassword = await bcrypt.hash('staff123', 10);
    await User.create({
      name: 'Staff User',
      email: staffEmail,
      phoneNumber: '9800000001',
      password: hashedPassword,
      role: 'PROCUREMENT_OFFICER',
      isActive: true,
    });
    console.log('Staff user created (staff@paropakar.org / staff123)');
  } else {
    console.log('Staff user already exists');
  }

  console.log('\n=== Default login (dev/demo) ===');
  console.log('Admin: adminparopakarorg@gmail.com / admin123');
  console.log('Officer: staff@paropakar.org / staff123');
  console.log('================================\n');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
