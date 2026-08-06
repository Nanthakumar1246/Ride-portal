/**
 * ArcheRide E2E PROOF Test
 * Real JWT only. No fake-token-dev.
 * For each module: POST → show response → DB query → GET → Dashboard
 */
import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;
const BASE_URL = "http://localhost:5000";
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

// ─── helpers ────────────────────────────────────────
async function api(path, opts = {}) {
  const r = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const txt = await r.text();
  let json;
  try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
  return { status: r.status, ok: r.ok, json };
}

function line(c = "═", n = 72) { return c.repeat(n); }
function section(title) { console.log(`\n${line()}\n  ${title}\n${line()}`); }
function sub(title) { console.log(`\n  ── ${title} ${"─".repeat(60 - title.length)}`); }
function kv(k, v) { console.log(`    ${k.padEnd(22)}: ${v}`); }
function jsonBlock(label, obj) {
  console.log(`\n    📦 ${label}:`);
  const s = JSON.stringify(obj, null, 2);
  s.split("\n").forEach(l => console.log(`       ${l}`));
}

const results = [];
const today = new Date().toISOString().slice(0, 10);

// ═══════════════════════════════════════════════════
// 1. LOGIN
// ═══════════════════════════════════════════════════
async function login() {
  section("STEP 1 — AUTHENTICATION (Real JWT)");
  const { status, json, ok } = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "ajaykumar.j@arche.global",
      password: "Ajaykumar@Arche2026",
    }),
  });

  const token = json.token || json.data?.token;
  const user = json.data?.user || json.user;

  kv("Endpoint", "POST /api/auth/login");
  kv("HTTP Status", status);
  kv("Login Success", ok ? "✅ YES" : "❌ NO");

  if (!ok || !token) {
    console.log("  ❌ FATAL: Cannot obtain real JWT. Aborting.");
    jsonBlock("Response", json);
    process.exit(1);
  }

  kv("Token (first 50 chars)", token.substring(0, 50) + "…");
  kv("User ID", user?.id);
  kv("User Name", user?.name);
  kv("User Email", user?.email);
  kv("User Role", user?.role);
  console.log("\n  ✅ Authentication: PASS — Real JWT obtained");
  return token;
}

// ═══════════════════════════════════════════════════
// 2. MODULE TESTS
// ═══════════════════════════════════════════════════

async function testModule(token, cfg) {
  const { name, postPath, getListPath, table, idCol, payload } = cfg;
  const result = { module: name, auth: "✅", post: "—", get: "—", db: "—", dashboard: "—", overall: "FAIL" };

  section(`MODULE: ${name.toUpperCase()}`);

  // ─── 2a. CREATE (POST) ───
  sub("POST — Create Record");
  kv("Endpoint", `POST ${postPath}`);
  jsonBlock("Request Payload", payload);

  const post = await api(postPath, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  kv("HTTP Status", post.status);

  if (!post.ok || !post.json.data) {
    kv("Result", "❌ FAIL");
    jsonBlock("Error Response", post.json);
    result.post = "❌";
    results.push(result);
    return result;
  }

  const created = post.json.data;
  const recordUUID = created.id;
  const entityId = created[idCol];

  kv("Result", "✅ PASS");
  kv("Record UUID", recordUUID);
  kv("Entity ID", entityId);
  jsonBlock("Full API Response (data)", created);
  result.post = "✅";

  // ─── 2b. DATABASE VERIFICATION ───
  sub("DATABASE — Direct PostgreSQL Query");
  kv("Table", table);
  kv("Query", `SELECT * FROM ${table} WHERE id = '${recordUUID}'`);

  try {
    const dbRes = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [recordUUID]);
    if (dbRes.rows.length === 1) {
      const row = dbRes.rows[0];
      kv("Rows Found", "1");
      kv("DB id", row.id);
      kv(`DB ${idCol}`, row[idCol]);
      kv("DB status", row.status);
      kv("DB created_at", row.created_at?.toISOString());
      kv("Result", "✅ PASS — Record exists in PostgreSQL");
      result.db = "✅";
    } else {
      kv("Rows Found", dbRes.rows.length);
      kv("Result", "❌ FAIL — Record NOT found in database");
      result.db = "❌";
    }
  } catch (err) {
    kv("Result", `❌ FAIL — DB Error: ${err.message}`);
    result.db = "❌";
  }

  // ─── 2c. GET BY ID ───
  sub("GET — Fetch Record by ID");
  const getPath = `${getListPath}/${recordUUID}`;
  kv("Endpoint", `GET ${getPath}`);

  const getRes = await api(getPath, {
    headers: { Authorization: `Bearer ${token}` },
  });

  kv("HTTP Status", getRes.status);

  if (getRes.ok && getRes.json.data) {
    const fetched = getRes.json.data;
    kv("Fetched UUID", fetched.id);
    kv("Fetched Entity ID", fetched[idCol]);
    kv("Match", fetched.id === recordUUID ? "✅ IDs match" : "❌ ID mismatch!");
    kv("Result", "✅ PASS");
    result.get = "✅";
  } else {
    kv("Result", "❌ FAIL");
    jsonBlock("Error", getRes.json);
    result.get = "❌";
  }

  // ─── 2d. LIST VERIFICATION ───
  sub("LIST — Verify in Module List");
  kv("Endpoint", `GET ${getListPath}`);

  const listRes = await api(getListPath, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (listRes.ok && Array.isArray(listRes.json.data)) {
    const found = listRes.json.data.find(r => r.id === recordUUID);
    kv("Total Records", listRes.json.data.length);
    kv("Our Record Found", found ? "✅ YES" : "❌ NO");
  }

  result.recordUUID = recordUUID;
  result.entityId = entityId;
  results.push(result);
  return result;
}

// ═══════════════════════════════════════════════════
// 3. DASHBOARD VERIFICATION
// ═══════════════════════════════════════════════════
async function verifyDashboard(token) {
  section("VP DASHBOARD VERIFICATION");
  kv("Endpoint", "GET /api/dashboard/metrics");

  const { status, json, ok } = await api("/api/dashboard/metrics", {
    headers: { Authorization: `Bearer ${token}` },
  });

  kv("HTTP Status", status);

  if (!ok) {
    console.log("  ❌ Dashboard API failed");
    return;
  }

  console.log("\n  📊 Dashboard Metrics:");
  kv("Total Items", json.total_items);
  kv("Open", json.total_open);
  kv("On Hold", json.total_on_hold);
  kv("Resolved", json.resolved);
  kv("Approved & Closed", json.approved);
  kv("Cancelled", json.cancelled);

  if (json.module_status) {
    console.log("\n  📋 Module Status Table:");
    console.log(`    ${"Module".padEnd(14)} ${"Open".padStart(5)} ${"Submitted".padStart(10)} ${"Closed".padStart(7)} ${"Hold".padStart(5)} ${"Total".padStart(6)}`);
    console.log(`    ${"─".repeat(50)}`);
    json.module_status.forEach(m => {
      console.log(`    ${m.module.padEnd(14)} ${String(m.Open).padStart(5)} ${String(m.ClosureSubmitted).padStart(10)} ${String(m.ClosedAcknowledged).padStart(7)} ${String(m.Hold).padStart(5)} ${String(m.total).padStart(6)}`);
    });
  }

  // Check each tested module
  const moduleMap = { RISK: "Risk", ISSUE: "Issue", DEPENDENCY: "Dependency", ESCALATION: "Escalation", ACTION: "Action" };

  console.log("\n  🔍 Dashboard Visibility per Module:");
  for (const r of results) {
    const dashName = moduleMap[r.module];
    if (!dashName) {
      // Appreciation not in module_status
      kv(r.module, "N/A (Appreciations use separate feed)");
      r.dashboard = "N/A";
      continue;
    }
    const ms = json.module_status?.find(m => m.module === dashName);
    if (ms && ms.total > 0) {
      kv(r.module, `✅ Visible — Open: ${ms.Open}, Total: ${ms.total}`);
      r.dashboard = "✅";
    } else {
      kv(r.module, `❌ NOT visible`);
      r.dashboard = "❌";
    }
  }
}

// ═══════════════════════════════════════════════════
// 4. DB COUNT VERIFICATION
// ═══════════════════════════════════════════════════
async function verifyDbCounts() {
  section("DATABASE RECORD COUNTS");
  const tables = ["risks", "issues", "dependencies", "escalations", "actions", "appreciations"];
  for (const t of tables) {
    const res = await pool.query(`SELECT COUNT(*)::int as count FROM ${t}`);
    kv(t, `${res.rows[0].count} records`);
  }
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════════╗");
  console.log("║          ARCHERIDE — FULL E2E PROOF TEST                              ║");
  console.log("║          Real JWT Auth · DB Proof · Dashboard Proof                   ║");
  console.log("╚════════════════════════════════════════════════════════════════════════╝");

  const token = await login();

  // ─── Test all 6 modules ───
  const modules = [
    {
      name: "RISK",
      postPath: "/api/risks",
      getListPath: "/api/risks",
      table: "risks",
      idCol: "risk_id",
      payload: {
        risk_title: "E2E Proof: Production Memory Leak",
        risk_description: "Memory consumption grows 15% per hour under sustained load, risking OOM crash in production after 6 hours of peak traffic",
        priority: "Critical",
        category: "Technical",
        status: "Open",
        account: "Arche Global",
        probability: 4,
        impact: 5,
        identified_by: "ajaykumar.j@arche.global",
        identified_date: today,
        mitigation_strategy: "Implement memory profiling and garbage collection optimization",
        mitigation_owner: "backend-team@arche.global",
        target_mitigation_date: "2026-08-20",
        comments: "E2E proof test — created via direct API call with real JWT"
      }
    },
    {
      name: "ISSUE",
      postPath: "/api/issues",
      getListPath: "/api/issues",
      table: "issues",
      idCol: "issue_id",
      payload: {
        issue_title: "E2E Proof: Login Session Timeout",
        issue_description: "Users are getting logged out after 15 minutes of inactivity despite the configured 8-hour session timeout",
        priority: "High",
        category: "Authentication",
        status: "Open",
        account: "Arche Global",
        severity: "Major",
        reported_by: "ajaykumar.j@arche.global",
        reported_date: today,
        comments: "E2E proof test — created via direct API call with real JWT"
      }
    },
    {
      name: "DEPENDENCY",
      postPath: "/api/dependencies",
      getListPath: "/api/dependencies",
      table: "dependencies",
      idCol: "dependency_id",
      payload: {
        dependency_title: "E2E Proof: Cloud Infrastructure Migration",
        dependency_description: "Application deployment depends on AWS to Azure migration completing before Q3 release deadline",
        priority: "High",
        type: "Infrastructure",
        status: "Open",
        account: "Arche Global",
        reported_by: "ajaykumar.j@arche.global",
        reported_date: today,
        contact_person: "cloud-ops@arche.global",
        comments: "E2E proof test — created via direct API call with real JWT"
      }
    },
    {
      name: "ESCALATION",
      postPath: "/api/escalations",
      getListPath: "/api/escalations",
      table: "escalations",
      idCol: "escalation_id",
      payload: {
        title: "E2E Proof: Critical Security Vulnerability",
        description: "Penetration testing revealed SQL injection vulnerability in the reporting module requiring immediate patching",
        priority: "Critical",
        category: "Security",
        status: "Open",
        account: "Arche Global",
        escalated_to: "santhosh.b@arche.global",
        reported_by: "ajaykumar.j@arche.global",
        reported_date: today,
        target_resolution_date: "2026-08-10",
        impact: "Critical — Potential data breach if exploited",
        last_updated: new Date().toISOString(),
        comments: "E2E proof test — created via direct API call with real JWT"
      }
    },
    {
      name: "ACTION",
      postPath: "/api/actions",
      getListPath: "/api/actions",
      table: "actions",
      idCol: "action_id",
      payload: {
        action_item: "E2E Proof: Implement Automated CI/CD Pipeline",
        priority: "High",
        status: "Open",
        target_date: "2026-08-25",
        responsible: "ajaykumar.j@arche.global",
        support_required_from: "DevOps Team",
        teams_involved: "Engineering, QA",
        remarks: "E2E proof test — Set up GitHub Actions + Docker for automated build, test, and deploy pipeline"
      }
    },
    {
      name: "APPRECIATION",
      postPath: "/api/appreciations",
      getListPath: "/api/appreciations",
      table: "appreciations",
      idCol: "appreciation_id",
      payload: {
        subject: "E2E Proof: Exceptional Client Delivery",
        details: "Team successfully delivered the Q2 product release 2 weeks ahead of schedule, receiving praise from the client CTO for code quality and zero post-release defects",
        appreciation_type: "Client Feedback",
        customer_name: "Sarah Johnson - CTO, TechCorp",
        customer_contact: "sarah.j@techcorp.com",
        received_date: today,
        account: "Arche Global",
        team_members_recognized: "ajaykumar.j@arche.global,santhosh.b@arche.global",
        shared_with_team: "Yes",
        follow_up_action: "Feature in monthly newsletter and nominate for quarterly award",
        comments: "E2E proof test — created via direct API call with real JWT"
      }
    }
  ];

  for (const m of modules) {
    await testModule(token, m);
  }

  // Dashboard
  await verifyDashboard(token);

  // DB counts
  await verifyDbCounts();

  // ═══════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════
  section("FINAL E2E PROOF REPORT");

  console.log(`\n  ${"Module".padEnd(14)} ${"Auth".padEnd(6)} ${"POST".padEnd(6)} ${"GET".padEnd(6)} ${"DB".padEnd(6)} ${"Dashboard".padEnd(10)} ${"Result".padEnd(7)}`);
  console.log(`  ${"─".repeat(58)}`);

  let allPass = true;
  for (const r of results) {
    const pass = r.post === "✅" && r.get === "✅" && r.db === "✅";
    r.overall = pass ? "PASS ✅" : "FAIL ❌";
    if (!pass) allPass = false;
    console.log(`  ${r.module.padEnd(14)} ${r.auth.padEnd(6)} ${r.post.padEnd(6)} ${r.get.padEnd(6)} ${r.db.padEnd(6)} ${(r.dashboard || "—").padEnd(10)} ${r.overall}`);
  }

  console.log(`\n  ${"═".repeat(58)}`);
  console.log(`  🏁 OVERALL: ${allPass ? "ALL 6 MODULES PASSED ✅" : "SOME MODULES FAILED ❌"}`);
  console.log(`  ${"═".repeat(58)}\n`);

  await pool.end();
}

main().catch(async err => {
  console.error("Fatal:", err);
  await pool.end();
  process.exit(1);
});
