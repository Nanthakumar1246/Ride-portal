import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

const AuthContext = createContext(null);

/** Decode JWT payload without verifying signature (client-side expiry check only). */
function decodeJwtPayload(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  if (!token) return true;
  // Dev fake tokens never expire
  if (String(token).startsWith("fake-token-")) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  // Treat as expired a few seconds early so we don't race the server
  return payload.exp * 1000 <= Date.now() + 5000;
}

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 60 minutes

function readStoredAuth() {
  try {
    const stored = localStorage.getItem("ARCHERIDE_AUTH");
    if (!stored) return { user: null, token: null, loginTime: null };
    const parsed = JSON.parse(stored);
    const token = parsed.token || null;
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem("ARCHERIDE_AUTH");
      return { user: null, token: null, loginTime: null };
    }
    return {
      user: parsed.user || null,
      token,
      loginTime: parsed.loginTime || null,
    };
  } catch {
    localStorage.removeItem("ARCHERIDE_AUTH");
    return { user: null, token: null, loginTime: null };
  }
}

export const AuthProvider = ({ children }) => {
  // Restore auth synchronously so ProtectedRoute does not redirect on browser refresh
  const initial = readStoredAuth();
  const [user, setUser] = useState(initial.user);
  const [token, setToken] = useState(initial.token);
  const [loginTime, setLoginTime] = useState(initial.loginTime);

  const login = (data) => {
    const now = new Date().toISOString();
    const authState = {
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
      },
      token: data.token,
      loginTime: now,
    };

    setUser(authState.user);
    setToken(authState.token);
    setLoginTime(now);
    localStorage.setItem("ARCHERIDE_AUTH", JSON.stringify(authState));
  };

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setLoginTime(null);
    localStorage.removeItem("ARCHERIDE_AUTH");
  }, []);

  // Keep React state in sync when http.js clears an expired/invalid session
  useEffect(() => {
    const onAuthCleared = () => {
      setUser(null);
      setToken(null);
      setLoginTime(null);
    };
    window.addEventListener("archeride:auth-cleared", onAuthCleared);
    return () => window.removeEventListener("archeride:auth-cleared", onAuthCleared);
  }, []);

  // Proactively expire the session when the JWT expires (without waiting for a 401)
  useEffect(() => {
    if (!token || String(token).startsWith("fake-token-")) return undefined;
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) {
      logout();
      return undefined;
    }
    const msUntilExpiry = payload.exp * 1000 - Date.now();
    if (msUntilExpiry <= 0) {
      logout();
      return undefined;
    }
    const id = setTimeout(() => logout(), msUntilExpiry);
    return () => clearTimeout(id);
  }, [token, logout]);

  // --- Auto Logout Logic (60 Minutes Inactivity) ---
  const timeoutRef = useRef(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (token) {
      timeoutRef.current = setTimeout(() => {
        console.warn("Auto-logging out due to 60 minutes of inactivity.");
        logout();
      }, INACTIVITY_LIMIT_MS);
    }
  }, [token, logout]);

  useEffect(() => {
    if (token) {
      const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
      const handleEvent = () => resetTimer();

      events.forEach((event) => document.addEventListener(event, handleEvent));

      resetTimer(); // Initialize timer

      return () => {
        events.forEach((event) => document.removeEventListener(event, handleEvent));
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [token, resetTimer]);
  // -------------------------------------------------

  return (
    <AuthContext.Provider value={{ user, token, loginTime, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
