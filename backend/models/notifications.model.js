import pool from "../db.js";

export async function createResolutionNotification({
  module,
  itemId,
  itemCode,
  statusBefore,
  statusAfter,
  payload,
  bmUser,
}) {
  const sql = `
    INSERT INTO notifications (
      module,
      item_id,
      item_code,
      status_before,
      status_after,
      payload,
      bm_user
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *;
  `;

  const { rows } = await pool.query(sql, [
    module,
    itemId,
    itemCode || null,
    statusBefore || null,
    statusAfter || null,
    payload ? JSON.stringify(payload) : null,
    bmUser || null,
  ]);

  return rows[0];
}

export async function decideNotification({ id, adminUser, decision, comment }) {
  const notifSql = `
    UPDATE notifications
    SET admin_user = $2,
        decision   = $3,
        comment    = $4,
        decided_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await pool.query(notifSql, [
    id,
    adminUser || null,
    decision,
    comment || null,
  ]);

  const notif = rows[0];
  if (!notif) throw new Error("Notification not found");

  await pool.query(`
    UPDATE notifications
    SET decision = 'Auto-Closed', decided_at = NOW(), admin_user = $1
    WHERE module = $2
      AND item_id = $3
      AND decision IS NULL
      AND id != $4
  `, [adminUser || 'System', notif.module, notif.item_id, notif.id]);

  const FINAL_STATUS =
    decision === "Closed" ? "Approved & Closed" : "On Hold";

  const TABLE_MAP = {
    risk: "risks",
    issue: "issues",
    dependency: "dependencies",
    escalation: "escalations",
    action: "actions",
  };

  const table = TABLE_MAP[notif.module];
  if (table) {
    await pool.query(
      `UPDATE ${table} SET status = $1 WHERE id = $2`,
      [FINAL_STATUS, notif.item_id]
    );

    if (notif.bm_user) {
      const bmTable = `bm_${notif.module}_notifications`;
      const idCol = `${notif.module}_id`;
      await pool.query(
        `INSERT INTO ${bmTable} (${idCol}, bm_email, decision, comment, created_at, is_read)
         VALUES ($1,$2,$3,$4,NOW(),false)`,
        [notif.item_id, notif.bm_user, decision, comment]
      );
    }
  }

  return notif;
}

function baseAdminQuery(module, table, titleCol, extraSelect = "") {
  return `
    SELECT DISTINCT ON(n.item_id)
      n.*,
      t.${titleCol} AS title,
      p.name AS project_name,
      t.status,
      t.priority
      ${extraSelect}
    FROM notifications n
    JOIN ${table} t ON t.id = n.item_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE n.module = '${module}'
      AND n.decision IS NULL
    ORDER BY n.item_id, n.created_at DESC;
  `;
}

export async function listPendingRiskNotifications() {
  const { rows } = await pool.query(
    baseAdminQuery("risk", "risks", "risk_title")
  );
  return rows;
}

export async function listPendingIssueNotifications() {
  const { rows } = await pool.query(
    baseAdminQuery("issue", "issues", "issue_title")
  );
  return rows;
}

export async function listPendingDependencyNotifications() {
  const { rows } = await pool.query(
    baseAdminQuery("dependency", "dependencies", "dependency_title")
  );
  return rows;
}

export async function listPendingEscalationNotifications() {
  const { rows } = await pool.query(
    baseAdminQuery(
      "escalation",
      "escalations",
      "title",
      `, (SELECT json_agg(json_build_object('file_name', ed.file_name, 'file_path', ed.file_path)) FROM escalation_documents ed WHERE ed.escalation_id = t.id) as documents`
    )
  );
  return rows;
}

export async function listPendingActionNotifications() {
  const { rows } = await pool.query(
    baseAdminQuery("action", "actions", "action_title")
  );
  return rows;
}

async function countAdmin(module, table) {
  const { rows } = await pool.query(`
    SELECT COUNT(*) AS c
    FROM notifications n
    JOIN ${table} t ON t.id = n.item_id
    WHERE n.module = '${module}'
      AND n.decision IS NULL
    `);
  return Number(rows[0].c || 0);
}

export const countAdminPendingRiskNotifications = () =>
  countAdmin("risk", "risks");
export const countAdminPendingIssueNotifications = () =>
  countAdmin("issue", "issues");
export const countAdminPendingDependencyNotifications = () =>
  countAdmin("dependency", "dependencies");
export const countAdminPendingEscalationNotifications = () =>
  countAdmin("escalation", "escalations");
export const countAdminPendingActionNotifications = () =>
  countAdmin("action", "actions");

export async function listBmNotificationsByModule(email, module) {
  const sql = `
    SELECT n.*,
    (n.payload ->> 'manual_project_id') as manual_project_id,
    (n.payload ->> 'priority') as priority,
    (n.payload ->> 'risk_title') as risk_title,
    (n.payload ->> 'issue_title') as issue_title,
    (n.payload ->> 'dependency_title') as dependency_title,
    (n.payload ->> 'action_title') as action_title,
    (n.payload ->> 'title') as title
    FROM notifications n
    WHERE n.bm_user = $1 AND n.module = $2
    ORDER BY n.created_at DESC
    `;
  const { rows } = await pool.query(sql, [email, module]);
  return rows;
}

export async function listBmRiskNotifications(email) {
  const sql = `
    SELECT n.*,
    COALESCE(r.manual_project_id, n.payload ->> 'manual_project_id') as manual_project_id,
    r.priority,
    r.category,
    r.risk_title
    FROM notifications n
    LEFT JOIN risks r ON r.id = n.item_id
    WHERE n.bm_user = $1 AND n.module = 'risk'
    ORDER BY n.created_at DESC
    `;
  const { rows } = await pool.query(sql, [email]);
  return rows;
}

export async function listBmIssueNotifications(email) {
  return listBmNotificationsByModule(email, "issue");
}

export async function listBmDependencyNotifications(email) {
  return listBmNotificationsByModule(email, "dependency");
}

export async function listBmEscalationNotifications(email) {
  return listBmNotificationsByModule(email, "escalation");
}

export async function listBmActionNotifications(email) {
  return listBmNotificationsByModule(email, "action");
}

export async function countBmNotifications(email) {
  const sql = `
  SELECT
    (SELECT COUNT(*) FROM bm_risk_notifications WHERE bm_email = $1 AND is_read = false) +
    (SELECT COUNT(*) FROM bm_issue_notifications WHERE bm_email = $1 AND is_read = false) +
      (SELECT COUNT(*) FROM bm_dependency_notifications WHERE bm_email = $1 AND is_read = false) +
        (SELECT COUNT(*) FROM bm_escalation_notifications WHERE bm_email = $1 AND is_read = false) +
          (SELECT COUNT(*) FROM bm_action_notifications WHERE bm_email = $1 AND is_read = false)
    AS c
    `;
  const { rows } = await pool.query(sql, [email]);
  return Number(rows[0].c || 0);
}

async function createBmNotification(table, idCol, id, bmEmail, decision, comment) {
  await pool.query(
    `
    INSERT INTO ${table} (${idCol}, bm_email, decision, comment, created_at, is_read)
  VALUES($1, $2, $3, $4, NOW(), false)
    `,
    [id, bmEmail, decision, comment]
  );
}

export const createBmNotificationForRiskDecision = (p) =>
  createBmNotification(
    "bm_risk_notifications",
    "risk_id",
    p.riskId,
    p.bmEmail,
    p.decision,
    p.comment
  );

export const createBmNotificationForIssueDecision = (p) =>
  createBmNotification(
    "bm_issue_notifications",
    "issue_id",
    p.issueId,
    p.bmEmail,
    p.decision,
    p.comment
  );

export const createBmNotificationForDependencyDecision = (p) =>
  createBmNotification(
    "bm_dependency_notifications",
    "dependency_id",
    p.dependencyId,
    p.bmEmail,
    p.decision,
    p.comment
  );

export const createBmNotificationForEscalationDecision = (p) =>
  createBmNotification(
    "bm_escalation_notifications",
    "escalation_id",
    p.escalationId,
    p.bmEmail,
    p.decision,
    p.comment
  );

export const createBmNotificationForActionDecision = (p) =>
  createBmNotification(
    "bm_action_notifications",
    "action_id",
    p.actionId,
    p.bmEmail,
    p.decision,
    p.comment
  );
