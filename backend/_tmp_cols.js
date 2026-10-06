import dotenv from "dotenv";
dotenv.config();
import pool from "./db.js";

for (const t of ["risks", "issues", "actions", "dependencies", "escalations", "appreciations"]) {
  const r = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = $1
       AND column_name IN ('created_by','identified_by','reported_by','recorded_by','project_manager')
     ORDER BY 1`,
    [t]
  );
  console.log(t, r.rows);
}

const samples = await pool.query(`
  SELECT 'risks' AS t, created_by::text, identified_by::text AS reporter FROM risks ORDER BY created_at DESC LIMIT 1
  UNION ALL
  SELECT 'issues', NULL, reported_by::text FROM issues ORDER BY created_at DESC LIMIT 1
`);
// separate samples
for (const q of [
  "SELECT created_by::text AS c, identified_by::text AS r FROM risks ORDER BY created_at DESC LIMIT 3",
  "SELECT reported_by::text AS r FROM issues ORDER BY created_at DESC LIMIT 3",
  "SELECT created_by::text AS c FROM actions ORDER BY created_at DESC LIMIT 3",
  "SELECT reported_by::text AS r FROM dependencies ORDER BY created_at DESC LIMIT 3",
  "SELECT created_by::text AS c, reported_by::text AS r FROM escalations ORDER BY created_at DESC LIMIT 3",
  "SELECT recorded_by::text AS r FROM appreciations ORDER BY created_at DESC LIMIT 3",
]) {
  console.log(q.split(" FROM ")[1].split(" ")[0], (await pool.query(q)).rows);
}

await pool.end();
