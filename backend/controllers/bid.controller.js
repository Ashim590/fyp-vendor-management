import { Bid } from "../models/bid.model.js";
import { Tender } from "../models/tender.model.js";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";

export const submitBid = async (req, res) => {
  try {
    const { tenderId, amount, technicalProposal, financialProposal, documents } = req.body;

    if (!tenderId || amount === undefined) {
      return res.status(400).json({
        message: "Tender ID and amount are required.",
        success: false,
      });
    }

    const tender = await Tender.findById(tenderId);
    if (!tender) {
      return res.status(404).json({
        message: "Tender not found.",
        success: false,
      });
    }
    if (tender.status !== "PUBLISHED") {
      return res.status(400).json({
        message: "Tender is not open for bids.",
        success: false,
      });
    }

    const user = await User.findById(req.id).populate("vendorProfile");
    const vendorId = user?.vendorProfile?._id || user?.vendorProfile;
    if (!vendorId) {
      return res.status(400).json({
        message: "No vendor profile linked. Complete vendor registration first.",
        success: false,
      });
    }

    const existing = await Bid.findOne({ tender: tenderId, vendor: vendorId });
    if (existing) {
      return res.status(400).json({
        message: "You have already submitted a bid for this tender.",
        success: false,
      });
    }

    const bid = await Bid.create({
      tender: tenderId,
      vendor: vendorId,
      amount: Number(amount),
      technicalProposal: technicalProposal || "",
      financialProposal: financialProposal || "",
      documents: documents || [],
      status: "SUBMITTED",
    });

    // Notify tender creator (procurement officer)
    const createdBy = tender.createdBy;
    if (createdBy) {
      await Notification.create({
        user: createdBy,
        title: "New bid submitted",
        body: `A new bid was submitted for tender "${tender.title}" (${tender.referenceNumber}).`,
        link: `/tenders/${tenderId}/bids`,
        type: "bid_submitted",
      });
    }

    return res.status(201).json({
      message: "Bid submitted successfully.",
      bid,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error submitting bid.",
      success: false,
      error: error.message,
    });
  }
};

export const getBidsByTender = async (req, res) => {
  try {
    const { id } = req.params;
    const bids = await Bid.find({ tender: id })
      .populate("vendor", "name email category phoneNumber")
      .sort({ amount: 1, createdAt: -1 });

    return res.status(200).json({
      bids,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error fetching bids.",
      success: false,
      error: error.message,
    });
  }
};

export const getMyBids = async (req, res) => {
  try {
    const user = await User.findById(req.id).populate("vendorProfile");
    const vendorId = user?.vendorProfile?._id || user?.vendorProfile;
    if (!vendorId) {
      return res.status(200).json({ bids: [], success: true });
    }

    const bids = await Bid.find({ vendor: vendorId })
      .populate("tender", "title referenceNumber status closeDate")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      bids,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error fetching your bids.",
      success: false,
      error: error.message,
    });
  }
};

export const getBidById = async (req, res) => {
  try {
    const bid = await Bid.findById(req.params.id)
      .populate("tender", "title referenceNumber status")
      .populate("vendor", "name email category contactPerson");

    if (!bid) {
      return res.status(404).json({
        message: "Bid not found.",
        success: false,
      });
    }

    return res.status(200).json({
      bid,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error fetching bid.",
      success: false,
      error: error.message,
    });
  }
};

export const acceptBid = async (req, res) => {
  try {
    const { id } = req.params;
    const bid = await Bid.findById(id).populate("tender vendor");
    if (!bid) {
      return res.status(404).json({
        message: "Bid not found.",
        success: false,
      });
    }

    const tender = await Tender.findByIdAndUpdate(
      bid.tender._id,
      { status: "AWARDED", awardedVendor: bid.vendor._id },
      { new: true }
    );

    await Bid.updateMany(
      { tender: bid.tender._id, _id: { $ne: id } },
      { status: "REJECTED" }
    );
    bid.status = "ACCEPTED";
    await bid.save();

    // Notify vendor
    const owner = await User.findOne({ vendorProfile: bid.vendor._id });
    if (owner) {
      await Notification.create({
        user: owner._id,
        title: "Bid accepted",
        body: `Your bid for tender "${bid.tender.title}" has been accepted.`,
        link: "/my-bids",
        type: "bid_accepted",
      });
    }

    return res.status(200).json({
      message: "Bid accepted and tender awarded.",
      bid,
      tender,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error accepting bid.",
      success: false,
      error: error.message,
    });
  }
};

export const rejectBid = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const bid = await Bid.findByIdAndUpdate(
      id,
      { status: "REJECTED", rejectionReason: rejectionReason || "" },
      { new: true }
    )
      .populate("tender", "title")
      .populate("vendor", "_id");

    if (!bid) {
      return res.status(404).json({
        message: "Bid not found.",
        success: false,
      });
    }

    const owner = await User.findOne({ vendorProfile: bid.vendor._id });
    if (owner) {
      await Notification.create({
        user: owner._id,
        title: "Bid rejected",
        body: `Your bid for tender "${bid.tender.title}" was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`,
        link: "/my-bids",
        type: "bid_rejected",
      });
    }

    return res.status(200).json({
      message: "Bid rejected.",
      bid,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error rejecting bid.",
      success: false,
      error: error.message,
    });
  }
};
