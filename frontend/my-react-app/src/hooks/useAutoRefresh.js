import { useEffect, useRef } from "react";

function hasAuthToken() {
  try {
    const stored = localStorage.getItem("ARCHERIDE_AUTH");
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    return Boolean(parsed?.token);
  } catch {
    return false;
  }
}

/**
 * Periodically refreshes data and also refreshes when the tab becomes visible again,
 * so admin/BM views stay in sync without a full page reload.
 * Skips ticks when there is no auth token (avoids 401 spam after session expiry).
 */
export default function useAutoRefresh(loadFn, intervalMs = 30000) {
  const loadRef = useRef(loadFn);
  loadRef.current = loadFn;

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (!hasAuthToken()) return;
      loadRef.current?.();
    };

    const id = setInterval(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible" && hasAuthToken()) {
        loadRef.current?.();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [intervalMs]);
}
