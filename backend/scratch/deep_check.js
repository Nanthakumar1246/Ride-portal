
import pool from "../db.js";

async function deepCheck() {
  const t = 'actions';
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = '${t}'
    ORDER BY column_name
  `);
  console.log(`Deep check for ${t}:`);
  res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));
  process.exit(0);
}

deepCheck();
