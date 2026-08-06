import axios from "axios";
import { BASE_URL } from "./http";

const getAuthHeaders = () => {
    const stored = localStorage.getItem("ARCHERIDE_AUTH");
    if (!stored) return {};
    const { token } = JSON.parse(stored);
    return { Authorization: `Bearer ${token}` };
};

export const getLayoutApi = async (moduleName) => {
    try {
        const res = await axios.get(`${BASE_URL}/layout/${moduleName}`, { headers: getAuthHeaders() });
        return res.data.data; 
    } catch (err) {
        console.error(err);
        return null; 
    }
};

export const saveLayoutApi = async (moduleName, config) => {
    const res = await axios.post(
        `${BASE_URL}/layout/${moduleName}`,
        config,
        { headers: getAuthHeaders() }
    );
    return res.data;
};

export const deleteLayoutApi = async (moduleName) => {
    const res = await axios.post(
        `${BASE_URL}/layout/${moduleName}/reset`,
        {},
        { headers: getAuthHeaders() }
    );
    return res.data;
};
