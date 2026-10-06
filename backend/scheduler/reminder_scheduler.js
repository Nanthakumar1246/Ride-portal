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
 * Priority Notifications for Risk & Issue: sends a 7-day-out advance alert
 * and a 24-hour-out (due tomorrow) alert based on the planned closure date.
 */
export async function checkPriorityDueDateAlerts() {
  try {
    const sevenDaysStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tomorrowStr = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    console.log(`[ReminderScheduler] Running Risk/Issue Priority Due Date check (7-day: ${sevenDaysStr}, 24-hour: ${tomorrowStr})...`);

    const targets = [
      {
        dateStr: sevenDaysStr,
        eventType: "DUE_THIS_WEEK",
      },
      {
        dateStr: tomorrowStr,
        eventType: "DUE_TOMORROW",
      }
    ];

    const queries = [
      {
        module: "risk",
        sql: `SELECT risk_id AS record_id, account, manual_project_id, risk_description, risk_title, priority, status, mitigation_owner, target_mitigation_date AS target_closure_date
              FROM risks
              WHERE target_mitigation_date::text LIKE $1
                AND status NOT IN ('Closed', 'Closed & Acknowledged', 'Approved & Closed', 'Resolved', 'Cancelled')`
      },
      {
        module: "issue",
        sql: `SELECT issue_id AS record_id, account, manual_project_id, issue_description, issue_title, priority, status, COALESCE(assigned_to, reported_by) AS mitigation_owner, target_resolution_date AS target_closure_date
              FROM issues
              WHERE target_resolution_date::text LIKE $1
                AND status NOT IN ('Closed', 'Closed & Acknowledged', 'Approved & Closed', 'Resolved', 'Cancelled')`
      }
    ];

    for (const target of targets) {
      for (const q of queries) {
        try {
          const { rows } = await pool.query(q.sql, [`${target.dateStr}%`]);
          for (const item of rows) {
            if (!item.record_id) continue;

            const { rows: alreadySent } = await pool.query(
              `SELECT 1 FROM email_audit_log
               WHERE record_id = $1 AND event_type = $2
                 AND created_at::date = CURRENT_DATE
               LIMIT 1`,
              [item.record_id, target.eventType]
            );
            if (alreadySent.length > 0) continue;

            await sendGovernanceEventMail({
              module: q.module,
              recordId: item.record_id,
              eventType: target.eventType,
              recordData: item
            });
          }
        } catch (err) {
          console.warn(`[ReminderScheduler] Notice for ${q.module} priority due-date check (${target.eventType}):`, err.message);
        }
      }
    }
  } catch (err) {
    console.error("[ReminderScheduler] Error in checkPriorityDueDateAlerts:", err.message);
  }
}

/**
 * Checks for active governance items with no updates for 3 or more days
 * (i.e. still in the same Open/Hold status with no progress recorded).
 */
export async function checkInactivityReminders() {
  try {
    console.log("[ReminderScheduler] Running 3+ Days Inactivity check...");

    // 3 days ago cutoff
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

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
        const { rows } = await pool.query(q.sql, [threeDaysAgo]);
        for (const item of rows) {
          if (!item.record_id) continue;

          // Avoid sending more than one "not noticed" reminder per record per day.
          const { rows: alreadySent } = await pool.query(
            `SELECT 1 FROM email_audit_log
             WHERE record_id = $1 AND event_type = 'INACTIVITY_REMINDER'
               AND created_at::date = CURRENT_DATE
               AND status = 'SENT'
             LIMIT 1`,
            [item.record_id]
          );
          if (alreadySent.length > 0) continue;

          await sendGovernanceEventMail({
            module: q.module,
            recordId: item.record_id,
            eventType: "INACTIVITY_REMINDER",
            recordData: item
          });
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
 * Runs the Due Today and 3+ Days Inactivity checks once a day (every 24h),
 * with a short initial delay after server startup.
 */
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 60 * 1000;

export function startReminderScheduler() {
  console.log("[ReminderScheduler] Starting automated daily reminder checks (Due Today + 3-Day Inactivity).");

  setTimeout(() => {
    checkDueTodayItems();
    checkPriorityDueDateAlerts();
    checkInactivityReminders();

    setInterval(() => {
      checkDueTodayItems();
      checkPriorityDueDateAlerts();
      checkInactivityReminders();
    }, DAILY_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}
