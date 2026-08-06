
import pool from "../db.js";

/**
 * Maps database columns to the simplified names requested by the user.
 * Since we don't have DDL permissions to rename actual columns, 
 * we handle the mapping in the data layer.
 */

const MAP_COLUMNS_SELECT = `
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
`;

export async function findActions(filters = {}) {
  let where = [];
  let params = [];
  
  if (filters.manager && filters.manager !== 'All') {
    where.push(`created_by LIKE $${params.length + 1}`);
    params.push(`%${filters.manager}%`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `
    SELECT ${MAP_COLUMNS_SELECT}
    FROM actions
    ${whereSql}
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function findActionById(id) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const col = isUuid ? "id" : "action_id";
  const sql = `
    SELECT ${MAP_COLUMNS_SELECT}
    FROM actions
    WHERE ${col} = $1
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
}

export async function createAction(data) {
  const sql = `
    INSERT INTO actions (
      action_item_placeholder, -- We will map these in the query
      action_title,
      priority,
      due_date,
      status,
      action_owner,
      dependencies,
      related_to_type,
      comments,
      created_by
    ) VALUES (
      'Simplified', -- Placeholder for unused col if needed, but better to just use what we have
      $1, $2, $3, $4, $5, $6, $7, $8, $9
    )
    RETURNING ${MAP_COLUMNS_SELECT};
  `;

  // Wait, the column 'action_item_placeholder' doesn't exist.
  // I should just insert into the existing columns.

  const insertSql = `
    INSERT INTO actions (
      action_title,
      action_description,
      priority,
      due_date,
      status,
      action_owner,
      dependencies,
      related_to_type,
      comments,
      created_by,
      action_id,
      created_date,
      last_updated,
      project_manager,
      program_manager,
      behalf_of
    ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE, NOW(), $11, $12, $13)
    RETURNING ${MAP_COLUMNS_SELECT};
  `;

  const params = [
    data.action_item || '',
    data.priority || 'Medium',
    data.target_date || new Date().toISOString().split('T')[0],
    data.status || 'Open',
    data.responsible || '',
    data.support_required_from || '',
    data.teams_involved || '',
    data.remarks || '',
    data.created_by,
    data.action_id,
    data.project_manager || null,
    data.program_manager || null,
    data.behalf_of || null,
  ];

  const { rows } = await pool.query(insertSql, params);
  return rows[0];
}

export async function updateAction(id, data) {
  const sql = `
    UPDATE actions SET
      action_title = $1,
      priority = $2,
      due_date = $3,
      status = $4,
      action_owner = $5,
      dependencies = $6,
      related_to_type = $7,
      comments = $8,
      project_manager = $10,
      program_manager = $11,
      behalf_of = $12,
      updated_at = NOW()
    WHERE id = $9
    RETURNING ${MAP_COLUMNS_SELECT};
  `;

  const params = [
    data.action_item,
    data.priority,
    data.target_date,
    data.status,
    data.responsible,
    data.support_required_from,
    data.teams_involved,
    data.remarks,
    id,
    data.project_manager || null,
    data.program_manager || null,
    data.behalf_of || null,
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0];
}

export async function deleteMultipleActions(ids) {
  if (!ids || ids.length === 0) return 0;
  const sql = `DELETE FROM actions WHERE id = ANY($1::uuid[]) RETURNING *`;
  const { rowCount } = await pool.query(sql, [ids]);
  return rowCount;
}

export async function countAll() {
  const result = await pool.query("SELECT COUNT(*) AS c FROM actions");
  return Number(result.rows[0].c);
}

export async function countByStatus(status) {
  const result = await pool.query(
    "SELECT COUNT(*) AS c FROM actions WHERE status::text = $1::text",
    [status]
  );
  return Number(result.rows[0].c);
}

export async function countOverdue() {
  const result = await pool.query(`
    SELECT COUNT(*) AS c
    FROM actions
    WHERE due_date < now()::date
      AND status NOT IN ('Resolved', 'Cancelled')
  `);
  return Number(result.rows[0].c);
}

export async function findActionsByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const sql = `SELECT ${MAP_COLUMNS_SELECT} FROM actions WHERE id = ANY($1::uuid[])`;
  const { rows } = await pool.query(sql, [ids]);
  return rows;
}

export async function bulkUpsertActions(actionsArray, userEmail) {
  const results = [];
  try {
    await pool.query('BEGIN');
    for (const data of actionsArray) {
      if (data.action_id) {
        // Try to update if we can find it by action_id
        const existing = await pool.query("SELECT id FROM actions WHERE action_id = $1", [data.action_id]);
        if (existing.rows.length > 0) {
           const id = existing.rows[0].id;
           const updated = await updateAction(id, data);
           results.push(updated);
           continue;
        }
      }
      // If we made it here, create new
      data.created_by = userEmail;
      const created = await createAction(data);
      results.push(created);
    }
    await pool.query('COMMIT');
    return results;
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }
}
