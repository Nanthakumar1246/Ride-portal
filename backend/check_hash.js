
import pool from "./db.js";

async function checkUserHash() {
    try {
        const res = await pool.query("SELECT email, password_hash FROM users WHERE email = $1", ["ajaykumar.j@arche.global"]);
        if (res.rows.length > 0) {
            const hash = res.rows[0].password_hash;
            console.log("Email:", res.rows[0].email);
            console.log("Hash Prefix:", hash ? hash.substring(0, 10) : "NULL");
            console.log("Hash Length:", hash ? hash.length : 0);
        } else {
            console.log("User not found");
        }
        process.exit(0);
    } catch (err) {
        console.error("Check Hash Failed:", err);
        process.exit(1);
    }
}

checkUserHash();
