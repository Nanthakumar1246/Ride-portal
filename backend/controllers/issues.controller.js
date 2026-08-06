import { buildIssueFilters, applyRoleRestrictions } from "../utils/filters.utils.js";
import { getAssignedProjects } from "../models/users.model.js";
import {
  findIssues,
  findIssueById,
  createIssue as createIssueModel,
  updateIssue as updateIssueModel,
  findIssuesByIds,
  deleteMultipleIssues
} from "../models/issues.model.js";
import {
  createResolutionNotification,
  decideNotification,
  createBmNotificationForIssueDecision,
} from "../models/notifications.model.js";
import { sendSuccess, sendError } from "../utils/response.utils.js";
import { sendNewItemEmailNotification, sendGovernanceEventMail } from "../utils/email.utils.js";
import { notifyRecordEvent } from "../utils/notify.utils.js";
import { createModuleHistory } from "../models/moduleHistory.model.js";
import { isValidBehalfOf } from "../utils/validation.utils.js";
import pool from "../db.js";

export async function listIssues(req, res) {
  try {
    const user = req.user;
    const augmentedQuery = await applyRoleRestrictions(user, req.query);
    const filters = buildIssueFilters(augmentedQuery);

    const rows = await findIssues(filters);
    return sendSuccess(res, rows);
  } catch (err) {
    console.error("issues.listIssues error", err);
    return sendError(res, 500, "Failed to fetch issues");
  }
}

export async function createIssue(req, res) {
  try {
    const payload = {
      ...req.body,
      reported_by: req.user.email,
    };
    const issue = await createIssueModel(payload);
    return sendSuccess(res, issue, 201);
  } catch (err) {
    return sendError(res, 500, "Failed to create issue");
  }
}

export async function getIssue(req, res) {
  try {
    const { id } = req.params;
    const issue = await findIssueById(id);
    if (!issue) return sendError(res, 404, "Issue not found");

    if (req.user.role === "PM" && issue.project_manager !== req.user.name) {
      return sendError(res, 403, "Forbidden: Not assigned to this record");
    }

    return sendSuccess(res, issue);
  } catch (err) {
    console.error("Error getting issue", err);
    return sendError(res, 500, "Failed to get issue");
  }
}

export async function createIssueHandler(req, res) {
  try {
    if (!req.user || !req.user.email) {
      return sendError(res, 401, "User not authenticated");
    }
    if (!isValidBehalfOf(req.body.behalf_of)) {
      return sendError(res, 400, "Behalf Of must be a valid @arche.global email address");
    }

    const { generateEntityId } = await import("../utils/idGenerator.js");
    let existingIssue = null;
    if (req.body.issue_id && req.body.issue_id.trim() !== "") {
      existingIssue = await findIssueById(req.body.issue_id.trim());
    }

    if (!req.body.issue_id || req.body.issue_id.trim() === "" || existingIssue) {
      req.body.issue_id = await generateEntityId(
        req.user.email,
        req.body.account || "Default",
        "issue"
      );
    }

    const payload = { ...req.body };
    payload.reported_date = payload.reported_date || payload.identified_date || new Date();

    if (payload.reported_date) {
      const d = new Date(payload.reported_date);
      payload.reported_date = d.toISOString().slice(0, 10);
    }

    if (req.user.role !== "ADMIN") {
      payload.reported_by = req.user.email;
    } else {
      payload.reported_by = payload.reported_by || payload.identified_by || req.user.email;
    }

    delete payload.identified_date;
    delete payload.identified_by;


    [
      "manual_project_id",
      "project_description",
      "account",
      "severity",
      "probability",

    ].forEach(f => {
      if (payload[f] === undefined) payload[f] = null;
    });

    let created;
    try {
      created = await createIssueModel(payload);
    } catch (dbErr) {
      if (dbErr.code === '23505') {
        payload.issue_id = await generateEntityId(req.user.email, req.body.account || "Default", "issue");
        created = await createIssueModel(payload);
      } else {
        throw dbErr;
      }
    }

    if (req.user?.email) {
      await createResolutionNotification({
        module: "issue",
        itemId: created.id,
        itemCode: created.issue_id,
        statusBefore: "N/A (New Record)",
        statusAfter: payload.status || "Open",
        payload: {
          account: created.account,
          manual_project_id: created.manual_project_id,
          priority: created.priority,
          category: created.category,
          issue_title: created.issue_title,
          reported_date: created.reported_date,
          mitigation_owner: created.assigned_to || created.reported_by,
          reported_by: created.reported_by
        },
        bmUser: req.user.email,
      });

      try {
        const isOnBehalf = created.reported_by && req.user.email && created.reported_by.toLowerCase() !== req.user.email.toLowerCase();
        await sendGovernanceEventMail({
          module: "issue",
          recordId: created.issue_id,
          eventType: isOnBehalf ? "ON_BEHALF_CREATED" : "NEW_RECORD",
          recordData: created,
          currentUserEmail: req.user.email
        });
      } catch (emailErr) {
        console.error("[Email Trigger Error]", emailErr.message);
      }
    }

    return sendSuccess(res, created, 201);
  } catch (err) {
    console.error("Error creating issue", err);
    return sendError(res, 500, `Failed to create issue: ${err.message}`);
  }
}

export async function updateIssueHandler(req, res) {
  try {
    const { id } = req.params;
    if (!isValidBehalfOf(req.body.behalf_of)) {
      return sendError(res, 400, "Behalf Of must be a valid @arche.global email address");
    }
    const existing = await findIssueById(id);
    if (!existing) return sendError(res, 404, "Issue not found");

    const payload = { ...req.body };
    payload.reported_date = payload.reported_date || payload.identified_date || existing.reported_date;

    if (req.user.role !== "ADMIN") {
      payload.reported_by = existing.reported_by;
    } else {
      payload.reported_by = payload.reported_by || payload.identified_by || existing.reported_by;
    }

    delete payload.identified_date;
    delete payload.identified_by;

    const oldStatus = existing.status;
    const newStatus = payload.status;

    const updated = await updateIssueModel(id, payload);

    if (payload.remarks || (newStatus && oldStatus !== newStatus)) {
      try {
        await createModuleHistory({
          module: "issues",
          record_id: existing.issue_id || existing.id,
          updated_by: req.user?.email,
          old_status: oldStatus,
          new_status: newStatus,
          remarks: payload.remarks || payload.comments,
        });
      } catch (hErr) {
        console.error("Failed to save issue history entry:", hErr);
      }
    }

    const normalize = (s) => s?.trim().toLowerCase();
    const becameResolved =
      normalize(oldStatus) !== "resolved" &&
      normalize(newStatus) === "resolved";

    if (becameResolved && req.user?.email) {
      await createResolutionNotification({
        module: "issue",
        itemId: updated.id,
        itemCode: updated.issue_id,
        statusBefore: oldStatus,
        statusAfter: newStatus,
        payload: {
          account: existing.account, manual_project_id: existing.manual_project_id,
          priority: updated.priority,
          category: updated.category,
          issue_title: updated.issue_title,
          reported_date: updated.reported_date,
        },
        bmUser: req.user.email,
      });
    }

    if (newStatus && oldStatus !== newStatus) {
      try {
        await notifyRecordEvent({
          module: "issue",
          recordId: existing.issue_id || updated.issue_id,
          eventType: "STATUS_CHANGED",
          recordData: {
            ...updated,
            statusBefore: oldStatus,
            statusAfter: newStatus,
            remarks: payload.remarks || payload.comments
          },
          currentUserEmail: req.user?.email,
          title: `Status changed: ${existing.issue_id || updated.issue_id}`,
          message: `${oldStatus} → ${newStatus}`
        });
      } catch (eErr) {
        console.error("[Email Status Update Error]", eErr.message);
      }
    }

    return sendSuccess(res, updated);
  } catch (err) {
    console.error("Error updating issue", err);
    return sendError(res, 500, "Failed to update issue");
  }
}

export async function decideIssueResolution(req, res) {
  try {
    const { notificationId } = req.params;
    const { decision, comment } = req.body;
    const adminUser = req.user?.email || null;

    if (!decision) {
      return sendError(res, 400, "Decision required");
    }

    const decided = await decideNotification({
      id: notificationId,
      adminUser,
      decision,
      comment,
    });
    return sendSuccess(res, decided);
  } catch (err) {
    console.error("Issue decision failed", err);
    return sendError(res, 500, "Failed to process decision");
  }
}

export const deleteIssuesHandler = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 400, "No ids provided for deletion.");
    }

    if (req.user?.role === "ADMIN") {
      return sendError(res, 403, "Admins are not allowed to delete issues.");
    }

    const records = await findIssuesByIds(ids);
    if (!records.length) {
      return sendError(res, 404, "None of the specified entries were found.");
    }

    if (req.user?.role !== "ADMIN") {
      const today = new Date().toDateString();
      for (const r of records) {
        // Fallback checks for various date structures just in case
        const dateRaw = r.created_at || r.identified_date || r.reported_date || r.received_date || Date.now();
        const createdAt = new Date(dateRaw).toDateString();
        if (createdAt !== today) {
          return sendError(res, 403, "Deletion is restricted to same-day entries only.");
        }
      }
    }

    const deletedCount = await deleteMultipleIssues(ids);
    return sendSuccess(res, { deleted: deletedCount }, 200, "Issues deleted successfully");
  } catch (error) {
    console.error("deleteIssuesHandler error:", error);
    sendError(res, 500, "Internal Server Error");
  }
};
