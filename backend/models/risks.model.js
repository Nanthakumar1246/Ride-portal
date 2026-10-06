
import pool from "../db.js";
import { createResolutionNotification } from "../models/notifications.model.js";
import { buildPmCreatorAndClause } from "../utils/filters.utils.js";




export async function findRisks({ whereSql = "", params = [] } = {}) {
  const sql = `
    SELECT
      r.id,
      r.risk_id,
      r.manual_project_id,
      r.project_description,
      r.account,
      r.identified_date,
      r.identified_by,
      r.status,
      r.priority,
      r.category,
      r.risk_title,
      r.risk_description,
      r.probability,
      r.impact,
      r.risk_score,
      r.mitigation_strategy,
      r.mitigation_owner,
      r.target_mitigation_date,
      r.current_status,
      r.last_reviewed_date,
      r.comments,
      r.project_manager,
      r.program_manager,
      r.behalf_of,
      u.email as created_by,
      r.created_at,
      r.updated_at
    FROM risks r
    LEFT JOIN users u ON r.created_by = u.id
    ${whereSql}
    ORDER BY r.created_at DESC, r.identified_date DESC
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}


export async function findRiskById(id) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const col = isUuid ? "r.id" : "r.risk_id";
  const sql = `
    SELECT r.*
    FROM risks r
    WHERE ${col} = $1
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
}


export async function createRisk(data) {
  const sql = `
    INSERT INTO risks (
      risk_id,
      manual_project_id,
      project_description,
      account,
      identified_date,
      identified_by,
      status,
      priority,
      category,
      risk_title,
      risk_description,
      probability,
      impact,
      risk_score,
      mitigation_strategy,
      mitigation_owner,
      target_mitigation_date,
      current_status,
      last_reviewed_date,
      comments,
      created_by,
      project_manager,
      program_manager,
      behalf_of
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,$19,$20, $21,$22,$23,$24
    )
    RETURNING *;
  `;

  const params = [
    data.risk_id,
    data.manual_project_id || null,
    data.project_description || null,
    data.account || null,
    data.identified_date,
    data.identified_by,
    data.status,
    data.priority,
    data.category,
    data.risk_title,
    data.risk_description,
    data.probability,
    data.impact,
    data.risk_score || null,
    data.mitigation_strategy || null,
    data.mitigation_owner || null,
    data.target_mitigation_date || null,
    data.current_status || null,
    data.last_reviewed_date || null,
    data.comments || null,
    data.created_by,
    data.project_manager || null,
    data.program_manager || null,
    data.behalf_of || null,
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0];
}


export async function updateRisk(id, data) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const whereCol = isUuid ? "id" : "risk_id";

  const sql = `
    UPDATE risks SET
      risk_id = $1,
      manual_project_id = $21,
      project_description = $2,
      account = $3,
      identified_date = $4,
      identified_by = $5,
      status = $6,
      priority = $7,
      category = $8,
      risk_title = $9,
      risk_description = $10,
      probability = $11,
      impact = $12,
      risk_score = $13,
      mitigation_strategy = $14,
      mitigation_owner = $15,
      target_mitigation_date = $16,
      current_status = $17,
      last_reviewed_date = $18,
      comments = $19,
      project_manager = $22,
      program_manager = $23,
      behalf_of = $24,
      updated_at = NOW()
    WHERE ${whereCol} = $20
    RETURNING *;
  `;

  const params = [
    data.risk_id,
    data.project_description || null,
    data.account || null,
    data.identified_date,
    data.identified_by,
    data.status,
    data.priority,
    data.category,
    data.risk_title,
    data.risk_description,
    data.probability,
    data.impact,
    data.risk_score || null,
    data.mitigation_strategy || null,
    data.mitigation_owner || null,
    data.target_mitigation_date || null,
    data.current_status || null,
    data.last_reviewed_date || null,
    data.comments || null,
    id,
    data.manual_project_id,
    data.project_manager || null,
    data.program_manager || null,
    data.behalf_of || null,
  ];

  const { rows } = await pool.query(sql, params);
  const updated = rows[0];

  if (String(updated.status).toLowerCase() === "resolved") {
    
  }

  return updated;
}

export async function countAll() {
  const result = await pool.query("SELECT COUNT(*) AS c FROM risks");
  return Number(result.rows[0].c);
}

export async function countByStatus(status) {
  const result = await pool.query(
    "SELECT COUNT(*) AS c FROM risks WHERE status::text = $1::text",
    [status]
  );
  return Number(result.rows[0].c);
}


export async function updateRiskStatus(id, status) {
  const sql = `
    UPDATE risks
    SET status = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, [status, id]);
  return rows[0];
}

export async function findRisksByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const sql = `SELECT * FROM risks WHERE id = ANY($1::uuid[])`;
  const { rows } = await pool.query(sql, [ids]);
  return rows;
}

export async function deleteMultipleRisks(ids) {
  if (!ids || ids.length === 0) return 0;
  const sql = `DELETE FROM risks WHERE id = ANY($1::uuid[]) RETURNING *`;
  const { rowCount } = await pool.query(sql, [ids]);
  return rowCount;
}

export async function createRiskHistory({ risk_id, updated_by, old_status, new_status, remarks, attachment_name, attachment_path }) {
  const sql = `
    INSERT INTO risk_history (risk_id, updated_by, old_status, new_status, remarks, attachment_name, attachment_path)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, [
    risk_id,
    updated_by || null,
    old_status || null,
    new_status || null,
    remarks || null,
    attachment_name || null,
    attachment_path || null,
  ]);
  return rows[0];
}

export async function findRiskHistory(risk_id, pmScope = null) {
  const pmUser = pmScope && (pmScope.id || pmScope.email || pmScope.name)
    ? { role: "PM", id: pmScope.id, email: pmScope.email, name: pmScope.name }
    : null;

  if (!risk_id || risk_id === "ALL") {
    if (pmUser) {
      const params = [];
      const clause = buildPmCreatorAndClause("risks", pmUser, params, { alias: "r" });
      const sql = `
        SELECT rh.* FROM risk_history rh
        JOIN risks r ON r.risk_id = rh.risk_id
        WHERE 1=1${clause}
        ORDER BY rh.created_at DESC LIMIT 50;
      `;
      const { rows } = await pool.query(sql, params);
      return rows;
    }
    const sql = `SELECT * FROM risk_history ORDER BY created_at DESC LIMIT 50;`;
    const { rows } = await pool.query(sql);
    return rows;
  }

  if (pmUser) {
    const params = [risk_id];
    const clause = buildPmCreatorAndClause("risks", pmUser, params, { alias: "r" });
    const sql = `
      SELECT rh.* FROM risk_history rh
      JOIN risks r ON r.risk_id = rh.risk_id
      WHERE (rh.risk_id = $1 OR rh.risk_id = (SELECT risk_id FROM risks WHERE id::text = $1))
        ${clause}
      ORDER BY rh.created_at DESC;
    `;
    const { rows } = await pool.query(sql, params);
    return rows;
  }

  const sql = `
    SELECT * FROM risk_history
    WHERE risk_id = $1 OR risk_id = (SELECT risk_id FROM risks WHERE id::text = $1)
    ORDER BY created_at DESC;
  `;
  const { rows } = await pool.query(sql, [risk_id]);
  return rows;
}
