import express from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import PurchaseRequest, { PurchaseRequestStatus, PurchaseRequestPriority } from '../models/PurchaseRequest';
import User, { IUser } from '../models/User';
import Notification from '../models/Notification';
import {
  mergeWithCursorFilter,
  parseListLimit,
  trimExtraDoc,
} from '../utils/cursorPagination';

const router = express.Router();

const shapeRequester = (user: IUser | null) => {
  if (!user) return null;
  return {
    _id: user._id,
    fullname: user.name,
    email: user.email,
    role: user.role
  };
};

async function notifyPrSubmitted(
  pr: any,
  actorUserId: any
): Promise<void> {
  const recipients = await User.find({
    _id: { $ne: actorUserId },
    $or: [{ role: 'ADMIN' }, { role: 'PROCUREMENT_OFFICER' }]
  }).select('_id');
  if (!recipients.length) return;
  await Notification.insertMany(
    recipients.map((u) => ({
      user: u._id,
      title: 'Purchase request submitted',
      body: `${pr.requestNumber}: ${pr.title} is waiting for admin approval.`,
      link: '/approvals',
      type: 'purchase_request_submitted'
    }))
  );
}

// Create purchase request
router.post(
  '/create',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const {
      title,
      description,
      department,
      items,
      requiredDate,
      deliveryLocation,
      justification,
      priority,
      notes,
      status
    } = req.body || {};

    const pr = new PurchaseRequest({
      title,
      description,
      requester: req.user?._id,
      department,
      items: Array.isArray(items) ? items : [],
      requiredDate: requiredDate ? new Date(requiredDate) : new Date(),
      deliveryLocation,
      justification,
      priority: priority as PurchaseRequestPriority,
      notes,
      status: (status as PurchaseRequestStatus) || 'draft'
    });

    await pr.save();
    const requesterDoc = await User.findById(pr.requester);
    return res.status(201).json({
      success: true,
      purchaseRequest: {
        ...pr.toObject(),
        requester: shapeRequester(requesterDoc)
      }
    });
  }
);

// List purchase requests
router.get(
  '/',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR']),
  async (req: AuthRequest, res) => {
    const pageLimit = parseListLimit(req.query.limit, 50, 100);
    const cursor =
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const status =
      typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;

    const filter: Record<string, unknown> = status ? { status } : {};
    if (req.user?.role === 'VENDOR') {
      filter.requester = req.user._id;
    }

    let merged: Record<string, unknown>;
    try {
      merged = mergeWithCursorFilter(filter, cursor);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid cursor' });
    }

    const raw = await PurchaseRequest.find(merged)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageLimit + 1)
      .select(
        'requestNumber title description department status priority requiredDate deliveryLocation totalEstimatedAmount requester createdAt updatedAt'
      )
      .lean();

    const { items: prs, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);

    const requesterIds = Array.from(new Set(prs.map((p) => String(p.requester))));
    const users = await User.find({ _id: { $in: requesterIds } }).select('name email role');
    const userById = new Map(users.map((u) => [String(u._id), u]));

    const purchaseRequests = prs.map((p) => ({
      ...p,
      requester: shapeRequester(userById.get(String(p.requester)) ?? null)
    }));

    res.json({
      success: true,
      purchaseRequests,
      nextCursor,
      hasMore,
    });
  }
);

// My purchase requests (creator)
router.get(
  '/my',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const pageLimit = parseListLimit(req.query.limit, 50, 100);
    const cursor =
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const base = { requester: req.user?._id } as Record<string, unknown>;
    let merged: Record<string, unknown>;
    try {
      merged = mergeWithCursorFilter(base, cursor);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid cursor' });
    }

    const raw = await PurchaseRequest.find(merged)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageLimit + 1)
      .select(
        'requestNumber title description department status priority requiredDate deliveryLocation totalEstimatedAmount requester createdAt updatedAt'
      )
      .lean();

    const { items: prs, nextCursor, hasMore } = trimExtraDoc(raw, pageLimit);

    const requesterDoc = await User.findById(req.user?._id).select('name email role');
    res.json({
      success: true,
      purchaseRequests: prs.map((p) => ({
        ...p,
        requester: shapeRequester(requesterDoc)
      })),
      nextCursor,
      hasMore,
    });
  }
);

router.get(
  '/stats',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (_req: AuthRequest, res) => {
    const [total, pending, approved] = await Promise.all([
      PurchaseRequest.countDocuments(),
      PurchaseRequest.countDocuments({ status: 'pending_approval' }),
      PurchaseRequest.countDocuments({ status: 'approved' })
    ]);
    res.json({
      success: true,
      stats: {
        total,
        pending,
        approved
      }
    });
  }
);

router.get(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER', 'VENDOR']),
  async (req: AuthRequest, res) => {
    const pr = await PurchaseRequest.findById(req.params.id);
    if (!pr) return res.status(404).json({ message: 'Purchase request not found' });

    // Basic access control for vendor: only allow their own PR.
    if (req.user?.role === 'VENDOR') {
      const isOwner = String(pr.requester) === String(req.user?._id);
      if (!isOwner) return res.status(403).json({ message: 'Forbidden' });
    }

    const requesterDoc = await User.findById(pr.requester);
    return res.json({
      success: true,
      purchaseRequest: {
        ...pr.toObject(),
        requester: shapeRequester(requesterDoc)
      }
    });
  }
);

router.put(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const pr = await PurchaseRequest.findById(req.params.id);
    if (!pr) return res.status(404).json({ message: 'Purchase request not found' });
    if (req.user?.role === 'PROCUREMENT_OFFICER') {
      if (String(pr.requester) !== String(req.user?._id)) {
        return res.status(403).json({ message: 'You can only edit your own requests' });
      }
      if (!['draft', 'rejected', 'pending_approval'].includes(pr.status)) {
        return res.status(400).json({ message: 'Only draft, rejected, or pending requests can be edited' });
      }
    }
    const wasPending = pr.status === 'pending_approval';

    const {
      title,
      description,
      department,
      items,
      requiredDate,
      deliveryLocation,
      justification,
      priority,
      notes,
      status
    } = req.body || {};

    pr.title = title ?? pr.title;
    pr.description = description ?? pr.description;
    pr.department = department ?? pr.department;
    pr.items = Array.isArray(items) ? items : pr.items;
    if (requiredDate) pr.requiredDate = new Date(requiredDate);
    pr.deliveryLocation = deliveryLocation ?? pr.deliveryLocation;
    pr.justification = justification ?? pr.justification;
    pr.priority = (priority as PurchaseRequestPriority) ?? pr.priority;
    pr.notes = notes ?? pr.notes;
    if (status) pr.status = status as PurchaseRequestStatus;
    if (wasPending) {
      // Any edit to pending request moves it back to draft.
      pr.status = 'draft';
    }

    await pr.save();
    if (wasPending) {
      const Approval = (await import('../models/Approval')).default;
      await Approval.updateMany(
        { purchaseRequest: pr._id, status: 'pending' },
        { status: 'cancelled', comments: 'Auto-cancelled because PR was edited' }
      );
    }
    const requesterDoc = await User.findById(pr.requester);
    return res.json({
      success: true,
      purchaseRequest: {
        ...pr.toObject(),
        requester: shapeRequester(requesterDoc)
      }
    });
  }
);

router.put(
  '/:id/submit',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const pr = await PurchaseRequest.findById(req.params.id);
    if (!pr) return res.status(404).json({ message: 'Purchase request not found' });
    const admin = await User.findOne({ role: 'ADMIN' }).sort({ createdAt: 1 });
    if (!admin) {
      return res.status(400).json({ message: 'No admin account found to assign approval' });
    }

    pr.status = 'pending_approval';
    await pr.save();

    // Create approval record (pending) so Approvals page can load it.
    const Approval = (await import('../models/Approval')).default;
    const requesterDoc = await User.findById(pr.requester);

    const existingApproval = await Approval.findOne({
      purchaseRequest: pr._id,
      status: 'pending'
    });
    if (existingApproval) {
      await notifyPrSubmitted(pr, req.user!._id);
      return res.json({
        success: true,
        purchaseRequest: pr.toObject(),
        approval: existingApproval.toObject()
      });
    }

    const approval = new Approval({
      entityType: 'purchase_request',
      entityId: pr._id,
      purchaseRequest: pr._id,
      requester: pr.requester,
      requesterName: requesterDoc?.name ?? 'Unknown',
      requesterDepartment: pr.department,
      title: pr.title,
      description: pr.description,
      amount: pr.totalEstimatedAmount,
      currency: 'USD',
      priority: pr.priority,
      approverRole: 'ADMIN',
      currentApprover: admin._id,
      status: 'pending'
    });
    await approval.save();

    await notifyPrSubmitted(pr, req.user!._id);

    return res.json({
      success: true,
      purchaseRequest: pr.toObject(),
      approval: approval.toObject()
    });
  }
);

router.put(
  '/:id/cancel',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const pr = await PurchaseRequest.findById(req.params.id);
    if (!pr) return res.status(404).json({ message: 'Purchase request not found' });

    pr.status = 'cancelled';
    await pr.save();
    return res.json({ success: true, purchaseRequest: pr.toObject() });
  }
);

router.delete(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'PROCUREMENT_OFFICER']),
  async (req: AuthRequest, res) => {
    const pr = await PurchaseRequest.findById(req.params.id);
    if (!pr) return res.status(404).json({ message: 'Purchase request not found' });
    if (req.user?.role === 'PROCUREMENT_OFFICER') {
      if (String(pr.requester) !== String(req.user?._id)) {
        return res.status(403).json({ message: 'You can only delete your own requests' });
      }
      if (pr.status !== 'draft') {
        return res.status(400).json({ message: 'Only draft requests can be deleted' });
      }
    }
    await PurchaseRequest.deleteOne({ _id: pr._id });
    res.json({ success: true });
  }
);

export default router;

