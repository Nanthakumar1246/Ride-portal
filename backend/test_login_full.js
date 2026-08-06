
import { loginHandler } from "./controllers/auth.controller.js";
import pool from "./db.js";

async function testFull() {
    try {
        const res = {
            status: (code) => {
                console.log("Status:", code);
                return res;
            },
            json: (data) => {
                console.log("JSON:", JSON.stringify(data, null, 2));
                return res;
            }
        };

        const userResult = await pool.query("SELECT * FROM users WHERE email = $1", ["ajaykumar.j@arche.global"]);
        const user = userResult.rows[0];

        // We will bypass the password check for simplicity and just test sendLoginResponse
        // Wait, sendLoginResponse is not exported. But loginHandler calls it.
        // If we want to test exactly sendLoginResponse, we'd need to invoke loginHandler with the right pass.

        const req = {
            body: {
                email: "ajaykumar.j@arche.global",
                password: "Ajaykumar@Arche2026"
            }
        };

        await loginHandler(req, res);

        process.exit(0);
    } catch (err) {
        console.error("FULL TEST ERROR:", err);
        process.exit(1);
    }
}

testFull();
