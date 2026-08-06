
import pool from "../db.js";

async function simplifyActions() {
  try {
    console.log("Starting database simplification for 'actions' table...");

    // 1. Rename existing columns to match new names if possible
    await pool.query(`ALTER TABLE actions RENAME COLUMN action_title TO action_item;`);
    await pool.query(`ALTER TABLE actions RENAME COLUMN due_date TO target_date;`);
    await pool.query(`ALTER TABLE actions RENAME COLUMN action_owner TO responsible;`);
    await pool.query(`ALTER TABLE actions RENAME COLUMN comments TO remarks;`);

    // 2. Add new columns
    await pool.query(`ALTER TABLE actions ADD COLUMN IF NOT EXISTS support_required_from TEXT;`);
    await pool.query(`ALTER TABLE actions ADD COLUMN IF NOT EXISTS teams_involved TEXT;`);

    // 3. Drop unused columns
    const columnsToDrop = [
      "manual_project_id",
      "project_id",
      "project_description",
      "account",
      "created_date",
      "action_description",
      "completion_date",
      "completion_percent",
      "related_to_type",
      "related_to_id",
      "dependencies"
    ];

    for (const col of columnsToDrop) {
      await pool.query(`ALTER TABLE actions DROP COLUMN IF EXISTS ${col};`);
      console.log(`Dropped column: ${col}`);
    }

    console.log("Database simplification completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Error simplifying database:", err);
    process.exit(1);
  }
}

simplifyActions();
