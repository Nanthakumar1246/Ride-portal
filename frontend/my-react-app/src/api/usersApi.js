import axios from "axios";
import { BASE_URL } from "./http";

const getAuthHeaders = () => {
    const stored = localStorage.getItem("ARCHERIDE_AUTH");
    if (!stored) return {};
    const { token } = JSON.parse(stored);
    return { Authorization: `Bearer ${token}` };
};

export const fetchUsers = async () => {
    const res = await axios.get(`${BASE_URL}/users`, { headers: getAuthHeaders() });
    return res.data.data;
};

export const fetchAdminPmUsers = async () => {
    const res = await axios.get(`${BASE_URL}/users/admin-pm`, { headers: getAuthHeaders() });
    return res.data.data;
};

export const createUser = async ({ name, email, role, password }) => {
    try {
        const res = await axios.post(
            `${BASE_URL}/users`,
            { name, email, role, password },
            { headers: getAuthHeaders() }
        );
        return res.data.data;
    } catch (err) {
        const message =
            err?.response?.data?.message ||
            (err?.code === "ERR_NETWORK" || err?.message === "Network Error"
                ? "Cannot reach backend. Make sure the server is running on port 5000."
                : null) ||
            err?.message ||
            "Failed to create user";
        const error = new Error(message);
        error.status = err?.response?.status;
        error.response = err?.response;
        throw error;
    }
};

export const deleteUser = async (userId) => {
    try {
        const res = await axios.delete(`${BASE_URL}/users/${userId}`, {
            headers: getAuthHeaders(),
        });
        return res.data.data;
    } catch (err) {
        const message = err?.response?.data?.message || err?.message || "Failed to delete user";
        const error = new Error(message);
        error.status = err?.response?.status;
        error.response = err?.response;
        throw error;
    }
};

export const assignProjectsToUser = async (userId, projectIds) => {
    const res = await axios.post(
        `${BASE_URL}/users/${userId}/projects`,
        { projectIds },
        { headers: getAuthHeaders() }
    );
    return res.data;
};
