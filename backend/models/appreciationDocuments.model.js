
import pool from "../db.js";

export async function createAppreciationDocument(data) {
  const sql = `
    INSERT INTO appreciation_documents (
      appreciation_id, file_name, file_type, file_path, uploaded_by
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const params = [
    data.appreciation_id,
    data.file_name,
    data.file_type,
    data.file_path,
    data.uploaded_by,
  ];
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

export async function findLatestDocumentByAppreciationId(appreciationId) {
  const sql = `
    SELECT * FROM appreciation_documents
    WHERE appreciation_id = $1
    ORDER BY uploaded_at DESC
    LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [appreciationId]);
  return rows[0];
}

export async function findLatestDocumentsByAppreciationIds(appreciationIds) {
  if (!appreciationIds || appreciationIds.length === 0) return [];
  const sql = `
    SELECT DISTINCT ON (appreciation_id) *
    FROM appreciation_documents
    WHERE appreciation_id = ANY($1::uuid[])
    ORDER BY appreciation_id, uploaded_at DESC;
  `;
  const { rows } = await pool.query(sql, [appreciationIds]);
  return rows;
}
