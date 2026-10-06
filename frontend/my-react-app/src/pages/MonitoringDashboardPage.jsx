import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { fetchDashboardMetrics, fetchNearingTat } from "../api/metricsApi";
import { fetchGlobalSearch } from "../api/searchApi";
import { fetchRisks } from "../api/risksApi";
import { fetchIssues } from "../api/issuesApi";
import { fetchDependencies } from "../api/dependenciesApi";
import { fetchEscalations } from "../api/escalationsApi";
import { fetchActions } from "../api/actionsApi";
import { fetchAppreciations } from "../api/appreciationsApi";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from "recharts";
import { useFilter } from "../context/FilterContext";
import { useSidebar } from "../context/SidebarContext";
import useAutoRefresh from "../hooks/useAutoRefresh";
import StackedColumnChart from "../components/StackedColumnChart";
import { DownloadSimple, Clock, ArrowClockwise, ShieldWarning, CheckCircle, PauseCircle, Star } from "phosphor-react";
import { exportToExcel } from "../utils/exportToExcel";
import { formatDateOnly } from "../utils/dateFormat";
import { AGING_BUCKETS, AGING_CONFIGS, matchesAgingFilter } from "../utils/agingUtils";

const agingConfig = AGING_CONFIGS.dashboard;

/* ── normalizes a raw record from any module into one shared shape for the
   Priority Tracker and Aging Tracker widgets, which span all modules ── */
const normalizeLogRow = (r, moduleLabel) => {
  const idByModule = {
    Risk: r.risk_id,
    Issue: r.issue_id,
    Dependency: r.dependency_id,
    Escalation: r.escalation_id,
    Action: r.action_id,
  };
  const ownerByModule = {
    Risk: r.mitigation_owner || r.identified_by,
    Issue: r.assigned_to || r.reported_by,
    Dependency: r.contact_person,
    Escalation: r.escalated_to,
    Action: r.responsible || r.action_owner,
  };
  const dueDateByModule = {
    Risk: r.target_mitigation_date || r.planned_closure_date || r.identified_date,
    Issue: r.target_resolution_date || r.due_date,
    Dependency: r.required_by_date || r.due_date,
    Escalation: r.target_resolution_date || r.due_date,
    Action: r.target_date || r.due_date,
  };

  return {
    id: r.id,
    module: moduleLabel,
    item_id: idByModule[moduleLabel] || r.id,
    account: r.account,
    manual_project_id: r.manual_project_id,
    owner: ownerByModule[moduleLabel] || "—",
    priority: r.priority,
    due_date: dueDateByModule[moduleLabel],
    status: r.status || r.current_status,
    updated_at: r.updated_at || r.last_reviewed_date,
  };
};

/* ── colour maps ── */
const KPI_CONFIG = [
  { key: "totalOpen",      label: "Open",      color: "#EF4444" },
  { key: "totalClosed",    label: "Resolved",  color: "#10B981" },
  { key: "totalApproved",  label: "Approved",  color: "#3B82F6" },
  { key: "totalCancelled", label: "Cancelled", color: "#9CA3AF" },
];

const PRI_CONFIG = [
  { key: "Critical", color: "#EF4444", light: "#FEF2F2" },
  { key: "High",     color: "#F97316", light: "#FFF7ED" },
  { key: "Medium",   color: "#F59E0B", light: "#FFFBEB" },
  { key: "Low",      color: "#10B981", light: "#ECFDF5" },
];

const DONUT_COLORS = {
  Critical: "#991B1B",
  High: "#EF4444",
  Medium: "#F59E0B",
  Low: "#10B981",
  Unset: "#94A3B8",
};

const API_ORIGIN = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/api\/?$/, "");

const resolveUploadUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = String(path).replace(/\\/g, "/");
  const uploadsIdx = normalized.toLowerCase().lastIndexOf("uploads/");
  const relative = uploadsIdx >= 0 ? normalized.slice(uploadsIdx) : normalized.replace(/^\//, "");
  return `${API_ORIGIN}/${relative}`;
};

const getAppreciationPhotoUrl = (row) => {
  if (!row) return null;
  if (row.image_url) return resolveUploadUrl(row.image_url);
  const path = row.attachment_url || "";
  if (/\.(png|jpe?g|webp|gif)$/i.test(path) || String(row.file_type || "").startsWith("image/")) {
    return resolveUploadUrl(path);
  }
  return null;
};

const getInitials = (name) => {
  if (!name) return "TM";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return String(name).slice(0, 2).toUpperCase();
};

const AnimatedCounter = ({ value, delay = 0 }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    const animation = animate(count, value, { duration: 1.2, delay, ease: "easeOut" });
    return animation.stop;
  }, [value, delay, count]);

  return <motion.span>{rounded}</motion.span>;
};

/* ── card shell ── */
const Card = ({ title, children, className = "", delay = 0 }) => (
  <motion.div 
    initial={{ opacity: 0, y: 15, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.4, delay, ease: "easeOut" }}
    className={`bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col min-h-0 ${className}`}
  >
    {title && <p className="text-[10px] sm:text-[11px] font-black text-gray-600 uppercase tracking-wider mb-2 flex-shrink-0 truncate" title={title}>{title}</p>}
    <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
  </motion.div>
);

const MonitoringDashboardPage = () => {
  const { selectedManager } = useFilter();

  const navigate = useNavigate();
  const location = useLocation();
  const searchQuery = new URLSearchParams(location.search).get("search") || "";
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [kpis, setKpis] = useState(null);
  const [moduleStatus, setModuleStatus] = useState([]);
  const [selectedModule, setSelectedModule] = useState("Action");
  const [priorityByModule, setPriorityByModule] = useState({});
  const [appreciations, setAppreciations] = useState([]);
  const [currentAppSlide, setCurrentAppSlide] = useState(0);
  const [detailRow, setDetailRow] = useState(null);
  const [tatRows, setTatRows] = useState([]);
  const [tatPage, setTatPage] = useState(1);
  const [tatTotalPages, setTatTotalPages] = useState(1);
  const TAT_PAGE_SIZE = 5;
  const [allRisks, setAllRisks] = useState([]);
  const [allIssues, setAllIssues] = useState([]);
  const [allDependencies, setAllDependencies] = useState([]);
  const [allEscalations, setAllEscalations] = useState([]);
  const [allActions, setAllActions] = useState([]);
  const [loadingRisks, setLoadingRisks] = useState(true);
  const [toast, setToast] = useState(false);
  const [agingFilter, setAgingFilter] = useState("");

  const { sidebarJustClosed, sidebarOpen, sidebarClosing } = useSidebar();
  const [contentReady, setContentReady] = useState(() => !sidebarOpen && !sidebarClosing);
  
  useEffect(() => {
    if (sidebarJustClosed && !contentReady) {
      setContentReady(true);
    }
  }, [sidebarJustClosed, contentReady]);

  // Appreciations Carousel Auto-Slide
  useEffect(() => {
    if (appreciations.length > 1) {
      const int = setInterval(() => setCurrentAppSlide(prev => (prev + 1) % appreciations.length), 4000);
      return () => clearInterval(int);
    }
  }, [appreciations]);

  const loadData = async () => {
    try {
      const res = await fetchDashboardMetrics({ manager: selectedManager });
      const data = res?.data || res;
      const ms = data.module_status || [];
      const tOpen = ms.reduce((acc, row) => acc + (Number(row.Open) || 0), 0);
      const tSubmitted = ms.reduce((acc, row) => acc + (Number(row.ClosureSubmitted) || 0), 0);
      const tClosed = ms.reduce((acc, row) => acc + (Number(row.ClosedAcknowledged) || Number(row.Resolved) || 0), 0);
      const tHold = ms.reduce((acc, row) => acc + (Number(row.Hold) || Number(row["On Hold"]) || 0), 0);

      setKpis({
        totalOpen: tOpen,
        totalSubmitted: tSubmitted,
        totalClosed: tClosed,
        totalHold: tHold,
        totalItems: Number(data.total_items ?? 0),
      });
      setPriorityByModule(data.priority_by_module || {});
      setModuleStatus(data.module_status || []);
    } catch (err) { console.error(err); }

    try {
      const appRes = await fetchAppreciations({ manager: selectedManager });
      const appData = appRes?.data || appRes || [];
      const sortedApp = appData.sort((a,b) => new Date(b.received_date || 0) - new Date(a.received_date || 0));
      setAppreciations(sortedApp.slice(0, 5));
    } catch (err) { console.error(err); }

    try {
      setLoadingRisks(true);
      const [rRes, iRes, dRes, eRes, aRes] = await Promise.all([
        fetchRisks({ manager: selectedManager }),
        fetchIssues({ manager: selectedManager }),
        fetchDependencies({ manager: selectedManager }),
        fetchEscalations({ manager: selectedManager }),
        fetchActions({ manager: selectedManager }),
      ]);
      const asArray = (res) => (Array.isArray(res) ? res : (res?.data || []));
      setAllRisks(asArray(rRes));
      setAllIssues(asArray(iRes));
      setAllDependencies(asArray(dRes));
      setAllEscalations(asArray(eRes));
      setAllActions(asArray(aRes));
    } catch (err) {
      console.error("Failed to load module logs", err);
    } finally {
      setLoadingRisks(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedManager]);

  useAutoRefresh(loadData, 30000);

  useEffect(() => {
    fetchNearingTat({ limit: TAT_PAGE_SIZE, offset: (tatPage - 1) * TAT_PAGE_SIZE })
      .then((res) => {
        setTatRows(res?.rows || []);
        setTatTotalPages(res?.totalPages || 1);
      })
      .catch((err) => console.error("Failed to load nearing-TAT logs", err));
  }, [tatPage]);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    fetchGlobalSearch(searchQuery)
      .then((res) => setSearchResults(res?.rows || []))
      .catch((err) => {
        console.error("Global search failed", err);
        setSearchResults([]);
      })
      .finally(() => setSearchLoading(false));
  }, [searchQuery]);

  const pCounts = selectedModule && priorityByModule[selectedModule]
    ? priorityByModule[selectedModule]
    : { Critical: 0, High: 0, Medium: 0, Low: 0 };

  // Combine open logs across ALL modules — Priority Tracker and Aging
  // Tracker below are meant to reflect the whole portfolio, not just Risks.
  const isOpenStatus = (r) => {
    const s = String(r.status || r.current_status || "").toLowerCase();
    return s === "open" || s === "in progress" || s === "on hold" || s === "closure submitted";
  };

  const allModuleLogs = [
    ...allRisks.map((r) => normalizeLogRow(r, "Risk")),
    ...allIssues.map((r) => normalizeLogRow(r, "Issue")),
    ...allDependencies.map((r) => normalizeLogRow(r, "Dependency")),
    ...allEscalations.map((r) => normalizeLogRow(r, "Escalation")),
    ...allActions.map((r) => normalizeLogRow(r, "Action")),
  ];

  const openRisksList = allModuleLogs.filter(isOpenStatus);

  // Bucket every open log so Critical+High+Medium+Low+Unset === openCount
  const priorityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0, Unset: 0 };
  openRisksList.forEach((r) => {
    const p = String(r.priority || "").trim().toLowerCase();
    if (p.includes("critical")) priorityCounts.Critical++;
    else if (p.includes("high")) priorityCounts.High++;
    else if (p.includes("medium")) priorityCounts.Medium++;
    else if (p.includes("low")) priorityCounts.Low++;
    else priorityCounts.Unset++; // blank / N/A / unexpected values — never drop silently
  });

  const prioritySideRows = [
    { key: "Critical", label: "Critical", count: priorityCounts.Critical, dot: "bg-rose-800", wrap: "bg-rose-50 border-rose-100/80", text: "text-rose-800" },
    { key: "High", label: "High", count: priorityCounts.High, dot: "bg-red-500", wrap: "bg-red-50 border-red-100/80", text: "text-red-700" },
    { key: "Medium", label: "Medium", count: priorityCounts.Medium, dot: "bg-amber-500", wrap: "bg-amber-50 border-amber-100/80", text: "text-amber-700" },
    { key: "Low", label: "Low", count: priorityCounts.Low, dot: "bg-emerald-500", wrap: "bg-emerald-50 border-emerald-100/80", text: "text-emerald-700" },
    { key: "Unset", label: "Unset", count: priorityCounts.Unset, dot: "bg-slate-400", wrap: "bg-slate-50 border-slate-100/80", text: "text-slate-600" },
  ];

  const donutData = prioritySideRows
    .map(({ key, count }) => ({ priority: key, count }))
    .filter((d) => d.count > 0);

  // Calculate Aging Metrics
  const totalRisksCount = allModuleLogs.length;
  const openCount = openRisksList.length;
  const openPercentage = totalRisksCount > 0 ? Math.round((openCount / totalRisksCount) * 100) : 0;

  let overdueCount = 0;
  let dueTodayTomorrowCount = 0;
  let dueThisWeekCount = 0;
  let onTrackCount = 0;

  const today = new Date();
  today.setHours(0,0,0,0);

  openRisksList.forEach(r => {
    const dateStr = r.due_date;
    if (!dateStr) {
      onTrackCount++;
      return;
    }
    const targetDate = new Date(dateStr);
    targetDate.setHours(0,0,0,0);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      overdueCount++;
    } else if (diffDays === 0 || diffDays === 1) {
      dueTodayTomorrowCount++;
    } else if (diffDays >= 2 && diffDays <= 7) {
      dueThisWeekCount++;
    } else {
      onTrackCount++;
    }
  });

  const agingBarTotal = overdueCount + dueTodayTomorrowCount + dueThisWeekCount + onTrackCount || openCount;

  const handleAgingFilterClick = (bucket) => {
    setAgingFilter((prev) => (prev === bucket ? "" : bucket));
    setTatPage(1);
  };

  /* ── Aging Overview drill-down ──────────────────────────────────────────
     Clicking a bucket (bar segment or legend entry) opens a popup listing the
     logs in it; clicking one of those logs jumps to that module's own page,
     pre-searched on the log's ID. ── */
  const MODULE_ROUTES = {
    Risk: "/monitoring/risks",
    Issue: "/monitoring/issues",
    Dependency: "/monitoring/dependencies",
    Escalation: "/monitoring/escalations",
    Action: "/monitoring/actions",
  };

  const goToModuleRecord = (row) => {
    const route = MODULE_ROUTES[row?.module];
    if (!route) return;
    navigate(`${route}?search=${encodeURIComponent(row.item_id || "")}`);
  };

  const filteredAgingTrackerRows = agingFilter
    ? openRisksList.filter((r) => matchesAgingFilter(r, agingConfig, agingFilter))
    : tatRows;

  const displayedAgingRows = agingFilter
    ? filteredAgingTrackerRows.slice((tatPage - 1) * TAT_PAGE_SIZE, tatPage * TAT_PAGE_SIZE)
    : tatRows;
  const displayedAgingTotalPages = agingFilter
    ? Math.max(1, Math.ceil(filteredAgingTrackerRows.length / TAT_PAGE_SIZE))
    : tatTotalPages;

  const handleExportAging = async () => {
    try {
      const res = await fetchNearingTat({ limit: 1000, offset: 0 });
      const allTatRows = res?.rows || [];
      if (!allTatRows.length) return;
      const exportRows = allTatRows.map(r => ({
        "Module": r.module,
        "ID": r.item_id,
        "Customer": r.account || "N/A",
        "Project": r.manual_project_id || "N/A",
        "Owner": r.owner || "N/A",
        "Priority": r.priority || "N/A",
        "Due Date": r.due_date ? String(r.due_date).slice(0, 10) : "N/A",
        "Current Status": r.status || "Open",
        "Latest Update": r.updated_at ? String(r.updated_at).slice(0, 10) : "N/A",
      }));

      exportToExcel({
        filename: `Aging_Tracker_${new Date().toISOString().slice(0,10)}`,
        sheetName: "Aging Tracker",
        rows: exportRows
      });
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    } catch (err) {
      console.error("Failed to export aging tracker", err);
    }
  };

  if (!kpis) return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-6 h-6 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div
      className="font-urbanist relative overflow-y-auto bg-slate-50/50"
      style={{
        margin: "-16px -8px",
        minHeight: "calc(100dvh - 76px)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "12px",
      }}
    >
      {toast && (
        <div className="fixed top-4 right-1/2 translate-x-1/2 z-50 rounded-md bg-green-600 px-4 py-2 text-xs font-bold text-white shadow-xl animate-bounce">
          ✅ Exported Aging Logs Successfully
        </div>
      )}

      {contentReady && (
      searchQuery ? (
        <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
            <h3 className="text-sm font-black text-gray-900 tracking-tight">
              Search results for "{searchQuery}"
            </h3>
            <span className="text-[11px] text-gray-500 font-semibold">
              {searchLoading ? "Searching..." : `${searchResults.length} results`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Module</th>
                  <th className="p-2.5">Project ID</th>
                  <th className="p-2.5">Account</th>
                  <th className="p-2.5">Description</th>
                  <th className="p-2.5">Title</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Owner</th>
                  <th className="p-2.5">Created By</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((row, idx) => (
                  <tr key={`${row.module}-${row.id || idx}`} className="border-b border-gray-100 hover:bg-indigo-50/50 transition-colors">
                    <td className="p-2.5 font-bold text-gray-500 uppercase text-[10px]">{row.module}</td>
                    <td className="p-2.5 text-indigo-700 font-bold">{row.project_id || "—"}</td>
                    <td className="p-2.5 text-gray-800">{row.account || "—"}</td>
                    <td className="p-2.5 text-gray-600 max-w-xs truncate">{row.description || "—"}</td>
                    <td className="p-2.5 text-gray-800 font-medium max-w-xs truncate">{row.title || "—"}</td>
                    <td className="p-2.5 text-gray-700">{row.status || "—"}</td>
                    <td className="p-2.5 text-gray-600">{row.owner || "—"}</td>
                    <td className="p-2.5 text-gray-600">{row.created_by || "—"}</td>
                  </tr>
                ))}
                {!searchLoading && searchResults.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-400 italic">
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* ── Executive KPI Cards Grid Row ── */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch">
            {/* KPI Card 1: OPEN */}
            <motion.div
              onClick={() => navigate("/monitoring/command-center?status=Open")}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
              whileHover={{ y: -2 }}
              className="bg-red-50/20 rounded-2xl border border-gray-200 border-l-4 border-l-red-500 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-red-600 font-extrabold">
                  OPEN
                </span>
                <div className="w-9 h-9 rounded-xl bg-red-100/50 text-red-600 flex items-center justify-center border border-red-200 shrink-0">
                  <ShieldWarning size={18} weight="bold" />
                </div>
              </div>
              <div className="my-2">
                <h3 className="text-3xl font-extrabold text-red-600 tracking-tight">
                  <AnimatedCounter value={kpis.totalOpen} delay={0.4} />
                </h3>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  {kpis.totalOpen === 1 ? "1 Active Governance Log" : `${kpis.totalOpen} Active Governance Logs`}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-1.5 w-full px-1">
                {(moduleStatus || []).map(m => {
                  const openVal = Number(m.Open) || 0;
                  return (
                    <div key={m.module} className="flex flex-col items-center justify-center">
                      <span className="text-[7px] uppercase tracking-wider text-slate-400 font-extrabold">{m.module === 'Dependency' ? 'DEP' : m.module === 'Escalation' ? 'ESC' : m.module === 'Action' ? 'ACT' : m.module === 'Issue' ? 'ISS' : 'RSK'}</span>
                      <span className="text-red-600 font-black text-[10px] leading-tight">{openVal}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* KPI Card 2: CLOSURE SUBMITTED */}
            <motion.div
              onClick={() => navigate("/monitoring/command-center?status=Closure Submitted")}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
              whileHover={{ y: -2 }}
              className="bg-blue-50/20 rounded-2xl border border-gray-200 border-l-4 border-l-blue-500 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 font-extrabold">
                  CLOSURE SUBMITTED
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-100/50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0">
                  <Clock size={18} weight="bold" />
                </div>
              </div>
              <div className="my-2">
                <h3 className="text-3xl font-extrabold text-blue-600 tracking-tight">
                  <AnimatedCounter value={kpis.totalSubmitted} delay={0.45} />
                </h3>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  {kpis.totalSubmitted === 1 ? "1 Submitted Log" : `${kpis.totalSubmitted} Submitted Logs`}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-1.5 w-full px-1">
                {(moduleStatus || []).map(m => {
                  const subVal = Number(m.ClosureSubmitted) || 0;
                  return (
                    <div key={m.module} className="flex flex-col items-center justify-center">
                      <span className="text-[7px] uppercase tracking-wider text-slate-400 font-extrabold">{m.module === 'Dependency' ? 'DEP' : m.module === 'Escalation' ? 'ESC' : m.module === 'Action' ? 'ACT' : m.module === 'Issue' ? 'ISS' : 'RSK'}</span>
                      <span className="text-blue-600 font-black text-[10px] leading-tight">{subVal}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* KPI Card 3: CLOSED & ACKNOWLEDGED */}
            <motion.div
              onClick={() => navigate("/monitoring/command-center?status=Closed")}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}
              whileHover={{ y: -2 }}
              className="bg-emerald-50/20 rounded-2xl border border-gray-200 border-l-4 border-l-emerald-500 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 font-extrabold">
                  CLOSED & ACK.
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-100/50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                  <CheckCircle size={18} weight="bold" />
                </div>
              </div>
              <div className="my-2">
                <h3 className="text-3xl font-extrabold text-emerald-600 tracking-tight">
                  <AnimatedCounter value={kpis.totalClosed} delay={0.5} />
                </h3>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  {kpis.totalClosed === 1 ? "1 Closed Log" : `${kpis.totalClosed} Closed Logs`}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-1.5 w-full px-1">
                {(moduleStatus || []).map(m => {
                  const closedVal = Number(m.ClosedAcknowledged) || Number(m.Resolved) || 0;
                  return (
                    <div key={m.module} className="flex flex-col items-center justify-center">
                      <span className="text-[7px] uppercase tracking-wider text-slate-400 font-extrabold">{m.module === 'Dependency' ? 'DEP' : m.module === 'Escalation' ? 'ESC' : m.module === 'Action' ? 'ACT' : m.module === 'Issue' ? 'ISS' : 'RSK'}</span>
                      <span className="text-emerald-600 font-black text-[10px] leading-tight">{closedVal}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* KPI Card 4: HOLD */}
            <motion.div
              onClick={() => navigate("/monitoring/command-center?status=Hold")}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}
              whileHover={{ y: -2 }}
              className="bg-amber-50/20 rounded-2xl border border-gray-200 border-l-4 border-l-amber-500 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 font-extrabold">
                  HOLD
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-100/50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                  <PauseCircle size={18} weight="bold" />
                </div>
              </div>
              <div className="my-2">
                <h3 className="text-3xl font-extrabold text-amber-600 tracking-tight">
                  <AnimatedCounter value={kpis.totalHold} delay={0.55} />
                </h3>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  {kpis.totalHold === 1 ? "1 Log on Hold" : `${kpis.totalHold} Logs on Hold`}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-1.5 w-full px-1">
                {(moduleStatus || []).map(m => {
                  const holdVal = Number(m.Hold) || Number(m["On Hold"]) || 0;
                  return (
                    <div key={m.module} className="flex flex-col items-center justify-center">
                      <span className="text-[7px] uppercase tracking-wider text-slate-400 font-extrabold">{m.module === 'Dependency' ? 'DEP' : m.module === 'Escalation' ? 'ESC' : m.module === 'Action' ? 'ACT' : m.module === 'Issue' ? 'ISS' : 'RSK'}</span>
                      <span className="text-amber-600 font-black text-[10px] leading-tight">{holdVal}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* ── Top Dashboard Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Merged Card: Priority Tracker — Across Your Open Logs */}
            <Card title="Priority Tracker — Across Your Open Logs" delay={0.2} className="h-72 lg:col-span-2">
              <div className="flex flex-col md:flex-row h-full items-center justify-between gap-4 p-1">
                {/* Left Side: Live Donut & Dynamic Counts */}
                <div className="w-full md:w-1/2 flex flex-col h-full justify-between border-b md:border-b-0 md:border-r border-gray-100 pr-0 md:pr-3 pb-2 md:pb-0">
                  <div className="flex items-center justify-between min-h-[10.5rem] gap-2">
                    <div className="w-1/2 h-36 relative flex items-center justify-center min-w-0 self-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={donutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={26}
                            outerRadius={42}
                            paddingAngle={2}
                            dataKey="count"
                            nameKey="priority"
                            stroke="none"
                          >
                            {donutData.map((e, idx) => (
                              <Cell key={idx} fill={DONUT_COLORS[e.priority] || "#3B82F6"} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-base font-extrabold text-gray-900 leading-none">{openCount}</span>
                        <span className="text-[7px] text-gray-400 font-bold uppercase mt-0.5">Open</span>
                      </div>
                    </div>

                    <div className="w-1/2 flex flex-col gap-0.5 pl-1 justify-center min-w-0">
                      {prioritySideRows.map((row) => (
                        <div
                          key={row.key}
                          className={`flex items-center justify-between px-2 py-0.5 rounded-md border ${row.wrap}`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${row.dot}`} />
                            <span className={`text-[10px] font-bold truncate ${row.text}`}>{row.label}</span>
                          </div>
                          <span className={`text-xs font-black ml-1 shrink-0 ${row.text}`}>{row.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-400 text-center italic font-semibold pt-1 border-t border-gray-100/60 truncate">
                    Critical + High + Medium + Low + Unset = {openCount} open
                  </div>
                </div>

                {/* Right Side: Priority Breakdown by Selected Module */}
                <div className="w-full md:w-1/2 flex flex-col h-full justify-between">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold text-gray-500 uppercase">Module Breakdown:</span>
                    <select
                      value={selectedModule}
                      onChange={e => setSelectedModule(e.target.value)}
                      className="text-[9px] font-bold border border-gray-200 rounded-md px-1.5 py-0.5 bg-gray-50 outline-none cursor-pointer hover:border-gray-400 transition"
                    >
                      {["Action","Dependency","Issue","Risk","Escalation"].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 h-[calc(100%-30px)]">
                    {PRI_CONFIG.map((p, i) => (
                      <motion.div
                        key={p.key}
                        className="rounded-lg p-1.5 flex flex-col items-center justify-center"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.4 + (i * 0.08) }}
                        style={{ background: p.light, border: `1px solid ${p.color}22` }}
                      >
                        <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: p.color }}>{p.key}</span>
                        <span className="text-xl font-black" style={{ color: p.color }}>
                          <AnimatedCounter value={pCounts[p.key] ?? 0} delay={0.6 + (i * 0.08)} />
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Card 2: Customer Appreciation */}
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.4, ease: "easeOut" }}
              className="h-64 lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col"
            >
              {/* Title */}
              <div className="px-4 pt-4 pb-2 flex-shrink-0">
                <h3 className="text-base font-bold text-gray-900">Customer Appreciation</h3>
              </div>

              {/* Body */}
              <div className="flex-1 min-h-0 px-2 pb-1 relative flex items-center">
                {/* Left Arrow */}
                <button
                  type="button"
                  onClick={() => setCurrentAppSlide(i => Math.max(0, i - 1))}
                  className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                >
                  ‹
                </button>

                {appreciations.length > 0 ? (() => {
                  const item = appreciations[currentAppSlide] || {};
                  const team = item.team_members_recognized || "—";
                  const displayName = team !== "—"
                    ? team.split(/[,;]/)[0].trim()
                    : (item.recorded_by || "Team Member");
                  const account = item.account || item.customer_name || "—";
                  const project = item.project_description || item.manual_project_id || "";
                  const photoUrl = getAppreciationPhotoUrl(item);
                  const initials = getInitials(team !== "—" ? team : item.recorded_by);
                  const quote = item.subject || item.details || "";
                  const dateStr = item.received_date || item.created_at;

                  return (
                    <motion.button
                      key={currentAppSlide}
                      type="button"
                      onClick={() => setDetailRow(item)}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="flex-1 px-1 flex flex-col items-center min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-rose-400 rounded-lg"
                    >
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={displayName}
                          className="shrink-0 w-14 h-14 rounded-full object-cover border-4 border-white shadow-md"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      ) : (
                        <div className="shrink-0 w-14 h-14 rounded-full bg-rose-400 text-white font-black text-sm flex items-center justify-center shadow-md">
                          {initials}
                        </div>
                      )}

                      <div className="flex items-center gap-0.5 mt-1.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={11} weight="fill" className="text-rose-400" />
                        ))}
                      </div>

                      <p className="font-black text-[12px] text-gray-900 leading-snug text-center mt-1 truncate max-w-full" title={displayName}>
                        {displayName}
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold text-center truncate max-w-full">
                        {account}{project ? ` · ${project}` : ""}
                      </p>
                      {dateStr && (
                        <p className="text-[9px] text-gray-300 font-bold uppercase tracking-wider mt-0.5">
                          {formatDateOnly(dateStr)}
                        </p>
                      )}
                      {quote && (
                        <div className="mt-2 w-full rounded-lg bg-rose-50 px-2.5 py-1.5 text-center">
                          <p className="text-[10px] text-gray-700 leading-snug line-clamp-2">{quote}</p>
                        </div>
                      )}
                    </motion.button>
                  );
                })() : (
                  <div className="flex-1 flex items-center justify-center text-gray-300 text-xs font-semibold">
                    No Appreciations Yet
                  </div>
                )}

                {/* Right Arrow */}
                <button
                  type="button"
                  onClick={() => setCurrentAppSlide(i => Math.min(appreciations.length - 1, i + 1))}
                  className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                >
                  ›
                </button>
              </div>

              {/* View More */}
              <div className="border-t border-gray-100 py-2.5 text-center flex-shrink-0">
                <button
                  type="button"
                  onClick={() => navigate("/monitoring/appreciations")}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors"
                >
                  View More
                </button>
              </div>
            </motion.div>
          </div>

          {detailRow && (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setDetailRow(null)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-rose-50/60 shrink-0">
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">
                      Appreciation Details
                    </h3>
                    <p className="text-[11px] text-rose-700 font-bold mt-0.5">
                      {detailRow.appreciation_id || "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailRow(null)}
                    className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 text-lg font-bold leading-none"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <div className="overflow-y-auto px-5 py-4 space-y-4">
                  {(detailRow.image_url || detailRow.attachment_url) && (
                    <div className="rounded-xl border border-rose-100 overflow-hidden bg-rose-50/30">
                      {getAppreciationPhotoUrl(detailRow) ? (
                        <img
                          src={getAppreciationPhotoUrl(detailRow)}
                          alt="Appreciation photo"
                          className="w-full max-h-64 object-contain bg-white"
                        />
                      ) : (
                        <a
                          href={resolveUploadUrl(detailRow.attachment_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="block px-4 py-3 text-sm font-bold text-rose-700 hover:underline"
                        >
                          📎 View attachment
                        </a>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: "Appreciation ID", value: detailRow.appreciation_id },
                      { label: "Scope", value: detailRow.appreciation_scope || "Internal Appreciation" },
                      { label: "Account / Customer", value: detailRow.account || detailRow.customer_name },
                      { label: "Customer Contact", value: detailRow.customer_contact },
                      { label: "Project ID", value: detailRow.manual_project_id },
                      { label: "Project Description", value: detailRow.project_description },
                      { label: "Project Manager", value: detailRow.project_manager },
                      { label: "Program Manager", value: detailRow.program_manager },
                      { label: "Behalf Of", value: detailRow.behalf_of },
                      { label: "Appreciation Type", value: detailRow.appreciation_type },
                      { label: "Received Date", value: formatDateOnly(detailRow.received_date) },
                      { label: "Recorded By", value: detailRow.recorded_by },
                      { label: "Team Recognized", value: detailRow.team_members_recognized },
                      { label: "Follow-up Action", value: detailRow.follow_up_action },
                      { label: "Subject", value: detailRow.subject },
                    ].map((field) => (
                      <div
                        key={field.label}
                        className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5"
                      >
                        <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                          {field.label}
                        </span>
                        <span className="text-sm font-semibold text-gray-800 break-words whitespace-pre-wrap">
                          {field.value || "—"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-rose-100 bg-rose-50/40 px-4 py-3">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-rose-500 mb-2">
                      Details
                    </span>
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words font-medium">
                      {detailRow.details || "—"}
                    </p>
                  </div>

                  {detailRow.comments && (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">
                        Comments
                      </span>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                        {detailRow.comments}
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDetailRow(null)}
                    className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold uppercase tracking-wide hover:bg-gray-800 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Aging Overview Widget (Matching Reference UI) ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 flex flex-col gap-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight">Aging Overview</h3>
              <p className="text-xs sm:text-sm font-semibold text-gray-600">
                <span className="text-indigo-600 font-black text-sm sm:text-base">{openPercentage}%</span> of Risks are currently Open
              </p>
            </div>

            {/* Segmented Progress Pill Bar with Smooth Animations & Inner Numbers */}
            <div className="w-full h-5 rounded-full bg-gray-100 overflow-hidden flex shadow-inner p-0.5">
              {agingBarTotal > 0 ? (
                <>
                  {overdueCount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(overdueCount / agingBarTotal) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                      className={`bg-[#FF5252] h-full rounded-l-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden cursor-pointer hover:opacity-90 ${agingFilter === AGING_BUCKETS.OVERDUE ? "ring-2 ring-rose-300 ring-offset-1" : ""}`}
                      title={`Overdue: ${overdueCount}`}
                      onClick={() => handleAgingFilterClick(AGING_BUCKETS.OVERDUE)}
                    >
                      {overdueCount}
                    </motion.div>
                  )}
                  {dueTodayTomorrowCount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(dueTodayTomorrowCount / agingBarTotal) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.35 }}
                      className={`bg-[#FFA726] h-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden cursor-pointer hover:opacity-90 ${agingFilter === AGING_BUCKETS.DUE_TODAY_TOMORROW ? "ring-2 ring-amber-300 ring-offset-1" : ""}`}
                      title={`Due Today / Tomorrow: ${dueTodayTomorrowCount}`}
                      onClick={() => handleAgingFilterClick(AGING_BUCKETS.DUE_TODAY_TOMORROW)}
                    >
                      {dueTodayTomorrowCount}
                    </motion.div>
                  )}
                  {dueThisWeekCount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(dueThisWeekCount / agingBarTotal) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                      className={`bg-[#42A5F5] h-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden cursor-pointer hover:opacity-90 ${agingFilter === AGING_BUCKETS.DUE_THIS_WEEK ? "ring-2 ring-sky-300 ring-offset-1" : ""}`}
                      title={`Due This Week: ${dueThisWeekCount}`}
                      onClick={() => handleAgingFilterClick(AGING_BUCKETS.DUE_THIS_WEEK)}
                    >
                      {dueThisWeekCount}
                    </motion.div>
                  )}
                  {onTrackCount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(onTrackCount / agingBarTotal) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.65 }}
                      className={`bg-[#26A69A] h-full rounded-r-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden cursor-pointer hover:opacity-90 ${agingFilter === AGING_BUCKETS.ON_TRACK ? "ring-2 ring-emerald-300 ring-offset-1" : ""}`}
                      title={`On Track: ${onTrackCount}`}
                      onClick={() => handleAgingFilterClick(AGING_BUCKETS.ON_TRACK)}
                    >
                      {onTrackCount}
                    </motion.div>
                  )}
                </>
              ) : (
                <div className="w-full h-full rounded-full bg-[#26A69A] flex items-center justify-center text-[10px] font-black text-white">
                  100% On Track
                </div>
              )}
            </div>

            {/* Legend Line matching exact screenshot text format */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-gray-700 pt-0.5">
              <div
                className={`flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${!agingFilter ? "bg-gray-100 ring-1 ring-gray-300" : "hover:bg-gray-50"}`}
                onClick={() => setAgingFilter("")}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-gray-500 shrink-0" />
                <span>All ({overdueCount + dueTodayTomorrowCount + dueThisWeekCount + onTrackCount})</span>
              </div>
              <div
                className={`flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${agingFilter === AGING_BUCKETS.OVERDUE ? "bg-rose-50 ring-1 ring-rose-200" : "hover:bg-gray-50"}`}
                onClick={() => handleAgingFilterClick(AGING_BUCKETS.OVERDUE)}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5252] shrink-0" />
                <span>Overdue ({overdueCount})</span>
              </div>
              <div
                className={`flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${agingFilter === AGING_BUCKETS.DUE_TODAY_TOMORROW ? "bg-amber-50 ring-1 ring-amber-200" : "hover:bg-gray-50"}`}
                onClick={() => handleAgingFilterClick(AGING_BUCKETS.DUE_TODAY_TOMORROW)}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFA726] shrink-0" />
                <span>Due Today/Tomorrow ({dueTodayTomorrowCount})</span>
              </div>
              <div
                className={`flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${agingFilter === AGING_BUCKETS.DUE_THIS_WEEK ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-gray-50"}`}
                onClick={() => handleAgingFilterClick(AGING_BUCKETS.DUE_THIS_WEEK)}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#42A5F5] shrink-0" />
                <span>Due This Week ({dueThisWeekCount})</span>
              </div>
              <div
                className={`flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${agingFilter === AGING_BUCKETS.ON_TRACK ? "bg-emerald-50 ring-1 ring-emerald-200" : "hover:bg-gray-50"}`}
                onClick={() => handleAgingFilterClick(AGING_BUCKETS.ON_TRACK)}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#26A69A] shrink-0" />
                <span>On Track ({onTrackCount})</span>
              </div>
            </div>
          </motion.div>

          {/* ── NEW: Aging Tracker Widget with Vertical Slider Animation ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="w-full bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div>
                <h3 className="text-sm font-black text-gray-900 tracking-tight">Aging Tracker</h3>
                <p className="text-[11px] text-amber-600 font-bold uppercase tracking-wider">Logs Nearing TAT</p>
              </div>
              <button
                type="button"
                onClick={handleExportAging}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold transition shadow-sm"
              >
                <DownloadSimple size={16} weight="bold" />
                Export to Excel
              </button>
            </div>

            {/* Vertical Slider Animation Container */}
            <div className="relative overflow-hidden h-64 border border-gray-100 rounded-lg bg-gray-50/50 group">
              <div className="w-full h-full overflow-y-auto pr-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 sticky top-0 z-10 text-gray-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">ID</th>
                      <th className="p-2.5">Module</th>
                      <th className="p-2.5">Customer / Account</th>
                      <th className="p-2.5">Owner</th>
                      <th className="p-2.5">Priority</th>
                      <th className="p-2.5">Due Date</th>
                      <th className="p-2.5">Current Status</th>
                      <th className="p-2.5">Latest Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedAgingRows.map((row, idx) => {
                      const pri = String(row.priority || "").toLowerCase();
                      const isHigh = pri.includes("high") || pri.includes("critical");
                      return (
                        <motion.tr
                          key={row.id || idx}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.04 }}
                          className="border-b border-gray-200/60 hover:bg-indigo-50/50 transition-colors"
                        >
                          <td className="p-2.5 font-bold text-indigo-700">
                            <button
                              type="button"
                              onClick={() => goToModuleRecord(row)}
                              title={`Open this ${String(row.module || "log").toLowerCase()} in its own page`}
                              className="hover:underline focus:outline-none focus:underline"
                            >
                              {row.item_id}
                            </button>
                          </td>
                          <td className="p-2.5 font-bold text-gray-500 uppercase text-[10px]">{row.module}</td>
                          <td className="p-2.5 font-medium text-gray-800">{row.account || "—"}</td>
                          <td className="p-2.5 text-gray-600">{row.owner || "—"}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              isHigh ? "bg-red-100 text-red-700 border border-red-200" : "bg-amber-100 text-amber-700 border border-amber-200"
                            }`}>
                              {row.priority || "Medium"}
                            </span>
                          </td>
                          <td className="p-2.5 font-bold text-gray-900">
                            {row.due_date ? String(row.due_date).slice(0, 10) : "—"}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-bold border border-gray-200">
                              {row.status || "Open"}
                            </span>
                          </td>
                          <td className="p-2.5 text-gray-500 text-[11px] max-w-xs truncate">
                            {row.updated_at ? String(row.updated_at).slice(0,10) : "—"}
                          </td>
                        </motion.tr>
                      );
                    })}
                    {displayedAgingRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-gray-400 italic">
                          {agingFilter ? "No records match this aging filter." : "No logs currently nearing target date."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-gray-500 font-semibold">
                Page {tatPage} of {displayedAgingTotalPages}
                {agingFilter ? ` · Filtered: ${agingFilter}` : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={tatPage <= 1}
                  onClick={() => setTatPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={tatPage >= displayedAgingTotalPages}
                  onClick={() => setTatPage(p => Math.min(displayedAgingTotalPages, p + 1))}
                  className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  Next
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )
      )}

    </div>
  );
};

export default MonitoringDashboardPage;
