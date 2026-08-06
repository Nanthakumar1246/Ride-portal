import pool from "../db.js";
import { sendGovernanceEventMail } from "../integrations/outlook/mail_service.js";

/**
 * Checks for governance items due for planned closure today and sends email notifications.
 */
export async function checkDueTodayItems() {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    console.log(`[ReminderScheduler] Running Due Today check for date: ${todayStr}`);

    const queries = [
      {
        module: "risk",
        sql: `SELECT risk_id AS record_id, account, manual_project_id, risk_description AS title, status, mitigation_owner, target_mitigation_date AS target_closure_date
              FROM risks
              WHERE target_mitigation_date::text LIKE $1
                AND status NOT IN ('Closed', 'Closed & Acknowledged', 'Approved & Closed', 'Resolved', 'Cancelled')`
      },
      {
        module: "issue",
        sql: `SELECT issue_id AS record_id, account, manual_project_id, issue_description AS title, status, COALESCE(assigned_to, reported_by) AS mitigation_owner, target_closure_date
              FROM issues
              WHERE target_closure_date::text LIKE $1
                AND status NOT IN ('Closed', 'Closed & Acknowledged', 'Approved & Closed', 'Resolved', 'Cancelled')`
      },
      {
        module: "dependency",
        sql: `SELECT dependency_id AS record_id, account, manual_project_id, dependency_title AS title, status, contact_person AS mitigation_owner, target_closure_date
              FROM dependencies
              WHERE target_closure_date::text LIKE $1
                AND status NOT IN ('Closed', 'Closed & Acknowledged', 'Approved & Closed', 'Resolved', 'Cancelled')`
      },
      {
        module: "escalation",
        sql: `SELECT escalation_id AS record_id, account, manual_project_id, title, status, escalated_to AS mitigation_owner, target_closure_date
              FROM escalations
              WHERE target_closure_date::text LIKE $1
                AND status NOT IN ('Closed', 'Closed & Acknowledged', 'Approved & Closed', 'Resolved', 'Cancelled')`
      },
      {
        module: "action",
        sql: `SELECT action_id AS record_id, action_title AS title, status, action_owner AS mitigation_owner, due_date AS target_closure_date
              FROM actions
              WHERE due_date::text LIKE $1
                AND status NOT IN ('Closed', 'Closed & Acknowledged', 'Approved & Closed', 'Resolved', 'Cancelled')`
      }
    ];

    for (const q of queries) {
      try {
        const { rows } = await pool.query(q.sql, [`${todayStr}%`]);
        for (const item of rows) {
          if (item.record_id) {
            await sendGovernanceEventMail({
              module: q.module,
              recordId: item.record_id,
              eventType: "DUE_TODAY",
              recordData: item
            });
          }
        }
      } catch (err) {
        // Log warning gracefully if column doesn't exist in specific schema variant
        console.warn(`[ReminderScheduler] Notice for ${q.module} due check:`, err.message);
      }
    }
  } catch (err) {
    console.error("[ReminderScheduler] Error in checkDueTodayItems:", err.message);
  }
}

/**
 * Checks for active governance items with no updates for more than 2 days.
 */
export async function checkInactivityReminders() {
  try {
    console.log("[ReminderScheduler] Running 2+ Days Inactivity check...");
    
    // 2 days ago cutoff
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const queries = [
      {
        module: "risk",
        sql: `SELECT risk_id AS record_id, account, manual_project_id, risk_description AS title, status, mitigation_owner, COALESCE(updated_at, created_at) AS last_updated
              FROM risks
              WHERE COALESCE(updated_at, created_at) < $1
                AND status NOT IN ('Closed', 'Closed & Acknowledged', 'Approved & Closed', 'Resolved', 'Cancelled')
              LIMIT 10`
      },
      {
        module: "issue",
        sql: `SELECT issue_id AS record_id, account, manual_project_id, issue_description AS title, status, COALESCE(assigned_to, reported_by) AS mitigation_owner, COALESCE(updated_at, created_at) AS last_updated
              FROM issues
              WHERE COALESCE(updated_at, created_at) < $1
                AND status NOT IN ('Closed', 'Closed & Acknowledged', 'Approved & Closed', 'Resolved', 'Cancelled')
              LIMIT 10`
      },
      {
        module: "dependency",
        sql: `SELECT dependency_id AS record_id, account, manual_project_id, dependency_title AS title, status, contact_person AS mitigation_owner, COALESCE(updated_at, created_at) AS last_updated
              FROM dependencies
              WHERE COALESCE(updated_at, created_at) < $1
                AND status NOT IN ('Closed', 'Closed & Acknowledged', 'Approved & Closed', 'Resolved', 'Cancelled')
              LIMIT 10`
      },
      {
        module: "escalation",
        sql: `SELECT escalation_id AS record_id, account, manual_project_id, title, status, escalated_to AS mitigation_owner, COALESCE(updated_at, created_at) AS last_updated
              FROM escalations
              WHERE COALESCE(updated_at, created_at) < $1
                AND status NOT IN ('Closed', 'Closed & Acknowledged', 'Approved & Closed', 'Resolved', 'Cancelled')
              LIMIT 10`
      },
      {
        module: "action",
        sql: `SELECT action_id AS record_id, action_title AS title, status, action_owner AS mitigation_owner, COALESCE(updated_at, created_at) AS last_updated
              FROM actions
              WHERE COALESCE(updated_at, created_at) < $1
                AND status NOT IN ('Closed', 'Closed & Acknowledged', 'Approved & Closed', 'Resolved', 'Cancelled')
              LIMIT 10`
      }
    ];

    for (const q of queries) {
      try {
        const { rows } = await pool.query(q.sql, [twoDaysAgo]);
        for (const item of rows) {
          if (item.record_id) {
            await sendGovernanceEventMail({
              module: q.module,
              recordId: item.record_id,
              eventType: "INACTIVITY_REMINDER",
              recordData: item
            });
          }
        }
      } catch (err) {
        console.warn(`[ReminderScheduler] Notice for ${q.module} inactivity check:`, err.message);
      }
    }
  } catch (err) {
    console.error("[ReminderScheduler] Error in checkInactivityReminders:", err.message);
  }
}

/**
 * Initializes the periodic reminder scheduler.
 * Disabled: Periodic background reminder and inactivity emails are disabled per user requirements.
 * Item registration and direct event-driven email notifications will continue to function normally.
 */
export function startReminderScheduler() {
  console.log("[ReminderScheduler] Automated background reminder emails are disabled per configuration.");
}
