/**
 * E2E Test Script for ArcheRide Modules
 * Tests: Risk, Issue, Dependency, Escalation, Action, Appreciation
 * Flow: Login → Create → Verify GET → Dashboard Check
 */

const BASE_URL = "http://localhost:5000";

const results = [];

async function log(module, step, status, detail = "") {
  const emoji = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚡";
  console.log(`${emoji} [${module}] ${step}: ${status} ${detail ? "- " + detail : ""}`);
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, ok: res.ok };
}

// ═══════════════════════════════════════════════════════
// STEP 1: LOGIN
// ═══════════════════════════════════════════════════════
async function login() {
  console.log("\n════════════════════════════════════════════");
  console.log("  STEP 1: LOGIN");
  console.log("════════════════════════════════════════════\n");

  const { status, json, ok } = await fetchJSON(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({
      email: "ajaykumar.j@arche.global",
      password: "Ajaykumar@Arche2026",
    }),
  });

  const token = json.token || json.data?.token;
  if (ok && token) {
    log("AUTH", "Login", "PASS", `Token received (${token.substring(0, 30)}...)`);
    return token;
  } else {
    log("AUTH", "Login", "FAIL", `Status ${status}: ${JSON.stringify(json).substring(0, 200)}`);
    // Fallback to dev token
    console.log("⚠️  Falling back to fake-token-dev for auth bypass");
    return "fake-token-dev";
  }
}

// ═══════════════════════════════════════════════════════
// STEP 2: CREATE RECORDS
// ═══════════════════════════════════════════════════════

async function createRisk(token) {
  const module = "RISK";
  console.log(`\n─── Creating ${module} ───`);
  const payload = {
    risk_title: "E2E Test: Server Downtime Risk",
    risk_description: "Risk of production server outage during peak holiday traffic exceeding 10K concurrent users",
    priority: "High",
    category: "Technical",
    status: "Open",
    account: "Arche Global",
    probability: 3,
    impact: 4,
    identified_by: "ajaykumar.j@arche.global",
    identified_date: new Date().toISOString().slice(0, 10),
    mitigation_strategy: "Implement auto-scaling and load balancer failover",
    mitigation_owner: "devops-team@arche.global",
    target_mitigation_date: "2026-09-15",
    comments: "E2E test record created via API"
  };

  const { status, json, ok } = await fetchJSON(`${BASE_URL}/api/risks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  const result = { module, api_status: status, api_ok: ok };

  if (ok && json.data) {
    log(module, "CREATE (POST /api/risks)", "PASS", `ID: ${json.data.id}, Risk ID: ${json.data.risk_id}`);
    result.record_id = json.data.id;
    result.entity_id = json.data.risk_id;
    result.create = "PASS";
  } else {
    log(module, "CREATE (POST /api/risks)", "FAIL", `Status ${status}: ${JSON.stringify(json).substring(0, 200)}`);
    result.create = "FAIL";
    result.error = JSON.stringify(json).substring(0, 200);
  }
  return result;
}

async function createIssue(token) {
  const module = "ISSUE";
  console.log(`\n─── Creating ${module} ───`);
  const payload = {
    issue_title: "E2E Test: Database Connection Timeout",
    issue_description: "Intermittent DB connection failures under sustained load causing 5xx errors for 2% of users",
    priority: "Medium",
    category: "Performance",
    status: "Open",
    account: "Arche Global",
    severity: "Major",
    reported_by: "ajaykumar.j@arche.global",
    reported_date: new Date().toISOString().slice(0, 10),
    comments: "E2E test record created via API"
  };

  const { status, json, ok } = await fetchJSON(`${BASE_URL}/api/issues`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  const result = { module, api_status: status, api_ok: ok };

  if (ok && json.data) {
    log(module, "CREATE (POST /api/issues)", "PASS", `ID: ${json.data.id}, Issue ID: ${json.data.issue_id}`);
    result.record_id = json.data.id;
    result.entity_id = json.data.issue_id;
    result.create = "PASS";
  } else {
    log(module, "CREATE (POST /api/issues)", "FAIL", `Status ${status}: ${JSON.stringify(json).substring(0, 200)}`);
    result.create = "FAIL";
    result.error = JSON.stringify(json).substring(0, 200);
  }
  return result;
}

async function createDependency(token) {
  const module = "DEPENDENCY";
  console.log(`\n─── Creating ${module} ───`);
  const payload = {
    dependency_title: "E2E Test: Payment Gateway API Integration",
    dependency_description: "Critical dependency on third-party payment gateway API for checkout flow processing",
    priority: "High",
    type: "External",
    status: "Open",
    account: "Arche Global",
    reported_by: "ajaykumar.j@arche.global",
    reported_date: new Date().toISOString().slice(0, 10),
    contact_person: "vendor-support@payment.com",
    comments: "E2E test record created via API"
  };

  const { status, json, ok } = await fetchJSON(`${BASE_URL}/api/dependencies`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  const result = { module, api_status: status, api_ok: ok };

  if (ok && json.data) {
    log(module, "CREATE (POST /api/dependencies)", "PASS", `ID: ${json.data.id}, Dep ID: ${json.data.dependency_id}`);
    result.record_id = json.data.id;
    result.entity_id = json.data.dependency_id;
    result.create = "PASS";
  } else {
    log(module, "CREATE (POST /api/dependencies)", "FAIL", `Status ${status}: ${JSON.stringify(json).substring(0, 200)}`);
    result.create = "FAIL";
    result.error = JSON.stringify(json).substring(0, 200);
  }
  return result;
}

async function createEscalation(token) {
  const module = "ESCALATION";
  console.log(`\n─── Creating ${module} ───`);
  const payload = {
    title: "E2E Test: Delayed Sprint 14 Delivery",
    description: "Sprint 14 deliverables delayed by 3 business days due to critical resource shortage in QA team",
    priority: "High",
    category: "Schedule",
    status: "Open",
    account: "Arche Global",
    escalated_to: "santhosh.b@arche.global",
    reported_by: "ajaykumar.j@arche.global",
    reported_date: new Date().toISOString().slice(0, 10),
    target_resolution_date: "2026-09-01",
    impact: "High - Sprint deliverables delayed affecting client timeline",
    last_updated: new Date().toISOString(),
    comments: "E2E test record created via API"
  };

  const { status, json, ok } = await fetchJSON(`${BASE_URL}/api/escalations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  const result = { module, api_status: status, api_ok: ok };

  if (ok && json.data) {
    log(module, "CREATE (POST /api/escalations)", "PASS", `ID: ${json.data.id}, Esc ID: ${json.data.escalation_id}`);
    result.record_id = json.data.id;
    result.entity_id = json.data.escalation_id;
    result.create = "PASS";
  } else {
    log(module, "CREATE (POST /api/escalations)", "FAIL", `Status ${status}: ${JSON.stringify(json).substring(0, 200)}`);
    result.create = "FAIL";
    result.error = JSON.stringify(json).substring(0, 200);
  }
  return result;
}

async function createAction(token) {
  const module = "ACTION";
  console.log(`\n─── Creating ${module} ───`);
  const payload = {
    action_item: "E2E Test: Clear Code Review Backlog",
    priority: "Medium",
    status: "Open",
    target_date: "2026-08-15",
    responsible: "ajaykumar.j@arche.global",
    support_required_from: "Frontend Team",
    teams_involved: "Engineering",
    remarks: "E2E test: Clear pending code reviews from last 2 sprints before next release"
  };

  const { status, json, ok } = await fetchJSON(`${BASE_URL}/api/actions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  const result = { module, api_status: status, api_ok: ok };

  if (ok && json.data) {
    log(module, "CREATE (POST /api/actions)", "PASS", `ID: ${json.data.id}, Action ID: ${json.data.action_id}`);
    result.record_id = json.data.id;
    result.entity_id = json.data.action_id;
    result.create = "PASS";
  } else {
    log(module, "CREATE (POST /api/actions)", "FAIL", `Status ${status}: ${JSON.stringify(json).substring(0, 200)}`);
    result.create = "FAIL";
    result.error = JSON.stringify(json).substring(0, 200);
  }
  return result;
}

async function createAppreciation(token) {
  const module = "APPRECIATION";
  console.log(`\n─── Creating ${module} ───`);
  const payload = {
    subject: "E2E Test: Outstanding Sprint Performance",
    details: "Team delivered all Sprint 14 features ahead of schedule with zero production defects and 98% test coverage",
    appreciation_type: "Client Feedback",
    customer_name: "John Smith - VP Engineering",
    customer_contact: "john.smith@client.com",
    received_date: new Date().toISOString().slice(0, 10),
    account: "Arche Global",
    team_members_recognized: "ajaykumar.j@arche.global,santhosh.b@arche.global",
    shared_with_team: "Yes",
    follow_up_action: "Share in all-hands meeting and add to quarterly review",
    comments: "E2E test record created via API"
  };

  const { status, json, ok } = await fetchJSON(`${BASE_URL}/api/appreciations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });

  const result = { module, api_status: status, api_ok: ok };

  if (ok && json.data) {
    log(module, "CREATE (POST /api/appreciations)", "PASS", `ID: ${json.data.id}, App ID: ${json.data.appreciation_id}`);
    result.record_id = json.data.id;
    result.entity_id = json.data.appreciation_id;
    result.create = "PASS";
  } else {
    log(module, "CREATE (POST /api/appreciations)", "FAIL", `Status ${status}: ${JSON.stringify(json).substring(0, 200)}`);
    result.create = "FAIL";
    result.error = JSON.stringify(json).substring(0, 200);
  }
  return result;
}

// ═══════════════════════════════════════════════════════
// STEP 3: VERIFY RECORDS VIA GET
// ═══════════════════════════════════════════════════════

async function verifyGet(token, result) {
  const module = result.module;
  const endpoints = {
    RISK: "/api/risks",
    ISSUE: "/api/issues",
    DEPENDENCY: "/api/dependencies",
    ESCALATION: "/api/escalations",
    ACTION: "/api/actions",
    APPRECIATION: "/api/appreciations",
  };

  if (!result.record_id) {
    log(module, "GET VERIFY", "FAIL", "No record ID from create step");
    result.get_verify = "FAIL";
    return result;
  }

  // Verify individual GET by ID
  const { status, json, ok } = await fetchJSON(
    `${BASE_URL}${endpoints[module]}/${result.record_id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (ok && json.data) {
    log(module, `GET by ID (${result.record_id.substring(0, 8)}...)`, "PASS", `Found record successfully`);
    result.get_verify = "PASS";
    result.db_persisted = "PASS";
  } else {
    log(module, `GET by ID (${result.record_id})`, "FAIL", `Status ${status}: ${JSON.stringify(json).substring(0, 150)}`);
    result.get_verify = "FAIL";
    result.db_persisted = "FAIL";
  }

  // Verify it appears in list
  const listRes = await fetchJSON(
    `${BASE_URL}${endpoints[module]}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (listRes.ok && Array.isArray(listRes.json.data)) {
    const found = listRes.json.data.find(r => r.id === result.record_id);
    if (found) {
      log(module, "LIST VERIFY", "PASS", `Record found in list (total: ${listRes.json.data.length})`);
      result.list_verify = "PASS";
    } else {
      log(module, "LIST VERIFY", "FAIL", `Record NOT found in list of ${listRes.json.data.length} items`);
      result.list_verify = "FAIL";
    }
  } else {
    log(module, "LIST VERIFY", "FAIL", `List API failed: ${listRes.status}`);
    result.list_verify = "FAIL";
  }

  return result;
}

// ═══════════════════════════════════════════════════════
// STEP 4: VERIFY DASHBOARD
// ═══════════════════════════════════════════════════════

async function verifyDashboard(token) {
  console.log("\n════════════════════════════════════════════");
  console.log("  STEP 4: DASHBOARD METRICS VERIFICATION");
  console.log("════════════════════════════════════════════\n");

  const { status, json, ok } = await fetchJSON(
    `${BASE_URL}/api/dashboard/metrics`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!ok) {
    log("DASHBOARD", "GET /api/dashboard/metrics", "FAIL", `Status ${status}`);
    return { dashboard_ok: false };
  }

  log("DASHBOARD", "GET /api/dashboard/metrics", "PASS", `Status ${status}`);

  console.log(`\n  📊 Dashboard Summary:`);
  console.log(`     Total Items: ${json.total_items}`);
  console.log(`     Open: ${json.total_open}`);
  console.log(`     On Hold: ${json.total_on_hold}`);
  console.log(`     Resolved: ${json.resolved}`);
  console.log(`     Approved: ${json.approved}`);
  console.log(`     Cancelled: ${json.cancelled}`);
  console.log(`     Completion %: ${json.action_completion_percent}%`);

  if (json.module_status && Array.isArray(json.module_status)) {
    console.log(`\n  📋 Module Status Breakdown:`);
    console.log(`     ${"Module".padEnd(15)} ${"Open".padStart(6)} ${"Submitted".padStart(10)} ${"Closed".padStart(8)} ${"Hold".padStart(6)} ${"Total".padStart(6)}`);
    console.log(`     ${"─".repeat(55)}`);
    json.module_status.forEach(m => {
      console.log(`     ${m.module.padEnd(15)} ${String(m.Open).padStart(6)} ${String(m.ClosureSubmitted).padStart(10)} ${String(m.ClosedAcknowledged).padStart(8)} ${String(m.Hold).padStart(6)} ${String(m.total).padStart(6)}`);
    });
  }

  return { dashboard_ok: true, data: json };
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   ARCHERIDE E2E TEST SUITE                   ║");
  console.log("║   Modules: Risk, Issue, Dep, Esc, Act, App   ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // Step 1: Login
  const token = await login();

  // Step 2: Create all records
  console.log("\n════════════════════════════════════════════");
  console.log("  STEP 2: CREATE RECORDS");
  console.log("════════════════════════════════════════════");

  const riskResult = await createRisk(token);
  const issueResult = await createIssue(token);
  const depResult = await createDependency(token);
  const escResult = await createEscalation(token);
  const actResult = await createAction(token);
  const appResult = await createAppreciation(token);

  const allResults = [riskResult, issueResult, depResult, escResult, actResult, appResult];

  // Step 3: Verify via GET
  console.log("\n════════════════════════════════════════════");
  console.log("  STEP 3: VERIFY RECORDS (GET APIs)");
  console.log("════════════════════════════════════════════");

  for (const r of allResults) {
    await verifyGet(token, r);
  }

  // Step 4: Dashboard
  const dashResult = await verifyDashboard(token);

  // Check if each new record's module shows "Open" count >= 1
  if (dashResult.dashboard_ok && dashResult.data.module_status) {
    for (const r of allResults) {
      if (r.module === "APPRECIATION") {
        r.dashboard = "N/A"; // Appreciations don't show in module_status
        continue;
      }
      const moduleNameMap = {
        RISK: "Risk",
        ISSUE: "Issue",
        DEPENDENCY: "Dependency",
        ESCALATION: "Escalation",
        ACTION: "Action",
      };
      const ms = dashResult.data.module_status.find(m => m.module === moduleNameMap[r.module]);
      if (ms && ms.Open >= 1) {
        log(r.module, "DASHBOARD VISIBILITY", "PASS", `Open count: ${ms.Open}`);
        r.dashboard = "PASS";
      } else {
        log(r.module, "DASHBOARD VISIBILITY", "FAIL", `Module status: ${JSON.stringify(ms)}`);
        r.dashboard = "FAIL";
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════
  console.log("\n╔══════════════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                           E2E TEST REPORT - FINAL RESULTS                          ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════════════════╣");
  console.log(`║ ${"Module".padEnd(14)} │ ${"API".padEnd(6)} │ ${"Create".padEnd(7)} │ ${"GET".padEnd(6)} │ ${"List".padEnd(6)} │ ${"DB".padEnd(6)} │ ${"Dashboard".padEnd(10)} │ ${"Result".padEnd(6)} ║`);
  console.log(`╠${"═".repeat(86)}╣`);

  for (const r of allResults) {
    const overall = (r.create === "PASS" && r.get_verify === "PASS" && r.list_verify === "PASS") ? "PASS" : "FAIL";
    r.overall = overall;
    const row = `║ ${r.module.padEnd(14)} │ ${String(r.api_status).padEnd(6)} │ ${(r.create || "—").padEnd(7)} │ ${(r.get_verify || "—").padEnd(6)} │ ${(r.list_verify || "—").padEnd(6)} │ ${(r.db_persisted || "—").padEnd(6)} │ ${(r.dashboard || "—").padEnd(10)} │ ${overall.padEnd(6)} ║`;
    console.log(row);
  }

  console.log(`╚${"═".repeat(86)}╝`);

  const passed = allResults.filter(r => r.overall === "PASS").length;
  const failed = allResults.filter(r => r.overall !== "PASS").length;
  console.log(`\n🏁 SUMMARY: ${passed} PASSED, ${failed} FAILED out of ${allResults.length} modules\n`);

  // Print errors for failed modules
  if (failed > 0) {
    console.log("─── FAILURE DETAILS ───");
    for (const r of allResults.filter(r => r.overall !== "PASS")) {
      console.log(`\n  ❌ ${r.module}:`);
      if (r.error) console.log(`     Error: ${r.error}`);
      console.log(`     Create: ${r.create}, GET: ${r.get_verify}, List: ${r.list_verify}, DB: ${r.db_persisted}, Dashboard: ${r.dashboard}`);
    }
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
