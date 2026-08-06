
import pool from "../db.js";

export async function getSummaryMetrics(req, res) {
  try {
    
    const statusSql = `
      SELECT status, COUNT(*) AS c
      FROM (
        SELECT status FROM risks
        UNION ALL
        SELECT status FROM issues
        UNION ALL
        SELECT status FROM dependencies
        UNION ALL
        SELECT status FROM escalations
        UNION ALL
        SELECT status FROM actions
      ) s
      GROUP BY status;
    `;
    const { rows: statusRows } = await pool.query(statusSql);
    const totalOpen =
      Number(statusRows.find((r) => r.status === "Open")?.c || 0);
    const totalInProgress =
      Number(statusRows.find((r) => r.status === "In Progress")?.c || 0);
    const totalClosed =
      Number(statusRows.find((r) => r.status === "Closed")?.c || 0);
    const totalItems = statusRows.reduce(
      (sum, r) => sum + Number(r.c || 0),
      0
    );

    const kpis = {
      totalOpen,
      totalInProgress,
      totalClosed,
      totalItems,
    };

    
    const byModuleSql = `
      SELECT 'Risk' as module, status, COUNT(*)::int AS count FROM risks GROUP BY status
      UNION ALL
      SELECT 'Issue' as module, status, COUNT(*)::int AS count FROM issues GROUP BY status
      UNION ALL
      SELECT 'Dependency' as module, status, COUNT(*)::int AS count FROM dependencies GROUP BY status
      UNION ALL
      SELECT 'Escalation' as module, status, COUNT(*)::int AS count FROM escalations GROUP BY status
      UNION ALL
      SELECT 'Action' as module, status, COUNT(*)::int AS count FROM actions GROUP BY status;
    `;
    const { rows: byModuleRows } = await pool.query(byModuleSql);

    
    const agingSql = `
      SELECT bucket, COUNT(*)::int AS count
      FROM (
        SELECT
          CASE
            WHEN age(now(), created_at) <= interval '7 days' THEN '0-7'
            WHEN age(now(), created_at) <= interval '30 days' THEN '8-30'
            ELSE '31+'
          END AS bucket
        FROM (
          SELECT created_at FROM risks
          UNION ALL
          SELECT created_at FROM issues
          UNION ALL
          SELECT created_at FROM dependencies
          UNION ALL
          SELECT created_at FROM escalations
          UNION ALL
          SELECT created_at FROM actions
        ) all_items
      ) x
      GROUP BY bucket;
    `;
    const { rows: agingRows } = await pool.query(agingSql);

    return res.json({
      success: true,
      data: {
        kpis,
        byModule: byModuleRows,
        aging: agingRows,
      },
    });
  } catch (err) {
    console.error("Error loading summary metrics", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load metrics" });
  }
}



export async function getNearingTat(req, res) {
  try {
    const limit = Math.max(1, parseInt(req.query.limit) || 5);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const offset = req.query.offset !== undefined ? Math.max(0, parseInt(req.query.offset) || 0) : (page - 1) * limit;

    const pmName = req.user?.role === "PM" ? req.user.name : null;
    const params = [];
    const pmClause = () => {
      if (!pmName) return "";
      params.push(pmName);
      return ` AND project_manager::text = $${params.length}::text`;
    };

    const unionSql = `
      SELECT 'Risk' as module, id, risk_id as item_id, risk_title as title, account,
        manual_project_id, priority, status, mitigation_owner as owner,
        target_mitigation_date as due_date, updated_at
      FROM risks WHERE status NOT IN ('Resolved', 'Cancelled', 'Approved & Closed')${pmClause()}
      UNION ALL
      SELECT 'Issue', id, issue_id, issue_title, account,
        manual_project_id, priority, status, assigned_to,
        target_resolution_date, updated_at
      FROM issues WHERE status NOT IN ('Resolved', 'Cancelled', 'Approved & Closed')${pmClause()}
      UNION ALL
      SELECT 'Dependency', id, dependency_id, dependency_title, account,
        manual_project_id, priority, status, contact_person,
        required_by_date, updated_at
      FROM dependencies WHERE status NOT IN ('Resolved', 'Cancelled', 'Approved & Closed')${pmClause()}
      UNION ALL
      SELECT 'Escalation', id, escalation_id, title, account,
        manual_project_id, priority, status, escalated_to,
        target_resolution_date, updated_at
      FROM escalations WHERE status NOT IN ('Resolved', 'Cancelled', 'Approved & Closed')${pmClause()}
      UNION ALL
      SELECT 'Action', id, action_id, action_title, NULL::text as account,
        NULL::text as manual_project_id, priority, status, action_owner,
        due_date, updated_at
      FROM actions WHERE status NOT IN ('Resolved', 'Cancelled', 'Approved & Closed')${pmClause()}
    `;

    const countRes = await pool.query(`SELECT COUNT(*) AS c FROM (${unionSql}) t`, params);
    const total = Number(countRes.rows[0]?.c || 0);

    const dataParams = [...params, limit, offset];
    const dataRes = await pool.query(
      `SELECT * FROM (${unionSql}) t ORDER BY due_date ASC NULLS LAST LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    return res.json({
      success: true,
      rows: dataRes.rows,
      limit,
      offset,
      currentPage: Math.floor(offset / limit) + 1,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      total,
    });
  } catch (err) {
    console.error("Error loading nearing-TAT logs", err);
    return res.status(500).json({ success: false, message: "Failed to load nearing-TAT logs" });
  }
}

export async function getPrioritySplit(req, res) {
  try {
    const { module } = req.query;
    const cleanModule = (module || "all").toLowerCase();
    const pmName = req.user?.role === "PM" ? req.user.name : null;
    const params = pmName ? [pmName] : [];

    let sql = "";

    if (cleanModule === "all") {
      const pmFilter = pmName ? "WHERE project_manager = $1" : "";
      sql = `
          SELECT priority, COUNT(*)::int as count
          FROM (
            SELECT priority, project_manager FROM risks
            UNION ALL
            SELECT priority, project_manager FROM issues
            UNION ALL
            SELECT priority, project_manager FROM dependencies
            UNION ALL
            SELECT priority, project_manager FROM escalations
            UNION ALL
            SELECT priority, project_manager FROM actions
          ) all_items
          ${pmFilter}
          GROUP BY priority
        `;
    } else {
      let table = "";
      switch (cleanModule) {
        case "risk": table = "risks"; break;
        case "issue": table = "issues"; break;
        case "dependency": table = "dependencies"; break;
        case "escalation": table = "escalations"; break;
        case "action": table = "actions"; break;
        default: return res.status(400).json({ success: false, message: "Invalid module" });
      }

      const pmFilter = pmName ? "WHERE project_manager = $1" : "";
      sql = `
          SELECT priority, COUNT(*)::int as count
          FROM ${table}
          ${pmFilter}
          GROUP BY priority
        `;
    }

    const { rows } = await pool.query(sql, params);

    
    const result = rows.map(r => ({
      priority: r.priority || "Unassigned",
      count: Number(r.count)
    }));

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load priority split" });
  }
}
