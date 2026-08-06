
import {
  findNotificationsForUser,
  countUnreadForUser,
  markNotificationRead,
  markAllNotificationsRead,
} from "../models/appNotifications.model.js";
import { sendSuccess, sendError } from "../utils/response.utils.js";

export async function listMyNotifications(req, res) {
  try {
    const email = req.user.email;
    const unreadOnly = req.query.unread === "true";
    const rows = await findNotificationsForUser(email, { limit: Number(req.query.limit) || 20, unreadOnly });
    const unreadCount = await countUnreadForUser(email);
    return sendSuccess(res, { rows, unreadCount });
  } catch (err) {
    console.error("Error listing notifications", err);
    return sendError(res, 500, "Failed to list notifications");
  }
}

export async function markRead(req, res) {
  try {
    const { id } = req.params;
    const row = await markNotificationRead(id, req.user.email);
    if (!row) return sendError(res, 404, "Notification not found");
    return sendSuccess(res, row);
  } catch (err) {
    console.error("Error marking notification read", err);
    return sendError(res, 500, "Failed to update notification");
  }
}

export async function markAllRead(req, res) {
  try {
    await markAllNotificationsRead(req.user.email);
    return sendSuccess(res, { message: "All notifications marked read" });
  } catch (err) {
    console.error("Error marking all notifications read", err);
    return sendError(res, 500, "Failed to update notifications");
  }
}
