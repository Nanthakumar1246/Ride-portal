
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Folder,
  House,
  Warning,
  Circle,
  Link,
  TrendUp,
  CheckCircle,
  ThumbsUp,
  UserCircle,
  SignOut,
  Bell,
  UserPlus,
  X,
  CaretDown,
  Funnel,
  User,
  Receipt,
  Key,
  Translate,
  CaretRight,
  Check,
  MagnifyingGlass
} from "phosphor-react";

import { useAuth } from "../context/AuthContext";
import { useFilter } from "../context/FilterContext";
import { fetchManagers } from "../api/managersApi";
import {
  fetchAdminNotificationCount,
  fetchBmNotificationCount,
} from "../api/notificationsApi";
import { fetchMyNotifications, markNotificationReadApi, markAllNotificationsReadApi } from "../api/appNotificationsApi";
import { approveBMApi, fetchApprovedBMsApi } from "../api/authApi";
import logo from "../assets/arche-logo2.png";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar, SidebarProvider } from "../context/SidebarContext";

const MODULE_LINKS = [
  { key: "dashboard", label: "Dashboard", icon: House },
  { key: "project-master", label: "Project Master", icon: Folder },
  { key: "risks", label: "Risk", icon: Warning },
  { key: "issues", label: "Issue", icon: Circle },
  { key: "dependencies", label: "Dependency", icon: Link },
  { key: "escalations", label: "Escalation", icon: TrendUp },
  { key: "actions", label: "Action", icon: CheckCircle },
  { key: "appreciations", label: "Appreciation", icon: ThumbsUp },
  { key: "managers", label: "Managers", icon: UserCircle },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.25,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.8, rotateX: 90 },
  visible: {
    opacity: 1,
    scale: 1,
    rotateX: 0,
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

const sidebarItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: "easeOut" },
  },
};

function getTitle(pathname, search) {
  // Remove "Monitoring" terminology
  // if (pathname.startsWith("/monitoring")) return "Monitoring"; // Legacy

  if (pathname.startsWith("/modules/")) {
    const key = pathname.split("/")[2] || "";
    const mod = MODULE_LINKS.find((m) => m.key === key);
    const params = new URLSearchParams(search);
    const mode = params.get("mode") || "view";
    const modeLabel = mode === "edit" ? "Edit" : "View";
    return `${mod?.label || "Module"} – ${modeLabel}`;
  }
  if (pathname.startsWith("/login")) return "Login";
  if (pathname === "/landing") return "Landing";
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/bm/notifications") return "Notification"; // Renamed
  if (pathname === "/monitoring/users") return "Users Management";
  if (pathname === "/monitoring") return "Dashboard"; // Fallback for admin dashboard

  // Specific monitoring paths mapped to simple names
  if (pathname.startsWith("/monitoring/project-master")) return "Project Master";
  if (pathname.startsWith("/monitoring/risks")) return "Risk";
  if (pathname.startsWith("/monitoring/issues")) return "Issue";
  if (pathname.startsWith("/monitoring/dependencies")) return "Dependency";
  if (pathname.startsWith("/monitoring/actions")) return "Action";
  if (pathname.startsWith("/monitoring/escalations")) return "Escalation";
  if (pathname.startsWith("/monitoring/appreciations")) return "Appreciation";
  if (pathname.startsWith("/monitoring/notifications")) return "Notification";

  return "App";
}

const MainLayoutInner = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loginTime, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());


  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [bmApprovalEmail, setBmApprovalEmail] = useState("");
  const [approvalStatus, setApprovalStatus] = useState({ loading: false, error: "", success: "" });
  const [showHistory, setShowHistory] = useState(false);
  const [approvalHistory, setApprovalHistory] = useState([]);

  const isDashboard = location.pathname === "/monitoring";
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchInput(params.get("search") || "");
    setShowSearchBar(Boolean(params.get("search")));
  }, [location.pathname, location.search]);

  const applySearch = (value) => {
    setSearchInput(value);
    const params = new URLSearchParams(location.search);
    if (value) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  };

  useEffect(() => {
    if (showHistory) {
      fetchApprovedBMsApi().then(setApprovalHistory).catch(console.error);
    }
  }, [showHistory]);


  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const [notifCount, setNotifCount] = useState(0);
  const [appNotifCount, setAppNotifCount] = useState(0);
  const [appNotifRows, setAppNotifRows] = useState([]);
  const [showAppNotifDropdown, setShowAppNotifDropdown] = useState(false);
  const appNotifDropdownRef = React.useRef(null);
  const [showToast] = useState(false);
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const { selectedManager, setSelectedManager } = useFilter();
  const [managers, setManagers] = useState([]);
  const [showMgrDropdown, setShowMgrDropdown] = useState(false);
  const mgrDropdownRef = React.useRef(null);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLangSubmenu, setShowLangSubmenu] = useState(false);
  const [selectedLang, setSelectedLang] = useState("English (US)");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showTxHistoryModal, setShowTxHistoryModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: "", newPwd: "", confirm: "" });
  const [pwdStatus, setPwdStatus] = useState({ loading: false, error: "", success: "" });
  const profileDropdownRef = React.useRef(null);

  const params = new URLSearchParams(location.search);
  const currentMode = params.get("mode") || "view";
  const isModules = location.pathname.startsWith("/modules/");

  useEffect(() => {
    fetchManagers().then(setManagers).catch(console.error);
  }, []);

  // In edit mode the EnterpriseWorkspaceLayout has its own left nav sidebar,
  // so keep the MainLayout drawer closed to avoid a duplicate modules panel.
  useEffect(() => {
    if (isModules && currentMode === "edit") {
      setSidebarOpen(false);
      return;
    }
    const timer = setTimeout(() => setSidebarOpen(false), 5000);
    return () => clearTimeout(timer);
  }, [setSidebarOpen, isModules, currentMode]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mgrDropdownRef.current && !mgrDropdownRef.current.contains(event.target)) {
        setShowMgrDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileMenu(false);
        setShowLangSubmenu(false);
      }
      if (appNotifDropdownRef.current && !appNotifDropdownRef.current.contains(event.target)) {
        setShowAppNotifDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const title = getTitle(location.pathname, location.search);

  const handleModeChange = (mode) => {
    if (!isModules) return;
    const p = new URLSearchParams(location.search);
    p.set("mode", mode);
    navigate(`${location.pathname}?${p.toString()}`);
  };

  const handleNavClick = (item) => {
    if (!user) {
      navigate("/login");
      return;
    }


    setSidebarOpen(false);


    if (user.role === "ADMIN") {
      if (item.key === "dashboard") {
        navigate("/monitoring");
      } else if (item.key === "users") {
        navigate("/monitoring/users");
      } else {
        navigate(`/monitoring/${item.key}`);
      }
      return;
    }


    if (user.role === "BM" || user.role === "PM") {
      if (item.key === "dashboard") {
        navigate("/monitoring/risks");
      } else {
        navigate(`/monitoring/${item.key}`);
      }
      return;
    }


    navigate("/login");
  };

  const isActive = (itemKey) => {
    const path = location.pathname;

    if (itemKey === "dashboard") {
      return (
        path === "/monitoring" ||
        path.startsWith("/modules/risks")
      );
    }

    return (
      path.startsWith(`/monitoring/${itemKey}`) ||
      path.startsWith(`/modules/${itemKey}`)
    );
  };

  const goNotifications = () => {
    if (!user) return;
    if (user.role === "ADMIN") {
      navigate("/monitoring/notifications");
    } else if (user.role === "BM" || user.role === "PM") {
      navigate("/bm/notifications");
    }
  };


  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    setApprovalStatus({ loading: true, error: "", success: "" });
    try {
      await approveBMApi(bmApprovalEmail);
      setApprovalStatus({ loading: false, error: "", success: `Approved ${bmApprovalEmail}` });
      setBmApprovalEmail("");

      setTimeout(() => {
        setShowApprovalModal(false);
        setApprovalStatus({ loading: false, error: "", success: "" });
      }, 2000);
    } catch (err) {
      setApprovalStatus({ loading: false, error: err.message || "Failed", success: "" });
    }
  };


  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!user) {
        if (!ignore) setNotifCount(0);
        return;
      }
      try {
        let c = 0;
        if (user.role === "ADMIN") {
          c = await fetchAdminNotificationCount();
        } else if (user.role === "BM" || user.role === "PM") {
          c = await fetchBmNotificationCount();
        }
        if (!ignore) setNotifCount(c);
      } catch {
        if (!ignore) setNotifCount(0);
      }
    };

    load();
    const id = setInterval(load, 60000);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, [user]);

  useEffect(() => {
    let ignore = false;

    const loadAppNotifs = async () => {
      if (!user) {
        if (!ignore) {
          setAppNotifCount(0);
          setAppNotifRows([]);
        }
        return;
      }
      try {
        const res = await fetchMyNotifications({ limit: 10 });
        if (!ignore) {
          setAppNotifRows(res?.data?.rows || []);
          setAppNotifCount(res?.data?.unreadCount || 0);
        }
      } catch {
        if (!ignore) {
          setAppNotifCount(0);
          setAppNotifRows([]);
        }
      }
    };

    loadAppNotifs();
    const id = setInterval(loadAppNotifs, 60000);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, [user]);

  const handleOpenAppNotifDropdown = async () => {
    setShowAppNotifDropdown((v) => !v);
  };

  const handleMarkNotifRead = async (id) => {
    try {
      await markNotificationReadApi(id);
      setAppNotifRows((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setAppNotifCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setAppNotifRows((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setAppNotifCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications read", err);
    }
  };

  return (
    <div className="h-screen w-full flex bg-gray-50 text-slate-900 font-urbanist overflow-hidden relative">
      
      {/* Sidebar Backdrop — shown on mobile/tablet when open */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Permanent Left Sidebar (desktop), drawer overlay on mobile/tablet */}
      <aside
        className={`fixed lg:static top-0 left-0 h-screen w-[225px] bg-white border-r border-gray-100 shadow-2xl lg:shadow-none z-50 flex-shrink-0 flex flex-col pt-4 pb-5 overflow-y-auto overflow-x-hidden transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Drawer Header (Logo & Title) */}
        <div className="flex items-center justify-between px-4 pb-4 border-b border-gray-100/60 mb-2">
          <div className="flex items-center gap-2.5">
            <img
              src={logo}
              alt="Arche Logo"
              className="h-6 w-auto object-contain shrink-0"
              style={{ height: "24px", maxHeight: "24px" }}
            />
            <div className="flex flex-col" key={location.pathname}>
              <span className="text-base leading-tight font-black text-gray-900 tracking-tight">
                RIDE+
              </span>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.1em]">
                {title || "Delivery"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-black transition-colors"
            aria-label="Close menu"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <nav className="flex-1">
          <motion.ul
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-1 pr-3 pl-0"
          >
            {(user && user.role === "ADMIN")
              ? [...MODULE_LINKS].map((item) => {
                const active = isActive(item.key);
                const Icon = item.icon;
                return (
                  <motion.li key={item.key} variants={sidebarItemVariants}>
                    <button
                      type="button"
                      onClick={() => handleNavClick(item)}
                      className={`w-full text-left pl-6 pr-3 py-2 rounded-r-md text-xs sm:text-sm transition-all flex items-center gap-3 relative ${
                        active
                          ? "text-white font-semibold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:pl-7"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="active-nav-bg"
                          className="absolute inset-0 bg-black rounded-r-md -z-10"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <Icon size={19} weight={active ? "fill" : "regular"} className="flex-shrink-0 relative z-10" />
                      <span className="flex-1 relative z-10 truncate">{item.label}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-white/80 mr-0.5 relative z-10" />}
                    </button>
                  </motion.li>
                );
              })
              : MODULE_LINKS.filter((item) => item.key !== "dashboard" && item.key !== "managers" && item.key !== "project-master").map((item) => {
                const active = isActive(item.key);
                const Icon = item.icon;
                return (
                  <motion.li key={item.key} variants={sidebarItemVariants}>
                    <button
                      type="button"
                      onClick={() => handleNavClick(item)}
                      className={`w-full text-left pl-6 pr-3 py-2 rounded-r-md text-xs sm:text-sm transition-all flex items-center gap-3 relative ${
                        active
                          ? "text-white font-semibold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:pl-7"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="active-nav-bg"
                          className="absolute inset-0 bg-black rounded-r-md -z-10"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <Icon size={19} weight={active ? "fill" : "regular"} className="flex-shrink-0 relative z-10" />
                      <span className="flex-1 relative z-10 truncate">{item.label}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-white/80 mr-0.5 relative z-10" />}
                    </button>
                  </motion.li>
                );
              })}
          </motion.ul>
        </nav>

        {/* Footer user info */}
        {user && (
          <div className="mx-3 mt-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Signed in as</div>
            <div className="text-xs font-bold text-gray-800 truncate">{user.name || user.email}</div>
            <div className="text-[10px] text-gray-400 mt-0.5 uppercase">{user.role}</div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        
        {/* Header (Right Controls only on Desktop) */}
        <header className="flex flex-col sm:flex-row items-center justify-between lg:justify-end border-b border-gray-200 bg-white px-2 sm:px-6 py-2 sm:h-16 gap-2 sm:gap-0 shrink-0">
          
          {/* Mobile Menu Toggle */}
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-black transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

        {/* Right Side: Actions */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3 sm:gap-6 px-1 sm:px-0"
        >

          {/* View/Edit Toggle for Modules */}
          {isModules && (
            <motion.div variants={itemVariants} className="inline-flex items-center gap-1 sm:gap-2 rounded-full bg-gray-100 px-1 py-1">
              <button
                type="button"
                onClick={() => handleModeChange("view")}
                className={`px-3 py-1 text-[10px] sm:text-xs rounded-full ${currentMode === "view"
                  ? "bg-white text-brandDark shadow-sm"
                  : "text-brandMuted"
                  }`}
              >
                View
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("edit")}
                className={`px-3 py-1 text-[10px] sm:text-xs rounded-full ${currentMode === "edit"
                  ? "bg-brandDark text-white shadow-sm"
                  : "text-brandMuted"
                  }`}
              >
                Edit
              </button>
            </motion.div>
          )}

          {/* Global Search (Dashboard only) */}
          {isDashboard && (
            <motion.div variants={itemVariants} className="hidden sm:flex items-center">
              <motion.div
                initial={false}
                animate={{ width: showSearchBar ? 220 : 36 }}
                className="flex items-center gap-1.5 bg-gray-100 rounded-full overflow-hidden h-9 px-2"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (showSearchBar && searchInput) {
                      applySearch("");
                    }
                    setShowSearchBar((v) => !v);
                  }}
                  className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-800 shrink-0"
                  aria-label="Toggle search"
                >
                  <MagnifyingGlass size={16} weight="bold" />
                </button>
                {showSearchBar && (
                  <input
                    type="text"
                    autoFocus
                    value={searchInput}
                    onChange={(e) => applySearch(e.target.value)}
                    placeholder="Search account, project, risk, issue..."
                    className="flex-1 bg-transparent text-xs outline-none text-gray-800 placeholder:text-gray-400"
                  />
                )}
              </motion.div>
            </motion.div>
          )}

          {/* Manager Filter */}
          {(user?.role === "ADMIN" || user?.role === "VP") && (
            <motion.div variants={itemVariants} className="relative hidden sm:block" ref={mgrDropdownRef}>
              <button
                onClick={() => setShowMgrDropdown(!showMgrDropdown)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/50 rounded-full py-1.5 px-4 text-sm font-semibold text-indigo-900 hover:shadow-md hover:border-indigo-300 transition-all shadow-sm group backdrop-blur-sm"
              >
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform">
                  <Funnel size={12} weight="bold" />
                </div>
                <span className="max-w-[120px] truncate tracking-tight">
                  {selectedManager || "All Managers"}
                </span>
                <CaretDown size={14} className="text-indigo-400 group-hover:text-indigo-600 transition-colors" />
              </button>

              <AnimatePresence>
                {showMgrDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute top-full right-0 mt-3 w-64 bg-white/70 backdrop-blur-2xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/40 py-3 z-50 max-h-80 overflow-y-auto ring-1 ring-black/5"
                  >
                    <div className="px-4 py-2 text-[10px] font-black text-indigo-400/80 uppercase tracking-widest border-b border-indigo-100/30 mb-2">
                      System Filter
                    </div>
                    
                    <button
                      onClick={() => { setSelectedManager(""); setShowMgrDropdown(false); }}
                      className={`w-full flex items-center px-4 py-2.5 text-sm transition-all relative ${!selectedManager ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 font-bold border-l-2 border-indigo-500" : "text-gray-600 hover:bg-white/50 hover:text-indigo-900 font-medium"}`}
                    >
                      <div className="flex-1 text-left">All Managers</div>
                      {!selectedManager && <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>}
                    </button>
                    
                    <div className="px-4 py-3 mt-1 text-[10px] font-black text-indigo-400/80 uppercase tracking-widest">
                      Individuals
                    </div>

                    {[...new Set(managers.map(m => m.name))].filter(m => m && m.toLowerCase() !== "global").map(m => {
                      if (!m) return null;
                      const isSelected = selectedManager === m;
                      return (
                        <button
                          key={m}
                          onClick={() => { setSelectedManager(m); setShowMgrDropdown(false); }}
                          className={`w-full flex items-center px-4 py-2.5 text-sm transition-all relative ${isSelected ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 font-bold border-l-2 border-indigo-500" : "text-gray-600 hover:bg-white/50 hover:text-indigo-900 font-medium"}`}
                        >
                          <div className="flex-1 text-left">{m}</div>
                          {isSelected && <div className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm ml-auto sm:ml-0">
            {/* Export button REMOVED from navbar */}

            {showToast && (
              <div className="absolute right-40 top-20 z-50
                      rounded-md bg-green-600 px-3 py-1.5
                      text-xs text-white shadow-lg
                      animate-fade">
                ✅ Downloaded successfully
              </div>
            )}

            {/* Notifications */}
            {user && (
              <motion.div variants={itemVariants} className="relative" ref={appNotifDropdownRef}>
                <button
                  type="button"
                  onClick={handleOpenAppNotifDropdown}
                  className="relative rounded-full h-8 w-8 flex items-center justify-center border border-orange-200 text-orange-500 hover:bg-orange-50 transition-colors"
                  title="Notification"
                  style={{ color: "#f97316", borderColor: "#fed7aa" }}
                >
                  <Bell size={20} weight="duotone" />
                  {(notifCount + appNotifCount) > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[16px] text-center">
                      {notifCount + appNotifCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showAppNotifDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute top-full right-0 mt-3 w-80 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 py-2 z-50 max-h-96 overflow-y-auto"
                    >
                      <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100 mb-1">
                        <span className="text-xs font-black text-gray-700">Notifications</span>
                        {appNotifCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllNotifsRead}
                            className="text-[10px] font-bold text-indigo-600 hover:underline"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      {appNotifRows.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-gray-400">No notifications yet.</div>
                      ) : (
                        appNotifRows.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => !n.is_read && handleMarkNotifRead(n.id)}
                            className={`w-full text-left px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${n.is_read ? "opacity-60" : ""}`}
                          >
                            <div className="flex items-center gap-2">
                              {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                              <span className="text-xs font-bold text-gray-800 truncate">{n.title}</span>
                            </div>
                            {n.message && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>}
                            <span className="text-[10px] text-gray-400 mt-0.5 block">
                              {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                            </span>
                          </button>
                        ))
                      )}
                      {(user.role === "ADMIN" || user.role === "BM" || user.role === "PM") && (
                        <button
                          type="button"
                          onClick={() => { setShowAppNotifDropdown(false); goNotifications(); }}
                          className="w-full text-center px-4 py-2 text-[11px] font-bold text-indigo-600 hover:underline border-t border-gray-100 mt-1"
                        >
                          View Approval Requests
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* NEW MEMBER (Replaced Approve BM) */}
            {user && user.role === "ADMIN" && (
              <motion.button
                variants={itemVariants}
                type="button"
                onClick={() => setShowApprovalModal(true)}
                className="rounded-full h-8 w-8 flex items-center justify-center border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors"
                title="Add New Member"
                style={{ color: "#9333ea", borderColor: "#e9d5ff" }}
              >
                <UserPlus size={20} weight="duotone" />
              </motion.button>
            )}

            {/* User Info & Profile Dropdown */}
            {user && (
              <motion.div variants={itemVariants} className="hidden sm:flex flex-col text-right shrink-0">
                <span className="text-xs font-black text-gray-900 leading-none">{user.name || "User Name"}</span>
                <span className="text-[10px] font-bold text-gray-400 mt-1 leading-none">{user.email || "email@domain.com"}</span>
              </motion.div>
            )}

            {/* User Profile Dropdown */}
            <motion.div variants={itemVariants} className="relative flex items-center" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className={`rounded-full h-8 w-8 flex items-center justify-center border border-gray-300 text-slate-700 hover:bg-gray-100 transition-all ${
                  showProfileMenu ? "ring-2 ring-indigo-500 border-transparent bg-gray-100" : ""
                }`}
                title="Profile Menu"
              >
                <UserCircle size={22} weight="duotone" />
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 top-full mt-2 w-80 bg-white rounded-md shadow-2xl border border-gray-200 z-50 overflow-hidden font-urbanist py-4"
                  >
                    {/* Top Section - User Info Card */}
                    <div className="flex flex-col items-center px-6 pt-1 pb-3">
                      {/* Large circular avatar icon */}
                      <div className="w-24 h-24 rounded-full bg-[#595959] text-white flex items-center justify-center mb-3 shadow-md border-2 border-white">
                        <User size={58} weight="regular" />
                      </div>

                      {/* Name + Code */}
                      <div className="text-center">
                        <div className="text-base font-normal text-gray-900 tracking-tight leading-tight">
                          {user?.name || "B Santhosh"} ({user?.employeeId || user?.empId || "AGFT1536"})
                        </div>
                        {/* Email */}
                        <div className="text-sm text-gray-800 mt-1">
                          <span className="font-bold text-gray-900">Email: </span>
                          {user?.email || "santhosh.b@arche.global"}
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-200 my-2" />

                    {/* Menu Options */}
                    <div className="py-1">
                      {/* My Profile */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowProfileModal(true);
                        }}
                        className="w-full flex items-center gap-3.5 px-6 py-2.5 text-gray-800 hover:bg-gray-100/80 transition-colors text-left text-sm sm:text-base font-medium"
                      >
                        <User size={20} weight="bold" className="text-gray-700 shrink-0" />
                        <span>My Profile</span>
                      </button>

                      {/* My Transaction History */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowTxHistoryModal(true);
                        }}
                        className="w-full flex items-center gap-3.5 px-6 py-2.5 text-gray-800 hover:bg-gray-100/80 transition-colors text-left text-sm sm:text-base font-medium"
                      >
                        <Receipt size={20} weight="bold" className="text-gray-700 shrink-0" />
                        <span>My Transaction History</span>
                      </button>

                      {/* Change password */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowPasswordModal(true);
                        }}
                        className="w-full flex items-center gap-3.5 px-6 py-2.5 text-gray-800 hover:bg-gray-100/80 transition-colors text-left text-sm sm:text-base font-medium"
                      >
                        <Key size={20} weight="bold" className="text-gray-700 shrink-0" />
                        <span>Change password</span>
                      </button>

                      {/* Language */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowLangSubmenu((prev) => !prev)}
                          className="w-full flex items-center justify-between px-6 py-2.5 text-gray-800 hover:bg-gray-100/80 transition-colors text-left text-sm sm:text-base font-medium"
                        >
                          <div className="flex items-center gap-3.5">
                            <Translate size={20} weight="bold" className="text-gray-700 shrink-0" />
                            <span>Language</span>
                          </div>
                          <CaretRight size={16} weight="bold" className="text-gray-800" />
                        </button>

                        {/* Language Selector Accordion */}
                        <AnimatePresence>
                          {showLangSubmenu && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-gray-50 border-y border-gray-200 px-8 py-2 space-y-1 overflow-hidden"
                            >
                              {["English (US)", "English (UK)", "Hindi", "Spanish"].map((lang) => (
                                <button
                                  key={lang}
                                  type="button"
                                  onClick={() => {
                                    setSelectedLang(lang);
                                    setShowLangSubmenu(false);
                                    setShowProfileMenu(false);
                                  }}
                                  className={`w-full text-left py-1.5 px-3 text-xs sm:text-sm rounded flex items-center justify-between transition-colors ${
                                    selectedLang === lang ? "bg-indigo-50 text-indigo-700 font-bold" : "text-gray-700 hover:bg-gray-200/60"
                                  }`}
                                >
                                  <span>{lang}</span>
                                  {selectedLang === lang && <Check size={14} weight="bold" />}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Logout */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3.5 px-6 py-2.5 text-gray-800 hover:bg-gray-100/80 transition-colors text-left text-sm sm:text-base font-medium"
                      >
                        <SignOut size={20} weight="bold" className="text-gray-700 shrink-0" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>


            {/* Clock & Date Display */}
            <motion.div variants={itemVariants} className="flex flex-col items-end justify-center text-right ml-2 border-l border-gray-200/80 pl-4 h-9 shrink-0">
              <span className="text-[11px] font-bold text-[#8c9bb0] uppercase tracking-wider leading-none mb-1">
                {`${currentTime.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}, ${currentTime.getDate()} ${currentTime.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}`}
              </span>
              <span className="text-sm font-urbanist font-bold text-[#1e293b] tabular-nums leading-none">
                {currentTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase()}
              </span>
            </motion.div>
          </div>
        </motion.div>
      </header >
        <main className={`flex-1 min-h-0 overflow-auto overflow-x-hidden ${isModules && currentMode === "edit" ? "p-0" : "px-2 sm:px-4 py-4"}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedManager || "__all__"}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Approval Modal */}
      <AnimatePresence>
        {showApprovalModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowApprovalModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm z-10 font-urbanist"
            >
              <button
                onClick={() => setShowApprovalModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-black"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center mb-6">
                <div className="h-10 w-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-3">
                  <UserPlus size={24} weight="duotone" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">ADD NEW MEMBER</h3>
                <p className="text-gray-500 text-xs text-center mt-1">
                  Enter the email ID of the new member
                </p>
              </div>

              {!showHistory ? (
                <>
                  <form onSubmit={handleApproveSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Mail</label>
                      <input
                        type="email"
                        value={bmApprovalEmail}
                        onChange={(e) => setBmApprovalEmail(e.target.value)}
                        placeholder="bm@arche.global"
                        className="w-full p-3 rounded border border-gray-200 text-sm focus:border-purple-600 focus:ring-1 focus:ring-purple-600 outline-none"
                        required
                      />
                    </div>

                    {approvalStatus.error && (
                      <div className="text-red-500 text-xs bg-red-50 p-2 rounded border border-red-100">
                        {approvalStatus.error}
                      </div>
                    )}
                    {approvalStatus.success && (
                      <div className="text-green-600 text-xs bg-green-50 p-2 rounded border border-green-100">
                        {approvalStatus.success}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={approvalStatus.loading}
                      className="w-full bg-purple-600 text-white py-3 rounded font-bold uppercase tracking-wider text-sm hover:bg-purple-700 transition shadow-md"
                    >
                      {approvalStatus.loading ? "Approving..." : "Approve Access"}
                    </button>
                  </form>
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setShowHistory(true)}
                      className="text-xs text-purple-600 font-semibold hover:underline"
                    >
                      View Approval History
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-800">Past Approvals</h4>
                    <button onClick={() => setShowHistory(false)} className="text-xs text-gray-500 hover:text-purple-600">Back</button>
                  </div>
                  <div className="bg-gray-50 rounded border border-gray-100 max-h-48 overflow-y-auto p-2 space-y-2">
                    {approvalHistory.length === 0 ? (
                      <p className="text-xs text-center text-gray-400 py-2">No history found</p>
                    ) : (
                      approvalHistory.map((item, i) => (
                        <div key={i} className="flex flex-col border-b border-gray-200 last:border-0 pb-2 last:pb-0">
                          <span className="text-xs font-semibold text-gray-800">{item.email}</span>
                          <span className="text-[10px] text-gray-500">{new Date(item.approvedAt).toLocaleDateString()} {new Date(item.approvedAt).toLocaleTimeString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* My Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowProfileModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md z-10 font-urbanist"
            >
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-black"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 rounded-full bg-[#595959] text-white flex items-center justify-center mb-3 shadow-md">
                  <User size={48} weight="regular" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">MY PROFILE</h3>
                <p className="text-xs text-gray-500 mt-0.5">Account & User Credentials</p>
              </div>

              <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100 text-sm">
                <div className="flex justify-between py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-medium">Full Name</span>
                  <span className="font-bold text-gray-800">{user?.name || "B Santhosh"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-medium">Employee Code</span>
                  <span className="font-bold text-gray-800">{user?.employeeId || user?.empId || "AGFT1536"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-medium">Email Address</span>
                  <span className="font-bold text-gray-800">{user?.email || "santhosh.b@arche.global"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-medium">User Role</span>
                  <span className="font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded text-xs">{user?.role || "ADMIN"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 font-medium">Active Language</span>
                  <span className="font-bold text-gray-800">{selectedLang}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="mt-6 w-full bg-slate-900 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-black transition shadow"
              >
                Close Profile
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowPasswordModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm z-10 font-urbanist"
            >
              <button
                onClick={() => setShowPasswordModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-black"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center mb-5">
                <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-2">
                  <Key size={24} weight="bold" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">CHANGE PASSWORD</h3>
                <p className="text-gray-500 text-xs text-center mt-0.5">
                  Update your account password
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!pwdForm.current || !pwdForm.newPwd || !pwdForm.confirm) {
                    setPwdStatus({ loading: false, error: "All fields are required", success: "" });
                    return;
                  }
                  if (pwdForm.newPwd !== pwdForm.confirm) {
                    setPwdStatus({ loading: false, error: "Passwords do not match", success: "" });
                    return;
                  }
                  setPwdStatus({ loading: true, error: "", success: "" });
                  setTimeout(() => {
                    setPwdStatus({ loading: false, error: "", success: "Password updated successfully!" });
                    setTimeout(() => {
                      setShowPasswordModal(false);
                      setPwdForm({ current: "", newPwd: "", confirm: "" });
                      setPwdStatus({ loading: false, error: "", success: "" });
                    }, 1200);
                  }, 600);
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Current Password</label>
                  <input
                    type="password"
                    value={pwdForm.current}
                    onChange={(e) => setPwdForm({ ...pwdForm, current: e.target.value })}
                    placeholder="••••••••"
                    className="w-full p-2.5 rounded border border-gray-200 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none mt-1"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">New Password</label>
                  <input
                    type="password"
                    value={pwdForm.newPwd}
                    onChange={(e) => setPwdForm({ ...pwdForm, newPwd: e.target.value })}
                    placeholder="••••••••"
                    className="w-full p-2.5 rounded border border-gray-200 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none mt-1"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Confirm Password</label>
                  <input
                    type="password"
                    value={pwdForm.confirm}
                    onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
                    placeholder="••••••••"
                    className="w-full p-2.5 rounded border border-gray-200 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none mt-1"
                    required
                  />
                </div>

                {pwdStatus.error && (
                  <div className="text-red-500 text-xs bg-red-50 p-2 rounded border border-red-100">
                    {pwdStatus.error}
                  </div>
                )}
                {pwdStatus.success && (
                  <div className="text-green-600 text-xs bg-green-50 p-2 rounded border border-green-100">
                    {pwdStatus.success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pwdStatus.loading}
                  className="w-full bg-slate-900 text-white py-2.5 rounded font-bold text-xs uppercase tracking-wider hover:bg-black transition shadow"
                >
                  {pwdStatus.loading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction History Modal */}
      <AnimatePresence>
        {showTxHistoryModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowTxHistoryModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg z-10 font-urbanist"
            >
              <button
                onClick={() => setShowTxHistoryModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-black"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-3">
                <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                  <Receipt size={22} weight="bold" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">MY TRANSACTION HISTORY</h3>
                  <p className="text-xs text-gray-500">Recent account actions & system activity logs</p>
                </div>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {[
                  { title: "User Session Authenticated", time: "Today, 11:59 AM", type: "Login" },
                  { title: "Dashboard Filter Changed", time: "Today, 11:45 AM", type: "System" },
                  { title: "Risk Module Data Exported", time: "Yesterday, 04:30 PM", type: "Export" },
                  { title: "BM Approval Submitted", time: "18 Jul 2026, 02:15 PM", type: "Admin" },
                ].map((tx, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100 hover:bg-gray-100/60 transition">
                    <div>
                      <div className="text-xs font-bold text-gray-800">{tx.title}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{tx.time}</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {tx.type}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowTxHistoryModal(false)}
                className="mt-5 w-full bg-gray-100 text-gray-800 py-2 rounded-lg font-bold text-xs hover:bg-gray-200 transition"
              >
                Close History
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

// Wrapper layout
const MainLayout = ({ children }) => (
  <SidebarProvider>
    <MainLayoutInner>{children}</MainLayoutInner>
  </SidebarProvider>
);

export default MainLayout;
