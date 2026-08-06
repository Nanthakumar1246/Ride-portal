
import pool from "./db.js";

async function findMatch() {
    try {
        const res = await pool.query(`
      SELECT name, account, description 
      FROM projects 
      WHERE name LIKE '%CPSO%' OR name LIKE 'CPSO%'
      LIMIT 10
    `);
        console.log("Matching Projects:", JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findMatch();
