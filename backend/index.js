import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./utils/db.js";
import userRoute from "./routes/user.route.js";
import companyRoute from "./routes/company.route.js";
import jobRoute from "./routes/job.route.js";
import applicationRoute from "./routes/application.route.js";
import vendorRoute from "./routes/vendor.route.js";
import purchaseRequestRoute from "./routes/purchaseRequest.route.js";
import quotationRoute from "./routes/quotation.route.js";
import approvalRoute from "./routes/approval.route.js";
import purchaseOrderRoute from "./routes/purchaseOrder.route.js";
import deliveryRoute from "./routes/delivery.route.js";
import invoiceRoute from "./routes/invoice.route.js";
import paymentRoute from "./routes/payment.route.js";
import auditLogRoute from "./routes/auditLog.route.js";
import adminVendorRoutes from "./routes/admin.vendor.routes.js";
import tenderRoute from "./routes/tender.route.js";
import bidRoute from "./routes/bid.route.js";
import notificationRoute from "./routes/notification.route.js";
import reportRoute from "./routes/report.route.js";

dotenv.config({});

const app = express();

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
};

app.use(cors(corsOptions));

const PORT = process.env.PORT || 3000;

// api's
app.use("/api/v1/user", userRoute);
app.use("/api/v1/company", companyRoute);
app.use("/api/v1/job", jobRoute);
app.use("/api/v1/application", applicationRoute);

// New VendorNet routes
app.use("/api/v1/vendor", vendorRoute);
app.use("/api/v1/purchase-request", purchaseRequestRoute);
app.use("/api/v1/quotation", quotationRoute);
app.use("/api/v1/approval", approvalRoute);
app.use("/api/v1/purchase-order", purchaseOrderRoute);
app.use("/api/v1/delivery", deliveryRoute);
app.use("/api/v1/invoice", invoiceRoute);
app.use("/api/v1/payment", paymentRoute);
app.use("/api/v1/audit-log", auditLogRoute);
app.use("/api/admin/vendors", adminVendorRoutes);
app.use("/api/v1/tenders", tenderRoute);
app.use("/api/v1/bids", bidRoute);
app.use("/api/v1/notifications", notificationRoute);
app.use("/api/v1/reports", reportRoute);

app.listen(PORT, () => {
  connectDB();
  console.log(`Server running at port ${PORT}`);
});
