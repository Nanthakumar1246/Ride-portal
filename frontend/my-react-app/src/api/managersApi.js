
import { BASE_URL, authHeaders, handleResponse } from "./http";


export async function fetchManagers() {
  const res = await fetch(`${BASE_URL}/managers`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

export async function fetchMappings() {
    const res = await fetch(`${BASE_URL}/managers/mappings`, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
    });
    return handleResponse(res);
  }

export async function createManager(manager_name, member_name) {
  const res = await fetch(`${BASE_URL}/managers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ manager_name, member_name }),
  });
  return handleResponse(res);
}

export async function deleteManager(id) {
  const res = await fetch(`${BASE_URL}/managers/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}

