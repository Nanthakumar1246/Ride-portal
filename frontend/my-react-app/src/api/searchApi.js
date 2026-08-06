
import { BASE_URL, authHeaders, handleResponse } from "./http";

export async function fetchGlobalSearch(q) {
  const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(q || "")}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}
