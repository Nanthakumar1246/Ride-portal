import dotenv from "dotenv";
dotenv.config();
import pool from "./db.js";

const email = "harikrishna.s@arche.global";
const u = await pool.query("SELECT id, name, email, role FROM users WHERE email = $1", [email]);
console.log("USER:", u.rows[0]);

const name = u.rows[0]?.name;
const total = await pool.query("SELECT COUNT(*)::int AS c FROM risks");
const byPm = await pool.query(
  "SELECT COUNT(*)::int AS c FROM risks WHERE LOWER(TRIM(project_manager::text)) = LOWER(TRIM($1::text))",
  [name]
);
const created = await pool.query(
  "SELECT COUNT(*)::int AS c FROM risks WHERE created_by::text ILIKE $1 OR identified_by::text ILIKE $1",
  ["%" + (name || "") + "%"]
);
const samplePm = await pool.query(
  "SELECT project_manager, COUNT(*)::int AS c FROM risks GROUP BY 1 ORDER BY c DESC LIMIT 20"
);
console.log("total risks", total.rows[0].c);
console.log("risks where project_manager matches user.name", byPm.rows[0].c);
console.log("risks created/identified matching name", created.rows[0].c);
console.log("top project_managers:", samplePm.rows);

const login = await fetch("http://localhost:5000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "Admin@123" }),
});
const loginBody = await login.json();
console.log(
  "login",
  login.status,
  loginBody.success,
  loginBody.message,
  "role=",
  loginBody.data?.user?.role,
  "name=",
  loginBody.data?.user?.name
);

if (loginBody.data?.token) {
  const risks = await fetch("http://localhost:5000/api/risks", {
    headers: { Authorization: "Bearer " + loginBody.data.token },
  });
  const risksBody = await risks.json();
  const rows = risksBody.data || risksBody;
  console.log("API risks count for PM:", Array.isArray(rows) ? rows.length : rows);
  if (Array.isArray(rows)) {
    console.log(
      "API project_managers:",
      [...new Set(rows.map((r) => r.project_manager))].slice(0, 20)
    );
  }

  const dash = await fetch("http://localhost:5000/api/dashboard/metrics", {
    headers: { Authorization: "Bearer " + loginBody.data.token },
  });
  const dashBody = await dash.json();
  console.log("dashboard metrics keys:", Object.keys(dashBody.data || dashBody));
  console.log("dashboard sample:", JSON.stringify(dashBody.data || dashBody).slice(0, 500));
}

await pool.end();
