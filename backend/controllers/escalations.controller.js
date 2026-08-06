
import { buildEscalationFilters, applyRoleRestrictions } from "../utils/filters.utils.js";
import { getAssignedProjects } from "../models/users.model.js";
import {
  findEscalations,
  findEscalationById,
  createEscalation,
  updateEscalation,
  findEscalationsByIds,
  deleteMultipleEscalations
} from "../models/escalations.model.js";

import {
  createResolutionNotification,
  decideNotification,
} from "../models/notifications.model.js";
import { sendSuccess, sendError } from "../utils/response.utils.js";
import { sendGovernanceEventMail } from "../utils/email.utils.js";
import { notifyRecordEvent } from "../utils/notify.utils.js";
import { createModuleHistory } from "../models/moduleHistory.model.js";
import { isValidBehalfOf } from "../utils/validation.utils.js";
import pool from "../db.js";

export async function listEscalations(req, res) {
  try {
    const user = req.user;
    const augmentedQuery = await applyRoleRestrictions(user, req.query);
    const filters = buildEscalationFilters(augmentedQuery);

    const rows = await findEscalations(filters);
    return sendSuccess(res, rows);
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Failed to list escalations");
  }
}
export async function getEscalation(req, res) {
  try {
    const row = await findEscalationById(req.params.id);
    if (!row) return sendError(res, 404, "Escalation not found");

    if (req.user.role === "PM") {
      if (row.project_manager !== req.user.name) {
        return sendError(res, 403, "Forbidden: Not assigned to this record");
      }
    } else if (req.user.role !== "ADMIN") {
      const assigned = await getAssignedProjects(req.user.id);
      const projectIds = assigned.map(p => p.id);
      if (!projectIds.includes(row.project_id)) {
        return sendError(res, 403, "Access denied: Not assigned to this project");
      }
    }

    return sendSuccess(res, row);
  } catch (err) {
    return sendError(res, 500, "Failed to get escalation");
  }
}

export async function createEscalationHandler(req, res) {
  try {
    if (!isValidBehalfOf(req.body.behalf_of)) {
      return sendError(res, 400, "Behalf Of must be a valid @arche.global email address");
    }
    if (!req.body.escalation_id || req.body.escalation_id.trim() === "") {
      const { generateEntityId } = await import("../utils/idGenerator.js");
      req.body.escalation_id = await generateEntityId(
        req.user.email,
        req.body.account || "Default",
        "escalation"
      );
    }

    const payload = {
      ...req.body,
      created_by: req.user.id
    };


    ["project_id", "project_description", "account"].forEach(f => {
      if (payload[f] === undefined) payload[f] = null;
    });

    const created = await createEscalation(
      payload,
      req.user.id
    );

    if (req.user?.email) {
      await createResolutionNotification({
        module: "escalation",
        itemId: created.id,
        itemCode: created.escalation_id,
        statusBefore: "N/A (New Record)",
        statusAfter: payload.status || "Open",
        payload: {
          title: created.title,
          priority: created.priority,
          category: created.category,
          escalated_to: created.escalated_to,
          mitigation_owner: created.escalated_to || created.reported_by,
          project_id: created.manual_project_id || created.project_id,
          account: created.account
        },
        bmUser: req.user.email,
      });
    }

    try {
      const isOnBehalf = created.reported_by && req.user?.email && created.reported_by.toLowerCase() !== req.user.email.toLowerCase();
      await sendGovernanceEventMail({
        module: "escalation",
        recordId: created.escalation_id,
        eventType: isOnBehalf ? "ON_BEHALF_CREATED" : "NEW_RECORD",
        recordData: created,
        currentUserEmail: req.user?.email
      });
    } catch (eErr) {
      console.error("[Escalation Email Error]", eErr.message);
    }

    return sendSuccess(res, created, 201);

  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Failed to create escalation");
  }
}

export async function updateEscalationHandler(req, res) {
  try {
    const { id } = req.params;
    const payload = req.body;

    if (!isValidBehalfOf(payload.behalf_of)) {
      return sendError(res, 400, "Behalf Of must be a valid @arche.global email address");
    }

    const existing = await findEscalationById(id);
    if (!existing) return sendError(res, 404, "Escalation not found");

    const oldStatus = existing.status;
    const newStatus = payload.status;

    const updated = await updateEscalation(id, payload);
    if (!updated) return sendError(res, 404, "Escalation not found");

    // Save history timeline entry
    if (payload.remarks || (newStatus && oldStatus !== newStatus)) {
      try {
        await createModuleHistory({
          module: "escalations",
          record_id: existing.escalation_id || existing.id,
          updated_by: req.user?.email,
          old_status: oldStatus,
          new_status: newStatus,
          remarks: payload.remarks || payload.comments,
        });
      } catch (hErr) {
        console.error("Failed to save escalation history entry:", hErr);
      }
    }

    const normalize = (s) => s?.trim().toLowerCase();
    const becameResolved =
      normalize(oldStatus) !== "resolved" &&
      normalize(newStatus) === "resolved";

    if (becameResolved && req.user?.email) {
      await createResolutionNotification({
        module: "escalation",
        itemId: updated.id,
        itemCode: updated.escalation_id,
        statusBefore: oldStatus,
        statusAfter: newStatus,
        payload: {
          account: updated.account,
          project_id: updated.manual_project_id || updated.project_id,
          priority: updated.priority,
          category: updated.category,
          escalated_to: updated.escalated_to,
          title: updated.title,
          reported_date: updated.reported_date,
        },
        bmUser: req.user.email,
      });
    }

    if (newStatus && oldStatus !== newStatus) {
      try {
        await notifyRecordEvent({
          module: "escalation",
          recordId: existing.escalation_id || updated.escalation_id,
          eventType: "STATUS_CHANGED",
          recordData: {
            ...updated,
            statusBefore: oldStatus,
            statusAfter: newStatus,
            remarks: payload.remarks || payload.comments
          },
          currentUserEmail: req.user?.email,
          title: `Status changed: ${existing.escalation_id || updated.escalation_id}`,
          message: `${oldStatus} → ${newStatus}`
        });
      } catch (eErr) {
        console.error("[Escalation Status Email Error]", eErr.message);
      }
    }

    return sendSuccess(res, updated);
  } catch (err) {
    console.error("Error updating escalation", err);
    return sendError(res, 500, "Failed to update escalation");
  }
}

export async function decideEscalationResolution(req, res) {
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
    console.error("Escalation decision failed", err);
    return sendError(res, 500, "Failed to process decision");
  }
}

export async function resolveEscalation(req, res) {
  try {
    const { id } = req.params;
    const { status, resolution_details } = req.body;
    const files = req.files;


    if (!files || files.length === 0) {
      return sendError(res, 400, "At least one document is required to resolve.");
    }


    const existing = await findEscalationById(id);
    if (!existing) return sendError(res, 404, "Escalation not found");

    const payload = {
      ...existing,
      status: "Resolved",
      resolution_details: resolution_details || existing.resolution_details,
      previous_status: existing.status
    };

    const updated = await updateEscalation(id, payload);


    const { createEscalationDocument } = await import("../models/escalations.model.js");

    for (const file of files) {
      await createEscalationDocument({
        escalation_id: id,
        file_name: file.originalname,
        file_type: file.mimetype,
        file_path: file.path,
        uploaded_by: req.user.email
      });
    }


    await createResolutionNotification({
      module: "escalation",
      itemId: updated.id,
      itemCode: updated.escalation_id,
      statusBefore: existing.status,
      statusAfter: "Resolved",
      payload: {
        title: updated.title,
        priority: updated.priority,
        category: updated.category,
        escalated_to: updated.escalated_to,
        project_id: updated.manual_project_id || updated.project_id,
        account: updated.account
      },
      bmUser: req.user.email,
    });
    return sendSuccess(res, { message: "Escalation resolved and documents submitted." });
  } catch (err) {
    console.error("Resolve escalation error:", err);
    return sendError(res, 500, "Failed to resolve escalation");
  }
}

export const deleteEscalationsHandler = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 400, "No ids provided for deletion.");
    }

    if (req.user?.role === "ADMIN") {
      return sendError(res, 403, "Admins are not allowed to delete escalations.");
    }

    const records = await findEscalationsByIds(ids);
    if (!records.length) {
      return sendError(res, 404, "None of the specified entries were found.");
    }

    if (req.user?.role !== "ADMIN") {
      const today = new Date().toDateString();
      for (const r of records) {
        const dateRaw = r.created_at || r.identified_date || r.reported_date || r.received_date || r.created_date || Date.now();
        const createdAt = new Date(dateRaw).toDateString();
        if (createdAt !== today) {
          return sendError(res, 403, "Deletion is restricted to same-day entries only.");
        }
      }
    }

    const deletedCount = await deleteMultipleEscalations(ids);
    res.json({ message: `Successfully deleted ${deletedCount} entries.` });
  } catch (error) {
    console.error("deleteEscalationsHandler error:", error);
    sendError(res, 500, "Internal Server Error");
  }
};
