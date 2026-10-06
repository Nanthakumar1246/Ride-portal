
import pool from "../db.js";
import { listMembersByManager } from "../models/managers.model.js";
import { buildPmCreatorAndClause, isPmRole } from "../utils/filters.utils.js";

const safeCount = async (sql, params = []) => {
  try {
    const res = await pool.query(sql, params);
    return Number(res.rows[0]?.count || 0);
  } catch (err) {
    console.error("safeCount error:", err.message);
    return 0;
  }
};

export async function getDashboardMetrics(req, res) {
  try {
    const currentYear = new Date().getFullYear();
    const selectedYear = parseInt(req.query.year) || currentYear;
    const riskYear = parseInt(req.query.risk_year) || selectedYear;
    const priorityParam = req.query.priority || null;
    const managerParam = req.query.manager || 'All';

    // 1. Resolve Manager Filter
    let managerMembers = [];
    if (managerParam !== 'All') {
        managerMembers = await listMembersByManager(managerParam);
    }

    // PM users are scoped to records they created / reported.
    const pmUser = isPmRole(req.user) ? req.user : null;

    const buildFilters = (baseTable) => {
      const filters = { where: " WHERE 1=1 ", params: [] };
      let i = 1;

      if (priorityParam) {
        filters.where += ` AND priority::text = $${i++}::text `;
        filters.params.push(priorityParam);
      }

      if (pmUser) {
        // buildPmCreatorAndClause pushes into params and returns " AND (...)"
        const clause = buildPmCreatorAndClause(baseTable, pmUser, filters.params);
        filters.where += clause;
        i = filters.params.length + 1;
      }

      const fieldMap = { risks: 'identified_by', issues: 'reported_by', actions: 'created_by', dependencies: 'reported_by', escalations: 'reported_by' };
      const ownerCol = fieldMap[baseTable] || 'reported_by';

      if (!pmUser && managerParam && managerParam !== 'All') {
        const clauses = [];
        // Primary: Headed By (program_manager) matches selected manager
        clauses.push(`program_manager::text ILIKE $${i++}`);
        filters.params.push(managerParam);

        if (managerMembers && managerMembers.length > 0) {
          managerMembers.forEach(m => {
            clauses.push(`project_manager::text = $${i++}`);
            filters.params.push(m);
            clauses.push(`${ownerCol}::text = $${i++}`);
            filters.params.push(m);
            clauses.push(`${ownerCol}::text = $${i++}`);
            filters.params.push(`${managerParam} - ${m}`);
          });
        }
        clauses.push(`${ownerCol}::text = $${i++}`);
        filters.params.push(managerParam);
        clauses.push(`${ownerCol}::text ILIKE $${i++}`);
        filters.params.push(`${managerParam}%`);

        filters.where += ` AND (${clauses.join(' OR ')}) `;
      }
      return filters;
    };

    // Helper for Union
    const getUnionData = (tables) => {
       const parts = [];
       const allParams = [];
       let offset = 0;
       tables.forEach(t => {
          const f = buildFilters(t);
          let wh = f.where;
          f.params.forEach((p, idx) => {
             wh = wh.replace(new RegExp(`\\$${idx+1}(?![0-9])`, 'g'), `$${idx+1+offset}`);
          });
          parts.push(`SELECT id, status, priority, updated_at, created_at FROM ${t} ${wh}`);
          allParams.push(...f.params);
          offset += f.params.length;
       });
       return { sql: parts.join(" UNION ALL "), params: allParams };
    };

    const g = getUnionData(['risks', 'issues', 'actions', 'dependencies', 'escalations']);
    const commonQ = `SELECT COUNT(*) FROM (${g.sql}) t`;

    const [total_open, total_on_hold, resolved, approved, cancelled, total_items] = await Promise.all([
      safeCount(`${commonQ} WHERE status ILIKE '%open%' OR status ILIKE '%progress%' OR status ILIKE '%submitted%'`, g.params),
      safeCount(`${commonQ} WHERE status ILIKE '%hold%'`, g.params),
      safeCount(`${commonQ} WHERE status ILIKE '%resolved%' OR status ILIKE '%closed%' OR status ILIKE '%acknowledged%' OR status ILIKE '%approved%'`, g.params),
      safeCount(`${commonQ} WHERE status ILIKE '%approved%'`, g.params),
      safeCount(`${commonQ} WHERE status ILIKE '%cancel%'`, g.params),
      safeCount(commonQ, g.params)
    ]);

    // Priority Data
    const priority_split = (await pool.query(`SELECT priority, COUNT(*)::INT as count FROM (${g.sql}) t WHERE priority IS NOT NULL GROUP BY 1`, g.params)).rows;
    
    const priority_by_module = {};
    for (const t of ['risks', 'issues', 'actions', 'dependencies', 'escalations']) {
       const f = buildFilters(t);
       const res = await pool.query(`SELECT priority::text, COUNT(*)::INT as count FROM ${t} ${f.where} AND priority IS NOT NULL GROUP BY 1`, f.params);
       const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
       res.rows.forEach(r => { if (counts.hasOwnProperty(r.priority)) counts[r.priority] = r.count; });
       const nameMap = { risks: 'Risk', issues: 'Issue', dependencies: 'Dependency', actions: 'Action', escalations: 'Escalation' };
       priority_by_module[nameMap[t] || t] = counts;
    }

    // Trends
    const getTrend = async (dateField, tableFilterSql = "", tableParams = []) => {
       const trendParams = [...tableParams];
       const yearIdx = trendParams.push(selectedYear);
       try {
         const res = await pool.query(`
            SELECT EXTRACT(MONTH FROM ${dateField})::INT as m, COUNT(*)::INT as c
            FROM (${tableFilterSql}) t
            WHERE EXTRACT(YEAR FROM ${dateField})::int = $${yearIdx}::int
            GROUP BY 1 ORDER BY 1
         `, trendParams);
         const trend = Array(12).fill(0).map((_, i) => ({ value: 0 }));
         res.rows.forEach(r => { if (trend[r.m-1]) trend[r.m-1].value = r.c; });
         return trend;
       } catch (e) { return Array(12).fill({ value: 0 }); }
    };

    const trend_created = await getTrend('created_at', g.sql, g.params);
    const trend_closed = await getTrend('updated_at', `SELECT * FROM (${g.sql}) g2 WHERE status IN ('Resolved', 'Approved & Closed', 'Cancelled')`, g.params);
    
    const escF = buildFilters('escalations');
    const trend_escalations = await getTrend('created_at', `SELECT created_at FROM escalations ${escF.where}`, escF.params);

    // Monthly Risks (Engagement Trend)
    const monthlyF = buildFilters('risks');
    const ryIdx = monthlyF.params.push(riskYear);
    const monthly_risk_trend_res = await pool.query(`
       SELECT TO_CHAR(created_at, 'Mon') as month_label, COUNT(*)::INT as c FROM risks ${monthlyF.where} AND EXTRACT(YEAR FROM created_at)::int = $${ryIdx}::int GROUP BY 1, EXTRACT(MONTH FROM created_at) ORDER BY EXTRACT(MONTH FROM created_at)
    `, monthlyF.params);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthly_risk_trend = months.map(m => ({
       month: m, count: monthly_risk_trend_res.rows.find(r => r.month_label === m)?.c || 0
    }));

    // Feeds
    const latest_risks = (await pool.query(`SELECT risk_id, risk_title, priority, status, account, identified_date, updated_at FROM risks ${buildFilters('risks').where} ORDER BY updated_at DESC LIMIT 10`, buildFilters('risks').params)).rows;
    const latest_issues = (await pool.query(`SELECT issue_id, issue_title, priority, status, account, reported_date as identified_date, updated_at FROM issues ${buildFilters('issues').where} ORDER BY updated_at DESC LIMIT 10`, buildFilters('issues').params)).rows;
    const latest_actions = (await pool.query(`SELECT action_id, action_title, priority, status, updated_at FROM actions ${buildFilters('actions').where} ORDER BY updated_at DESC LIMIT 10`, buildFilters('actions').params)).rows;
    const latest_dependencies = (await pool.query(`SELECT dependency_id, dependency_title, priority, status, updated_at FROM dependencies ${buildFilters('dependencies').where} ORDER BY updated_at DESC LIMIT 10`, buildFilters('dependencies').params)).rows;

    // Status Table
    const module_status = [];
    for (const t of ['risks', 'issues', 'dependencies', 'actions', 'escalations']) {
      const f = buildFilters(t);
      const res = await pool.query(`
        SELECT 
           SUM(CASE WHEN status ILIKE '%open%' OR status = 'Open' THEN 1 ELSE 0 END)::INT as o, 
           SUM(CASE WHEN status ILIKE '%submitted%' OR status ILIKE '%closure%' THEN 1 ELSE 0 END)::INT as cs,
           SUM(CASE WHEN status ILIKE '%closed%' OR status ILIKE '%resolved%' OR status ILIKE '%approved%' OR status ILIKE '%acknowledged%' THEN 1 ELSE 0 END)::INT as ca,
           SUM(CASE WHEN status ILIKE '%hold%' THEN 1 ELSE 0 END)::INT as h
        FROM ${t} ${f.where}`, f.params);
      const o = res.rows[0].o || 0;
      const cs = res.rows[0].cs || 0;
      const ca = res.rows[0].ca || 0;
      const h = res.rows[0].h || 0;
      module_status.push({ 
        module: { risks: 'Risk', issues: 'Issue', dependencies: 'Dependency', actions: 'Action', escalations: 'Escalation' }[t], 
        Open: o, 
        ClosureSubmitted: cs,
        ClosedAcknowledged: ca,
        Hold: h,
        Resolved: ca,
        total: o + cs + ca + h
      });
    }

    // Actions by Responsible
    const actF = buildFilters('actions');
    const actRespCountsRes = await pool.query(`
      SELECT action_owner as responsible, COUNT(*)::INT as count 
      FROM actions 
      ${actF.where} AND action_owner IS NOT NULL AND TRIM(action_owner) != '' 
      GROUP BY 1 
      ORDER BY count DESC 
      LIMIT 7
    `, actF.params);
    const action_responsible_counts = actRespCountsRes.rows;

    // Get the details for these top responsible people
    const topRespNames = action_responsible_counts.map(r => r.responsible);
    let action_responsible_details = [];
    if (topRespNames.length > 0) {
      const actDetailsFParams = [...actF.params];
      const namePlaceholders = topRespNames.map((_, i) => `$${actDetailsFParams.length + i + 1}`);
      actDetailsFParams.push(...topRespNames);
      
      const sql = `
        SELECT action_owner as responsible, action_id, action_title, status, priority, due_date 
        FROM actions 
        ${actF.where} AND action_owner IN (${namePlaceholders.join(', ')})
      `;
      const actDetailsRes = await pool.query(sql, actDetailsFParams);
      action_responsible_details = actDetailsRes.rows.map(r => ({ ...r, target_date: r.due_date }));
    }

    return res.json({
      success: true,
      total_open, total_on_hold, resolved, approved, cancelled, total_items,
      priority_split, priority_by_module, monthly_risk_trend,
      trend_created, trend_closed, trend_escalations,
      latest_risks, latest_issues, latest_actions, latest_dependencies,
      module_status, available_years: [2026, 2025, 2024],
      action_completion_percent: Math.round((resolved + approved + cancelled) / (total_items || 1) * 100),
      action_responsible_counts,
      action_responsible_details
    });

  } catch (err) {
    console.error('DASHBOARD ERROR:', err);
    return res.status(500).json({ error: 'failed' });
  }
}
