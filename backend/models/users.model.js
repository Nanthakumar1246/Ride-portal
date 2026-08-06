import db from "../db.js";


export async function findByEmail(email) {
  const result = await db.query(
    `SELECT *
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );

  return result.rows[0] || null;
}


export async function createUser({ name, email, password_hash, role }) {
  const result = await db.query(
    `INSERT INTO users (name, email, password_hash, role, password_updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, name, email, role, is_active, password_updated_at`,
    [name, email, password_hash, role]
  );

  return result.rows[0];
}


export async function findUsersByNames(names) {
  const cleanNames = (names || []).map((n) => String(n || "").trim()).filter(Boolean);
  if (cleanNames.length === 0) return [];

  const result = await db.query(
    `SELECT name, email
     FROM users
     WHERE LOWER(TRIM(name)) = ANY($1::text[])`,
    [cleanNames.map((n) => n.toLowerCase())]
  );
  return result.rows;
}


export async function listAllUsers() {
  const result = await db.query(
    `SELECT id, name, email, role, is_active, created_at
     FROM users
     ORDER BY name ASC`
  );
  return result.rows;
}


export async function getAssignedProjects(userId) {
  const result = await db.query(
    `SELECT p.id, p.name, p.account
     FROM projects p
     JOIN user_projects up ON up.project_id = p.id
     WHERE up.user_id = $1`,
    [userId]
  );
  return result.rows;
}

export async function assignProjects(userId, projectIds) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    
    await client.query(`DELETE FROM user_projects WHERE user_id = $1`, [userId]);

    
    if (projectIds && projectIds.length > 0) {
      for (const pid of projectIds) {
        await client.query(
          `INSERT INTO user_projects (user_id, project_id) VALUES ($1, $2)`,
          [userId, pid]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}


export async function updatePassword(userId, newPasswordHash) {
  const result = await db.query(
    `UPDATE users 
     SET password_hash = $1, password_updated_at = NOW(), updated_at = NOW() 
     WHERE id = $2 
     RETURNING id, email`,
    [newPasswordHash, userId]
  );
  return result.rows[0];
}

export async function saveOtp(userId, otp, mobileNumber) {
  const expiresAt = new Date(Date.now() + 10 * 60000); // 10 mins expiry
  await db.query(
    `UPDATE users SET reset_otp = $1, reset_otp_expires_at = $2, mobile_number = $3 WHERE id = $4`,
    [otp, expiresAt, mobileNumber, userId]
  );
}

export async function clearOtp(userId) {
  await db.query(
    `UPDATE users SET reset_otp = NULL, reset_otp_expires_at = NULL WHERE id = $1`,
    [userId]
  );
}
