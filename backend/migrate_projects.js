import pool from "./db.js";

async function migrate() {
  try {
    // Add created_by if it doesn't exist
    await pool.query(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS created_by TEXT,
      ALTER COLUMN created_at SET DEFAULT NOW()
    `);
    console.log("Migration successful: added created_by and set created_at default.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
