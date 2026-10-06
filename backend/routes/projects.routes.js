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

    // No role-based narrowing: Account / Project / Project Manager are master
    // data, and every authenticated user picks from the full list when
    // creating a record.

    sql += ` ORDER BY COALESCE(manual_project_id, name) ASC LIMIT $${params.length + 1}`;
    params.push(Number(limit));

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("Project master lookup error:", err);
    return res.status(500).json({ message: "Failed to fetch projects" });
  }
});

// POST /api/projects/create - Create a single project
router.post("/create", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });

    const manual_project_id = String(req.body.manual_project_id || req.body.name || "").trim();
    const account = String(req.body.account || "").trim();
    const project_description = String(req.body.project_description || req.body.description || "").trim();
    const project_manager = String(req.body.project_manager || "").trim();
    const program_manager = String(req.body.program_manager || "").trim();
    const so_number = String(req.body.so_number || "").trim();
    const scope_description = String(req.body.scope_description || "").trim();
    const status = String(req.body.status || "Active").trim() || "Active";

    if (!manual_project_id || !account) {
      return res.status(400).json({ message: "Project ID and Account are required" });
    }

    const exists = await pool.query(
      `SELECT id FROM projects WHERE manual_project_id = $1 OR name = $1 LIMIT 1`,
      [manual_project_id]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "Project ID already exists" });
    }

    let rows;
    try {
      const result = await pool.query(
        `INSERT INTO projects (
          name, manual_project_id, account, project_description, description,
          project_manager, program_manager, so_number, scope_description, status, created_by
        ) VALUES ($1, $1, $2, $3, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, COALESCE(manual_project_id, name) as manual_project_id,
          COALESCE(manual_project_id, name) as name,
          COALESCE(project_description, description) as project_description,
          so_number, project_manager, program_manager, scope_description, account,
          COALESCE(status, 'Active') as status, created_at, updated_at`,
        [
          manual_project_id,
          account,
          project_description,
          project_manager,
          program_manager,
          so_number,
          scope_description,
          status,
          user.email || "System",
        ]
      );
      rows = result.rows;
    } catch (insertErr) {
      // Fallback if status column is missing in older DBs
      if (String(insertErr.message || "").toLowerCase().includes("status")) {
        const result = await pool.query(
          `INSERT INTO projects (
            name, manual_project_id, account, project_description, description,
            project_manager, program_manager, so_number, scope_description, created_by
          ) VALUES ($1, $1, $2, $3, $3, $4, $5, $6, $7, $8)
          RETURNING id, COALESCE(manual_project_id, name) as manual_project_id,
            COALESCE(manual_project_id, name) as name,
            COALESCE(project_description, description) as project_description,
            so_number, project_manager, program_manager, scope_description, account,
            created_at, updated_at`,
          [
            manual_project_id,
            account,
            project_description,
            project_manager,
            program_manager,
            so_number,
            scope_description,
            user.email || "System",
          ]
        );
        rows = result.rows.map((r) => ({ ...r, status: status || "Active" }));
      } else {
        throw insertErr;
      }
    }

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Create project error:", err);
    return res.status(500).json({ message: "Failed to create project: " + err.message });
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
    // No role-based narrowing: Account / Project / Project Manager are master
    // data, and every authenticated user picks from the full list when
    // creating a record.
    sql += ` ORDER BY account ASC`;
    const { rows } = await pool.query(sql, params);
    return res.json(rows.map((r) => r.account));
  } catch (err) {
    console.error("Error fetching accounts:", err);
    return res.status(500).json({ message: "Failed to fetch accounts" });
  }
});

// GET /api/projects/managers - List distinct PMs and Project Managers
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
    console.error("Error fetching Project Managers:", err);
    return res.status(500).json({ message: "Failed to fetch Project Managers" });
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
    // No role-based narrowing: Account / Project / Project Manager are master
    // data, and every authenticated user picks from the full list when
    // creating a record.
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

// PUT /api/projects/update - Update PM and Project Manager (Headed By) only
// Body: { id, project_manager, program_manager }
router.put("/update", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });

    const id = req.body.id || req.body.project_id;
    if (!id) return res.status(400).json({ message: "Project id is required" });

    const existing = await pool.query(
      `SELECT id, project_manager, program_manager FROM projects WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    const project_manager =
      req.body.project_manager !== undefined
        ? String(req.body.project_manager).trim()
        : existing.rows[0].project_manager || "";
    const program_manager =
      req.body.program_manager !== undefined
        ? String(req.body.program_manager).trim()
        : existing.rows[0].program_manager || "";

    try {
      const { rows } = await pool.query(
        `UPDATE projects
         SET project_manager = $1,
             program_manager = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, COALESCE(manual_project_id, name) as manual_project_id,
           COALESCE(manual_project_id, name) as name,
           COALESCE(project_description, description) as project_description,
           so_number, project_manager, program_manager, scope_description, account,
           COALESCE(status, 'Active') as status, created_at, updated_at`,
        [project_manager, program_manager, id]
      );
      return res.json(rows[0]);
    } catch (err) {
      console.error("Update project error:", err);
      const { rows } = await pool.query(
        `UPDATE projects
         SET project_manager = $1,
             program_manager = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, COALESCE(manual_project_id, name) as manual_project_id,
           COALESCE(manual_project_id, name) as name,
           COALESCE(project_description, description) as project_description,
           so_number, project_manager, program_manager, scope_description, account,
           created_at, updated_at`,
        [project_manager, program_manager, id]
      );
      if (!rows[0]) return res.status(404).json({ message: "Project not found" });
      return res.json({ ...rows[0], status: "Active" });
    }
  } catch (err) {
    console.error("Update project error:", err);
    return res.status(500).json({ message: "Failed to update project: " + err.message });
  }
});

// DELETE /api/projects/delete - Delete a single project
// Body: { id }
router.delete("/delete", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });

    const id = req.body.id || req.body.project_id || req.query.id;
    if (!id) return res.status(400).json({ message: "Project id is required" });

    const result = await pool.query(`DELETE FROM projects WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }
    return res.json({ message: "Project deleted", id: result.rows[0].id });
  } catch (err) {
    console.error("Delete project error:", err);
    return res.status(500).json({ message: "Failed to delete project" });
  }
});

export default router;
