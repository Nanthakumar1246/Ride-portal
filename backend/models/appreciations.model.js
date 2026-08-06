
import pool from "../db.js";



export async function findAppreciations({ whereSql = "", params = [] } = {}) {
  const sql = `
    SELECT
      a.id,
      a.appreciation_id,
      a.manual_project_id,
      a.project_id,
      a.project_description,
      a.account,
      a.received_date,
      a.recorded_by,
      a.customer_name,
      a.customer_contact,
      a.appreciation_type,
      a.subject,
      a.details,
      a.team_members_recognized,
      CASE
        WHEN a.team_members_recognized IS NULL OR a.team_members_recognized = ''
        THEN 0
        ELSE array_length(string_to_array(a.team_members_recognized, ','), 1)
      END AS team_members_count,
      a.shared_with_team,
      a.follow_up_action,
      a.comments,
      a.project_manager,
      a.program_manager,
      a.behalf_of,
      a.created_at,
      a.updated_at
    FROM appreciations a
    ${whereSql}
    ORDER BY a.created_at DESC, a.received_date DESC
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
}


export async function findAppreciationById(id) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const sql = `
    SELECT
      a.id,
      a.appreciation_id,
      a.manual_project_id,
      a.project_id,
      a.project_description,
      a.account,
      a.received_date,
      a.recorded_by,
      a.customer_name,
      a.customer_contact,
      a.appreciation_type,
      a.subject,
      a.details,
      a.team_members_recognized,
      CASE
        WHEN a.team_members_recognized IS NULL OR a.team_members_recognized = ''
        THEN 0
        ELSE array_length(string_to_array(a.team_members_recognized, ','), 1)
      END AS team_members_count,
      a.shared_with_team,
      a.follow_up_action,
      a.comments,
      a.project_manager,
      a.program_manager,
      a.behalf_of,
      a.created_at,
      a.updated_at
    FROM appreciations a
    WHERE ${isUuid ? "a.id" : "a.appreciation_id"} = $1
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
}


export async function createAppreciation(data) {
  const sql = `
   INSERT INTO appreciations (
  appreciation_id,
  manual_project_id,
  project_id,
  project_description,
  account,
  received_date,
  recorded_by,
  customer_name,
  customer_contact,
  appreciation_type,
  subject,
  details,
  team_members_recognized,
  shared_with_team,
  follow_up_action,
  last_updated,
  comments,
  project_manager,
  program_manager,
  behalf_of
) VALUES (
  $1::text,
  $16::text,
  $2::uuid,
  $3::text,
  $4::text,
  $5::date,
  $6::text,
  $7::text,
  $8::text,
  $9::text,
  $10::text,
  $11::text,
  $12::text,
  $13::boolean,
  $14::text,
  now(),
  $15::text,
  $17::text,
  $18::text,
  $19::text
)
RETURNING *,
  CASE
    WHEN $12::text IS NULL OR $12::text = ''
    THEN 0
    ELSE array_length(string_to_array($12::text, ','), 1)
  END as team_members_count;

  `;

  const params = [
    data.appreciation_id,
    (data.project_id && data.project_id !== "") ? data.project_id : null,
    data.project_description || null,
    data.account || null,
    data.received_date,
    data.recorded_by,
    data.customer_name,
    data.customer_contact || null,
    data.appreciation_type,
    data.subject,
    data.details,
    data.team_members_recognized || null,
    data.shared_with_team === 'Yes' || data.shared_with_team === true,
    data.follow_up_action || null,
    data.comments || null,
    data.manual_project_id,
    data.project_manager || null,
    data.program_manager || null,
    data.behalf_of || null,
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0];
}


export async function updateAppreciation(id, data) {
  const sql = `
    UPDATE appreciations SET
      appreciation_id = $1::text,
      manual_project_id = $16::text,
      project_id = $2::uuid,
      project_description = $3::text,
      account = $4::text,
      received_date = $5::date,
      recorded_by = $6::text,
      customer_name = $7::text,
      customer_contact = $8::text,
      appreciation_type = $9::text,
      subject = $10::text,
      details = $11::text,
      team_members_recognized = $12::text,
      team_members_count = CASE
        WHEN $12::text IS NULL OR $12::text = ''
        THEN 0
        ELSE array_length(string_to_array($12::text, ','), 1)
      END,
      shared_with_team = $13::boolean,
      follow_up_action = $14::text,
      last_updated = now(),
      comments = $15::text,
      project_manager = $18::text,
      program_manager = $19::text,
      behalf_of = $20::text,
      updated_at = now()
    WHERE id = $17::uuid
    RETURNING *;
  `;

  const params = [
    data.appreciation_id,
    (data.project_id && data.project_id !== "") ? data.project_id : null,
    data.project_description || null,
    data.account || null,
    data.received_date,
    data.recorded_by,
    data.customer_name,
    data.customer_contact || null,
    data.appreciation_type,
    data.subject,
    data.details,
    data.team_members_recognized || null,
    data.shared_with_team === 'Yes' || data.shared_with_team === true,
    data.follow_up_action || null,
    data.comments || null,
    data.manual_project_id,
    id,
    data.project_manager || null,
    data.program_manager || null,
    data.behalf_of || null,
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0];
}


export async function countAll() {
  const { rows } = await pool.query(
    "SELECT COUNT(*) AS c FROM appreciations"
  );
  return Number(rows[0].c);
}

export async function findAppreciationsByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const sql = `SELECT * FROM appreciations WHERE id = ANY($1::uuid[])`;
  const { rows } = await pool.query(sql, [ids]);
  return rows;
}

export async function deleteMultipleAppreciations(ids) {
  if (!ids || ids.length === 0) return 0;
  const sql = `DELETE FROM appreciations WHERE id = ANY($1::uuid[]) RETURNING *`;
  const { rowCount } = await pool.query(sql, [ids]);
  return rowCount;
}
