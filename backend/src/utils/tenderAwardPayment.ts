import mongoose from 'mongoose';
import Payment from '../models/Payment';
import Vendor from '../models/Vendor';
import User from '../models/User';
import Notification from '../models/Notification';
import type { IBid } from '../models/Bid';
import type { ITender } from '../models/Tender';
import { invalidateStaffSummaryCache } from './staffDashboardCache';
import { invalidateAdminDashboardCache } from './adminDashboardCache';

/**
 * When a tender is awarded, create a pending tender payment (if missing) so it
 * appears under procurement Payments and vendor My payments (view-only; vendors do not initiate eSewa).
 */
export async function ensurePaymentForAwardedBid(
  bid: mongoose.HydratedDocument<IBid>,
  tender: mongoose.HydratedDocument<ITender>,
  auditUserId?: mongoose.Types.ObjectId,
): Promise<{ created: boolean }> {
  const existing = await Payment.findOne({
    tender: tender._id,
    vendor: bid.vendor,
  });
  if (existing) {
    return { created: false };
  }

  const vendor = await Vendor.findById(bid.vendor);
  if (!vendor) {
    return { created: false };
  }

  const payment = new Payment({
    tender: tender._id,
    tenderReference: tender.referenceNumber || tender.title,
    bid: bid._id,
    vendor: vendor._id,
    vendorName: vendor.name,
    vendorRegistrationNumber: vendor.registrationNumber || '',
    amount: Number(bid.amount || 0),
    status: 'Pending',
    method: 'eSewa',
    provider: 'eSewa',
    transactionId: '',
    payerMobileNumber: '',
    qrImage: '',
    createdBy: auditUserId,
    updatedBy: auditUserId,
    notes: 'Created when the tender was awarded.',
  });
  await payment.save();

  invalidateStaffSummaryCache();
  invalidateAdminDashboardCache();

  const vendorUser = await User.findOne({ vendorProfile: vendor._id });
  if (vendorUser) {
    await Notification.create({
      user: vendorUser._id,
      title: 'Tender awarded',
      body: `"${payment.tenderReference}" has been awarded to you. Amount NPR ${payment.amount} has been recorded. Procurement will complete payment; you can track status in My payments.`,
      link: '/my-payments',
      type: 'payment_pending',
    });
  }

  return { created: true };
}
