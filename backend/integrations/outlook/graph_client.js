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
export async function sendMailViaGraph({ to, cc = [], subject, htmlContent, attachments = [] }) {
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

  const payload = {
    message: {
      subject: subject,
      body: {
        contentType: "HTML",
        content: htmlContent
      },
      toRecipients: formattedRecipients,
      ...(formattedCc.length > 0 ? { ccRecipients: formattedCc } : {})
    },
    saveToSentItems: "true"
  };

  if (attachments && attachments.length > 0) {
    payload.message.attachments = attachments.map(att => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.name,
      contentType: att.contentType || "application/octet-stream",
      contentBytes: att.contentBytes // Base64 encoded string
    }));
  }

  const endpointUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`;

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  // Microsoft Graph sendMail returns 202 Accepted on success with empty body
  if (response.status === 202 || response.status === 200) {
    console.log(`[GraphClient] Email successfully dispatched to ${recipientList.join(", ")}${ccList.length ? ` (cc: ${ccList.join(", ")})` : ""} via ${senderEmail}`);
    return {
      success: true,
      status: response.status,
      sender: senderEmail,
      recipients: recipientList,
      cc: ccList
    };
  } else {
    const errorText = await response.text();
    console.error(`[GraphClient] Graph sendMail API returned status ${response.status}: ${errorText}`);
    throw new Error(`Microsoft Graph API sendMail Error (${response.status}): ${errorText}`);
  }
}
