
import { BASE_URL, authHeaders, handleResponse } from "./http";

export async function fetchModuleHistoryApi(moduleName, params = {}) {
  const query = new URLSearchParams({ module: moduleName, ...params });
  const res = await fetch(`${BASE_URL}/module-history?${query.toString()}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse(res);
}
