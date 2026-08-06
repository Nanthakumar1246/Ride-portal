import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "migrations", "add_pm_mapping_and_behalf_of.sql"), "utf8");
    await pool.query(sql);
    console.log("Migration applied: add_pm_mapping_and_behalf_of.sql");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    pool.end();
  }
}

run();
