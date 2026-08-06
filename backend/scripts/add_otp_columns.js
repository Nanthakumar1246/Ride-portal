import pool from "../db.js";

async function addOTPColumns() {
    try {
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20),
            ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(10),
            ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMP
        `);
        console.log("Successfully added OTP columns to users table.");
        process.exit(0);
    } catch (err) {
        console.error("Failed to add columns:", err);
        process.exit(1);
    }
}

addOTPColumns();
