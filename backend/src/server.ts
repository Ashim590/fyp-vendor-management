import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import vendorRoutes from './routes/vendor.routes';
import tenderRoutes from './routes/tender.routes';
import bidRoutes from './routes/bid.routes';
import settingsRoutes from './routes/settings.routes';
import notificationRoutes from './routes/notification.routes';
import reportRoutes from './routes/report.routes';
import adminVendorsRoutes from './routes/admin-vendors.routes';
import auditLogRoutes from './routes/audit-log.routes';
import purchaseRequestRoutes from './routes/purchaseRequest.routes';
import quotationRoutes from './routes/quotation.routes';
import approvalRoutes from './routes/approval.routes';
import purchaseOrderRoutes from './routes/purchaseOrder.routes';
import deliveryRoutes from './routes/delivery.routes';
import invoiceRoutes from './routes/invoice.routes';
import dashboardRoutes from './routes/dashboard.routes';
import sessionRoutes from './routes/session.routes';
import paymentRoutes from './routes/payment.routes';
import invoicePaymentRoutes from './routes/invoicePayment.routes';
import { apiPerfLogMiddleware } from './middleware/apiPerfLog';

dotenv.config();

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

const app = express();
/** Avoid 304 Not Modified on JSON APIs — Axios treats 304 as an error by default. */
app.set('etag', false);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/paropakar_vendornet';
const PORT = Number(process.env.PORT) || 5000;

const clientOrigins = (
  process.env.CLIENT_ORIGINS ||
  'http://localhost:5173,http://localhost:5174,http://localhost:5175'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: clientOrigins.length === 1 ? clientOrigins[0] : clientOrigins,
    credentials: true
  })
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));
/** Optional: set API_PERF_LOG=1 for request timing + JSON response size in logs. */
app.use(apiPerfLogMiddleware);

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production.');
  process.exit(1);
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/register-vendor', authLimiter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Paropakar VendorNet API',
    time: new Date().toISOString()
  });
});

/** Canonical REST paths */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/tenders', tenderRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/settings', settingsRoutes);

/** Paths matching the current frontend (`/api/v1/*`) */
app.use('/api/v1/tenders', tenderRoutes);
app.use('/api/v1/bids', bidRoutes);
app.use('/api/v1/vendor', vendorRoutes);
app.use('/api/v1/purchase-request', purchaseRequestRoutes);
app.use('/api/v1/quotation', quotationRoutes);
app.use('/api/v1/approval', approvalRoutes);
app.use('/api/v1/purchase-order', purchaseOrderRoutes);
app.use('/api/v1/delivery', deliveryRoutes);
app.use('/api/v1/invoice', invoiceRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/session', sessionRoutes);
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/invoice-payment', invoicePaymentRoutes);
app.use('/api/v1/audit-log', auditLogRoutes);
app.use('/api/admin/vendors', adminVendorsRoutes);

/** Wire compression helps on high-latency links to Atlas (disable with MONGO_DISABLE_COMPRESSION=1). */
const mongoOptions: mongoose.ConnectOptions = {
  maxPoolSize: 50,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 15_000,
  socketTimeoutMS: 60_000,
};
if (process.env.MONGO_DISABLE_COMPRESSION !== '1') {
  mongoOptions.compressors = ['zlib'];
  mongoOptions.zlibCompressionLevel = 6;
}

mongoose
  .connect(MONGO_URI, mongoOptions)
  .then(async () => {
    console.log('Connected to MongoDB');
    try {
      const db = mongoose.connection.getClient().db();
      await db.admin().command({ ping: 1 });
    } catch (e) {
      console.warn('Mongo warm-up ping failed (non-fatal):', (e as Error)?.message);
    }
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Allowed CORS origins: ${clientOrigins.join(', ')}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
