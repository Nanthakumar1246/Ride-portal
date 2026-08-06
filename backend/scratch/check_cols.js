
import pool from "../db.js";

async function checkColumns() {
  const tables = ['risks', 'issues', 'actions', 'dependencies', 'escalations'];
  for (const t of tables) {
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}'`);
    console.log(`Table ${t}:`, res.rows.map(r => r.column_name).sort().join(', '));
  }
  process.exit(0);
}

checkColumns();
