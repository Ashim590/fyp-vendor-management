import { Payment } from "../models/payment.model.js";
import { Invoice } from "../models/invoice.model.js";
import { PurchaseOrder } from "../models/purchaseOrder.model.js";
import { Vendor } from "../models/vendor.model.js";

// Create a payment request
export const createPayment = async (req, res) => {
  try {
    const {
      invoiceId,
      paymentMethod,
      paymentType,
      paymentDate,
      referenceNumber,
      remarks,
      dueDate,
    } = req.body;

    if (!invoiceId || !paymentMethod || !paymentDate) {
      return res.status(400).json({
        message: "Invoice, payment method, and payment date are required.",
        success: false,
      });
    }

    const invoice = await Invoice.findById(invoiceId)
      .populate("purchaseOrder")
      .populate("vendor");

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found.",
        success: false,
      });
    }

    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return res.status(400).json({
        message: "Invoice is already paid or cancelled.",
        success: false,
      });
    }

    const vendor = await Vendor.findById(invoice.vendor._id);
    const user = await User.findById(req.id);

    // Determine payment amount
    let amount = invoice.balanceDue;
    if (paymentType === "partial") {
      amount = req.body.amount;
      if (!amount || amount <= 0) {
        return res.status(400).json({
          message: "Valid payment amount is required for partial payment.",
          success: false,
        });
      }
    } else if (paymentType === "advance") {
      amount = req.body.amount;
      if (!amount || amount <= 0) {
        return res.status(400).json({
          message: "Valid advance payment amount is required.",
          success: false,
        });
      }
    }

    // Check if approval is required
    const requiresApproval = amount > 5000; // Threshold for approval

    const payment = await Payment.create({
      invoice: invoiceId,
      purchaseOrder: invoice.purchaseOrder._id,
      vendor: vendor._id,
      vendorName: vendor.name,
      vendorBankAccount: vendor.bankDetails,
      paymentDate,
      amount,
      currency: invoice.currency,
      paymentMethod,
      paymentType: paymentType || "full",
      status: requiresApproval ? "pending" : "approved",
      referenceNumber,
      requestedBy: req.id,
      requestedByName: user.fullname,
      department: user.department || "General",
      remarks,
      dueDate,
      approvalStatus: {
        required: requiresApproval,
        status: requiresApproval ? "pending" : "approved",
      },
    });

    // Update invoice
    invoice.payments.push({
      payment: payment._id,
      amount,
      paymentDate,
    });
    invoice.totalPaid += amount;
    invoice.balanceDue = invoice.totalAmount - invoice.totalPaid;

    if (invoice.balanceDue <= 0) {
      invoice.status = "paid";
      invoice.paidDate = new Date();
    } else {
      invoice.status = "partial_payment";
    }

    await invoice.save();

    return res.status(201).json({
      message: requiresApproval
        ? "Payment request created and pending approval."
        : "Payment created successfully.",
      payment,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error creating payment.",
      success: false,
      error: error.message,
    });
  }
};

// Get all payments (with filters)
export const getAllPayments = async (req, res) => {
  try {
    const {
      status,
      vendor,
      paymentMethod,
      paymentType,
      search,
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (vendor) query.vendor = vendor;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (paymentType) query.paymentType = paymentType;

    if (search) {
      query.$or = [
        { paymentNumber: { $regex: search, $options: "i" } },
        { vendorName: { $regex: search, $options: "i" } },
        { referenceNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const payments = await Payment.find(query)
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("vendor", "name email")
      .populate("invoice", "invoiceNumber")
      .populate("purchaseOrder", "orderNumber")
      .populate("requestedBy", "fullname email department")
      .populate("approvedBy", "fullname email")
      .populate("processedBy", "fullname email");

    const total = await Payment.countDocuments(query);

    return res.status(200).json({
      payments,
      success: true,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching payments.",
      success: false,
      error: error.message,
    });
  }
};

// Get payment by ID
export const getPaymentById = async (req, res) => {
  try {
    const paymentId = req.params.id;
    const payment = await Payment.findById(paymentId)
      .populate("vendor")
      .populate("invoice")
      .populate("purchaseOrder")
      .populate("requestedBy", "fullname email department")
      .populate("approvedBy", "fullname email")
      .populate("processedBy", "fullname email")
      .populate("approval");

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found.",
        success: false,
      });
    }

    return res.status(200).json({
      payment,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching payment.",
      success: false,
      error: error.message,
    });
  }
};

// Update payment
export const updatePayment = async (req, res) => {
  try {
    const paymentId = req.params.id;
    const {
      paymentMethod,
      paymentDate,
      referenceNumber,
      remarks,
      chequeDetails,
      bankReference,
    } = req.body;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found.",
        success: false,
      });
    }

    if (payment.status !== "pending" && payment.status !== "rejected") {
      return res.status(400).json({
        message: "Cannot update payment in current status.",
        success: false,
      });
    }

    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (paymentDate) payment.paymentDate = paymentDate;
    if (referenceNumber) payment.referenceNumber = referenceNumber;
    if (remarks) payment.remarks = remarks;
    if (chequeDetails) payment.chequeDetails = JSON.parse(chequeDetails);
    if (bankReference) payment.bankReference = bankReference;

    await payment.save();

    return res.status(200).json({
      message: "Payment updated successfully.",
      payment,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error updating payment.",
      success: false,
      error: error.message,
    });
  }
};

// Approve payment
export const approvePayment = async (req, res) => {
  try {
    const paymentId = req.params.id;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found.",
        success: false,
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        message: "Payment is not pending approval.",
        success: false,
      });
    }

    const user = await User.findById(req.id);

    payment.status = "approved";
    payment.approvalStatus.status = "approved";
    payment.approvedBy = req.id;
    payment.approvedByName = user.fullname;
    payment.approvedAt = new Date();

    await payment.save();

    return res.status(200).json({
      message: "Payment approved successfully.",
      payment,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error approving payment.",
      success: false,
      error: error.message,
    });
  }
};

// Reject payment
export const rejectPayment = async (req, res) => {
  try {
    const paymentId = req.params.id;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        message: "Rejection reason is required.",
        success: false,
      });
    }

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found.",
        success: false,
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        message: "Payment is not pending approval.",
        success: false,
      });
    }

    payment.status = "rejected";
    payment.approvalStatus.status = "rejected";
    payment.rejectionReason = rejectionReason;

    await payment.save();

    // Revert invoice status
    const invoice = await Invoice.findById(payment.invoice);
    if (invoice) {
      const paymentRecord = invoice.payments.find(
        (p) => p.payment.toString() === paymentId
      );
      if (paymentRecord) {
        invoice.totalPaid -= paymentRecord.amount;
        invoice.balanceDue = invoice.totalAmount - invoice.totalPaid;
        invoice.status = invoice.balanceDue > 0 ? "partial_payment" : "sent";
        await invoice.save();
      }
    }

    return res.status(200).json({
      message: "Payment rejected.",
      payment,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error rejecting payment.",
      success: false,
      error: error.message,
    });
  }
};

// Process payment (mark as completed)
export const processPayment = async (req, res) => {
  try {
    const paymentId = req.params.id;
    const { transactionId, bankReference, proofOfPayment } = req.body;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found.",
        success: false,
      });
    }

    if (payment.status !== "approved") {
      return res.status(400).json({
        message: "Payment must be approved first.",
        success: false,
      });
    }

    payment.status = "processing";

    if (transactionId) payment.transactionId = transactionId;
    if (bankReference) payment.bankReference = bankReference;
    if (proofOfPayment) payment.proofOfPayment = proofOfPayment;

    payment.processedBy = req.id;
    payment.processedAt = new Date();

    await payment.save();

    return res.status(200).json({
      message: "Payment processing started.",
      payment,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error processing payment.",
      success: false,
      error: error.message,
    });
  }
};

// Complete payment
export const completePayment = async (req, res) => {
  try {
    const paymentId = req.params.id;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found.",
        success: false,
      });
    }

    if (payment.status !== "processing") {
      return res.status(400).json({
        message: "Payment is not being processed.",
        success: false,
      });
    }

    payment.status = "completed";
    payment.completedDate = new Date();

    await payment.save();

    return res.status(200).json({
      message: "Payment completed successfully.",
      payment,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error completing payment.",
      success: false,
      error: error.message,
    });
  }
};

// Cancel payment
export const cancelPayment = async (req, res) => {
  try {
    const paymentId = req.params.id;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found.",
        success: false,
      });
    }

    if (payment.status === "completed" || payment.status === "cancelled") {
      return res.status(400).json({
        message: "Cannot cancel completed or already cancelled payment.",
        success: false,
      });
    }

    payment.status = "cancelled";
    await payment.save();

    // Revert invoice status
    const invoice = await Invoice.findById(payment.invoice);
    if (invoice) {
      const paymentRecord = invoice.payments.find(
        (p) => p.payment.toString() === paymentId
      );
      if (paymentRecord) {
        invoice.totalPaid -= paymentRecord.amount;
        invoice.balanceDue = invoice.totalAmount - invoice.totalPaid;
        invoice.status = invoice.balanceDue > 0 ? "partial_payment" : "sent";
        await invoice.save();
      }
    }

    return res.status(200).json({
      message: "Payment cancelled.",
      payment,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error cancelling payment.",
      success: false,
      error: error.message,
    });
  }
};

// Get my payments (vendor view)
export const getMyPayments = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ registeredBy: req.id });

    if (!vendor) {
      return res.status(404).json({
        message: "Vendor profile not found.",
        success: false,
      });
    }

    const { status, page = 1, limit = 10 } = req.query;

    const query = { vendor: vendor._id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const payments = await Payment.find(query)
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("invoice", "invoiceNumber")
      .populate("purchaseOrder", "orderNumber");

    const total = await Payment.countDocuments(query);

    return res.status(200).json({
      payments,
      success: true,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching payments.",
      success: false,
      error: error.message,
    });
  }
};

// Get pending approvals for payments
export const getPendingPaymentApprovals = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const query = { status: "pending", approvalStatus: { required: true } };

    const skip = (page - 1) * limit;

    const payments = await Payment.find(query)
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("vendor", "name email")
      .populate("invoice", "invoiceNumber")
      .populate("requestedBy", "fullname email department");

    const total = await Payment.countDocuments(query);

    return res.status(200).json({
      payments,
      success: true,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching pending approvals.",
      success: false,
      error: error.message,
    });
  }
};

// Get payment statistics
export const getPaymentStats = async (req, res) => {
  try {
    const totalPayments = await Payment.countDocuments();
    const pendingPayments = await Payment.countDocuments({ status: "pending" });
    const approvedPayments = await Payment.countDocuments({
      status: "approved",
    });
    const processingPayments = await Payment.countDocuments({
      status: "processing",
    });
    const completedPayments = await Payment.countDocuments({
      status: "completed",
    });

    const totalAmount = await Payment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const statusStats = await Payment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const methodStats = await Payment.aggregate([
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    return res.status(200).json({
      stats: {
        totalPayments,
        pendingPayments,
        approvedPayments,
        processingPayments,
        completedPayments,
        totalAmount: totalAmount[0]?.total || 0,
        statusStats,
        methodStats,
      },
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching statistics.",
      success: false,
      error: error.message,
    });
  }
};
