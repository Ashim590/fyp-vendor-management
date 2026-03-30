import { PurchaseOrder } from "../models/purchaseOrder.model.js";
import { PurchaseRequest } from "../models/purchaseRequest.model.js";
import { Quotation } from "../models/quotation.model.js";
import { Vendor } from "../models/vendor.model.js";
import { Invoice } from "../models/invoice.model.js";
import { User } from "../models/user.model.js";

// Create a purchase order from a purchase request
export const createPurchaseOrder = async (req, res) => {
  try {
    const {
      purchaseRequestId,
      quotationId,
      expectedDeliveryDate,
      deliveryLocation,
      paymentTerms,
      deliveryTerms,
      notes,
      termsAndConditions,
    } = req.body;

    if (
      !purchaseRequestId ||
      !quotationId ||
      !expectedDeliveryDate ||
      !deliveryLocation
    ) {
      return res.status(400).json({
        message:
          "Purchase request, quotation, delivery date, and location are required.",
        success: false,
      });
    }

    // Get purchase request and quotation
    const purchaseRequest = await PurchaseRequest.findById(
      purchaseRequestId
    ).populate("requester", "fullname email department");

    const quotation = await Quotation.findById(quotationId).populate("vendor");

    if (!purchaseRequest || !quotation) {
      return res.status(404).json({
        message: "Purchase request or quotation not found.",
        success: false,
      });
    }

    if (quotation.status !== "accepted") {
      return res.status(400).json({
        message: "Quotation must be accepted before creating purchase order.",
        success: false,
      });
    }

    const vendor = await Vendor.findById(quotation.vendor._id);

    // Create purchase order
    const purchaseOrder = await PurchaseOrder.create({
      purchaseRequest: purchaseRequestId,
      quotation: quotationId,
      vendor: vendor._id,
      vendorName: vendor.name,
      vendorAddress: vendor.address,
      vendorContact: vendor.phoneNumber,
      expectedDeliveryDate,
      deliveryLocation,
      items: quotation.items.map((item) => ({
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        specifications: item.specifications,
      })),
      subtotal: quotation.subtotal,
      taxAmount: quotation.taxAmount,
      discountAmount: quotation.discountAmount,
      totalAmount: quotation.totalAmount,
      taxRate: quotation.taxRate,
      discountRate: quotation.discountRate,
      currency: quotation.currency,
      paymentTerms: paymentTerms || quotation.paymentTerms,
      deliveryTerms: deliveryTerms || quotation.deliveryTerms,
      orderedBy: req.id,
      department: purchaseRequest.department,
      notes,
      termsAndConditions,
      status: "draft",
    });

    // Update purchase request
    purchaseRequest.purchaseOrder = purchaseOrder._id;
    purchaseRequest.status = "po_created";
    await purchaseRequest.save();

    // Update vendor stats
    vendor.totalOrders += 1;
    await vendor.save();

    return res.status(201).json({
      message: "Purchase order created successfully.",
      purchaseOrder,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error creating purchase order.",
      success: false,
      error: error.message,
    });
  }
};

// Get all purchase orders (with filters)
export const getAllPurchaseOrders = async (req, res) => {
  try {
    const {
      status,
      vendor,
      department,
      search,
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (vendor) query.vendor = vendor;
    if (department) query.department = department;

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { vendorName: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) query.orderDate.$gte = new Date(startDate);
      if (endDate) query.orderDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const purchaseOrders = await PurchaseOrder.find(query)
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("vendor", "name email status")
      .populate("purchaseRequest", "title requestNumber")
      .populate("orderedBy", "fullname email department");

    const total = await PurchaseOrder.countDocuments(query);

    return res.status(200).json({
      purchaseOrders,
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
      message: "Error fetching purchase orders.",
      success: false,
      error: error.message,
    });
  }
};

// Get purchase order by ID
export const getPurchaseOrderById = async (req, res) => {
  try {
    const orderId = req.params.id;
    const purchaseOrder = await PurchaseOrder.findById(orderId)
      .populate("vendor")
      .populate("purchaseRequest")
      .populate("quotation")
      .populate("orderedBy", "fullname email department")
      .populate("approvedBy", "fullname email")
      .populate("invoice")
      .populate("deliveries")
      .populate("payments");

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found.",
        success: false,
      });
    }

    return res.status(200).json({
      purchaseOrder,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching purchase order.",
      success: false,
      error: error.message,
    });
  }
};

// Update purchase order
export const updatePurchaseOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const {
      expectedDeliveryDate,
      deliveryLocation,
      paymentTerms,
      deliveryTerms,
      notes,
      termsAndConditions,
      status,
    } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(orderId);

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found.",
        success: false,
      });
    }

    if (
      purchaseOrder.status !== "draft" &&
      purchaseOrder.status !== "rejected"
    ) {
      return res.status(400).json({
        message: "Cannot update purchase order in current status.",
        success: false,
      });
    }

    const updateData = {};
    if (expectedDeliveryDate)
      updateData.expectedDeliveryDate = expectedDeliveryDate;
    if (deliveryLocation) updateData.deliveryLocation = deliveryLocation;
    if (paymentTerms) updateData.paymentTerms = paymentTerms;
    if (deliveryTerms) updateData.deliveryTerms = deliveryTerms;
    if (notes) updateData.notes = notes;
    if (termsAndConditions) updateData.termsAndConditions = termsAndConditions;
    if (status) updateData.status = status;

    const updatedOrder = await PurchaseOrder.findByIdAndUpdate(
      orderId,
      updateData,
      { new: true }
    );

    return res.status(200).json({
      message: "Purchase order updated successfully.",
      purchaseOrder: updatedOrder,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error updating purchase order.",
      success: false,
      error: error.message,
    });
  }
};

// Submit purchase order for approval
export const submitForApproval = async (req, res) => {
  try {
    const orderId = req.params.id;

    const purchaseOrder = await PurchaseOrder.findById(orderId);

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found.",
        success: false,
      });
    }

    if (purchaseOrder.status !== "draft") {
      return res.status(400).json({
        message: "Purchase order already submitted.",
        success: false,
      });
    }

    purchaseOrder.status = "pending_approval";
    await purchaseOrder.save();

    return res.status(200).json({
      message: "Purchase order submitted for approval.",
      purchaseOrder,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error submitting purchase order.",
      success: false,
      error: error.message,
    });
  }
};

// Approve purchase order
export const approvePurchaseOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { comments } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(orderId);

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found.",
        success: false,
      });
    }

    if (purchaseOrder.status !== "pending_approval") {
      return res.status(400).json({
        message: "Purchase order is not pending approval.",
        success: false,
      });
    }

    purchaseOrder.status = "approved";
    purchaseOrder.isApproved = true;
    purchaseOrder.approvedBy = req.id;
    purchaseOrder.approvedAt = new Date();

    purchaseOrder.approvals.push({
      approver: req.id,
      status: "approved",
      comments,
      approvedAt: new Date(),
    });

    await purchaseOrder.save();

    return res.status(200).json({
      message: "Purchase order approved.",
      purchaseOrder,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error approving purchase order.",
      success: false,
      error: error.message,
    });
  }
};

// Reject purchase order
export const rejectPurchaseOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { rejectionReason } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(orderId);

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found.",
        success: false,
      });
    }

    purchaseOrder.status = "rejected";
    purchaseOrder.rejectionReason = rejectionReason;

    purchaseOrder.approvals.push({
      approver: req.id,
      status: "rejected",
      comments: rejectionReason,
      approvedAt: new Date(),
    });

    await purchaseOrder.save();

    return res.status(200).json({
      message: "Purchase order rejected.",
      purchaseOrder,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error rejecting purchase order.",
      success: false,
      error: error.message,
    });
  }
};

// Mark purchase order as ordered
export const markAsOrdered = async (req, res) => {
  try {
    const orderId = req.params.id;

    const purchaseOrder = await PurchaseOrder.findById(orderId);

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found.",
        success: false,
      });
    }

    if (purchaseOrder.status !== "approved") {
      return res.status(400).json({
        message: "Purchase order must be approved first.",
        success: false,
      });
    }

    purchaseOrder.status = "ordered";
    await purchaseOrder.save();

    return res.status(200).json({
      message: "Purchase order marked as ordered.",
      purchaseOrder,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error updating purchase order.",
      success: false,
      error: error.message,
    });
  }
};

// Cancel purchase order
export const cancelPurchaseOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { cancellationReason } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(orderId);

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase order not found.",
        success: false,
      });
    }

    if (
      purchaseOrder.status === "delivered" ||
      purchaseOrder.status === "closed"
    ) {
      return res.status(400).json({
        message: "Cannot cancel delivered or closed purchase order.",
        success: false,
      });
    }

    purchaseOrder.status = "cancelled";
    purchaseOrder.notes = cancellationReason
      ? `${purchaseOrder.notes || ""}\nCancellation: ${cancellationReason}`
      : purchaseOrder.notes;

    await purchaseOrder.save();

    return res.status(200).json({
      message: "Purchase order cancelled.",
      purchaseOrder,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error cancelling purchase order.",
      success: false,
      error: error.message,
    });
  }
};

// Get my purchase orders
export const getMyPurchaseOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { orderedBy: req.id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const purchaseOrders = await PurchaseOrder.find(query)
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("vendor", "name email");

    const total = await PurchaseOrder.countDocuments(query);

    return res.status(200).json({
      purchaseOrders,
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
      message: "Error fetching purchase orders.",
      success: false,
      error: error.message,
    });
  }
};

// Get purchase order statistics
export const getPurchaseOrderStats = async (req, res) => {
  try {
    const totalOrders = await PurchaseOrder.countDocuments();
    const pendingOrders = await PurchaseOrder.countDocuments({
      status: "pending_approval",
    });
    const approvedOrders = await PurchaseOrder.countDocuments({
      status: "approved",
    });
    const orderedOrders = await PurchaseOrder.countDocuments({
      status: "ordered",
    });
    const deliveredOrders = await PurchaseOrder.countDocuments({
      status: "delivered",
    });

    const totalAmount = await PurchaseOrder.aggregate([
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const statusStats = await PurchaseOrder.aggregate([
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
        totalOrders,
        pendingOrders,
        approvedOrders,
        orderedOrders,
        deliveredOrders,
        totalAmount: totalAmount[0]?.total || 0,
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
