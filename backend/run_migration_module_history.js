import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "migrations", "create_module_history.sql"), "utf8");
    await pool.query(sql);
    console.log("Migration applied: create_module_history.sql");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    pool.end();
  }
}

run();
