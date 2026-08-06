import pool from "../db.js";

export async function globalSearch(req, res) {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json({ success: true, rows: [] });

    const pmName = req.user?.role === "PM" ? req.user.name : null;

    const params = [`%${q}%`];
    const searchIdx = 1;

    const pmClause = () => {
      if (!pmName) return "";
      params.push(pmName);
      return ` AND project_manager::text = $${params.length}::text`;
    };

    const searchCols = (cols) =>
      `(${cols.map((c) => `${c} ILIKE $${searchIdx}`).join(" OR ")})`;

    const unionSql = `
      SELECT 'Risk' as module, id, risk_id as item_id, manual_project_id as project_id, account,
        risk_description as description, risk_title as title, status, mitigation_owner as owner,
        identified_by as created_by, created_at
      FROM risks
      WHERE ${searchCols(["risk_title", "risk_description", "risk_id::text", "account", "manual_project_id", "project_description"])}${pmClause()}
      UNION ALL
      SELECT 'Issue', id, issue_id, manual_project_id, account,
        issue_description, issue_title, status, assigned_to,
        reported_by, created_at
      FROM issues
      WHERE ${searchCols(["issue_title", "issue_description", "issue_id::text", "account", "manual_project_id", "project_description"])}${pmClause()}
      UNION ALL
      SELECT 'Dependency', id, dependency_id, manual_project_id, account,
        description, dependency_title, status, contact_person,
        reported_by, created_at
      FROM dependencies
      WHERE ${searchCols(["dependency_title", "description", "dependency_id::text", "account", "manual_project_id", "project_description"])}${pmClause()}
      UNION ALL
      SELECT 'Escalation', id, escalation_id, manual_project_id, account,
        description, title, status, escalated_to,
        reported_by, created_at
      FROM escalations
      WHERE ${searchCols(["title", "description", "escalation_id::text", "account", "manual_project_id", "project_description"])}${pmClause()}
      UNION ALL
      SELECT 'Action', id, action_id, NULL::text, account,
        comments, action_title, status, action_owner,
        action_owner, created_at
      FROM actions
      WHERE ${searchCols(["action_title", "comments", "action_id::text", "action_owner", "account"])}${pmClause()}
      UNION ALL
      SELECT 'Appreciation', id, appreciation_id, manual_project_id, account,
        details, subject, NULL::text, recorded_by,
        recorded_by, created_at
      FROM appreciations
      WHERE ${searchCols(["subject", "details", "appreciation_id::text", "account", "manual_project_id", "project_description", "customer_name"])}${pmClause()}
    `;

    const { rows } = await pool.query(
      `SELECT * FROM (${unionSql}) t ORDER BY created_at DESC LIMIT 200`,
      params
    );

    return res.json({ success: true, rows });
  } catch (err) {
    console.error("Error running global search", err);
    return res.status(500).json({ success: false, message: "Search failed" });
  }
}
