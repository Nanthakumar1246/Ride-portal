
import { findModuleHistory } from "../models/moduleHistory.model.js";

export async function getModuleHistoryHandler(req, res) {
  try {
    const { module } = req.query;
    if (!module) return res.status(400).json({ success: false, message: "module is required" });

    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const offset = (page - 1) * limit;
    const programManager = req.user?.role === "PM" ? req.user.name : null;

    const { rows, total } = await findModuleHistory({ module, limit, offset, programManager });

    return res.json({
      success: true,
      rows,
      limit,
      offset,
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      total,
    });
  } catch (err) {
    console.error("Error loading module history", err);
    return res.status(500).json({ success: false, message: "Failed to load history" });
  }
}
