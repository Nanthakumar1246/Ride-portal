import pool from "./db.js";

async function inspectColumns() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects'
      ORDER BY ordinal_position
    `);
    console.log("Projects Table Columns in DB:");
    console.table(res.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspectColumns();
