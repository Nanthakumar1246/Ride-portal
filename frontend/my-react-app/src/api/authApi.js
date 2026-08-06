
import { BASE_URL, authHeaders, handleResponse } from "./http";

export async function loginApi(email, password) {
    
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const body = await res.json().catch(() => ({}));

    
    if (body.passwordExpired) {
        return body;
    }

    
    if (body.isFirstLogin && body.success) {
        return body;
    }

    if (!res.ok || !body.success) {
        throw new Error(body.message || "Login failed");
    }

    return body;
}

export async function approveBMApi(bmEmail) {
    const res = await fetch(`${BASE_URL}/auth/approve-bm`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders()
        },
        body: JSON.stringify({ bmEmail }),
    });

    return handleResponse(res);
}

export async function fetchApprovedBMsApi() {
    const res = await fetch(`${BASE_URL}/auth/approved-bms`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            ...authHeaders()
        },
    });

    
    return handleResponse(res);
}

export async function resetPasswordExpiredApi(email, oldPassword, newPassword) {
    const res = await fetch(`${BASE_URL}/auth/reset-password-expired`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, oldPassword, newPassword }),
    });

    return handleResponse(res);
}

export async function forgotPasswordOtpApi(email) {
    const res = await fetch(`${BASE_URL}/auth/forgot-password-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    return handleResponse(res);
}

export async function resetPasswordOtpApi(email, otp, newPassword) {
    const res = await fetch(`${BASE_URL}/auth/reset-password-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
    });
    return handleResponse(res);
}
