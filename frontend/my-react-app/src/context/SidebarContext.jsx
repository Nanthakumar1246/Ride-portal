import React, { createContext, useContext, useState, useCallback } from "react";

const SidebarContext = createContext({
  sidebarOpen: true,
  setSidebarOpen: () => {},
  sidebarClosing: false,
  sidebarJustClosed: false,   // pulses true→false right after sidebar closes
});

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({ children }) => {
  const [sidebarOpen, setSidebarOpenRaw] = useState(true);
  const [sidebarClosing, setSidebarClosing] = useState(false);
  const [sidebarJustClosed, setSidebarJustClosed] = useState(false);

  const setSidebarOpen = useCallback((value) => {
    // Detect close event (true → false)
    setSidebarOpenRaw(prev => {
      const next = typeof value === "function" ? value(prev) : value;
      if (prev === true && next === false) {
        // Sidebar is closing — notify after spring animation (~800ms)
        setSidebarClosing(true);
        setTimeout(() => {
          setSidebarClosing(false);
          setSidebarJustClosed(true);
          // Reset the pulse so it can re-trigger if sidebar opens & closes again
          setTimeout(() => setSidebarJustClosed(false), 50);
        }, 800);
      }
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen, sidebarClosing, sidebarJustClosed }}>
      {children}
    </SidebarContext.Provider>
  );
};
