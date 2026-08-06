
import pool from "./db.js";

async function checkSchema() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
        console.log("Users Columns:", JSON.stringify(res.rows));
        process.exit(0);
    } catch (err) {
        console.error("Schema Check Failed:", err);
        process.exit(1);
    }
}

checkSchema();
