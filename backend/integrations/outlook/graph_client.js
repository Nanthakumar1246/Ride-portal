import { getAccessToken } from "./token_manager.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Sends an email via Microsoft Graph API sendMail endpoint.
 * 
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string|string[]} [options.cc] - Cc email address(es)
 * @param {string} options.subject - Email subject line
 * @param {string} options.htmlContent - HTML body content
 * @param {Array} [options.attachments] - Optional attachments array
 * @returns {Promise<Object>} Response metadata { success, status, messageId }
 */
export async function sendMailViaGraph({ to, cc = [], subject, htmlContent, attachments = [], inReplyToMessageId = null }) {
  const senderEmail = process.env.MICROSOFT_SENDER_EMAIL || "rideplus@arche.global";
  const token = await getAccessToken();

  const recipientList = Array.isArray(to) ? to : [to];
  const formattedRecipients = recipientList.map(email => ({
    emailAddress: {
      address: email.trim()
    }
  }));

  const ccList = Array.isArray(cc) ? cc : [cc];
  const formattedCc = ccList.filter(Boolean).map(email => ({
    emailAddress: {
      address: email.trim()
    }
  }));

  const message = {
    subject: subject,
    body: {
      contentType: "HTML",
      content: htmlContent
    },
    toRecipients: formattedRecipients,
    ...(formattedCc.length > 0 ? { ccRecipients: formattedCc } : {})
  };

  if (attachments && attachments.length > 0) {
    message.attachments = attachments.map(att => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.name,
      contentType: att.contentType || "application/octet-stream",
      contentBytes: att.contentBytes // Base64 encoded string
    }));
  }

  // Thread this email into the same conversation/mail-trail as a prior message
  // for the same record (e.g. a status update following the creation email),
  // by referencing its Internet Message-ID in standard reply headers.
  if (inReplyToMessageId) {
    message.internetMessageHeaders = [
      { name: "In-Reply-To", value: inReplyToMessageId },
      { name: "References", value: inReplyToMessageId }
    ];
  }

  const base = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}`;
  const authHeaders = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  // Threaded sends go through the create-draft -> send flow so we can capture
  // the message's Internet Message-ID for the *next* email in the trail.
  // Non-threaded sends keep using the simpler one-shot /sendMail endpoint.
  if (inReplyToMessageId) {
    const createResponse = await fetch(`${base}/messages`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(message)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`[GraphClient] Graph create-message API returned status ${createResponse.status}: ${errorText}`);
      throw new Error(`Microsoft Graph API create-message Error (${createResponse.status}): ${errorText}`);
    }

    const created = await createResponse.json();

    const sendResponse = await fetch(`${base}/messages/${created.id}/send`, {
      method: "POST",
      headers: authHeaders
    });

    if (sendResponse.status !== 202 && sendResponse.status !== 200) {
      const errorText = await sendResponse.text();
      console.error(`[GraphClient] Graph send-message API returned status ${sendResponse.status}: ${errorText}`);
      throw new Error(`Microsoft Graph API send-message Error (${sendResponse.status}): ${errorText}`);
    }

    console.log(`[GraphClient] Threaded email successfully dispatched to ${recipientList.join(", ")}${ccList.length ? ` (cc: ${ccList.join(", ")})` : ""} via ${senderEmail}`);
    return {
      success: true,
      status: sendResponse.status,
      sender: senderEmail,
      recipients: recipientList,
      cc: ccList,
      internetMessageId: created.internetMessageId || null
    };
  }

  const payload = { message, saveToSentItems: "true" };

  const response = await fetch(`${base}/sendMail`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(payload)
  });

  // Microsoft Graph sendMail returns 202 Accepted on success with empty body
  if (response.status === 202 || response.status === 200) {
    console.log(`[GraphClient] Email successfully dispatched to ${recipientList.join(", ")}${ccList.length ? ` (cc: ${ccList.join(", ")})` : ""} via ${senderEmail}`);

    // /sendMail doesn't return the created message, so look up the message we
    // just sent (by subject, most recent in Sent Items) to capture its
    // Internet Message-ID for threading future emails on this record.
    let internetMessageId = null;
    try {
      const lookupUrl = `${base}/mailFolders/sentitems/messages?$filter=${encodeURIComponent(`subject eq '${subject.replace(/'/g, "''")}'`)}&$orderby=sentDateTime desc&$top=1&$select=internetMessageId`;
      const lookupResponse = await fetch(lookupUrl, { headers: authHeaders });
      if (lookupResponse.ok) {
        const lookupData = await lookupResponse.json();
        internetMessageId = lookupData?.value?.[0]?.internetMessageId || null;
      }
    } catch (lookupErr) {
      console.warn("[GraphClient] Could not look up sent message id for threading:", lookupErr.message);
    }

    return {
      success: true,
      status: response.status,
      sender: senderEmail,
      recipients: recipientList,
      cc: ccList,
      internetMessageId
    };
  } else {
    const errorText = await response.text();
    console.error(`[GraphClient] Graph sendMail API returned status ${response.status}: ${errorText}`);
    throw new Error(`Microsoft Graph API sendMail Error (${response.status}): ${errorText}`);
  }
}
