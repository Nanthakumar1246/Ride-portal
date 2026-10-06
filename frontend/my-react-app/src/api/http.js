const BASE_URL = window.location.origin.includes("localhost")
    ? "http://localhost:5000/api"
    : "/api";

let handlingUnauthorized = false;

/** Clear stored session and send the user to login (once). */
export function clearSessionAndRedirect(reason = "unauthorized") {
    if (handlingUnauthorized) return;
    handlingUnauthorized = true;

    try {
        localStorage.removeItem("ARCHERIDE_AUTH");
    } catch {
        /* ignore */
    }

    window.dispatchEvent(new CustomEvent("archeride:auth-cleared", { detail: { reason } }));

    const path = window.location.pathname || "";
    if (!path.startsWith("/login")) {
        window.location.assign("/login");
    } else {
        // Allow future 401s after a fresh login attempt
        setTimeout(() => {
            handlingUnauthorized = false;
        }, 1000);
    }
}

export function authHeaders() {
    const stored = localStorage.getItem("ARCHERIDE_AUTH");
    if (!stored) return {};
    try {
        const parsed = JSON.parse(stored);
        const token = parsed.token;
        return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
        return {};
    }
}

export async function handleResponse(res) {
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) {
        if (res.status === 401) {
            clearSessionAndRedirect("unauthorized");
        }
        const message = body.message || "Request failed";
        const error = new Error(message);
        error.status = res.status;
        throw error;
    }
    return body.data !== undefined ? body.data : body;
}

export { BASE_URL };
