import { Router } from "express";
import pool from "../db.js";

const router = Router();

// GET /api/projects - Master List with Search & Filtering
router.get("/", async (req, res) => {
  try {
    const { name, q, account, project_manager, program_manager, limit = 500 } = req.query;
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    let sql = `
      SELECT 
        id, 
        COALESCE(manual_project_id, name) as manual_project_id,
        COALESCE(manual_project_id, name) as name,
        COALESCE(project_description, description) as project_description,
        so_number,
        project_manager,
        program_manager,
        scope_description,
        account,
        COALESCE(status, 'Active') as status,
        created_at,
        updated_at
      FROM projects
      WHERE 1=1
    `;
    const params = [];

    const searchQuery = q || name;
    if (searchQuery) {
      params.push(`%${searchQuery}%`);
      sql += ` AND (manual_project_id ILIKE $${params.length} OR name ILIKE $${params.length} OR project_description ILIKE $${params.length} OR so_number ILIKE $${params.length} OR account ILIKE $${params.length})`;
    }

    if (account) {
      params.push(account);
      sql += ` AND account = $${params.length}`;
    }

    if (project_manager) {
      params.push(project_manager);
      sql += ` AND project_manager = $${params.length}`;
    }

    if (program_manager) {
      params.push(program_manager);
      sql += ` AND program_manager = $${params.length}`;
    }

    if (user.role === "PM") {
      params.push(user.name);
      sql += ` AND project_manager = $${params.length}`;
    }

    sql += ` ORDER BY COALESCE(manual_project_id, name) ASC LIMIT $${params.length + 1}`;
    params.push(Number(limit));

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("Project master lookup error:", err);
    return res.status(500).json({ message: "Failed to fetch projects" });
  }
});

// GET /api/projects/accounts - List distinct accounts
router.get("/accounts", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const params = [];
    let sql = `
      SELECT DISTINCT account
      FROM projects
      WHERE account IS NOT NULL AND TRIM(account) != ''
    `;
    if (user.role === "PM") {
      params.push(user.name);
      sql += ` AND project_manager = $${params.length}`;
    }
    sql += ` ORDER BY account ASC`;
    const { rows } = await pool.query(sql, params);
    return res.json(rows.map((r) => r.account));
  } catch (err) {
    console.error("Error fetching accounts:", err);
    return res.status(500).json({ message: "Failed to fetch accounts" });
  }
});

// GET /api/projects/managers - List distinct PMs and Program Managers
router.get("/managers", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const pmSql = `SELECT DISTINCT project_manager FROM projects WHERE project_manager IS NOT NULL AND TRIM(project_manager) != '' ORDER BY project_manager ASC`;
    const pgmSql = `SELECT DISTINCT program_manager FROM projects WHERE program_manager IS NOT NULL AND TRIM(program_manager) != '' ORDER BY program_manager ASC`;

    const [pmRes, pgmRes] = await Promise.all([pool.query(pmSql), pool.query(pgmSql)]);

    return res.json({
      project_managers: pmRes.rows.map((r) => r.project_manager),
      program_managers: pgmRes.rows.map((r) => r.program_manager),
    });
  } catch (err) {
    console.error("Error fetching managers:", err);
    return res.status(500).json({ message: "Failed to fetch managers" });
  }
});

// GET /api/projects/program-managers?headed_by=<name> - Distinct PMs mapped under a Headed By
// "Headed By" = projects.program_manager (the small set: Ajay/Mano/Prashanth/Dr. Gummadi).
// "PM" = projects.project_manager (the individual project managers, e.g. Santharam B).
router.get("/program-managers", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { headed_by } = req.query;
    if (!headed_by) return res.json([]);

    const sql = `
      SELECT DISTINCT project_manager
      FROM projects
      WHERE program_manager = $1
        AND project_manager IS NOT NULL AND TRIM(project_manager) != ''
      ORDER BY project_manager ASC
    `;
    const { rows } = await pool.query(sql, [headed_by]);
    return res.json(rows.map((r) => r.project_manager));
  } catch (err) {
    console.error("Error fetching program managers:", err);
    return res.status(500).json({ message: "Failed to fetch program managers" });
  }
});

// GET /api/projects/by-account/:account - Projects belonging to selected account
router.get("/by-account/:account", async (req, res) => {
  try {
    const { account } = req.params;
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const params = [account];
    let sql = `
      SELECT
        id,
        COALESCE(manual_project_id, name) as manual_project_id,
        COALESCE(manual_project_id, name) as name,
        COALESCE(project_description, description) as project_description,
        so_number,
        project_manager,
        program_manager,
        scope_description,
        account,
        COALESCE(status, 'Active') as status
      FROM projects
      WHERE account ILIKE $1
    `;
    if (user.role === "PM") {
      params.push(user.name);
      sql += ` AND project_manager = $${params.length}`;
    }
    sql += ` ORDER BY COALESCE(manual_project_id, name) ASC`;
    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching projects by account:", err);
    return res.status(500).json({ message: "Failed to fetch projects by account" });
  }
});

// POST /api/projects/upsert-bulk - Bulk Import & Upsert into Project Master
router.post("/upsert-bulk", async (req, res) => {
  const client = await pool.connect();
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { projects } = req.body;
    if (!Array.isArray(projects) || projects.length === 0) {
      return res.status(400).json({ message: "No projects provided for import" });
    }

    await client.query("BEGIN");

    let newCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors = [];

    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      const rowNum = i + 1;

      const manual_project_id = p.manual_project_id ? String(p.manual_project_id).trim() : "";
      const account = p.account ? String(p.account).trim() : "";
      const project_description = p.project_description ? String(p.project_description).trim() : "";
      const project_manager = p.project_manager ? String(p.project_manager).trim() : "";
      const program_manager = p.program_manager ? String(p.program_manager).trim() : "";
      const so_number = p.so_number ? String(p.so_number).trim() : "";
      const scope_description = p.scope_description ? String(p.scope_description).trim() : "";

      // Validation
      if (!manual_project_id || !account) {
        failedCount++;
        errors.push({ row: rowNum, project_id: manual_project_id, error: "Missing required fields (Project ID or Account)" });
        continue;
      }

      // Check if project exists
      const checkSql = `SELECT id FROM projects WHERE manual_project_id = $1 OR name = $1 LIMIT 1`;
      const checkRes = await client.query(checkSql, [manual_project_id]);

      if (checkRes.rows.length > 0) {
        // UPDATE (Upsert)
        const updateSql = `
          UPDATE projects
          SET 
            name = $1,
            manual_project_id = $1,
            account = $2,
            project_description = $3,
            description = $3,
            project_manager = $4,
            program_manager = $5,
            so_number = $6,
            scope_description = $7,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $8
        `;
        await client.query(updateSql, [
          manual_project_id,
          account,
          project_description,
          project_manager,
          program_manager,
          so_number,
          scope_description,
          checkRes.rows[0].id,
        ]);
        updatedCount++;
      } else {
        // INSERT
        const insertSql = `
          INSERT INTO projects (
            name, manual_project_id, account, project_description, description, 
            project_manager, program_manager, so_number, scope_description, created_by
          ) VALUES ($1, $1, $2, $3, $3, $4, $5, $6, $7, $8)
        `;
        await client.query(insertSql, [
          manual_project_id,
          account,
          project_description,
          project_manager,
          program_manager,
          so_number,
          scope_description,
          user.email || "System",
        ]);
        newCount++;
      }
    }

    await client.query("COMMIT");

    return res.json({
      total: projects.length,
      newCount,
      updatedCount,
      skippedCount,
      failedCount,
      errors,
      message: `Import Completed: ${newCount} New, ${updatedCount} Updated, ${failedCount} Failed`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Bulk upsert error:", err);
    return res.status(500).json({ message: "Bulk project import failed: " + err.message });
  } finally {
    client.release();
  }
});

// GET /api/projects/templates - Fetch saved column mapping templates
router.get("/templates", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const sql = `SELECT id, template_name, mapping_config, is_default, created_at FROM project_import_templates ORDER BY is_default DESC, created_at DESC`;
    const { rows } = await pool.query(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Fetch templates error:", err);
    return res.status(500).json({ message: "Failed to fetch mapping templates" });
  }
});

// POST /api/projects/templates - Save or update a mapping template
router.post("/templates", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { template_name, mapping_config, is_default } = req.body;
    if (!template_name || !mapping_config) {
      return res.status(400).json({ message: "Template name and mapping config are required" });
    }

    if (is_default) {
      await pool.query(`UPDATE project_import_templates SET is_default = FALSE`);
    }

    const sql = `
      INSERT INTO project_import_templates (template_name, mapping_config, is_default)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const { rows } = await pool.query(sql, [template_name, JSON.stringify(mapping_config), Boolean(is_default)]);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Save template error:", err);
    return res.status(500).json({ message: "Failed to save mapping template" });
  }
});

export default router;
