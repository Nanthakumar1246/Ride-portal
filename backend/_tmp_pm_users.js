import dotenv from "dotenv";
dotenv.config();
import pool from "./db.js";

const pms = (
  await pool.query("SELECT id, name, email, role FROM users WHERE UPPER(role) = 'PM' ORDER BY name")
).rows;
console.log("PM users:", pms);

for (const u of pms) {
  const byPm = await pool.query(
    "SELECT COUNT(*)::int AS c FROM risks WHERE LOWER(TRIM(project_manager::text)) = LOWER(TRIM($1::text))",
    [u.name]
  );
  const byCreator = await pool.query(
    "SELECT COUNT(*)::int AS c FROM risks WHERE created_by = $1",
    [u.id]
  );
  const byIdent = await pool.query(
    "SELECT COUNT(*)::int AS c FROM risks WHERE LOWER(TRIM(identified_by::text)) = LOWER(TRIM($1::text)) OR identified_by::text ILIKE $2",
    [u.name, "%" + u.email + "%"]
  );
  console.log(
    `${u.name} <${u.email}> | as project_manager: ${byPm.rows[0].c} | as created_by id: ${byCreator.rows[0].c} | as identified_by: ${byIdent.rows[0].c}`
  );
}

// Sample created_by / identified_by values
const sample = await pool.query(`
  SELECT r.risk_id, r.project_manager, r.identified_by, r.created_by, u.name AS creator_name, u.email AS creator_email
  FROM risks r
  LEFT JOIN users u ON r.created_by = u.id
  ORDER BY r.created_at DESC
  LIMIT 15
`);
console.log("recent risks sample:", sample.rows);

await pool.end();
