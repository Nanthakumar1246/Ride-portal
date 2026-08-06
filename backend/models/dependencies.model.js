
import pool from "../db.js";
import { createResolutionNotification } from "../models/notifications.model.js";





export async function findDependencies({ whereSql = "", params = [] } = {}) {
  const sql = `
    SELECT
      d.id,
      d.dependency_id,
      d.manual_project_id, 
      d.project_description,
      d.account,
      d.reported_date,
      d.reported_by,
      d.status,
      d.priority,
      d.type,
      d.dependency_title,
      d.description,
      d.dependent_on,
      d.impact_if_not_resolved,
      d.required_by_date,
      d.current_status,
      d.follow_up_date,
      d.contact_person,
      d.contact_details,
      d.last_updated,
      d.comments,
      d.project_manager,
      d.program_manager,
      d.behalf_of,
      d.reported_by as created_by,
      d.created_at,
      d.updated_at
    FROM dependencies d
    -- LEFT JOIN users u ON d.created_by = u.id
    ${whereSql}
    ORDER BY d.created_at DESC, d.reported_date DESC
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}


export async function findDependencyById(id) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const col = isUuid ? "d.id" : "d.dependency_id";
  const sql = `
    SELECT d.*
    FROM dependencies d
    WHERE ${col} = $1
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
}


export async function createDependency(data) {
  const sql = `
    INSERT INTO dependencies (
      dependency_id,
      manual_project_id,
      project_description,
      account,
      reported_date,
      reported_by,
      status,
      priority,
      type,
      dependency_title,
      description,
      dependent_on,
      impact_if_not_resolved,
      required_by_date,
      current_status,
      follow_up_date,
      contact_person,
      contact_details,
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
    data.dependency_id,
    data.manual_project_id || null,
    data.project_description || null,
    data.account || null,
    data.reported_date,
    data.reported_by,
    data.status,
    data.priority,
    data.type,
    data.dependency_title,
    data.description,
    data.dependent_on,
    data.impact_if_not_resolved || null,
    data.required_by_date,
    data.current_status || null,
    data.follow_up_date || null,
    data.contact_person || null,
    data.contact_details || null,
    data.comments || null,
    data.project_manager || null,
    data.program_manager || null,
    data.behalf_of || null,
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0];
}


export async function updateDependency(id, data) {
  const sql = `
    UPDATE dependencies SET
      dependency_id = $1,
      manual_project_id = $20,
      project_description = $2,
      account = $3,
      reported_date = $4,
      reported_by = $5,
      status = $6,
      priority = $7,
      type = $8,
      dependency_title = $9,
      description = $10,
      dependent_on = $11,
      impact_if_not_resolved = $12,
      required_by_date = $13,
      current_status = $14,
      follow_up_date = $15,
      contact_person = $16,
      contact_details = $17,
      last_updated = now(),
      comments = $18,
      project_manager = $21,
      program_manager = $22,
      behalf_of = $23,
      updated_at = now()
    WHERE id = $19
    RETURNING *;
  `;

  const params = [
    data.dependency_id,
    data.project_description || null,
    data.account || null,
    data.reported_date,
    data.reported_by,
    data.status,
    data.priority,
    data.type,
    data.dependency_title,
    data.description,
    data.dependent_on,
    data.impact_if_not_resolved || null,
    data.required_by_date,
    data.current_status || null,
    data.follow_up_date || null,
    data.contact_person || null,
    data.contact_details || null,
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
  const result = await pool.query("SELECT COUNT(*) AS c FROM dependencies");
  return Number(result.rows[0].c);
}

export async function findDependenciesByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const sql = `SELECT * FROM dependencies WHERE id = ANY($1::uuid[])`;
  const { rows } = await pool.query(sql, [ids]);
  return rows;
}

export async function deleteMultipleDependencies(ids) {
  if (!ids || ids.length === 0) return 0;
  const sql = `DELETE FROM dependencies WHERE id = ANY($1::uuid[]) RETURNING *`;
  const { rowCount } = await pool.query(sql, [ids]);
  return rowCount;
}

