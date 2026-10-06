
import { BASE_URL, authHeaders, handleResponse } from "./http";
function sanitizeStatus(payload = {}) {
  if (!payload.status) return payload;

  const s = String(payload.status).toLowerCase();

  if (s === "completed" || s === "closed") {
    return { ...payload, status: "Resolved" };
  }

  return payload;
}

export async function fetchRisks(params = {}) {
  const search = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/risks${search ? `?${search}` : ""}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function fetchRiskApi(id) {
  const res = await fetch(`${BASE_URL}/risks/${id}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function createRiskApi(payload) {
  const res = await fetch(`${BASE_URL}/risks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(sanitizeStatus(payload)),
  });
  return handleResponse(res);
}

export async function updateRiskApi(id, payload) {
  // A status update that carries a file arrives as FormData; the browser must
  // set its own multipart boundary, so the JSON Content-Type is omitted.
  const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;
  const res = await fetch(`${BASE_URL}/risks/${id}`, {
    method: "PUT",
    headers: isFormData
      ? { ...authHeaders() }
      : { "Content-Type": "application/json", ...authHeaders() },
    body: isFormData ? payload : JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteRisksApi(payload) {
  const res = await fetch(`${BASE_URL}/risks/delete-multiple`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function fetchRiskHistoryApi(id) {
  const res = await fetch(`${BASE_URL}/risks/${id}/history`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}
