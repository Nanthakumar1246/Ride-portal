
import pool from "../db.js";

export async function createAppNotification({ recipientEmail, module, recordId, eventType, title, message }) {
  const sql = `
    INSERT INTO app_notifications (recipient_email, module, record_id, event_type, title, message)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const { rows } = await pool.query(sql, [recipientEmail, module || null, recordId || null, eventType || null, title, message || null]);
  return rows[0];
}

export async function createAppNotificationsForEmails(emails, { module, recordId, eventType, title, message }) {
  const uniqueEmails = [...new Set((emails || []).filter(Boolean))];
  const results = [];
  for (const email of uniqueEmails) {
    results.push(await createAppNotification({ recipientEmail: email, module, recordId, eventType, title, message }));
  }
  return results;
}

export async function findNotificationsForUser(email, { limit = 20, unreadOnly = false } = {}) {
  const where = unreadOnly ? "WHERE recipient_email = $1 AND is_read = false" : "WHERE recipient_email = $1";
  const { rows } = await pool.query(
    `SELECT * FROM app_notifications ${where} ORDER BY created_at DESC LIMIT $2`,
    [email, limit]
  );
  return rows;
}

export async function countUnreadForUser(email) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS c FROM app_notifications WHERE recipient_email = $1 AND is_read = false`,
    [email]
  );
  return Number(rows[0]?.c || 0);
}

export async function markNotificationRead(id, email) {
  const { rows } = await pool.query(
    `UPDATE app_notifications SET is_read = true WHERE id = $1 AND recipient_email = $2 RETURNING *`,
    [id, email]
  );
  return rows[0];
}

export async function markAllNotificationsRead(email) {
  await pool.query(`UPDATE app_notifications SET is_read = true WHERE recipient_email = $1`, [email]);
}
