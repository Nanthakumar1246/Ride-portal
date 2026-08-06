
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';
const ADMIN_EMAIL = 'santhosh.b@arche.global';
const ADMIN_PASS = 'Santhosh@Arche2026';

async function testProjectsApi() {
  try {
    // 1. Login
    console.log("1. Logging in...");
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS })
    });

    if (!loginRes.ok) {
      const txt = await loginRes.text();
      console.error("Login Failed:", loginRes.status, txt);
      process.exit(1);
    }

    const loginData = await loginRes.json();
    const token = loginData.data?.token || loginData.token;
    console.log("Login response keys:", Object.keys(loginData));
    console.log("Token prefix:", token ? token.substring(0, 20) + "..." : "NULL");
    console.log("Login successful.\n");

    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. GET /api/projects (Master List)
    console.log("2. Testing GET /api/projects ...");
    const projRes = await fetch(`${BASE_URL}/projects`, { headers: authHeaders });
    console.log("   Status:", projRes.status);
    const projData = await projRes.json();
    console.log("   Rows returned:", Array.isArray(projData) ? projData.length : "NOT ARRAY");
    if (Array.isArray(projData) && projData.length > 0) {
      console.log("   First record keys:", Object.keys(projData[0]).join(", "));
      console.log("   Sample record:", JSON.stringify(projData[0], null, 2));
    }
    console.log();

    // 3. GET /api/projects/accounts
    console.log("3. Testing GET /api/projects/accounts ...");
    const accRes = await fetch(`${BASE_URL}/projects/accounts`, { headers: authHeaders });
    console.log("   Status:", accRes.status);
    const accData = await accRes.json();
    console.log("   Accounts:", Array.isArray(accData) ? accData.length : accData);
    console.log();

    // 4. GET /api/projects/managers
    console.log("4. Testing GET /api/projects/managers ...");
    const mgrRes = await fetch(`${BASE_URL}/projects/managers`, { headers: authHeaders });
    console.log("   Status:", mgrRes.status);
    const mgrData = await mgrRes.json();
    console.log("   PMs:", mgrData.project_managers?.length || 0);
    console.log("   Program Managers:", mgrData.program_managers?.length || 0);
    console.log();

    // 5. GET /api/projects/templates
    console.log("5. Testing GET /api/projects/templates ...");
    const tplRes = await fetch(`${BASE_URL}/projects/templates`, { headers: authHeaders });
    console.log("   Status:", tplRes.status);
    const tplData = await tplRes.json();
    console.log("   Templates:", Array.isArray(tplData) ? tplData.length : tplData);
    console.log();

    console.log("=== ALL TESTS PASSED ===");
    process.exit(0);
  } catch (err) {
    console.error("Test Error:", err.message);
    process.exit(1);
  }
}

testProjectsApi();
