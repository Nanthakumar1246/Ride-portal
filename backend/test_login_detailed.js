
import { loginHandler } from "./controllers/auth.controller.js";

const req = {
    body: {
        email: "ajaykumar.j@arche.global",
        password: "AnyPassword"
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
        // We expect this to return 401 if it works (wrong pass), but 500 if it crashes.
        // The user's crash is caught and returns { message: "Login failed" }
        // but the console.error should have more info.
        // We will override console.error to see what's being logged.
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
