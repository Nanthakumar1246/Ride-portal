
import pool from "../db.js";
import { sendSuccess, sendError } from "../utils/response.utils.js";


export async function getLayout(req, res) {
    try {
        const { module } = req.params;
        const { rows } = await pool.query("SELECT config FROM layout_configs WHERE module = $1", [module]);
        if (rows.length === 0) return sendSuccess(res, null); 
        return sendSuccess(res, rows[0].config);
    } catch (err) {
        console.error("Get Layout Error:", err);
        return sendError(res, 500, "Failed to get layout");
    }
}
export async function saveLayout(req, res) {
    try {
        const { module } = req.params;
        const config = req.body;
        const user = req.user?.email || "system";

        const sql = `
      INSERT INTO layout_configs (module, config, updated_by, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (module) 
      DO UPDATE SET config = $2, updated_by = $3, updated_at = NOW()
      RETURNING *;
    `;
        const { rows } = await pool.query(sql, [module, JSON.stringify(config), user]);
        return sendSuccess(res, rows[0]);
    } catch (err) {
        console.error("Save Layout Error:", err);
        return sendError(res, 500, "Failed to save layout");
    }
}
export async function deleteLayout(req, res) {
    try {
        const { module } = req.params;
        await pool.query("DELETE FROM layout_configs WHERE module = $1", [module]);
        return sendSuccess(res, { message: "Layout reset successfully" });
    } catch (err) {
        console.error("Delete Layout Error:", err);
        return sendError(res, 500, "Failed to reset layout");
    }
}
