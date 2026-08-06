import { previewEntityId } from "../utils/idGenerator.js";
import { sendSuccess, sendError } from "../utils/response.utils.js";
import pool from "../db.js";

export async function previewIdHandler(req, res) {
    try {
        const { module, projectName, account } = req.query;
        if (!module) return sendError(res, 400, "Module required");

        const previewId = await previewEntityId(
            req.user.email,
            projectName || (account || "GEN"),
            module
        );

        return sendSuccess(res, { previewId });
    } catch (err) {
        console.error("Preview ID Error", err);
        return sendError(res, 500, "Failed to preview ID");
    }
}

export async function getEmailAuditLogsHandler(req, res) {
    try {
        const limit = parseInt(req.query.limit || "50", 10);
        const { rows } = await pool.query(
            `SELECT * FROM email_audit_log ORDER BY created_at DESC LIMIT $1`,
            [limit]
        );
        return sendSuccess(res, rows);
    } catch (err) {
        console.error("Error fetching email audit log:", err);
        return sendError(res, 500, "Failed to fetch email audit logs");
    }
}
