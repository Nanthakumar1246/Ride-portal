
import { buildRiskFilters, applyRoleRestrictions } from "../utils/filters.utils.js";
import { getAssignedProjects } from "../models/users.model.js";
import {
  findRisks,
  findRiskById,
  createRisk,
  updateRisk,
  findRisksByIds,
  deleteMultipleRisks,
  createRiskHistory,
  findRiskHistory,
} from "../models/risks.model.js";
import { sendSuccess, sendError } from "../utils/response.utils.js";
import { createResolutionNotification } from "../models/notifications.model.js";
import { decideNotification } from "../models/notifications.model.js";
import { sendNewItemEmailNotification, sendGovernanceEventMail } from "../utils/email.utils.js";
import { notifyRecordEvent } from "../utils/notify.utils.js";
import { isValidBehalfOf } from "../utils/validation.utils.js";
import { validateStatusProof, attachmentFields } from "../utils/statusProof.utils.js";

function toYYYYMMDD(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}


export async function listRisks(req, res) {
  try {
    const user = req.user;
    const augmentedQuery = await applyRoleRestrictions(user, req.query);
    const filters = buildRiskFilters(augmentedQuery);

    const rows = await findRisks(filters);
    return sendSuccess(res, rows);
  } catch (err) {
    console.error("Error listing risks", err);
    return sendError(res, 500, "Failed to list risks");
  }
}


export async function getRisk(req, res) {
  try {
    const risk = await findRiskById(req.params.id);
    if (!risk) return sendError(res, 404, "Risk not found");

    return sendSuccess(res, risk);
  } catch (err) {
    return sendError(res, 500, "Failed to get risk");
  }
}


export async function createRiskHandler(req, res) {
  try {
    if (!isValidBehalfOf(req.body.behalf_of)) {
      return sendError(res, 400, "Behalf Of must be a valid @arche.global email address");
    }
    if (!req.body.risk_description || !String(req.body.risk_description).trim()) {
      return sendError(res, 400, "Risk Description is required");
    }

    const { generateEntityId } = await import("../utils/idGenerator.js");
    let existingRisk = null;
    if (req.body.risk_id && req.body.risk_id.trim() !== "") {
      existingRisk = await findRiskById(req.body.risk_id.trim());
    }

    if (!req.body.risk_id || req.body.risk_id.trim() === "" || existingRisk) {
      req.body.risk_id = await generateEntityId(
        req.user.email,
        req.body.account || "Default",
        "risk"
      );
    }


    const sanitizeInt = (val) => {
      if (val === null || val === undefined || val === "") return null;
      if (typeof val === "number") return val;
      const match = String(val).match(/\d+/);
      return match ? parseInt(match[0], 10) : null;
    };

    const calculateRiskScore = (prob, imp) => {
      const p = sanitizeInt(prob);
      const i = sanitizeInt(imp);
      if (p === null || i === null) return null;
      return p * i;
    };

    const payload = {
      ...req.body,
      created_by: req.user.id,
      identified_by: req.body.identified_by || req.user.email,
    };

    payload.probability = sanitizeInt(payload.probability);
    payload.impact = sanitizeInt(payload.impact);

    if (payload.probability !== null && payload.impact !== null) {
      payload.risk_score = calculateRiskScore(payload.probability, payload.impact);
    } else {
      payload.risk_score = sanitizeInt(payload.risk_score);
    }

    const dateFields = [
      "identified_date",
      "target_mitigation_date",
      "last_reviewed_date"
    ];

    dateFields.forEach((field) => {
      if (payload[field]) {
        payload[field] = toYYYYMMDD(payload[field]);
      } else {

        if (field === "identified_date") {
          payload[field] = toYYYYMMDD(new Date());
        } else {
          payload[field] = null;
        }
      }
    });

    [
      "manual_project_id",
      "project_description",
      "account",
      "risk_score",
      "mitigation_strategy",
      "mitigation_owner",
      "current_status"
    ].forEach((field) => {
      if (payload[field] === undefined) payload[field] = null;
    });
    let created;
    try {
      created = await createRisk(payload);
    } catch (dbErr) {
      if (dbErr.code === '23505') {
        payload.risk_id = await generateEntityId(req.user.email, req.body.account || "Default", "risk");
        created = await createRisk(payload);
      } else {
        throw dbErr;
      }
    }

    const riskCode = created.risk_id || payload.risk_id || "RSK-GEN";

    if (req.user?.email) {
      try {
        await createResolutionNotification({
          module: "risk",
          itemId: created.id,
          itemCode: riskCode,
          statusBefore: "N/A (New Record)",
          statusAfter: payload.status || "Open",
          payload: {
            account: created.account,
            manual_project_id: created.manual_project_id,
            priority: created.priority,
            category: created.category,
            risk_title: created.risk_title,
            identified_date: created.identified_date,
            mitigation_owner: created.mitigation_owner || created.identified_by,
            identified_by: created.identified_by
          },
          bmUser: req.user.email,
        });
      } catch (notifErr) {
        console.error("[Notification Error]", notifErr.message);
      }
    }

    // Always Dispatch Outlook Email Notification via Microsoft Graph API
    try {
      const userEmail = req.user?.email || payload.identified_by || "santhosh.b@arche.global";
      const isOnBehalf = !!(created.behalf_of && String(created.behalf_of).trim());
      
      console.log(`[Outlook Email Integration] Dispatching email notification for risk creation ${riskCode}...`);
      await sendGovernanceEventMail({
        module: "risk",
        recordId: riskCode,
        eventType: isOnBehalf ? "ON_BEHALF_CREATED" : "NEW_RECORD",
        recordData: {
          ...created,
          risk_id: riskCode
        },
        currentUserEmail: userEmail
      });
    } catch (emailErr) {
      console.error("[Email Trigger Error]", emailErr.message);
    }

    return sendSuccess(res, created, 201);
  } catch (err) {
    console.error("Create risk error", err);
    return sendError(res, 500, "Failed to create risk");
  }
}




export async function updateRiskHandler(req, res) {
  try {
    const { id } = req.params;
    if (!isValidBehalfOf(req.body.behalf_of)) {
      return sendError(res, 400, "Behalf Of must be a valid @arche.global email address");
    }
    const existing = await findRiskById(id);
    if (!existing) {
      return sendError(res, 404, "Risk not found");
    }

    const sanitizeInt = (val) => {
      if (val === null || val === undefined || val === "") return null;
      if (typeof val === "number") return val;
      const match = String(val).match(/\d+/);
      return match ? parseInt(match[0], 10) : null;
    };

    const calculateRiskScore = (prob, imp) => {
      const p = sanitizeInt(prob);
      const i = sanitizeInt(imp);
      if (p === null || i === null) return null;
      return p * i;
    };

    // Merge so partial updates (e.g. status-only) do not wipe existing fields
    const payload = { ...existing, ...req.body };
    if (req.body.remarks && !req.body.comments) {
      payload.comments = req.body.remarks;
    }
    // Never allow sparse updates to clear the business id
    payload.risk_id = existing.risk_id;

    const prob = req.body.probability !== undefined ? req.body.probability : existing.probability;
    const imp = req.body.impact !== undefined ? req.body.impact : existing.impact;

    payload.probability = sanitizeInt(prob);
    payload.impact = sanitizeInt(imp);

    if (payload.probability !== null && payload.impact !== null) {
      payload.risk_score = calculateRiskScore(payload.probability, payload.impact);
    } else {
      payload.risk_score = sanitizeInt(payload.risk_score || existing.risk_score);
    }

    const oldStatus = existing.status;
    const newStatus = payload.status || oldStatus;

    const normalize = (s) => s?.trim().toLowerCase();
    const becameResolved =
      normalize(oldStatus) !== "resolved" &&
      normalize(newStatus) === "resolved";

    const proofError = validateStatusProof({
      oldStatus,
      newStatus,
      remarks: payload.remarks || payload.comments,
      hasAttachment: Boolean(req.file),
    });
    if (proofError) return sendError(res, 400, proofError);

    const updated = await updateRisk(id, payload);

    // Save history timeline entry
    if (payload.remarks || (newStatus && oldStatus !== newStatus)) {
      try {
        await createRiskHistory({
          risk_id: existing.risk_id || updated.risk_id,
          updated_by: req.user?.email || "VP / User",
          old_status: oldStatus,
          new_status: newStatus,
          remarks: payload.remarks || payload.comments || "Updated Risk details",
          ...attachmentFields(req.file),
        });
      } catch (hErr) {
        console.error("Failed to save risk history entry:", hErr);
      }
    }

    if (becameResolved && req.user?.email) {
      await createResolutionNotification({
        module: "risk",
        itemId: updated.id,
        itemCode: updated.risk_id,
        statusBefore: oldStatus,
        statusAfter: newStatus,
        payload: {
          account: existing.account, manual_project_id: existing.manual_project_id,
          priority: updated.priority,
          category: updated.category,
          risk_title: updated.risk_title,
          identified_date: updated.identified_date,
        },
        bmUser: req.user.email,
      });
    }

    if (newStatus && oldStatus !== newStatus) {
      try {
        await notifyRecordEvent({
          module: "risk",
          recordId: existing.risk_id || updated.risk_id,
          eventType: "STATUS_CHANGED",
          recordData: {
            ...updated,
            statusBefore: oldStatus,
            statusAfter: newStatus,
            remarks: payload.remarks || payload.comments
          },
          currentUserEmail: req.user?.email,
          title: `Status changed: ${existing.risk_id || updated.risk_id}`,
          message: `${oldStatus} → ${newStatus}`
        });
      } catch (eErr) {
        console.error("[Email Status Update Error]", eErr.message);
      }
    }

    return sendSuccess(res, updated);
  } catch (err) {
    console.error("Failed to update risk", err);
    return sendError(res, 500, "Failed to update risk");
  }
}

export async function getRiskHistoryHandler(req, res) {
  try {
    const { id } = req.params;
    const pmScope = String(req.user?.role || "").toUpperCase() === "PM"
      ? { id: req.user.id, email: req.user.email, name: req.user.name }
      : null;
    const history = await findRiskHistory(id, pmScope);
    return sendSuccess(res, history);
  } catch (err) {
    console.error("Failed to get risk history", err);
    return sendError(res, 500, "Failed to fetch risk history");
  }
}

export async function decideRiskResolution(req, res) {
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
    console.error("Risk decision failed", err);
    return sendError(res, 500, "Failed to process decision");
  }
}

export async function deleteRisksHandler(req, res) {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 400, "No valid IDs provided for deletion");
    }

    const risks = await findRisksByIds(ids);
    if (!risks || risks.length === 0) {
      return sendError(res, 404, "No matching risks found to delete");
    }

    // Role-based deletion logic: PMs can only delete same-day records.
    // If Admin needs to be totally prevented from deleting (as per task), we check if role is ADMIN and block completely.
    if (req.user?.role === "ADMIN") {
      return sendError(res, 403, "Admins are not allowed to delete risks. This action is restricted to PMs.");
    }

    // If not Admin, enforce same-day rule
    if (req.user?.role !== "ADMIN") {
      const today = new Date().toDateString();
      for (const r of risks) {
        const createdAt = new Date(r.created_at || r.identified_date).toDateString();
        if (createdAt !== today) {
          return sendError(
            res, 
            403, 
            "Deletion is restricted to same-day entries only."
          );
        }
      }
    }

    const count = await deleteMultipleRisks(ids);
    return sendSuccess(res, { deleted: count }, 200, "Risks deleted successfully");
  } catch (err) {
    console.error("Error deleting risks", err);
    return sendError(res, 500, "Failed to delete risks");
  }
}
