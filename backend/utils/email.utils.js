import { sendGovernanceEventMail, getRecipientEmail, recordEmailAudit } from "../integrations/outlook/mail_service.js";

/**
 * Legacy wrapper for sending new item email notifications using Microsoft Graph API.
 */
export async function sendNewItemEmailNotification({
  module,
  itemCode,
  account,
  project,
  title,
  owner,
  priority,
  createdBy,
  targetEmail
}) {
  try {
    const result = await sendGovernanceEventMail({
      module: module || "Risk",
      recordId: itemCode,
      eventType: "NEW_RECORD",
      recordData: {
        account,
        manual_project_id: project,
        title,
        mitigation_owner: owner,
        priority,
        created_by: createdBy
      },
      currentUserEmail: createdBy,
      overrideRecipient: targetEmail
    });

    return result && result.success;
  } catch (err) {
    console.error(`[email.utils] Error sending notification for ${itemCode}:`, err.message);
    return false;
  }
}

export { sendGovernanceEventMail, getRecipientEmail, recordEmailAudit };
