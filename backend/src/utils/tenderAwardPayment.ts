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
 * When a quotation is accepted, create a pending tender payment (if missing) so it
 * appears under procurement Payments and the vendor My payments / eSewa flow.
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
    amount: Number(bid.amount || 0),
    status: 'Pending',
    method: 'eSewa',
    provider: 'eSewa',
    transactionId: '',
    payerMobileNumber: '',
    qrImage: '',
    createdBy: auditUserId,
    updatedBy: auditUserId,
    notes: 'Created when the quotation was accepted.',
  });
  await payment.save();

  invalidateStaffSummaryCache();
  invalidateAdminDashboardCache();

  const vendorUser = await User.findOne({ vendorProfile: vendor._id });
  if (vendorUser) {
    await Notification.create({
      user: vendorUser._id,
      title: 'Pay tender fee (eSewa)',
      body: `Your quotation was accepted. Pay NPR ${payment.amount} for "${payment.tenderReference}" from My payments.`,
      link: '/my-payments',
      type: 'payment_pending',
    });
  }

  return { created: true };
}
