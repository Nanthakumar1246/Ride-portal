
import pool from "./db.js";

async function inspectData() {
    try {
        const tableRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'projects'
    `);
        console.log("Projects Columns:", tableRes.rows.map(r => r.column_name).join(", "));

        const dataRes = await pool.query(`SELECT id, name, account, description FROM projects LIMIT 5`);
        console.log("Sample Projects Data:", JSON.stringify(dataRes.rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspectData();
