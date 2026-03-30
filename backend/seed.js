import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { User } from "./models/user.model.js";

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: "admin@paropakar.org" });

    if (existingAdmin) {
      console.log("Admin user already exists");
    } else {
      // Create default admin user
      const hashedPassword = await bcrypt.hash("admin123", 10);

      const admin = await User.create({
        fullname: "Admin User",
        email: "admin@paropakar.org",
        phoneNumber: "9800000000",
        password: hashedPassword,
        role: "admin",
        department: "IT",
        designation: "System Administrator",
      });

      console.log("Admin user created successfully");
      console.log("Email: admin@paropakar.org");
      console.log("Password: admin123");
    }

    // Create default staff user
    const existingStaff = await User.findOne({ email: "staff@paropakar.org" });

    if (existingStaff) {
      console.log("Staff user already exists");
    } else {
      const hashedPassword = await bcrypt.hash("staff123", 10);

      await User.create({
        fullname: "Staff User",
        email: "staff@paropakar.org",
        phoneNumber: "9800000001",
        password: hashedPassword,
        role: "staff",
        department: "Procurement",
        designation: "Procurement Officer",
      });

      console.log("Staff user created successfully");
      console.log("Email: staff@paropakar.org");
      console.log("Password: staff123");
    }

    console.log("\n=== Default Login Credentials ===");
    console.log("Admin:");
    console.log("  Email: admin@paropakar.org");
    console.log("  Password: admin123");
    console.log("  Role: admin");
    console.log("\nStaff:");
    console.log("  Email: staff@paropakar.org");
    console.log("  Password: staff123");
    console.log("  Role: staff");
    console.log("\n=================================\n");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
