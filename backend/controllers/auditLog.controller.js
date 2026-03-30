import { AuditLog } from "../models/auditLog.model.js";

// Create an audit log entry
export const createAuditLog = async (data) => {
  try {
    const log = await AuditLog.log(data);
    return log;
  } catch (error) {
    console.error("Error creating audit log:", error);
  }
};

// Get all audit logs (with filters)
export const getAllAuditLogs = async (req, res) => {
  try {
    const {
      action,
      entityType,
      user,
      status,
      module,
      search,
      page = 1,
      limit = 50,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (user) query.user = user;
    if (status) query.status = status;
    if (module) query.module = module;

    if (search) {
      query.$or = [
        { logNumber: { $regex: search, $options: "i" } },
        { entityName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { userName: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const auditLogs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("user", "fullname email role");

    const total = await AuditLog.countDocuments(query);

    return res.status(200).json({
      auditLogs,
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
      message: "Error fetching audit logs.",
      success: false,
      error: error.message,
    });
  }
};

// Get audit log by ID
export const getAuditLogById = async (req, res) => {
  try {
    const logId = req.params.id;
    const auditLog = await AuditLog.findById(logId).populate(
      "user",
      "fullname email role"
    );

    if (!auditLog) {
      return res.status(404).json({
        message: "Audit log not found.",
        success: false,
      });
    }

    return res.status(200).json({
      auditLog,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error fetching audit log.",
      success: false,
      error: error.message,
    });
  }
};

// Get entity history
export const getEntityHistory = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 50, startDate, endDate } = req.query;

    const logs = await AuditLog.getEntityHistory(entityType, entityId, {
      limit: parseInt(limit),
      skip: (page - 1) * limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    const total = await AuditLog.countDocuments({ entityType, entityId });

    return res.status(200).json({
      logs,
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
      message: "Error fetching entity history.",
      success: false,
      error: error.message,
    });
  }
};

// Get user activity
export const getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50, startDate, endDate } = req.query;

    const logs = await AuditLog.getUserActivity(userId, {
      limit: parseInt(limit),
      skip: (page - 1) * limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    const total = await AuditLog.countDocuments({ user: userId });

    return res.status(200).json({
      logs,
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
      message: "Error fetching user activity.",
      success: false,
      error: error.message,
    });
  }
};

// Get my activity (current user)
export const getMyActivity = async (req, res) => {
  try {
    const { page = 1, limit = 50, startDate, endDate } = req.query;

    const logs = await AuditLog.getUserActivity(req.id, {
      limit: parseInt(limit),
      skip: (page - 1) * limit,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    const total = await AuditLog.countDocuments({ user: req.id });

    return res.status(200).json({
      logs,
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
      message: "Error fetching activity.",
      success: false,
      error: error.message,
    });
  }
};

// Get audit statistics
export const getAuditStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const query =
      Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const totalLogs = await AuditLog.countDocuments(query);

    const actionStats = await AuditLog.aggregate([
      { $match: query },
      { $group: { _id: "$action", count: { $sum: 1 } } },
    ]);

    const entityTypeStats = await AuditLog.aggregate([
      { $match: query },
      { $group: { _id: "$entityType", count: { $sum: 1 } } },
    ]);

    const statusStats = await AuditLog.aggregate([
      { $match: query },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const userActivityStats = await AuditLog.aggregate([
      { $match: query },
      { $group: { _id: "$user", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          userName: "$user.fullname",
          userEmail: "$user.email",
          count: 1,
        },
      },
    ]);

    const moduleStats = await AuditLog.aggregate([
      { $match: query },
      { $group: { _id: "$module", count: { $sum: 1 } } },
    ]);

    // Daily activity for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await AuditLog.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      stats: {
        totalLogs,
        actionStats,
        entityTypeStats,
        statusStats,
        userActivityStats,
        moduleStats,
        dailyStats,
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

// Export audit logs
export const exportAuditLogs = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      entityType,
      action,
      format = "json",
    } = req.query;

    const query = {};

    if (entityType) query.entityType = entityType;
    if (action) query.action = action;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .populate("user", "fullname email role");

    if (format === "csv") {
      // Convert to CSV
      const headers = [
        "Log Number",
        "Action",
        "Entity Type",
        "Entity Name",
        "User",
        "Email",
        "Role",
        "Status",
        "Description",
        "Date",
      ];
      const rows = logs.map((log) => [
        log.logNumber,
        log.action,
        log.entityType,
        log.entityName || "",
        log.userName,
        log.userEmail,
        log.userRole,
        log.status,
        log.description,
        log.createdAt.toISOString(),
      ]);

      const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=audit_logs.csv"
      );
      return res.send(csv);
    }

    return res.status(200).json({
      logs,
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error exporting audit logs.",
      success: false,
      error: error.message,
    });
  }
};
