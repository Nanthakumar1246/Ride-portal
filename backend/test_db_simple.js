import pool from "./db.js";
async function test() {
    try {
        const res = await pool.query("SELECT NOW()");
        console.log("DB Connection OK:", res.rows[0]);
        process.exit(0);
    } catch (err) {
        console.error("DB Connection Failed:", err);
        process.exit(1);
    }
}

test();
