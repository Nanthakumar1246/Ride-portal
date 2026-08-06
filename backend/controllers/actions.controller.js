
import pool from "../db.js";
import {
  findActionById,
  createAction as createActionModel,
  updateAction as updateActionModel,
  findActionsByIds,
  deleteMultipleActions,
  findActions,
  bulkUpsertActions
} from "../models/actions.model.js";

import { buildActionFilters, applyRoleRestrictions } from "../utils/filters.utils.js";
import { isValidBehalfOf } from "../utils/validation.utils.js";
import { sendSuccess, sendError } from "../utils/response.utils.js";
import { sendGovernanceEventMail } from "../utils/email.utils.js";
import { notifyRecordEvent } from "../utils/notify.utils.js";
import { createModuleHistory } from "../models/moduleHistory.model.js";

export async function listActions(req, res) {
  try {
    const user = req.user;
    const augmentedQuery = await applyRoleRestrictions(user, req.query || {});
    const filters = buildActionFilters(augmentedQuery);

    const { whereSql, params } = filters;
    const sql = `
      SELECT 
        id,
        action_id,
        action_title AS action_item,
        priority,
        due_date AS target_date,
        status,
        action_owner AS responsible,
        dependencies AS support_required_from,
        related_to_type AS teams_involved,
        comments AS remarks,
        project_manager,
        program_manager,
        behalf_of,
        created_at,
        updated_at
      FROM actions a
      ${whereSql || ""}
      ORDER BY a.created_at DESC
    `;

    const { rows } = await pool.query(sql, params);
    return sendSuccess(res, rows);

  } catch (err) {
    console.error("Error listing actions:", err);
    return sendError(res, 500, "Failed to list actions");
  }
}

export async function getAction(req, res) {
  try {
    const action = await findActionById(req.params.id);
    if (!action) {
      return sendError(res, 404, "Action not found");
    }
    if (req.user.role === "PM" && action.project_manager !== req.user.name) {
      return sendError(res, 403, "Forbidden: Not assigned to this record");
    }
    return sendSuccess(res, action);
  } catch (err) {
    console.error("Error getting action", err);
    return sendError(res, 500, "Failed to get action");
  }
}

export async function createActionHandler(req, res) {
  try {
    if (!isValidBehalfOf(req.body.behalf_of)) {
      return sendError(res, 400, "Behalf Of must be a valid @arche.global email address");
    }
    const { generateEntityId } = await import("../utils/idGenerator.js");
    
    const action_id = req.body.action_id || await generateEntityId(
      req.user.email,
      "Simplified",
      "action"
    );

    const payload = {
      ...req.body,
      action_id,
      created_by: req.user.email,
    };

    const created = await createActionModel(payload);

    try {
      await sendGovernanceEventMail({
        module: "action",
        recordId: created.action_id || action_id,
        eventType: "ACTION_ASSIGNED",
        recordData: created,
        currentUserEmail: req.user.email
      });
    } catch (eErr) {
      console.error("[Action Email Error]", eErr.message);
    }

    return sendSuccess(res, created, 201);
  } catch (err) {
    console.error("Error creating action:", err);
    return sendError(res, 500, "Failed to create action");
  }
}

export async function updateActionHandler(req, res) {
  try {
    const { id } = req.params;
    const payload = req.body;

    if (!isValidBehalfOf(payload.behalf_of)) {
      return sendError(res, 400, "Behalf Of must be a valid @arche.global email address");
    }

    const existing = await findActionById(id);
    if (!existing) return sendError(res, 404, "Action not found");

    const oldStatus = existing.status;
    const newStatus = payload.status;

    const updated = await updateActionModel(id, payload);

    if (payload.remarks || (newStatus && oldStatus !== newStatus)) {
      try {
        await createModuleHistory({
          module: "actions",
          record_id: existing.action_id || existing.id,
          updated_by: req.user?.email,
          old_status: oldStatus,
          new_status: newStatus,
          remarks: payload.remarks || payload.comments,
        });
      } catch (hErr) {
        console.error("Failed to save action history entry:", hErr);
      }
    }

    if (newStatus && oldStatus !== newStatus) {
      try {
        await notifyRecordEvent({
          module: "action",
          recordId: existing.action_id || updated.action_id,
          eventType: "STATUS_CHANGED",
          recordData: {
            ...updated,
            statusBefore: oldStatus,
            statusAfter: newStatus,
            remarks: payload.remarks || payload.comments
          },
          currentUserEmail: req.user?.email,
          title: `Status changed: ${existing.action_id || updated.action_id}`,
          message: `${oldStatus} → ${newStatus}`
        });
      } catch (eErr) {
        console.error("[Action Status Email Error]", eErr.message);
      }
    }

    return sendSuccess(res, updated);
  } catch (err) {
    console.error("Error updating action:", err);
    return sendError(res, 500, "Failed to update action");
  }
}

export const deleteActionsHandler = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 400, "No ids provided for deletion.");
    }

    const deletedCount = await deleteMultipleActions(ids);
    res.json({ message: `Successfully deleted ${deletedCount} entries.` });
  } catch (error) {
    console.error("deleteActionsHandler error:", error);
    sendError(res, 500, "Internal Server Error");
  }
};

export const bulkUploadActionsHandler = async (req, res) => {
  try {
    const { actions } = req.body;
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return sendError(res, 400, "No actions provided for bulk upload.");
    }

    const { generateEntityId } = await import("../utils/idGenerator.js");
    
    // Assign missing action_ids
    for (const a of actions) {
       if (!a.action_id) {
           a.action_id = await generateEntityId(req.user.email, "Simplified", "action");
       }
    }

    const results = await bulkUpsertActions(actions, req.user.email);
    res.status(201).json({ message: `Successfully processed ${results.length} actions.`, data: results });
  } catch (error) {
    console.error("bulkUploadActionsHandler error:", error);
    sendError(res, 500, "Internal Server Error during bulk upload");
  }
};
