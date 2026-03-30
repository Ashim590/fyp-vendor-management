import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Vendor from '../models/Vendor';
import { authenticate, authorize } from '../middleware/auth';
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from '../utils/cursorPagination';
import { bustAuthUserCache } from '../utils/authUserCache';
import { invalidateAdminDashboardCache } from '../utils/adminDashboardCache';
import { safeClientProfilePhoto } from '../utils/safeClientProfilePhoto';

const router = Router();

router.get('/me', authenticate, async (req: any, res) => {
  const user = await User.findById(req.user?._id).select(
    '_id name email phoneNumber profilePhoto role isActive vendorProfile createdAt updatedAt'
  );
  if (!user) return res.status(404).json({ message: 'User not found' });

  let vendorProfile = null;
  if (user.vendorProfile) {
    vendorProfile = await Vendor.findById(user.vendorProfile).select(
      '_id name email phoneNumber address description website category status'
    );
  }

  res.json({
    success: true,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: (user as any).phoneNumber || '',
      profilePhoto: safeClientProfilePhoto((user as any).profilePhoto),
      role: user.role,
      isActive: user.isActive,
      vendorProfile,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt
    }
  });
});

router.patch('/me', authenticate, async (req: any, res) => {
  const { name, email, phoneNumber, profilePhoto } = req.body || {};
  const user = await User.findById(req.user?._id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (typeof email === 'string' && email.trim()) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
    if (existing) {
      return res.status(400).json({ message: 'Email already in use' });
    }
    user.email = normalizedEmail;
  }
  if (typeof name === 'string' && name.trim()) user.name = name.trim();
  if (typeof phoneNumber === 'string') (user as any).phoneNumber = phoneNumber.trim();
  if (typeof profilePhoto === 'string') (user as any).profilePhoto = profilePhoto.trim();

  await user.save();
  const saved = await User.findById(user._id).select(
    '_id name email phoneNumber profilePhoto role isActive vendorProfile createdAt updatedAt'
  );
  let vendorProfile = null;
  if (saved?.vendorProfile) {
    vendorProfile = await Vendor.findById(saved.vendorProfile).select(
      '_id name email phoneNumber address description website category status'
    );
  }
  res.json({
    success: true,
    message: 'Profile updated',
    user: saved
      ? {
          _id: saved._id,
          name: saved.name,
          email: saved.email,
          phoneNumber: (saved as any).phoneNumber || '',
          profilePhoto: safeClientProfilePhoto((saved as any).profilePhoto),
          role: saved.role,
          isActive: saved.isActive,
          vendorProfile,
          createdAt: (saved as any).createdAt,
          updatedAt: (saved as any).updatedAt
        }
      : null
  });
});

router.patch('/me/password', authenticate, async (req: any, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'currentPassword and newPassword are required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long' });
  }

  const user = await User.findById(req.user?._id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const ok = await bcrypt.compare(String(currentPassword), user.password);
  if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

  user.password = await bcrypt.hash(String(newPassword), 10);
  await user.save();
  res.json({ success: true, message: 'Password updated successfully' });
});

router.get('/', authenticate, authorize(['ADMIN']), async (req, res) => {
  const pageLimit = parseListLimit(req.query.limit, 40, 100);
  const cursor =
    typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  let merged: Record<string, unknown>;
  try {
    merged = mergeWithCursorFilter({}, cursor);
  } catch {
    return res.status(400).json({ message: 'Invalid cursor' });
  }
  const raw = await User.find(merged)
    .sort({ createdAt: -1, _id: -1 })
    .limit(pageLimit + 1)
    .select('-password')
    .populate('vendorProfile', 'name email status')
    .lean();
  const { items, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);
  res.json({ users: items, nextCursor, hasMore });
});

router.patch('/:id/role', authenticate, authorize(['ADMIN']), async (req, res) => {
  const { role } = req.body;
  const updated = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  ).select('-password');
  bustAuthUserCache(req.params.id);
  res.json(updated);
});

router.patch('/:id/status', authenticate, authorize(['ADMIN']), async (req, res) => {
  const { isActive } = req.body;
  const updated = await User.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true }
  ).select('-password');
  bustAuthUserCache(req.params.id);
  invalidateAdminDashboardCache();
  res.json(updated);
});

export default router;

