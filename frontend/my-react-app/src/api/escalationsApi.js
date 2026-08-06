
import { BASE_URL, authHeaders, handleResponse } from "./http";
function sanitizeStatus(payload = {}) {
  if (!payload.status) return payload;

  const s = String(payload.status).toLowerCase();

  if (s === "completed" || s === "closed") {
    return { ...payload, status: "Resolved" };
  }

  return payload;
}

export async function fetchEscalations(params = {}) {
  const search = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/escalations${search ? `?${search}` : ""}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function fetchEscalationApi(id) {
  const res = await fetch(`${BASE_URL}/escalations/${id}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function createEscalationApi(payload) {
  const res = await fetch(`${BASE_URL}/escalations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(sanitizeStatus(payload)),

  });
  return handleResponse(res);
}

export async function updateEscalationApi(id, payload) {
  const res = await fetch(`${BASE_URL}/escalations/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(sanitizeStatus(payload)),

  });
  return handleResponse(res);
}


export async function decideEscalationNotification(notificationId, decision, comment) {
  const res = await fetch(
    `${BASE_URL}/escalations/decisions/${notificationId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ decision, comment }),
    }
  );
  return handleResponse(res);
}

export async function resolveEscalationApi(id, formData) {
  
  const { Authorization } = authHeaders();
  const res = await fetch(`${BASE_URL}/escalations/${id}/resolve`, {
    method: "POST",
    headers: {
      Authorization
    },
    body: formData
  });
  return handleResponse(res);
}

export async function deleteEscalationsApi(payload) {
  const res = await fetch(`${BASE_URL}/escalations/delete-multiple`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

