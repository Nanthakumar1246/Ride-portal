
import { BASE_URL, authHeaders, handleResponse } from "./http";
function sanitizeStatus(payload = {}) {
  if (!payload.status) return payload;

  const s = String(payload.status).toLowerCase();

  if (s === "completed" || s === "closed") {
    return { ...payload, status: "Resolved" };
  }

  return payload;
}
export async function fetchActions(params = {}) {
  const search = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/actions${search ? `?${search}` : ""}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function fetchActionApi(id) {
  const res = await fetch(`${BASE_URL}/actions/${id}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function createActionApi(payload) {
  const res = await fetch(`${BASE_URL}/actions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(sanitizeStatus(payload)),

  });
  return handleResponse(res);
}

export async function updateActionApi(id, payload) {
  const res = await fetch(`${BASE_URL}/actions/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(sanitizeStatus(payload)),

  });
  return handleResponse(res);
}


export async function decideActionNotification(notificationId, decision, comment) {
  const res = await fetch(`${BASE_URL}/actions/decisions/${notificationId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ decision, comment }),
  });
  return handleResponse(res);
}

export async function deleteActionsApi(payload) {
  const res = await fetch(`${BASE_URL}/actions/delete-multiple`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function bulkUploadActionsApi(actions) {
  const payload = actions.map(sanitizeStatus);
  const res = await fetch(`${BASE_URL}/actions/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ actions: payload }),
  });
  return handleResponse(res);
}

