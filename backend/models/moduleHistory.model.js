
import pool from "../db.js";

export async function createModuleHistory({ module, record_id, updated_by, old_status, new_status, remarks }) {
  const sql = `
    INSERT INTO module_history (module, record_id, updated_by, old_status, new_status, remarks)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, [module, record_id, updated_by || null, old_status || null, new_status || null, remarks || null]);
  return rows[0];
}

const MODULE_TABLE_MAP = {
  risks: { table: "risks", codeCol: "risk_id" },
  issues: { table: "issues", codeCol: "issue_id" },
  dependencies: { table: "dependencies", codeCol: "dependency_id" },
  escalations: { table: "escalations", codeCol: "escalation_id" },
  actions: { table: "actions", codeCol: "action_id" },
  appreciations: { table: "appreciations", codeCol: "appreciation_id" },
};

export async function findModuleHistory({ module, limit = 10, offset = 0, programManager = null }) {
  const mapping = MODULE_TABLE_MAP[module];

  // Non-PM-scoped path (or unknown module — falls back to unscoped lookup)
  if (!programManager || !mapping) {
    const countRes = await pool.query(`SELECT COUNT(*) AS c FROM module_history WHERE module = $1`, [module]);
    const total = Number(countRes.rows[0]?.c || 0);

    const { rows } = await pool.query(
      `SELECT * FROM module_history WHERE module = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [module, limit, offset]
    );

    return { rows, total };
  }

  const { table, codeCol } = mapping;
  const joinClause = `
    FROM module_history h
    JOIN ${table} t ON (h.record_id::text = t.${codeCol}::text OR h.record_id::text = t.id::text)
    WHERE h.module = $1 AND t.project_manager::text = $2::text
  `;

  const countRes = await pool.query(`SELECT COUNT(*) AS c ${joinClause}`, [module, programManager]);
  const total = Number(countRes.rows[0]?.c || 0);

  const { rows } = await pool.query(
    `SELECT h.* ${joinClause} ORDER BY h.created_at DESC LIMIT $3 OFFSET $4`,
    [module, programManager, limit, offset]
  );

  return { rows, total };
}
