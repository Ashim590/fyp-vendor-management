import { Notification } from "../models/notification.model.js";

export const getMyNotifications = async (req, res) => {
  try {
    const { limit = 50, unreadOnly } = req.query;
    const query = { user: req.id };
    if (unreadOnly === "true") query.read = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({
      user: req.id,
      read: false,
    });

    return res.status(200).json({
      notifications,
      unreadCount,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error fetching notifications.",
      success: false,
      error: error.message,
    });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found.",
        success: false,
      });
    }

    return res.status(200).json({
      notification,
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error updating notification.",
      success: false,
      error: error.message,
    });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.id }, { read: true });
    return res.status(200).json({
      message: "All notifications marked as read.",
      success: true,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error updating notifications.",
      success: false,
      error: error.message,
    });
  }
};
