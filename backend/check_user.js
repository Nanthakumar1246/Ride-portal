
import pool from "./db.js";

async function checkUser() {
    try {
        const res = await pool.query("SELECT id, email, role, is_active FROM users WHERE email = $1", ["p@arche.global"]);
        console.log("User Check:", JSON.stringify(res.rows));
        process.exit(0);
    } catch (err) {
        console.error("User Check Failed:", err);
        process.exit(1);
    }
}

checkUser();
