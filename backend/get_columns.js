
import pool from "./db.js";

async function checkColumns() {
    try {
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'risks' 
      ORDER BY ordinal_position
    `);
        console.log("Columns:", res.rows.map(r => r.column_name).join(", "));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkColumns();
