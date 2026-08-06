
import pool from "../db.js";
import { createResolutionNotification } from "../models/notifications.model.js";




export async function findIssues({ whereSql = "", params = [] } = {}) {
  const sql = `
    SELECT
      i.id,
      i.issue_id,
      i.manual_project_id,
      i.project_description,
      i.account,
      i.reported_date,
      i.reported_by,
      i.status,
      i.priority,
      i.category,
      i.issue_title,
      i.issue_description,
      i.impact_on_project,
      i.affected_system,
      i.assigned_to,
      i.target_resolution_date,
      i.actual_resolution_date,
      i.resolution_details,
      i.root_cause_analysis,
      i.last_updated,
      i.comments,
      i.project_manager,
      i.program_manager,
      i.behalf_of,
      i.reported_by as created_by,
      i.created_at,
      i.updated_at
    FROM issues i
    -- LEFT JOIN users u ON i.created_by = u.id
    ${whereSql}
    ORDER BY i.created_at DESC, i.reported_date DESC
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}


export async function findIssueById(id) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const col = isUuid ? "i.id" : "i.issue_id";
  const sql = `
    SELECT i.*
    FROM issues i
    WHERE ${col} = $1
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
}


export async function createIssue(data) {
  const sql = `
    INSERT INTO issues (
      issue_id,
      manual_project_id,
      project_description,
      account,
      reported_date,
      reported_by,
      status,
      priority,
      category,
      issue_title,
      issue_description,
      impact_on_project,
      affected_system,
      assigned_to,
      target_resolution_date,
      actual_resolution_date,
      resolution_details,
      root_cause_analysis,
      last_updated,
      comments,
      project_manager,
      program_manager,
      behalf_of
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,
      $10,$11,$12,$13,$14,$15,$16,$17,$18,now(),$19,$20,$21,$22
    )
    RETURNING *;
  `;

  const params = [
    data.issue_id,
    data.manual_project_id || null,
    data.project_description || null,
    data.account || null,
    data.reported_date,
    data.reported_by,
    data.status,
    data.priority,
    data.category,
    data.issue_title,
    data.issue_description,
    data.impact_on_project || null,
    data.affected_system || null,
    data.assigned_to || null,
    data.target_resolution_date,
    data.actual_resolution_date || null,
    data.resolution_details || null,
    data.root_cause_analysis || null,
    data.comments || null,
    data.project_manager || null,
    data.program_manager || null,
    data.behalf_of || null,
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0];
}


export async function updateIssue(id, data) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const whereCol = isUuid ? "id" : "issue_id";

  const sql = `
    UPDATE issues SET
      issue_id = $1,
      manual_project_id = $20,
      project_description = $2,
      account = $3,
      reported_date = $4,
      reported_by = $5,
      status = $6,
      priority = $7,
      category = $8,
      issue_title = $9,
      issue_description = $10,
      impact_on_project = $11,
      affected_system = $12,
      assigned_to = $13,
      target_resolution_date = $14,
      actual_resolution_date = $15,
      resolution_details = $16,
      root_cause_analysis = $17,
      last_updated = now(),
      comments = $18,
      project_manager = $21,
      program_manager = $22,
      behalf_of = $23,
      updated_at = now()
    WHERE ${whereCol} = $19
    RETURNING *;
  `;

  const params = [
    data.issue_id,
    data.project_description || null,
    data.account || null,
    data.reported_date,
    data.reported_by,
    data.status,
    data.priority,
    data.category,
    data.issue_title,
    data.issue_description,
    data.impact_on_project || null,
    data.affected_system || null,
    data.assigned_to || null,
    data.target_resolution_date,
    data.actual_resolution_date || null,
    data.resolution_details || null,
    data.root_cause_analysis || null,
    data.comments || null,
    id,
    data.manual_project_id,
    data.project_manager || null,
    data.program_manager || null,
    data.behalf_of || null,
  ];

  const { rows } = await pool.query(sql, params);
  const updated = rows[0];

  if (updated && String(updated.status).toLowerCase() === "resolved") {
    
  }

  return updated;
}


export async function countAll() {
  const result = await pool.query("SELECT COUNT(*) AS c FROM issues");
  return Number(result.rows[0].c);
}

export async function countByStatus(status) {
  const result = await pool.query(
    "SELECT COUNT(*) AS c FROM issues WHERE status::text = $1::text",
    [status]
  );
  return Number(result.rows[0].c);
}

export async function findIssuesByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const sql = `SELECT * FROM issues WHERE id = ANY($1::uuid[])`;
  const { rows } = await pool.query(sql, [ids]);
  return rows;
}

export async function deleteMultipleIssues(ids) {
  if (!ids || ids.length === 0) return 0;
  const sql = `DELETE FROM issues WHERE id = ANY($1::uuid[]) RETURNING *`;
  const { rowCount } = await pool.query(sql, [ids]);
  return rowCount;
}
