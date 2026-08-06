import pool from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, "migrations", "update_projects_master_table.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    console.log("Running Project Master migration...");
    await pool.query(sql);
    console.log("Migration executed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

runMigration();
