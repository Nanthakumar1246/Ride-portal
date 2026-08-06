
import { BASE_URL, authHeaders, handleResponse } from "./http";
function sanitizeStatus(payload = {}) {
  if (!payload.status) return payload;

  const s = String(payload.status).toLowerCase();

  if (s === "completed" || s === "closed") {
    return { ...payload, status: "Resolved" };
  }

  return payload;
}


export async function fetchDependencies(params = {}) {
  const search = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/dependencies${search ? `?${search}` : ""}`; 
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function fetchDependencyApi(id) {
  const res = await fetch(`${BASE_URL}/dependencies/${id}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}


export async function createDependencyApi(payload) {
  const res = await fetch(`${BASE_URL}/dependencies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(sanitizeStatus(payload)),

  });
  return handleResponse(res);
}

export async function updateDependencyApi(id, payload) {
  const res = await fetch(`${BASE_URL}/dependencies/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(sanitizeStatus(payload)),

  });
  return handleResponse(res);
}


export async function decideDependencyNotification(
  notificationId,
  decision,
  comment
) {
  const res = await fetch(
    `${BASE_URL}/dependencies/decisions/${notificationId}`,
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

export async function deleteDependenciesApi(payload) {
  const res = await fetch(`${BASE_URL}/dependencies/delete-multiple`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

