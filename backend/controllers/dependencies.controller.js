
import {
  findDependencies,
  findDependencyById,
  createDependency,
  updateDependency,
  countAll,
  findDependenciesByIds,
  deleteMultipleDependencies
} from "../models/dependencies.model.js";

import {
  createResolutionNotification,
  decideNotification,
  createBmNotificationForDependencyDecision,
} from "../models/notifications.model.js";

import { buildDependencyFilters, applyRoleRestrictions } from "../utils/filters.utils.js";
import { getAssignedProjects } from "../models/users.model.js";
import { isValidBehalfOf } from "../utils/validation.utils.js";
import { sendSuccess, sendError } from "../utils/response.utils.js";
import { sendGovernanceEventMail } from "../utils/email.utils.js";
import { notifyRecordEvent } from "../utils/notify.utils.js";
import { createModuleHistory } from "../models/moduleHistory.model.js";
import pool from "../db.js";

export async function listDependencies(req, res) {
  try {
    const user = req.user;
    const augmentedQuery = await applyRoleRestrictions(user, req.query || {});
    const filters = buildDependencyFilters(augmentedQuery);

    const deps = await findDependencies(filters);
    return sendSuccess(res, deps);
  } catch (err) {
    console.error("Error listing dependencies", err);
    return sendError(res, 500, "Failed to list dependencies");
  }
}

export async function getDependency(req, res) {
  try {
    const { id } = req.params;
    const dep = await findDependencyById(id);
    if (!dep) return sendError(res, 404, "Dependency not found");

    if (req.user.role === "PM" && dep.project_manager !== req.user.name) {
      return sendError(res, 403, "Forbidden: Not assigned to this record");
    }

    return sendSuccess(res, dep);
  } catch (err) {
    console.error("Error getting dependency", err);
    return sendError(res, 500, "Failed to get dependency");
  }
}

export async function createDependencyHandler(req, res) {
  try {
    if (!isValidBehalfOf(req.body.behalf_of)) {
      return sendError(res, 400, "Behalf Of must be a valid @arche.global email address");
    }

    if (!req.body.dependency_id || req.body.dependency_id.trim() === "") {
      const { generateEntityId } = await import("../utils/idGenerator.js");
      req.body.dependency_id = await generateEntityId(
        req.user.email,
        req.body.account || "Default",
        "dependency"
      );
    }

    const payload = {
      ...req.body,
      reported_by: req.user.email,
    };


    ["manual_project_id", "project_description", "account"].forEach(f => {
      if (payload[f] === undefined) payload[f] = null;
    });

    const created = await createDependency(payload);

    if (req.user?.email) {
      await createResolutionNotification({
        module: "dependency",
        itemId: created.id,
        itemCode: created.dependency_id,
        statusBefore: "N/A (New Record)",
        statusAfter: payload.status || "Open",
        payload: {
          account: created.account,
          manual_project_id: created.manual_project_id,
          priority: created.priority,
          type: created.type,
          dependency_title: created.dependency_title,
          reported_date: created.reported_date,
          mitigation_owner: created.contact_person || created.reported_by,
          reported_by: created.reported_by
        },
        bmUser: req.user.email,
      });
    }

    try {
      const isOnBehalf = created.reported_by && req.user?.email && created.reported_by.toLowerCase() !== req.user.email.toLowerCase();
      await sendGovernanceEventMail({
        module: "dependency",
        recordId: created.dependency_id,
        eventType: isOnBehalf ? "ON_BEHALF_CREATED" : "NEW_RECORD",
        recordData: created,
        currentUserEmail: req.user?.email
      });
    } catch (eErr) {
      console.error("[Dependency Email Error]", eErr.message);
    }

    return sendSuccess(res, created, 201);
  } catch (err) {
    console.error("Error creating dependency", err);
    return sendError(res, 500, "Failed to create dependency");
  }
}


export async function updateDependencyHandler(req, res) {
  try {
    const { id } = req.params;
    const payload = req.body;

    if (!isValidBehalfOf(payload.behalf_of)) {
      return sendError(res, 400, "Behalf Of must be a valid @arche.global email address");
    }

    const existing = await findDependencyById(id);
    if (!existing) return sendError(res, 404, "Dependency not found");

    const oldStatus = existing.status;
    const newStatus = payload.status;

    const updated = await updateDependency(id, payload);
    if (!updated) return sendError(res, 404, "Dependency not found");

    // Save history timeline entry
    if (payload.remarks || (newStatus && oldStatus !== newStatus)) {
      try {
        await createModuleHistory({
          module: "dependencies",
          record_id: existing.dependency_id || existing.id,
          updated_by: req.user?.email,
          old_status: oldStatus,
          new_status: newStatus,
          remarks: payload.remarks || payload.comments,
        });
      } catch (hErr) {
        console.error("Failed to save dependency history entry:", hErr);
      }
    }

    const normalize = (s) => s?.trim().toLowerCase();
    const becameResolved =
      normalize(oldStatus) !== "resolved" &&
      normalize(newStatus) === "resolved";


    if (becameResolved && req.user?.email) {
      await createResolutionNotification({
        module: "dependency",
        itemId: updated.id,
        itemCode: updated.dependency_id,
        statusBefore: oldStatus,
        statusAfter: newStatus,
        payload: {
          account: existing.account, manual_project_id: existing.manual_project_id,
          priority: updated.priority,
          type: updated.type,
          dependency_title: updated.dependency_title,
          reported_date: updated.reported_date,
        },
        bmUser: req.user.email,
      });
    }

    if (newStatus && oldStatus !== newStatus) {
      try {
        await notifyRecordEvent({
          module: "dependency",
          recordId: existing.dependency_id || updated.dependency_id,
          eventType: "STATUS_CHANGED",
          recordData: {
            ...updated,
            statusBefore: oldStatus,
            statusAfter: newStatus,
            remarks: payload.remarks || payload.comments
          },
          currentUserEmail: req.user?.email,
          title: `Status changed: ${existing.dependency_id || updated.dependency_id}`,
          message: `${oldStatus} → ${newStatus}`
        });
      } catch (eErr) {
        console.error("[Dependency Status Email Error]", eErr.message);
      }
    }

    return sendSuccess(res, updated);
  } catch (err) {
    console.error("Error updating dependency", err);
    return sendError(res, 500, "Failed to update dependency");
  }
}

export async function decideDependencyResolution(req, res) {
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
    console.error("Dependency decision failed", err);
    return sendError(res, 500, "Failed to process decision");
  }
}

export const deleteDependenciesHandler = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 400, "No ids provided for deletion.");
    }

    if (req.user?.role === "ADMIN") {
      return sendError(res, 403, "Admins are not allowed to delete dependencies.");
    }

    const records = await findDependenciesByIds(ids);
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

    const deletedCount = await deleteMultipleDependencies(ids);
    res.json({ message: `Successfully deleted ${deletedCount} entries.` });
  } catch (error) {
    console.error("deleteDependenciesHandler error:", error);
    sendError(res, 500, "Internal Server Error");
  }
};
