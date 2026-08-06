
import { BASE_URL, authHeaders, handleResponse } from "./http";

export async function fetchMyNotifications(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/app-notifications${query ? `?${query}` : ""}`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  return handleResponse(res);
}

export async function markNotificationReadApi(id) {
  const res = await fetch(`${BASE_URL}/app-notifications/${id}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  return handleResponse(res);
}

export async function markAllNotificationsReadApi() {
  const res = await fetch(`${BASE_URL}/app-notifications/read-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  return handleResponse(res);
}
