import pool from "./db.js";
const res = await pool.query("SELECT * FROM actions LIMIT 1");
console.log("COLUMNS:", Object.keys(res.rows[0]));
process.exit();
