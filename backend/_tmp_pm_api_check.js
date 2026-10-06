import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
import pool from "./db.js";

const secret = process.env.JWT_SECRET || "dev-secret";
const email = "harikrishna.s@arche.global";
const u = (await pool.query("SELECT id, name, email, role FROM users WHERE email = $1", [email])).rows[0];
const token = jwt.sign({ id: u.id, email: u.email, role: u.role, name: u.name }, secret, { expiresIn: "1h" });

const endpoints = [
  "/api/risks",
  "/api/issues",
  "/api/actions",
  "/api/dependencies",
  "/api/escalations",
  "/api/appreciations",
  "/api/dashboard/metrics?manager=All",
];

for (const ep of endpoints) {
  const res = await fetch("http://localhost:5000" + ep, {
    headers: { Authorization: "Bearer " + token },
  });
  const body = await res.json();
  const data = body.data ?? body;
  if (Array.isArray(data)) {
    console.log(ep, "status", res.status, "count", data.length);
    if (data.length && data[0].project_manager !== undefined) {
      console.log("  PMs:", [...new Set(data.map((r) => r.project_manager))].slice(0, 10));
    }
  } else {
    console.log(ep, "status", res.status, "payload", JSON.stringify(data).slice(0, 300));
  }
}

// What would "created by this user" look like across modules?
const name = u.name;
const emailLike = u.email;
for (const [table, cols] of [
  ["risks", ["created_by", "identified_by", "project_manager"]],
  ["issues", ["reported_by", "project_manager"]],
  ["actions", ["created_by", "project_manager"]],
  ["dependencies", ["reported_by", "project_manager"]],
  ["escalations", ["created_by", "reported_by", "project_manager"]],
]) {
  const clauses = cols.map((c, i) => `LOWER(TRIM(COALESCE(${c}::text,''))) = LOWER(TRIM($${i + 1}))`).join(" OR ");
  const params = cols.map(() => name);
  // also try email
  const r = await pool.query(
    `SELECT COUNT(*)::int AS c FROM ${table} WHERE ${cols.map((c) => `${c}::text ILIKE '%hari%' OR ${c}::text ILIKE '%harikrishna%'`).join(" OR ")}`
  );
  console.log(`DB ${table} matching hari/harikrishna:`, r.rows[0].c);
}

await pool.end();
