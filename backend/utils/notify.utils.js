import { sendGovernanceEventMail, resolveRecipients } from "../integrations/outlook/mail_service.js";
import { createAppNotificationsForEmails } from "../models/appNotifications.model.js";

/**
 * Sends the governance email for an event AND creates matching in-app
 * notifications for the same resolved recipients (Mitigation Owner, Log
 * Owner, Project Manager, Headed By, Behalf Of).
 */
export async function notifyRecordEvent({
  module,
  recordId,
  eventType,
  recordData = {},
  currentUserEmail = null,
  title,
  message,
}) {
  const emailResult = await sendGovernanceEventMail({ module, recordId, eventType, recordData, currentUserEmail });

  try {
    const { to, cc } = await resolveRecipients(recordData);
    await createAppNotificationsForEmails([...to, ...cc], {
      module,
      recordId,
      eventType,
      title: title || `${(module || "Record").toUpperCase()} ${recordId}`,
      message,
    });
  } catch (err) {
    console.error("[Notify] Failed to create in-app notifications:", err.message);
  }

  return emailResult;
}
