import { Quotation } from "../models/quotation.model.js";
import { PurchaseRequest } from "../models/purchaseRequest.model.js";
import { Vendor } from "../models/vendor.model.js";

// Submit a quotation for a purchase request
export const submitQuotation = async (req, res) => {
  try {
    const {
      purchaseRequestId,
      items,
      taxRate,
      discountRate,
      currency,
      validityDate,
      deliveryDate,
      deliveryTerms,
      paymentTerms,
      warranty,
      notes,
    } = req.body;

    if (!purchaseRequestId || !items || !validityDate || !deliveryDate) {
      return res.status(400).json({
        message:
          "Purchase request, items, validity date, and delivery date are required.",
        success: false,
      });
    }

    const purchaseRequest = await PurchaseRequest.findById(purchaseRequestId);
    if (!purchaseRequest) {
      return res.status(404).json({
        message: "Purchase request not found.",
        success: false,
      });
    }

    // Get vendor info from authenticated user
    const vendor = await Vendor.findOne({ registeredBy: req.id });
    if (!vendor) {
      return res.status(404).json({
        message: "Vendor profile not found.",
        success: false,
      });
    }

    if (vendor.status !== "approved") {
      return res.status(400).json({
        message: "Your vendor account is not approved yet.",
        success: false,
      });
    }

    const itemsArray = JSON.parse(items);

    // Calculate totals
    let subtotal = 0;
    itemsArray.forEach((item) => {
      item.totalPrice = item.quantity * item.unitPrice;
      subtotal += item.totalPrice;
    });

    const discountAmount = subtotal * ((discountRate || 0) / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * ((taxRate || 0) / 100);
    const totalAmount = afterDiscount + taxAmount;

    const quotation = await Quotation.create({
      purchaseRequest: purchaseRequestId,
      vendor: vendor._id,
      vendorName: vendor.name,
      items: itemsArray,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      taxRate: taxRate || 0,
      discountRate: discountRate || 0,
      currency: currency || "USD",
      validityDate,
      deliveryDate,
      deliveryTerms,
      paymentTerms,
      warranty,
      notes,
      quotedBy: req.id,
      status: "submitted",
    });

    // Update purchase request with quotation reference
    purchaseRequest.quotations.push(quotation._id);
    if (
      purchaseRequest.status === "draft" ||
      purchaseRequest.status === "approved"
    ) {
      purchaseRequest.status = "quotation_received";
    }
    await purchaseRequest.save();

    return res.status(201).json({
      message: "Quotation submitted successfully.",
      quotation,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error submitting quotation.",
      success: false,
      error: error.message,
    });
  }
};

// Get all quotations (with filters)
export const getAllQuotations = async (req, res) => {
  try {
    const {
      status,
      vendor,
      purchaseRequest,
      search,
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (vendor) query.vendor = vendor;
    if (purchaseRequest) query.purchaseRequest = purchaseRequest;

    if (search) {
      query.$or = [
        { quotationNumber: { $regex: search, $options: "i" } },
        { vendorName: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const quotations = await Quotation.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("vendor", "name email status rating")
      .populate("purchaseRequest", "title requestNumber department status");

    const total = await Quotation.countDocuments(query);

    return res.status(200).json({
      quotations,
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
      message: "Error fetching quotations.",
      success: false,
      error: error.message,
    });
  }
};

// Get quotation by ID
export const getQuotationById = async (req, res) => {
  try {
    const quotationId = req.params.id;
    const quotation = await Quotation.findById(quotationId)
      .populate("vendor")
      .populate("purchaseRequest")
      .populate("quotedBy", "fullname email")
      .populate("reviewedBy", "fullname email");

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found.",
        success: false,
      });
    }

    return res.status(200).json({
      quotation,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching quotation.",
      success: false,
      error: error.message,
    });
  }
};

// Get quotations for a specific purchase request
export const getQuotationsByPurchaseRequest = async (req, res) => {
  try {
    const { purchaseRequestId } = req.params;

    const quotations = await Quotation.find({
      purchaseRequest: purchaseRequestId,
    })
      .sort({ totalAmount: 1 }) // Sort by price ascending
      .populate("vendor", "name email status rating");

    return res.status(200).json({
      quotations,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching quotations.",
      success: false,
      error: error.message,
    });
  }
};

// Update quotation (only if status is submitted)
export const updateQuotation = async (req, res) => {
  try {
    const quotationId = req.params.id;
    const {
      items,
      taxRate,
      discountRate,
      validityDate,
      deliveryDate,
      deliveryTerms,
      paymentTerms,
      warranty,
      notes,
    } = req.body;

    const quotation = await Quotation.findById(quotationId);

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found.",
        success: false,
      });
    }

    if (
      quotation.status !== "submitted" &&
      quotation.status !== "under_review"
    ) {
      return res.status(400).json({
        message: "Cannot update quotation in current status.",
        success: false,
      });
    }

    if (items) {
      const itemsArray = JSON.parse(items);
      quotation.items = itemsArray;

      // Recalculate totals
      quotation.subtotal = itemsArray.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );
      const discountAmount =
        quotation.subtotal * ((discountRate || quotation.discountRate) / 100);
      quotation.discountAmount = discountAmount;
      const afterDiscount = quotation.subtotal - discountAmount;
      quotation.taxAmount =
        afterDiscount * ((taxRate || quotation.taxRate) / 100);
      quotation.totalAmount = afterDiscount + quotation.taxAmount;
    }

    if (taxRate !== undefined) quotation.taxRate = taxRate;
    if (discountRate !== undefined) quotation.discountRate = discountRate;
    if (validityDate) quotation.validityDate = validityDate;
    if (deliveryDate) quotation.deliveryDate = deliveryDate;
    if (deliveryTerms) quotation.deliveryTerms = deliveryTerms;
    if (paymentTerms) quotation.paymentTerms = paymentTerms;
    if (warranty) quotation.warranty = warranty;
    if (notes) quotation.notes = notes;

    await quotation.save();

    return res.status(200).json({
      message: "Quotation updated successfully.",
      quotation,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error updating quotation.",
      success: false,
      error: error.message,
    });
  }
};

// Accept a quotation
export const acceptQuotation = async (req, res) => {
  try {
    const quotationId = req.params.id;
    const { notes } = req.body;

    const quotation = await Quotation.findById(quotationId).populate(
      "purchaseRequest"
    );

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found.",
        success: false,
      });
    }

    if (
      quotation.status !== "submitted" &&
      quotation.status !== "under_review"
    ) {
      return res.status(400).json({
        message: "Cannot accept quotation in current status.",
        success: false,
      });
    }

    // Reject all other quotations for this purchase request
    await Quotation.updateMany(
      {
        purchaseRequest: quotation.purchaseRequest._id,
        _id: { $ne: quotationId },
      },
      {
        status: "rejected",
        reviewNotes: "Rejected - Another quotation was selected",
      }
    );

    quotation.status = "accepted";
    quotation.isSelected = true;
    quotation.reviewedBy = req.id;
    quotation.reviewedAt = new Date();
    quotation.reviewNotes = notes;
    await quotation.save();

    // Update purchase request
    const purchaseRequest = await PurchaseRequest.findById(
      quotation.purchaseRequest._id
    );
    purchaseRequest.selectedQuotation = quotationId;
    purchaseRequest.status = "approved";
    await purchaseRequest.save();

    return res.status(200).json({
      message: "Quotation accepted successfully.",
      quotation,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error accepting quotation.",
      success: false,
      error: error.message,
    });
  }
};

// Reject a quotation
export const rejectQuotation = async (req, res) => {
  try {
    const quotationId = req.params.id;
    const { rejectionReason } = req.body;

    const quotation = await Quotation.findById(quotationId);

    if (!quotation) {
      return res.status(404).json({
        message: "Quotation not found.",
        success: false,
      });
    }

    quotation.status = "rejected";
    quotation.reviewedBy = req.id;
    quotation.reviewedAt = new Date();
    quotation.reviewNotes = rejectionReason;
    await quotation.save();

    return res.status(200).json({
      message: "Quotation rejected.",
      quotation,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error rejecting quotation.",
      success: false,
      error: error.message,
    });
  }
};

// Compare quotations for a purchase request
export const compareQuotations = async (req, res) => {
  try {
    const { purchaseRequestId } = req.params;

    const quotations = await Quotation.find({
      purchaseRequest: purchaseRequestId,
    })
      .sort({ totalAmount: 1 })
      .populate("vendor", "name rating");

    if (!quotations || quotations.length === 0) {
      return res.status(404).json({
        message: "No quotations found for comparison.",
        success: false,
      });
    }

    // Create comparison data
    const comparison = quotations.map((q) => ({
      quotationNumber: q.quotationNumber,
      vendor: q.vendor,
      items: q.items,
      subtotal: q.subtotal,
      taxAmount: q.taxAmount,
      discountAmount: q.discountAmount,
      totalAmount: q.totalAmount,
      deliveryDate: q.deliveryDate,
      validityDate: q.validityDate,
      paymentTerms: q.paymentTerms,
      warranty: q.warranty,
      status: q.status,
    }));

    return res.status(200).json({
      comparison,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error comparing quotations.",
      success: false,
      error: error.message,
    });
  }
};

// Get vendor's quotations
export const getMyQuotations = async (req, res) => {
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

    const quotations = await Quotation.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("purchaseRequest", "title requestNumber department status");

    const total = await Quotation.countDocuments(query);

    return res.status(200).json({
      quotations,
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
      message: "Error fetching quotations.",
      success: false,
      error: error.message,
    });
  }
};
