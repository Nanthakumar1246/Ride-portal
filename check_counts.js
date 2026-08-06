import pool from "./backend/db.js";
async function checkCounts() {
    try {
        const res = await pool.query("SELECT COUNT(*) FROM risks");
        console.log("Total Risks:", res.rows[0].count);

        const nullProj = await pool.query("SELECT COUNT(*) FROM risks WHERE manual_project_id IS NULL");
        console.log("Risks with NULL manual_project_id:", nullProj.rows[0].count);

        const emptyProj = await pool.query("SELECT COUNT(*) FROM risks WHERE manual_project_id = ''");
        console.log("Risks with empty manual_project_id:", emptyProj.rows[0].count);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkCounts();
