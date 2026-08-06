
import pool from "./db.js";

async function checkRiskIdSchema() {
    try {
        const res = await pool.query(`
      SELECT column_name, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'risks' AND column_name = 'risk_id'
    `);
        console.log("Risk ID Schema:", JSON.stringify(res.rows[0], null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkRiskIdSchema();
