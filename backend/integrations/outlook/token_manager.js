import dotenv from "dotenv";
dotenv.config();

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Fetches or returns a cached OAuth 2.0 access token for Microsoft Graph API
 * using Client Credentials Grant.
 */
export async function getAccessToken() {
  const now = Date.now();
  
  // Return cached token if valid (with 5 min safety buffer)
  if (cachedToken && tokenExpiresAt > now + 300000) {
    return cachedToken;
  }

  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("[TokenManager] Missing Microsoft Graph credentials in environment variables.");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: bodyParams.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[TokenManager] OAuth token request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error("[TokenManager] Access token missing in Microsoft OAuth response.");
    }

    cachedToken = data.access_token;
    // expires_in is in seconds, convert to absolute timestamp ms
    const expiresInMs = (data.expires_in || 3600) * 1000;
    tokenExpiresAt = Date.now() + expiresInMs;

    return cachedToken;
  } catch (err) {
    console.error("[TokenManager] Error acquiring Microsoft Graph token:", err.message);
    throw err;
  }
}
