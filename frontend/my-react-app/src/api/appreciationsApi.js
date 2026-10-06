
import { BASE_URL, authHeaders, handleResponse } from "./http";

export async function fetchAppreciations(params = {}) {
  const search = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/appreciations${search ? `?${search}` : ""}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function fetchAppreciationApi(id) {
  const res = await fetch(`${BASE_URL}/appreciations/${id}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function createAppreciationApi(payload) {
  const res = await fetch(`${BASE_URL}/appreciations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateAppreciationApi(id, payload) {
  const res = await fetch(`${BASE_URL}/appreciations/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function uploadAppreciationAttachmentApi(id, file) {
  const formData = new FormData();
  formData.append("attachment", file);
  const res = await fetch(`${BASE_URL}/appreciations/${id}/attachment`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });
  return handleResponse(res);
}

/** Admin approves or rejects a submitted appreciation. */
export async function decideAppreciationApi(id, decision) {
  const res = await fetch(`${BASE_URL}/appreciations/${id}/decide`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ decision }),
  });
  return handleResponse(res);
}

export async function deleteAppreciationsApi(payload) {
  const res = await fetch(`${BASE_URL}/appreciations/delete-multiple`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

