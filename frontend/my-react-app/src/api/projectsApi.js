import axios from "axios";
import { BASE_URL } from "./http";

const getAuthHeaders = () => {
  const stored = localStorage.getItem("ARCHERIDE_AUTH");
  if (!stored) return {};
  try {
    const { token } = JSON.parse(stored);
    return { Authorization: `Bearer ${token}` };
  } catch (err) {
    return {};
  }
};

export const searchProjects = async (name) => {
  const res = await axios.get(`${BASE_URL}/projects?q=${encodeURIComponent(name || "")}`, { headers: getAuthHeaders() });
  return res.data;
};

export const fetchProjectsMaster = async (params = {}) => {
  const res = await axios.get(`${BASE_URL}/projects`, {
    headers: getAuthHeaders(),
    params,
  });
  return res.data;
};

export const fetchAccounts = async () => {
  const res = await axios.get(`${BASE_URL}/projects/accounts`, { headers: getAuthHeaders() });
  return res.data;
};

export const fetchManagers = async () => {
  const res = await axios.get(`${BASE_URL}/projects/managers`, { headers: getAuthHeaders() });
  return res.data;
};

export const fetchProgramManagers = async (headedBy) => {
  if (!headedBy) return [];
  const res = await axios.get(`${BASE_URL}/projects/program-managers`, {
    headers: getAuthHeaders(),
    params: { headed_by: headedBy },
  });
  return res.data;
};

export const fetchProjectsByAccount = async (account) => {
  if (!account) return [];
  const res = await axios.get(`${BASE_URL}/projects/by-account/${encodeURIComponent(account)}`, {
    headers: getAuthHeaders(),
  });
  return res.data;
};

export const upsertProjectsBulk = async (projects) => {
  const res = await axios.post(
    `${BASE_URL}/projects/upsert-bulk`,
    { projects },
    { headers: getAuthHeaders() }
  );
  return res.data;
};

export const fetchMappingTemplates = async () => {
  const res = await axios.get(`${BASE_URL}/projects/templates`, { headers: getAuthHeaders() });
  return res.data;
};

export const saveMappingTemplate = async (templateData) => {
  const res = await axios.post(`${BASE_URL}/projects/templates`, templateData, { headers: getAuthHeaders() });
  return res.data;
};

export const createProject = async (data) => {
  const res = await axios.post(`${BASE_URL}/projects`, data, { headers: getAuthHeaders() });
  return res.data;
};

export const fetchProjectHistory = async () => {
  const res = await axios.get(`${BASE_URL}/projects/history`, { headers: getAuthHeaders() });
  return res.data;
};
