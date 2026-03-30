import { Vendor } from "../models/vendor.model.js";
import { User } from "../models/user.model.js";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";

// Register a new vendor
export const registerVendor = async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      address,
      description,
      website,
      category,
      taxId,
      businessLicense,
      contactPerson,
    } = req.body;

    if (!name || !email || !phoneNumber) {
      return res.status(400).json({
        message: "Name, email, and phone number are required.",
        success: false,
      });
    }

    const existingVendor = await Vendor.findOne({ email });
    if (existingVendor) {
      return res.status(400).json({
        message: "Vendor already exists with this email.",
        success: false,
      });
    }

    let logoUrl = "";
    if (req.file) {
      const fileUri = getDataUri(req.file);
      const cloudResponse = await cloudinary.uploader.upload(fileUri.content);
      logoUrl = cloudResponse.secure_url;
    }

    const vendor = await Vendor.create({
      name,
      email,
      phoneNumber,
      address,
      description,
      website,
      category,
      taxId,
      businessLicense,
      logo: logoUrl,
      contactPerson: contactPerson ? JSON.parse(contactPerson) : undefined,
      registeredBy: req.id,
      status: "pending",
    });

    // Link this vendor profile to the logged-in user (for role vendor)
    await User.findByIdAndUpdate(req.id, { vendorProfile: vendor._id });

    return res.status(201).json({
      message: "Vendor registered successfully.",
      vendor,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error registering vendor.",
      success: false,
      error: error.message,
    });
  }
};

// Get all vendors (with filters)
export const getAllVendors = async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 10 } = req.query;

    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const vendors = await Vendor.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("registeredBy", "fullname email");

    const total = await Vendor.countDocuments(query);

    return res.status(200).json({
      vendors,
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
      message: "Error fetching vendors.",
      success: false,
      error: error.message,
    });
  }
};

// Get current user's vendor profile (for role vendor)
export const getMyVendorProfile = async (req, res) => {
  try {
    const user = await User.findById(req.id).populate("vendorProfile");
    const vendor = user?.vendorProfile;
    if (!vendor) {
      return res.status(404).json({
        message: "No vendor profile found. Complete your vendor registration.",
        success: false,
      });
    }
    return res.status(200).json({
      vendor,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching vendor profile.",
      success: false,
      error: error.message,
    });
  }
};

// Get vendor by ID
export const getVendorById = async (req, res) => {
  try {
    const vendorId = req.params.id;
    const vendor = await Vendor.findById(vendorId).populate(
      "registeredBy",
      "fullname email"
    );

    if (!vendor) {
      return res.status(404).json({
        message: "Vendor not found.",
        success: false,
      });
    }

    return res.status(200).json({
      vendor,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching vendor.",
      success: false,
      error: error.message,
    });
  }
};

// Update vendor
export const updateVendor = async (req, res) => {
  try {
    const vendorId = req.params.id;
    const {
      name,
      email,
      phoneNumber,
      address,
      description,
      website,
      category,
      taxId,
      businessLicense,
      contactPerson,
      status,
      rating,
    } = req.body;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        message: "Vendor not found.",
        success: false,
      });
    }

    let logoUrl = vendor.logo;
    if (req.file) {
      const fileUri = getDataUri(req.file);
      const cloudResponse = await cloudinary.uploader.upload(fileUri.content);
      logoUrl = cloudResponse.secure_url;
    }

    const updateData = {
      name: name || vendor.name,
      email: email || vendor.email,
      phoneNumber: phoneNumber || vendor.phoneNumber,
      address: address || vendor.address,
      description: description || vendor.description,
      website: website || vendor.website,
      category: category || vendor.category,
      taxId: taxId || vendor.taxId,
      businessLicense: businessLicense || vendor.businessLicense,
      logo: logoUrl,
      status: status || vendor.status,
      rating: rating || vendor.rating,
    };

    if (contactPerson) {
      updateData.contactPerson = JSON.parse(contactPerson);
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(vendorId, updateData, {
      new: true,
    });

    return res.status(200).json({
      message: "Vendor updated successfully.",
      vendor: updatedVendor,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error updating vendor.",
      success: false,
      error: error.message,
    });
  }
};

// Approve vendor
export const approveVendor = async (req, res) => {
  try {
    const vendorId = req.params.id;

    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      { status: "approved", isVerified: true },
      { new: true }
    );

    if (!vendor) {
      return res.status(404).json({
        message: "Vendor not found.",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Vendor approved successfully.",
      vendor,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error approving vendor.",
      success: false,
      error: error.message,
    });
  }
};

// Reject vendor
export const rejectVendor = async (req, res) => {
  try {
    const vendorId = req.params.id;
    const { rejectionReason } = req.body;

    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      { status: "rejected" },
      { new: true }
    );

    if (!vendor) {
      return res.status(404).json({
        message: "Vendor not found.",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Vendor rejected.",
      vendor,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error rejecting vendor.",
      success: false,
      error: error.message,
    });
  }
};

// Delete vendor (soft delete)
export const deleteVendor = async (req, res) => {
  try {
    const vendorId = req.params.id;

    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      { status: "suspended" },
      { new: true }
    );

    if (!vendor) {
      return res.status(404).json({
        message: "Vendor not found.",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Vendor suspended successfully.",
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error suspending vendor.",
      success: false,
      error: error.message,
    });
  }
};

// Get vendor statistics
export const getVendorStats = async (req, res) => {
  try {
    const totalVendors = await Vendor.countDocuments();
    const approvedVendors = await Vendor.countDocuments({ status: "approved" });
    const pendingVendors = await Vendor.countDocuments({ status: "pending" });
    const suspendedVendors = await Vendor.countDocuments({
      status: { $in: ["suspended", "rejected"] },
    });

    const categoryStats = await Vendor.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    return res.status(200).json({
      stats: {
        totalVendors,
        approvedVendors,
        pendingVendors,
        suspendedVendors,
        categoryStats,
      },
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching vendor stats.",
      success: false,
      error: error.message,
    });
  }
};
