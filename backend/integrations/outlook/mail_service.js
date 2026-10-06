import { sendMailViaGraph } from "./graph_client.js";
import pool from "../../db.js";
import { findUsersByNames } from "../../models/users.model.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const GOVERNANCE_TEAM_MAILBOX = process.env.MICROSOFT_SENDER_EMAIL || "rideplus@arche.global";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARCHE_LOGO_DATA_URI = (() => {
  try {
    const logoPath = path.join(__dirname, "../../assets/arche-logo.png");
    const buffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error("[MailService] Failed to load Arche logo for email template:", err.message);
    return null;
  }
})();

function isEmailLike(value) {
  return typeof value === "string" && value.includes("@");
}

/**
 * Resolves a mixed list of raw values (each either already an email address,
 * or a plain name that needs to be looked up against the users table) into
 * real email addresses. Names with no matching user account are skipped
 * (never guessed/fabricated).
 */
async function resolveToEmails(rawValues) {
  const cleaned = [...new Set((rawValues || []).map((v) => String(v || "").trim()).filter(Boolean))];
  if (cleaned.length === 0) return [];

  const directEmails = cleaned.filter(isEmailLike);
  const namesToResolve = cleaned.filter((v) => !isEmailLike(v));

  let resolvedFromNames = [];
  if (namesToResolve.length > 0) {
    try {
      const matchedUsers = await findUsersByNames(namesToResolve);
      resolvedFromNames = matchedUsers.map((u) => u.email).filter(Boolean);
    } catch (err) {
      console.error("[MailService] Recipient name resolution failed:", err.message);
    }
  }

  return [...new Set([...directEmails, ...resolvedFromNames])];
}

/**
 * Recipient Routing.
 * To: Mitigation Owner (falls back to the common mailbox if it can't be resolved,
 * so a notification is never silently dropped).
 * Cc: Log Owner, Project Manager (projects.project_manager), Headed By
 * (projects.program_manager), Behalf Of, and the Governance Team mailbox —
 * whichever of these resolve to a real address, minus anything already in To.
 */
export async function resolveRecipients(recordData = {}, overrideEmail = null) {
  if (overrideEmail) {
    return { to: [overrideEmail], cc: [] };
  }

  const logOwnerRaw = recordData.identified_by || recordData.reported_by || recordData.created_by || recordData.recorded_by;

  // Appreciations have no mitigation_owner — the recipients are whoever was
  // named in "Team Members Recognized" (a free-text, comma/semicolon
  // separated list of names and/or emails). The default common mailbox
  // (santhosh.b@arche.global) must never appear on an appreciation email,
  // whether as a fallback "to" or picked up incidentally via cc.
  if (recordData.team_members_recognized !== undefined && recordData.team_members_recognized !== null) {
    const defaultMailbox = (process.env.DEFAULT_COMMON_MAILBOX || "santhosh.b@arche.global").toLowerCase();
    const excludeDefault = (list) => (list || []).filter((email) => String(email).toLowerCase() !== defaultMailbox);

    const names = String(recordData.team_members_recognized)
      .split(/[,;]/)
      .map((n) => n.trim())
      .filter(Boolean);

    const [toEmailsRaw, ccEmailsRaw] = await Promise.all([
      resolveToEmails(names),
      resolveToEmails([recordData.recorded_by, recordData.project_manager, recordData.program_manager, recordData.behalf_of]),
    ]);

    const to = excludeDefault(toEmailsRaw);
    const ccEmails = excludeDefault(ccEmailsRaw);
    const cc = [...new Set([...ccEmails, GOVERNANCE_TEAM_MAILBOX])].filter(
      (email) => !to.includes(email) && email.toLowerCase() !== defaultMailbox
    );

    if (to.length > 0) {
      return { to, cc };
    }
    // No recognized team member resolved to a real address — fall through
    // to the governance mailbox only, never the default common mailbox.
    return { to: [GOVERNANCE_TEAM_MAILBOX], cc: ccEmails.filter((email) => email !== GOVERNANCE_TEAM_MAILBOX) };
  }

  const [toEmails, ccEmails] = await Promise.all([
    resolveToEmails([recordData.mitigation_owner]),
    resolveToEmails([logOwnerRaw, recordData.project_manager, recordData.program_manager, recordData.behalf_of]),
  ]);

  const to = toEmails.length > 0 ? toEmails : [process.env.DEFAULT_COMMON_MAILBOX || "santhosh.b@arche.global"];
  const cc = [...new Set([...ccEmails, GOVERNANCE_TEAM_MAILBOX])].filter((email) => !to.includes(email));

  return { to, cc };
}

/**
 * Legacy convenience wrapper — returns only the "to" list.
 */
export async function getRecipientEmail(recordData = {}, overrideEmail = null) {
  const { to } = await resolveRecipients(recordData, overrideEmail);
  return to.length === 1 ? to[0] : to;
}

/**
 * Inserts an email delivery record into the database audit trail table.
 */
export async function recordEmailAudit({
  module,
  recordId,
  eventType,
  recipient,
  sender,
  subject,
  status,
  errorMessage = null,
  internetMessageId = null
}) {
  try {
    const sql = `
      INSERT INTO email_audit_log (
        module,
        record_id,
        event_type,
        recipient,
        sender,
        subject,
        status,
        error_message,
        internet_message_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      module || "GOVERNANCE",
      recordId || "N/A",
      eventType || "NOTIFICATION",
      recipient,
      sender || process.env.MICROSOFT_SENDER_EMAIL || "rideplus@arche.global",
      subject,
      status,
      errorMessage,
      internetMessageId
    ];
    await pool.query(sql, values);
  } catch (err) {
    console.error("[MailService] Failed to log email audit record:", err.message);
  }
}

/**
 * Pulls the module-specific fields that vary in name (title, description,
 * planned closure date, etc.) into one consistent shape for the templates.
 */
function extractCommonFields(recordData = {}) {
  return {
    title:
      recordData.risk_title || recordData.issue_title || recordData.dependency_title ||
      recordData.title || recordData.action_item || recordData.subject || "N/A",
    description:
      recordData.risk_description || recordData.issue_description || recordData.description ||
      recordData.details || recordData.action_item || "N/A",
    impact: recordData.impact || recordData.impact_if_not_resolved || recordData.impact_on_project || "N/A",
    plannedClosureDate:
      recordData.target_mitigation_date || recordData.target_resolution_date ||
      recordData.required_by_date || recordData.target_date ||
      recordData.target_closure_date || recordData.planned_closure_date || recordData.due_date || null,
    projectId: recordData.manual_project_id || recordData.project_id || "N/A",
    projectName: recordData.project_name || recordData.project_description || "N/A",
    mitigationOwner:
      recordData.mitigation_owner || recordData.action_owner || recordData.contact_person ||
      recordData.escalated_to || "Unassigned",
    programManager: recordData.project_manager || "N/A",
    headedBy: recordData.program_manager || "N/A",
    behalfOf: recordData.behalf_of || "N/A",
    createdBy: recordData.identified_by || recordData.reported_by || recordData.created_by || recordData.recorded_by || "N/A",
    createdOn: recordData.created_at || recordData.identified_date || recordData.reported_date || recordData.received_date || null,
  };
}

function formatDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toDateString();
}

function mitigationOwnerName(recordData = {}) {
  if (recordData.team_members_recognized) {
    return String(recordData.team_members_recognized).split(/[,;]/)[0].trim() || "Team Member";
  }
  return recordData.mitigation_owner || "Team Member";
}

function pick(...values) {
  for (const v of values) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s !== "" && s.toLowerCase() !== "n/a") return s;
  }
  return undefined;
}

function projectField(recordData = {}) {
  return pick(recordData.project_description, recordData.manual_project_id, recordData.project_id);
}

/**
 * Curated per-module detail rows for governance emails — only the fields a
 * recipient actually needs to identify and act on the log, never every raw
 * form field. Empty/missing values are dropped by buildHtmlTemplate's filter.
 */
export function getCoreDetailsRows(module, recordId, recordData = {}) {
  const account = pick(recordData.account, recordData.account_name);
  const project = projectField(recordData);

  switch ((module || "").toLowerCase()) {
    case "risk":
      return [
        ["Risk ID", recordId],
        ["Customer / Account", account],
        ["Project", project],
        ["Priority", recordData.priority],
        ["Mitigation Owner", recordData.mitigation_owner],
        ["Target Mitigation Date", formatDate(recordData.target_mitigation_date)],
        ["Risk Title", recordData.risk_title],
        ["Risk Description", recordData.risk_description],
      ];
    case "issue":
      return [
        ["Issue ID", recordId],
        ["Customer / Account", account],
        ["Project", project],
        ["Priority", recordData.priority],
        ["Issue Owner", recordData.assigned_to],
        ["Target Resolution Date", formatDate(recordData.target_resolution_date)],
        ["Issue Title", recordData.issue_title],
      ];
    case "dependency":
      return [
        ["Dependency ID", recordId],
        ["Customer / Account", account],
        ["Project", project],
        ["Dependency Owner", recordData.contact_person],
        ["Target Resolution Date", formatDate(recordData.required_by_date)],
        ["Dependency Type", recordData.type],
        ["Dependency Summary", recordData.dependency_title],
      ];
    case "escalation":
      return [
        ["Escalation ID", recordId],
        ["Customer / Account", account],
        ["Project", project],
        ["Priority", recordData.priority],
        ["Escalated To", recordData.escalated_to],
        ["Target Resolution Date", formatDate(recordData.target_resolution_date)],
        ["Escalation Title", recordData.title],
      ];
    case "action":
      return [
        ["Action ID", recordId],
        ["Customer / Account", account],
        ["Project", project],
        ["Responsible Person", pick(recordData.responsible, recordData.action_owner)],
        ["Target Completion Date", formatDate(recordData.target_date || recordData.due_date)],
        ["Priority", recordData.priority],
        ["Action Item Title", pick(recordData.action_item, recordData.action_title)],
      ];
    case "appreciation":
      return [
        ["Appreciation ID", recordId],
        ["Customer / Account", account],
        ["Project", project],
        ["Appreciation Subject", recordData.subject],
        ["Team Members Recognized", recordData.team_members_recognized],
        ["Recorded By", recordData.recorded_by],
        ["Received Date", formatDate(recordData.received_date)],
      ];
    default:
      return [
        ["Log ID", recordId],
        ["Customer / Account", account],
        ["Project", project],
      ];
  }
}

/**
 * RIDE+ branded email template — clean white Outlook-compatible layout,
 * bold field labels, table-based details grid, Arche + RIDE+ letterhead.
 */
export function buildHtmlTemplate({ subject, greetingName, introLine, detailsRows = [], requiredAction }) {
  const rowsHtml = detailsRows
    .filter(([, value]) => {
      if (value === null || value === undefined) return false;
      const s = String(value).trim();
      return s !== "" && s.toLowerCase() !== "n/a";
    })
    .map(([label, value], idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
        <td style="padding: 10px 16px; color: #475569; font-weight: 600; width: 42%; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top;">${label}</td>
        <td style="padding: 10px 16px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top;">${value}</td>
      </tr>
    `).join("");

  const logoCell = ARCHE_LOGO_DATA_URI
    ? `<img src="${ARCHE_LOGO_DATA_URI}" alt="Arche Global" height="32" style="display:block; height:32px; width:auto;" />`
    : `<span style="font-size: 16px; font-weight: 800; color: #0f172a;">ARCHE GLOBAL</span>`;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject || "RIDE+ Governance Notification"}</title>
  </head>
  <body style="margin:0; padding:24px 12px; background-color:#f1f5f9; font-family: 'Segoe UI', Arial, sans-serif; color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">

      <!-- Letterhead -->
      <tr>
        <td style="padding: 24px 28px; border-bottom: 3px solid #4f46e5; background-color:#ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="vertical-align:middle;">
                ${logoCell}
              </td>
              <td style="vertical-align:middle; text-align:right;">
                <span style="font-size: 20px; font-weight: 800; color: #4f46e5; letter-spacing: 0.5px;">RIDE+</span>
                <div style="font-size: 11px; color: #64748b; font-weight: 600; letter-spacing: 0.4px; margin-top: 2px;">DELIVERY GOVERNANCE PORTAL</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding: 28px 28px 8px 28px;">
          <p style="font-size: 14px; margin: 0 0 14px 0;">Dear <strong>${greetingName}</strong>,</p>
          <p style="font-size: 14px; margin: 0 0 22px 0; line-height: 1.6;">${introLine}</p>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 22px;">
            ${rowsHtml}
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#eef2ff; border-left: 3px solid #4f46e5; border-radius: 4px; margin-bottom: 26px;">
            <tr>
              <td style="padding: 12px 16px;">
                <p style="font-size: 12px; font-weight: 700; color:#4f46e5; margin: 0 0 4px 0; text-transform:uppercase; letter-spacing:0.4px;">Required Action</p>
                <p style="font-size: 14px; margin: 0; line-height: 1.5; color:#1e293b;">${requiredAction}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding: 4px 28px 28px 28px;">
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 13px; line-height: 1.9; color:#334155;">
            <p style="margin:0;">Regards,</p>
            <p style="margin:0;">&nbsp;</p>
            <p style="margin:0; font-weight: 700; color:#0f172a;">Team RIDE+</p>
            <p style="margin:0;">&nbsp;</p>
            <p style="margin:0;">Delivery Governance Team</p>
            <p style="margin:0;">&nbsp;</p>
            <p style="margin:0;"><a href="mailto:${GOVERNANCE_TEAM_MAILBOX}" style="color:#4f46e5; text-decoration:none; font-weight:600;">${GOVERNANCE_TEAM_MAILBOX}</a></p>
          </div>
          <p style="font-size: 11px; color: #94a3b8; margin: 20px 0 0 0; line-height: 1.5;">
            This is an automated email generated by the RIDE+ Governance Portal. Please do not reply to this email.
          </p>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

/**
 * Dispatch governance email via Microsoft Graph API and record audit log.
 */
export async function sendGovernanceEventMail({
  module,
  recordId,
  eventType,
  recordData = {},
  currentUserEmail = null,
  overrideRecipient = null
}) {
  const { to, cc } = await resolveRecipients(recordData, overrideRecipient);
  const sender = process.env.MICROSOFT_SENDER_EMAIL || "rideplus@arche.global";
  const modUpper = (module || "Record").toUpperCase();
  const f = extractCommonFields(recordData);
  const greetingName = mitigationOwnerName(recordData);
  const coreRows = getCoreDetailsRows(module, recordId, recordData);

  let subject = "";
  let introLine = "";
  let detailsRows = coreRows;
  let requiredAction = "Please review the log in the RIDE+ Governance Portal and take the necessary action.";

  switch (eventType) {
    case "NEW_RECORD":
      subject = `New ${modUpper} Created – ${recordId}`;
      introLine = `A new <strong>${modUpper}</strong> has been created in the <strong>RIDE+ Governance Portal</strong> and has been assigned for your review and necessary action.`;
      requiredAction = "Please review the log and update the mitigation plan and progress through the RIDE+ Portal.";
      break;

    case "ON_BEHALF_CREATED":
      subject = `New ${modUpper} Created (On Behalf Of ${f.behalfOf}) – ${recordId}`;
      introLine = `A new <strong>${modUpper}</strong> has been created by <strong>${f.createdBy}</strong> in the <strong>RIDE+ Governance Portal</strong> on behalf of <strong>${f.behalfOf}</strong> and has been assigned for your review and necessary action.`;
      requiredAction = "Please review the log and update the mitigation plan and progress through the RIDE+ Portal.";
      break;

    case "STATUS_CHANGED": {
      const statusAfter = recordData.statusAfter || recordData.status || "Updated";
      subject = `Status Updated – ${recordId}`;
      introLine = `The status of the following log has been updated in the <strong>RIDE+ Portal</strong>.`;

      // "Created By" and "Mitigation Date" are shown alongside the usual
      // details. Modules whose core rows already carry a mitigation date
      // (Risks) are not given a duplicate row.
      const extraRows = [["Created By", f.createdBy]];
      const hasMitigationDate = coreRows.some(([label]) => /mitigation date/i.test(label));
      if (!hasMitigationDate) {
        extraRows.push(["Mitigation Date", formatDate(f.plannedClosureDate)]);
      }

      // Only the status the log has moved to — the previous one is not shown.
      detailsRows = [...coreRows, ...extraRows, ["Status Update", statusAfter]];
      requiredAction = "Please review the latest update and take further action if required.";
      break;
    }

    case "DUE_TODAY":
      subject = `TAT Reminder (Due Today) – ${recordId}`;
      introLine = `The planned closure date for the following log is <strong>today</strong>.`;
      requiredAction = "Kindly review the log and complete the required actions before the planned closure date to avoid delays.";
      break;

    case "DUE_TOMORROW":
      subject = `24-Hour Due Date Alert – ${recordId}`;
      introLine = `The planned closure date for the following log is in tomorrow.`;
      requiredAction = "Kindly review the log and complete the required actions before the planned closure date to avoid delays.";
      break;

    case "DUE_THIS_WEEK":
      subject = `7-Day Due Date Alert – ${recordId}`;
      introLine = `The planned closure date for the following log is in 7 days.`;
      requiredAction = "Kindly review the log and complete the required actions before the planned closure date to avoid delays.";
      break;

    case "INACTIVITY_REMINDER":
      subject = `${modUpper} ${recordId} Not Updated – No Progress for the Past 3 Days`;
      introLine = `The following log with ID <strong>${recordId}</strong> has not been noticed / updated for the past <strong>3 days</strong> and remains in <strong>${recordData.status || "the same"}</strong> status.`;
      requiredAction = "Please update the latest progress in the RIDE+ Governance Portal so the governance team can track the current status.";
      break;

    case "CLOSURE_DATE_CHANGE_APPROVED":
      subject = `Planned Closure Date Updated – ${recordId}`;
      introLine = `Your Planned Closure Date change request has been approved.`;
      detailsRows = [
        ["Log ID", recordId],
        ["Project", f.projectName],
        ["Original Planned Closure Date", formatDate(recordData.old_date)],
        ["Revised Planned Closure Date", formatDate(recordData.new_date)],
        ["Approved By", recordData.approved_by],
        ["Approved On", formatDate(recordData.approved_on || new Date())],
      ];
      requiredAction = "Please continue updating the log based on the revised planned closure date.";
      break;

    case "ACTION_ASSIGNED":
      subject = `New Action Assigned – ${recordId}`;
      introLine = `A new <strong>Action</strong> has been assigned to you in the <strong>RIDE+ Governance Portal</strong>.`;
      requiredAction = "Please review the action item and update its status through the RIDE+ Portal.";
      break;

    case "APPRECIATION_SUBMITTED": {
      const fromAccount = pick(recordData.account, recordData.account_name, recordData.project_description) || "your customer/account";
      subject = `Congratulations! New Appreciation Received – ${recordId}`;
      introLine = `Congratulations on receiving an appreciation from the <strong>${fromAccount}</strong> in recognition of your contribution. Please keep up the excellent work!`;
      if (f.behalfOf && f.behalfOf !== "N/A") {
        introLine += ` This appreciation was submitted by <strong>${f.createdBy}</strong> on behalf of <strong>${f.behalfOf}</strong>.`;
      }
      requiredAction = "No action required — this is a recognition notice.";
      break;
    }

    default:
      subject = `Governance Event Notification – ${recordId}`;
      introLine = `A governance activity has been recorded in the RIDE+ Governance Portal.`;
  }

  // Keep every email about the same record under one common subject prefix
  // so mail clients (and the In-Reply-To/References threading below) group
  // creation, status-update and reminder emails for a record into one trail.
  subject = `[${modUpper} ${recordId}] ${subject}`;

  const htmlContent = buildHtmlTemplate({
    subject,
    greetingName,
    introLine,
    detailsRows,
    requiredAction,
  });

  const recipientLog = `${to.join(", ")}${cc.length ? `; CC: ${cc.join(", ")}` : ""}`;

  // Find the most recent prior email sent for this exact record so this one
  // can be threaded into the same mail trail via In-Reply-To/References.
  let inReplyToMessageId = null;
  try {
    const { rows } = await pool.query(
      `SELECT internet_message_id FROM email_audit_log
       WHERE module = $1 AND record_id = $2 AND status = 'SENT' AND internet_message_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [modUpper, recordId]
    );
    inReplyToMessageId = rows[0]?.internet_message_id || null;
  } catch (lookupErr) {
    console.warn("[MailService] Could not look up prior message for threading:", lookupErr.message);
  }

  try {
    const result = await sendMailViaGraph({
      to,
      cc,
      subject,
      htmlContent,
      inReplyToMessageId
    });

    await recordEmailAudit({
      module: modUpper,
      recordId,
      eventType,
      recipient: recipientLog,
      sender,
      subject,
      status: "SENT",
      errorMessage: null,
      internetMessageId: result.internetMessageId || null
    });

    return result;
  } catch (err) {
    console.error(`[MailService] Error delivering mail for ${recordId}:`, err.message);

    await recordEmailAudit({
      module: modUpper,
      recordId,
      eventType,
      recipient: recipientLog,
      sender,
      subject,
      status: "FAILED",
      errorMessage: err.message
    });

    return { success: false, error: err.message };
  }
}
