
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
        await loginHandler(req, res);
    } catch (err) {
        console.error("Test Login CRASHED with stack:");
        console.error(err.stack);
    }
}

testLogin();
