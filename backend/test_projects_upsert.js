import pool from "./db.js";

async function testUpsertAndRetrieve() {
  const client = await pool.connect();
  try {
    console.log("--- Testing Bulk Upsert ---");
    const testData = [
      {
        so_number: "230126",
        manual_project_id: "CPSO100",
        project_description: "On-Site Warranty Support for IT Infra",
        project_manager: "Santharam B",
        program_manager: "Ajay Jha",
        scope_description: "DESIGN, SUPPLY, INSTALLATION, TESTING AND COMMISSIONING OF SERVERS",
        account: "Cochin International Airport Limited",
      },
      {
        so_number: "230154",
        manual_project_id: "SI_AMC9",
        project_description: "Server Consolidation & Data Center",
        project_manager: "Santharam B",
        program_manager: "Ajay Jha",
        scope_description: "SETTING UP OF SERVER CONSOLIDATION & DATA CENTRE AT ARCI HYDERABAD",
        account: "INTERNATIONAL ADVANCED RESEARCH CENTRE FOR POWDER METALLURGY",
      },
    ];

    await client.query("BEGIN");

    for (const p of testData) {
      const checkSql = `SELECT id FROM projects WHERE manual_project_id = $1 OR name = $1 LIMIT 1`;
      const checkRes = await client.query(checkSql, [p.manual_project_id]);

      if (checkRes.rows.length > 0) {
        const updateSql = `
          UPDATE projects
          SET 
            name = $1, manual_project_id = $1, account = $2, project_description = $3,
            description = $3, project_manager = $4, program_manager = $5, so_number = $6,
            scope_description = $7, updated_at = CURRENT_TIMESTAMP
          WHERE id = $8
        `;
        await client.query(updateSql, [
          p.manual_project_id, p.account, p.project_description,
          p.project_manager, p.program_manager, p.so_number,
          p.scope_description, checkRes.rows[0].id
        ]);
      } else {
        const insertSql = `
          INSERT INTO projects (
            name, manual_project_id, account, project_description, description, 
            project_manager, program_manager, so_number, scope_description, created_by
          ) VALUES ($1, $1, $2, $3, $3, $4, $5, $6, $7, 'TestRunner')
        `;
        await client.query(insertSql, [
          p.manual_project_id, p.account, p.project_description,
          p.project_manager, p.program_manager, p.so_number,
          p.scope_description
        ]);
      }
    }

    await client.query("COMMIT");
    console.log("Upsert succeeded!");

    console.log("\n--- Testing Retrieval of Upserted Projects ---");
    const fetchSql = `
      SELECT id, manual_project_id, project_description, account, project_manager, program_manager, so_number, status
      FROM projects
      WHERE manual_project_id IN ('CPSO100', 'SI_AMC9')
    `;
    const res = await pool.query(fetchSql);
    console.table(res.rows);

    process.exit(0);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Test Upsert Error:", err);
    process.exit(1);
  } finally {
    client.release();
  }
}

testUpsertAndRetrieve();
