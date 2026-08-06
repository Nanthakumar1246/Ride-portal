import dotenv from "dotenv";
import { getAccessToken } from "./integrations/outlook/token_manager.js";
import { sendMailViaGraph } from "./integrations/outlook/graph_client.js";
import { sendGovernanceEventMail } from "./integrations/outlook/mail_service.js";
import pool from "./db.js";

dotenv.config();

async function runTest() {
  console.log("========== STEP 1: TEST MICROSOFT GRAPH OAUTH TOKEN ACQUISITION ==========");
  try {
    const token = await getAccessToken();
    console.log("SUCCESS: OAuth Access Token acquired!");
    console.log("Token sample:", token.substring(0, 35) + "...");
  } catch (err) {
    console.error("FAILED OAuth Token Acquisition:", err.message);
    process.exit(1);
  }

  console.log("\n========== STEP 2: TEST EMAIL DISPATCH VIA MICROSOFT GRAPH API ==========");
  try {
    const testResult = await sendGovernanceEventMail({
      module: "risk",
      recordId: "RSK-0312",
      eventType: "NEW_RECORD",
      recordData: {
        account: "Acme Corp",
        manual_project_id: "Payments Revamp",
        title: "Integration Test Risk - Latency Spike in Payment Gateway",
        status: "Open",
        mitigation_owner: "Santhosh B",
        priority: "High"
      },
      currentUserEmail: "santhosh.b@arche.global"
    });

    console.log("SUCCESS: Test email dispatch response:", JSON.stringify(testResult, null, 2));
  } catch (err) {
    console.error("FAILED Email Dispatch:", err.message);
  }

  console.log("\n========== STEP 3: CHECK DATABASE EMAIL AUDIT LOG ==========");
  try {
    // Ensure table exists first if not already created
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          module VARCHAR(50) NOT NULL,
          record_id VARCHAR(100) NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          recipient VARCHAR(255) NOT NULL,
          sender VARCHAR(255) NOT NULL,
          subject VARCHAR(500) NOT NULL,
          status VARCHAR(50) NOT NULL,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const { rows } = await pool.query("SELECT * FROM email_audit_log ORDER BY created_at DESC LIMIT 3");
    console.log("SUCCESS: Query returned email audit entries count:", rows.length);
    if (rows.length > 0) {
      console.log("Latest Audit Entry:", JSON.stringify(rows[0], null, 2));
    }
  } catch (err) {
    console.error("FAILED Email Audit DB Query:", err.message);
  }

  await pool.end();
  console.log("\n========== ALL VERIFICATION TESTS COMPLETED ==========");
}

runTest();
