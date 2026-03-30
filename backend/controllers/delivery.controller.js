import { Delivery } from "../models/delivery.model.js";
import { PurchaseOrder } from "../models/purchaseOrder.model.js";
import { Vendor } from "../models/vendor.model.js";
import { Invoice } from "../models/invoice.model.js";

// Create a delivery record
export const createDelivery = async (req, res) => {
  try {
    const {
      purchaseOrderId,
      deliveryDate,
      deliveredBy,
      items,
      deliveryLocation,
      deliveryNotes,
      shippingDocuments,
    } = req.body;

    if (!purchaseOrderId || !deliveryDate || !items || !deliveryLocation) {
      return res.status(400).json({
        message:
          "Purchase order, delivery date, items, and location are required.",
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
      purchaseOrder.status !== "ordered" &&
      purchaseOrder.status !== "partial_delivered"
    ) {
      return res.status(400).json({
        message: "Purchase order must be in ordered status for delivery.",
        success: false,
      });
    }

    const itemsArray = JSON.parse(items);

    // Calculate remaining items
    const remainingItems = purchaseOrder.items.map((poItem) => {
      const deliveredItem = itemsArray.find(
        (di) => di.itemName === poItem.itemName
      );
      const deliveredQty = deliveredItem ? deliveredItem.deliveredQuantity : 0;
      return {
        itemName: poItem.itemName,
        remainingQuantity: poItem.quantity - deliveredQty,
      };
    });

    const delivery = await Delivery.create({
      purchaseOrder: purchaseOrderId,
      vendor: purchaseOrder.vendor._id,
      vendorName: purchaseOrder.vendorName,
      deliveryDate,
      deliveredBy: deliveredBy ? JSON.parse(deliveredBy) : undefined,
      items: itemsArray,
      deliveryLocation,
      deliveryNotes,
      shippingDocuments: shippingDocuments
        ? JSON.parse(shippingDocuments)
        : undefined,
      remainingItems,
      status: "pending",
    });

    // Update purchase order
    purchaseOrder.deliveries.push(delivery._id);

    // Check if partial or full delivery
    const totalOrdered = purchaseOrder.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    const totalDelivered = itemsArray.reduce(
      (sum, item) => sum + item.deliveredQuantity,
      0
    );

    if (totalDelivered < totalOrdered) {
      purchaseOrder.status = "partial_delivered";
    } else {
      purchaseOrder.status = "delivered";
    }

    await purchaseOrder.save();

    return res.status(201).json({
      message: "Delivery record created successfully.",
      delivery,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error creating delivery record.",
      success: false,
      error: error.message,
    });
  }
};

// Get all deliveries (with filters)
export const getAllDeliveries = async (req, res) => {
  try {
    const {
      status,
      vendor,
      purchaseOrder,
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (vendor) query.vendor = vendor;
    if (purchaseOrder) query.purchaseOrder = purchaseOrder;

    if (startDate || endDate) {
      query.deliveryDate = {};
      if (startDate) query.deliveryDate.$gte = new Date(startDate);
      if (endDate) query.deliveryDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const deliveries = await Delivery.find(query)
      .sort({ deliveryDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("vendor", "name email")
      .populate("purchaseOrder", "orderNumber")
      .populate("receivedBy", "fullname")
      .populate("inspectedBy", "fullname");

    const total = await Delivery.countDocuments(query);

    return res.status(200).json({
      deliveries,
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
      message: "Error fetching deliveries.",
      success: false,
      error: error.message,
    });
  }
};

// Get delivery by ID
export const getDeliveryById = async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const delivery = await Delivery.findById(deliveryId)
      .populate("vendor")
      .populate("purchaseOrder")
      .populate("receivedBy", "fullname email")
      .populate("inspectedBy", "fullname email");

    if (!delivery) {
      return res.status(404).json({
        message: "Delivery not found.",
        success: false,
      });
    }

    return res.status(200).json({
      delivery,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching delivery.",
      success: false,
      error: error.message,
    });
  }
};

// Get deliveries for a purchase order
export const getDeliveriesByPurchaseOrder = async (req, res) => {
  try {
    const { purchaseOrderId } = req.params;

    const deliveries = await Delivery.find({ purchaseOrder: purchaseOrderId })
      .sort({ deliveryDate: -1 })
      .populate("vendor", "name email");

    return res.status(200).json({
      deliveries,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching deliveries.",
      success: false,
      error: error.message,
    });
  }
};

// Update delivery status
export const updateDeliveryStatus = async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const { status, inspectionStatus, inspectionNotes, proofOfDelivery } =
      req.body;

    const delivery = await Delivery.findById(deliveryId);

    if (!delivery) {
      return res.status(404).json({
        message: "Delivery not found.",
        success: false,
      });
    }

    if (status) delivery.status = status;
    if (inspectionStatus) delivery.inspectionStatus = inspectionStatus;
    if (inspectionNotes) delivery.inspectionNotes = inspectionNotes;
    if (proofOfDelivery) delivery.proofOfDelivery = proofOfDelivery;

    await delivery.save();

    return res.status(200).json({
      message: "Delivery updated successfully.",
      delivery,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error updating delivery.",
      success: false,
      error: error.message,
    });
  }
};

// Receive delivery
export const receiveDelivery = async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const { items, receivedNotes } = req.body;

    const delivery = await Delivery.findById(deliveryId).populate(
      "purchaseOrder"
    );

    if (!delivery) {
      return res.status(404).json({
        message: "Delivery not found.",
        success: false,
      });
    }

    if (delivery.status === "received" || delivery.status === "cancelled") {
      return res.status(400).json({
        message: "Delivery already received or cancelled.",
        success: false,
      });
    }

    // Update item acceptance
    if (items) {
      const itemsArray = JSON.parse(items);
      delivery.items = delivery.items.map((item) => {
        const updatedItem = itemsArray.find(
          (ui) => ui.itemName === item.itemName
        );
        if (updatedItem) {
          return {
            ...item,
            acceptedQuantity: updatedItem.acceptedQuantity || 0,
            rejectedQuantity: updatedItem.rejectedQuantity || 0,
            condition: updatedItem.condition || "pending",
            remarks: updatedItem.remarks,
          };
        }
        return item;
      });
    }

    // Calculate totals
    const totalAccepted = delivery.items.reduce(
      (sum, item) => sum + (item.acceptedQuantity || 0),
      0
    );
    const totalDelivered = delivery.items.reduce(
      (sum, item) => sum + item.deliveredQuantity,
      0
    );
    const totalRejected = delivery.items.reduce(
      (sum, item) => sum + (item.rejectedQuantity || 0),
      0
    );

    delivery.receivedBy = req.id;
    delivery.receivedByName = (await User.findById(req.id)).fullname;
    delivery.receivedDate = new Date();
    delivery.deliveryNotes = receivedNotes;

    // Update status based on inspection
    if (totalRejected > 0) {
      if (totalAccepted === 0) {
        delivery.status = "rejected";
      } else {
        delivery.status = "partially_received";
      }
    } else {
      delivery.status = "received";
    }

    // Check if all items are fully received
    if (totalAccepted === totalDelivered) {
      delivery.isComplete = true;
    }

    await delivery.save();

    // Update purchase order delivered quantities
    const purchaseOrder = await PurchaseOrder.findById(
      delivery.purchaseOrder._id
    );
    purchaseOrder.items = purchaseOrder.items.map((poItem) => {
      const deliveredItem = delivery.items.find(
        (di) => di.itemName === poItem.itemName
      );
      if (deliveredItem) {
        return {
          ...poItem._doc,
          deliveredQuantity:
            (poItem.deliveredQuantity || 0) +
            (deliveredItem.acceptedQuantity || 0),
        };
      }
      return poItem;
    });

    // Update PO status
    const allDelivered = purchaseOrder.items.every(
      (item) => (item.deliveredQuantity || 0) >= item.quantity
    );
    if (allDelivered) {
      purchaseOrder.status = "delivered";
    } else if (purchaseOrder.deliveries.length > 0) {
      purchaseOrder.status = "partial_delivered";
    }

    await purchaseOrder.save();

    return res.status(200).json({
      message: "Delivery received successfully.",
      delivery,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error receiving delivery.",
      success: false,
      error: error.message,
    });
  }
};

// Inspect delivery
export const inspectDelivery = async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const { inspectionStatus, inspectionNotes } = req.body;

    const delivery = await Delivery.findById(deliveryId);

    if (!delivery) {
      return res.status(404).json({
        message: "Delivery not found.",
        success: false,
      });
    }

    delivery.inspectionStatus = inspectionStatus;
    delivery.inspectionNotes = inspectionNotes;
    delivery.inspectionDate = new Date();
    delivery.inspectedBy = req.id;

    await delivery.save();

    return res.status(200).json({
      message: "Inspection completed successfully.",
      delivery,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error inspecting delivery.",
      success: false,
      error: error.message,
    });
  }
};

// Cancel delivery
export const cancelDelivery = async (req, res) => {
  try {
    const deliveryId = req.params.id;

    const delivery = await Delivery.findById(deliveryId);

    if (!delivery) {
      return res.status(404).json({
        message: "Delivery not found.",
        success: false,
      });
    }

    if (delivery.status === "received" || delivery.status === "cancelled") {
      return res.status(400).json({
        message: "Cannot cancel received or already cancelled delivery.",
        success: false,
      });
    }

    delivery.status = "cancelled";
    await delivery.save();

    return res.status(200).json({
      message: "Delivery cancelled.",
      delivery,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error cancelling delivery.",
      success: false,
      error: error.message,
    });
  }
};

// Get delivery statistics
export const getDeliveryStats = async (req, res) => {
  try {
    const totalDeliveries = await Delivery.countDocuments();
    const pendingDeliveries = await Delivery.countDocuments({
      status: "pending",
    });
    const inTransitDeliveries = await Delivery.countDocuments({
      status: "in_transit",
    });
    const deliveredDeliveries = await Delivery.countDocuments({
      status: { $in: ["delivered", "received"] },
    });
    const rejectedDeliveries = await Delivery.countDocuments({
      status: "rejected",
    });

    const statusStats = await Delivery.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const inspectionStats = await Delivery.aggregate([
      { $group: { _id: "$inspectionStatus", count: { $sum: 1 } } },
    ]);

    return res.status(200).json({
      stats: {
        totalDeliveries,
        pendingDeliveries,
        inTransitDeliveries,
        deliveredDeliveries,
        rejectedDeliveries,
        statusStats,
        inspectionStats,
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
