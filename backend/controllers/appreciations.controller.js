import {
  findAppreciations,
  findAppreciationById,
  createAppreciation,
  updateAppreciation,
  findAppreciationsByIds,
  deleteMultipleAppreciations,
  decideAppreciation,
} from "../models/appreciations.model.js";
import {
  createAppreciationDocument,
  findLatestDocumentByAppreciationId,
  findLatestDocumentsByAppreciationIds,
} from "../models/appreciationDocuments.model.js";

import { buildAppreciationFilters, applyRoleRestrictions } from "../utils/filters.utils.js";
import { getAssignedProjects } from "../models/users.model.js";
import { sendSuccess, sendError } from "../utils/response.utils.js";
import { sendGovernanceEventMail } from "../utils/email.utils.js";
import { createModuleHistory } from "../models/moduleHistory.model.js";
import { isValidBehalfOf } from "../utils/validation.utils.js";

function withDocumentFields(row, doc) {
  const isImage = doc?.file_type?.startsWith("image/");
  return {
    ...row,
    title: row.subject,
    description: row.details,
    appreciated_to: row.team_members_recognized,
    appreciated_by: row.recorded_by,
    created_date: row.created_at,
    attachment_url: doc ? doc.file_path : null,
    image_url: doc && isImage ? doc.file_path : null,
  };
}

export async function listAppreciations(req, res) {
  try {
    const user = req.user;
    const augmentedQuery = await applyRoleRestrictions(user, req.query || {});
    // Drives the approval/20-day visibility rules in buildAppreciationFilters.
    augmentedQuery.viewerRole = user?.role;
    augmentedQuery.viewerEmail = user?.email;
    const filters = buildAppreciationFilters(augmentedQuery);

    const rows = await findAppreciations(filters);
    const docs = await findLatestDocumentsByAppreciationIds(rows.map((r) => r.id));
    const docsByAppreciationId = new Map(docs.map((d) => [d.appreciation_id, d]));

    const shaped = rows.map((row) => withDocumentFields(row, docsByAppreciationId.get(row.id)));
    return sendSuccess(res, shaped);
  } catch (err) {
    console.error("Error listing appreciations", err);
    return sendError(res, 500, "Failed to list appreciations");
  }
}

export async function getAppreciation(req, res) {
  try {
    const { id } = req.params;
    const row = await findAppreciationById(id);

    if (!row) return sendError(res, 404, "Appreciation not found");

    if (req.user.role !== "ADMIN" && req.user.role !== "PM") {
      const assigned = await getAssignedProjects(req.user.id);
      const projectIds = assigned.map(p => p.id);
      if (!projectIds.includes(row.project_id)) {
        return sendError(res, 403, "Forbidden: Not assigned to this project");
      }
    }

    const doc = await findLatestDocumentByAppreciationId(row.id);
    return sendSuccess(res, withDocumentFields(row, doc));
  } catch (err) {
    console.error("Error getting appreciation", err);
    return sendError(res, 500, "Failed to get appreciation");
  }
}

export async function uploadAppreciationAttachmentHandler(req, res) {
  try {
    const { id } = req.params;
    const existing = await findAppreciationById(id);
    if (!existing) return sendError(res, 404, "Appreciation not found");

    if (!req.file) return sendError(res, 400, "No file uploaded");

    const doc = await createAppreciationDocument({
      appreciation_id: existing.id,
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      file_path: req.file.path.replace(/\\/g, "/").replace(/^.*?uploads\//i, "uploads/"),
      uploaded_by: req.user.id,
    });

    return sendSuccess(res, doc, 201);
  } catch (err) {
    console.error("Error uploading appreciation attachment", err);
    return sendError(res, 500, "Failed to upload attachment");
  }
}

export async function createAppreciationHandler(req, res) {
  try {
    if (!isValidBehalfOf(req.body.behalf_of)) {
      return sendError(res, 400, "Behalf Of must be a valid @arche.global email address");
    }
    if (!req.body.appreciation_id || req.body.appreciation_id.trim() === "") {
      const { generateEntityId } = await import("../utils/idGenerator.js");
      req.body.appreciation_id = await generateEntityId(
        req.user.email,
        req.body.account || "Default",
        "appreciation"
      );
    }

    // An admin's own appreciation is published immediately; anyone else's
    // (e.g. a PM's) waits for admin approval before it becomes visible.
    const isAdmin = String(req.user?.role || "").toUpperCase() === "ADMIN";

    const payload = {
      ...req.body,
      recorded_by: req.user.email,
      status: isAdmin ? "APPROVED" : "PENDING",
    };


    ["project_id", "project_description", "account"].forEach(f => {
      if (payload[f] === undefined) payload[f] = null;
    });

    const created = await createAppreciation(payload);

    // The recognition email only goes out once the appreciation is live —
    // a pending submission must not reach the recognised team members before
    // an admin has approved it. Approval sends it instead (see decide below).
    if (isAdmin) {
      try {
        await sendGovernanceEventMail({
          module: "appreciation",
          recordId: created.appreciation_id || req.body.appreciation_id,
          eventType: "APPRECIATION_SUBMITTED",
          recordData: created,
          currentUserEmail: req.user.email
        });
      } catch (eErr) {
        console.error("[Appreciation Email Error]", eErr.message);
      }
    }

    return sendSuccess(res, created, 201);
  } catch (err) {
    console.error("Error creating appreciation", err);
    return sendError(res, 500, "Failed to create appreciation");
  }
}

export async function updateAppreciationHandler(req, res) {
  try {
    const { id } = req.params;
    if (!isValidBehalfOf(req.body.behalf_of)) {
      return sendError(res, 400, "Behalf Of must be a valid @arche.global email address");
    }
        const existing = await findAppreciationById(id);
    if (!existing) return sendError(res, 404, "Appreciation not found");



    const updated = await updateAppreciation(id, {
      ...req.body,
      recorded_by: existing.recorded_by,
    });

    try {
      await createModuleHistory({
        module: "appreciations",
        record_id: existing.appreciation_id || existing.id,
        updated_by: req.user?.email,
        old_status: null,
        new_status: null,
        remarks: req.body.follow_up_action || req.body.comments || "Record updated",
      });
    } catch (hErr) {
      console.error("Failed to save appreciation history entry:", hErr);
    }

    return sendSuccess(res, updated);
  } catch (err) {
    console.error("Error updating appreciation:", err);
    return sendError(res, 500, `Failed to update appreciation: ${err.message}`);
  }
}

/**
 * Admin approves or rejects a submitted appreciation.
 * Body: { decision: "APPROVED" | "REJECTED" }
 */
export async function decideAppreciationHandler(req, res) {
  try {
    if (String(req.user?.role || "").toUpperCase() !== "ADMIN") {
      return sendError(res, 403, "Only an admin can approve or reject an appreciation");
    }

    const { id } = req.params;
    const status = String(req.body?.decision || "").toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(status)) {
      return sendError(res, 400, "decision must be APPROVED or REJECTED");
    }

    const existing = await findAppreciationById(id);
    if (!existing) return sendError(res, 404, "Appreciation not found");

    const decided = await decideAppreciation(existing.id, {
      status,
      approvedBy: req.user.email,
    });

    try {
      await createModuleHistory({
        module: "appreciations",
        record_id: existing.appreciation_id || existing.id,
        updated_by: req.user.email,
        old_status: existing.status,
        new_status: status,
        remarks: req.body?.comment || `Appreciation ${status.toLowerCase()} by admin`,
      });
    } catch (hErr) {
      console.error("Failed to save appreciation decision history:", hErr);
    }

    // Now that it is live, the recognised team members get their email.
    if (status === "APPROVED") {
      try {
        await sendGovernanceEventMail({
          module: "appreciation",
          recordId: decided.appreciation_id || existing.appreciation_id,
          eventType: "APPRECIATION_SUBMITTED",
          recordData: decided,
          currentUserEmail: req.user.email,
        });
      } catch (eErr) {
        console.error("[Appreciation Email Error]", eErr.message);
      }
    }

    return sendSuccess(res, decided);
  } catch (err) {
    console.error("Error deciding appreciation:", err);
    return sendError(res, 500, "Failed to process the approval decision");
  }
}

export const deleteAppreciationsHandler = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 400, "No ids provided for deletion.");
    }

    if (req.user?.role === "ADMIN") {
      return sendError(res, 403, "Admins are not allowed to delete appreciations.");
    }

    const records = await findAppreciationsByIds(ids);
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

    const deletedCount = await deleteMultipleAppreciations(ids);
    res.json({ message: `Successfully deleted ${deletedCount} entries.` });
  } catch (error) {
    console.error("deleteAppreciationsHandler error:", error);
    sendError(res, 500, "Internal Server Error");
  }
};
