
import { loginHandler } from "./controllers/auth.controller.js";

const req = {
    body: {
        email: "ajaykumar.j@arche.global",
        password: "Ajaykumar@Arche2026"
    }
};

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

async function testLogin() {
    try {
        const originalConsoleError = console.error;
        console.error = (...args) => {
            console.log("CAPTURED ERROR LOG:", ...args);
            originalConsoleError(...args);
        };

        await loginHandler(req, res);
    } catch (err) {
        console.error("Test Login CRASHED:");
        console.error(err);
    }
}

testLogin();
