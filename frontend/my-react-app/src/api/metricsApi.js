
import { BASE_URL, authHeaders, handleResponse } from "./http";

export async function fetchDashboardMetrics(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      query.append(key, val);
    }
  });
  const queryString = query.toString();
  const url = queryString ? `${BASE_URL}/dashboard/metrics?${queryString}` : `${BASE_URL}/dashboard/metrics`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function fetchNearingTat(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      query.append(key, val);
    }
  });
  const res = await fetch(`${BASE_URL}/metrics/nearing-tat?${query.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function fetchPrioritySplit(moduleName) {
  const res = await fetch(`${BASE_URL}/metrics/priority-split?module=${moduleName}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}
