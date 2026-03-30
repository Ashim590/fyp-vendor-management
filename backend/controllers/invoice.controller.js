import { Invoice } from "../models/invoice.model.js";
import { PurchaseOrder } from "../models/purchaseOrder.model.js";
import { Vendor } from "../models/vendor.model.js";
import { Payment } from "../models/payment.model.js";

// Create an invoice from a purchase order
export const createInvoice = async (req, res) => {
  try {
    const {
      purchaseOrderId,
      invoiceDate,
      dueDate,
      items,
      billingAddress,
      shippingAddress,
      paymentTerms,
      notes,
      termsAndConditions,
    } = req.body;

    if (!purchaseOrderId || !invoiceDate || !dueDate) {
      return res.status(400).json({
        message: "Purchase order, invoice date, and due date are required.",
        success: false,
      });
    }

    const purchaseOrder = await PurchaseOrder.findById(
      purchaseOrderId
    ).populate("vendor");

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found.",
        success: false,
      });
    }

    if (
      purchaseOrder.status !== "delivered" &&
      purchaseOrder.status !== "partial_delivered"
    ) {
      return res.status(400).json({
        message: "Purchase order must be delivered before creating invoice.",
        success: false,
      });
    }

    const vendor = await Vendor.findById(purchaseOrder.vendor._id);

    let itemsArray = items ? JSON.parse(items) : purchaseOrder.items;

    // Calculate totals
    let subtotal = 0;
    itemsArray = itemsArray.map((item) => {
      const taxAmount = (item.totalPrice || 0) * ((item.taxRate || 0) / 100);
      subtotal += item.totalPrice || 0;
      return {
        ...item,
        taxAmount,
      };
    });

    const invoice = await Invoice.create({
      purchaseOrder: purchaseOrderId,
      vendor: vendor._id,
      vendorName: vendor.name,
      vendorAddress: vendor.address,
      vendorTaxId: vendor.taxId,
      invoiceDate,
      dueDate,
      items: itemsArray,
      billingAddress: billingAddress ? JSON.parse(billingAddress) : undefined,
      shippingAddress: shippingAddress
        ? JSON.parse(shippingAddress)
        : undefined,
      paymentTerms,
      notes,
      termsAndConditions,
      createdBy: req.id,
      status: "draft",
    });

    // Update purchase order
    purchaseOrder.invoice = invoice._id;
    await purchaseOrder.save();

    return res.status(201).json({
      message: "Invoice created successfully.",
      invoice,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error creating invoice.",
      success: false,
      error: error.message,
    });
  }
};

// Get all invoices (with filters)
export const getAllInvoices = async (req, res) => {
  try {
    const {
      status,
      vendor,
      invoiceType,
      search,
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (vendor) query.vendor = vendor;
    if (invoiceType) query.invoiceType = invoiceType;

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { vendorName: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const invoices = await Invoice.find(query)
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("vendor", "name email")
      .populate("purchaseOrder", "orderNumber")
      .populate("createdBy", "fullname email");

    const total = await Invoice.countDocuments(query);

    return res.status(200).json({
      invoices,
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
      message: "Error fetching invoices.",
      success: false,
      error: error.message,
    });
  }
};

// Get invoice by ID
export const getInvoiceById = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await Invoice.findById(invoiceId)
      .populate("vendor")
      .populate("purchaseOrder")
      .populate("createdBy", "fullname email")
      .populate("payments.payment");

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found.",
        success: false,
      });
    }

    return res.status(200).json({
      invoice,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching invoice.",
      success: false,
      error: error.message,
    });
  }
};

// Update invoice
export const updateInvoice = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const {
      invoiceDate,
      dueDate,
      items,
      billingAddress,
      shippingAddress,
      paymentTerms,
      notes,
      termsAndConditions,
      status,
    } = req.body;

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found.",
        success: false,
      });
    }

    if (invoice.status !== "draft") {
      return res.status(400).json({
        message: "Cannot update invoice in current status.",
        success: false,
      });
    }

    if (invoiceDate) invoice.invoiceDate = invoiceDate;
    if (dueDate) invoice.dueDate = dueDate;
    if (items) {
      invoice.items = JSON.parse(items);
      // Recalculate totals
      invoice.subtotal = invoice.items.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );
      invoice.taxAmount = invoice.items.reduce(
        (sum, item) => sum + item.taxAmount,
        0
      );
    }
    if (billingAddress) invoice.billingAddress = JSON.parse(billingAddress);
    if (shippingAddress) invoice.shippingAddress = JSON.parse(shippingAddress);
    if (paymentTerms) invoice.paymentTerms = paymentTerms;
    if (notes) invoice.notes = notes;
    if (termsAndConditions) invoice.termsAndConditions = termsAndConditions;
    if (status) invoice.status = status;

    await invoice.save();

    return res.status(200).json({
      message: "Invoice updated successfully.",
      invoice,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error updating invoice.",
      success: false,
      error: error.message,
    });
  }
};

// Send invoice
export const sendInvoice = async (req, res) => {
  try {
    const invoiceId = req.params.id;

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found.",
        success: false,
      });
    }

    if (invoice.status !== "draft" && invoice.status !== "pending") {
      return res.status(400).json({
        message: "Invoice cannot be sent in current status.",
        success: false,
      });
    }

    invoice.status = "sent";
    invoice.sentDate = new Date();
    await invoice.save();

    return res.status(200).json({
      message: "Invoice sent successfully.",
      invoice,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error sending invoice.",
      success: false,
      error: error.message,
    });
  }
};

// Mark invoice as viewed
export const markAsViewed = async (req, res) => {
  try {
    const invoiceId = req.params.id;

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found.",
        success: false,
      });
    }

    invoice.status = "viewed";
    invoice.viewedDate = new Date();
    await invoice.save();

    return res.status(200).json({
      message: "Invoice marked as viewed.",
      invoice,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error updating invoice.",
      success: false,
      error: error.message,
    });
  }
};

// Record payment against invoice
export const recordPayment = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { paymentId } = req.body;

    const invoice = await Invoice.findById(invoiceId);
    const payment = await Payment.findById(paymentId);

    if (!invoice || !payment) {
      return res.status(404).json({
        message: "Invoice or payment not found.",
        success: false,
      });
    }

    // Add payment to invoice
    invoice.payments.push({
      payment: paymentId,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
    });

    invoice.totalPaid += payment.amount;
    invoice.balanceDue = invoice.totalAmount - invoice.totalPaid;

    // Update invoice status
    if (invoice.balanceDue <= 0) {
      invoice.status = "paid";
      invoice.paidDate = new Date();
    } else {
      invoice.status = "partial_payment";
    }

    await invoice.save();

    // Update purchase order
    const purchaseOrder = await PurchaseOrder.findById(invoice.purchaseOrder);
    if (purchaseOrder) {
      purchaseOrder.payments.push(paymentId);
      await purchaseOrder.save();
    }

    return res.status(200).json({
      message: "Payment recorded successfully.",
      invoice,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error recording payment.",
      success: false,
      error: error.message,
    });
  }
};

// Cancel invoice
export const cancelInvoice = async (req, res) => {
  try {
    const invoiceId = req.params.id;

    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        message: "Invoice not found.",
        success: false,
      });
    }

    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return res.status(400).json({
        message: "Cannot cancel paid or already cancelled invoice.",
        success: false,
      });
    }

    invoice.status = "cancelled";
    await invoice.save();

    return res.status(200).json({
      message: "Invoice cancelled.",
      invoice,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error cancelling invoice.",
      success: false,
      error: error.message,
    });
  }
};

// Get vendor's invoices
export const getMyInvoices = async (req, res) => {
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

    const invoices = await Invoice.find(query)
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("purchaseOrder", "orderNumber");

    const total = await Invoice.countDocuments(query);

    return res.status(200).json({
      invoices,
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
      message: "Error fetching invoices.",
      success: false,
      error: error.message,
    });
  }
};

// Get invoice statistics
export const getInvoiceStats = async (req, res) => {
  try {
    const totalInvoices = await Invoice.countDocuments();
    const pendingInvoices = await Invoice.countDocuments({
      status: { $in: ["pending", "sent", "viewed"] },
    });
    const paidInvoices = await Invoice.countDocuments({ status: "paid" });
    const partialInvoices = await Invoice.countDocuments({
      status: "partial_payment",
    });
    const overdueInvoices = await Invoice.countDocuments({
      status: { $nin: ["paid", "cancelled"] },
      dueDate: { $lt: new Date() },
    });

    const totalAmount = await Invoice.aggregate([
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const totalPaid = await Invoice.aggregate([
      { $group: { _id: null, total: { $sum: "$totalPaid" } } },
    ]);

    const statusStats = await Invoice.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);

    return res.status(200).json({
      stats: {
        totalInvoices,
        pendingInvoices,
        paidInvoices,
        partialInvoices,
        overdueInvoices,
        totalAmount: totalAmount[0]?.total || 0,
        totalPaid: totalPaid[0]?.total || 0,
        statusStats,
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
