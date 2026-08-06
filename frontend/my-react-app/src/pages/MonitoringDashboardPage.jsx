import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { fetchDashboardMetrics, fetchNearingTat } from "../api/metricsApi";
import { fetchGlobalSearch } from "../api/searchApi";
import { fetchRisks } from "../api/risksApi";
import { fetchAppreciations } from "../api/appreciationsApi";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from "recharts";
import { useFilter } from "../context/FilterContext";
import { useSidebar } from "../context/SidebarContext";
import StackedColumnChart from "../components/StackedColumnChart";
import { DownloadSimple, Clock, ArrowClockwise, TrendUp, ShieldWarning, CheckCircle, PauseCircle, FileText } from "phosphor-react";
import { exportToExcel } from "../utils/exportToExcel";

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

const DONUT_COLORS = { High: "#EF4444", Medium: "#F59E0B", Low: "#10B981", Critical: "#991B1B" };

const API_HOST = process.env.REACT_APP_API_URL || "http://localhost:5000";
const toFileUrl = (path) => (path ? `${API_HOST}/${path}` : null);

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
  const [previewImage, setPreviewImage] = useState(null);
  const [tatRows, setTatRows] = useState([]);
  const [tatPage, setTatPage] = useState(1);
  const [tatTotalPages, setTatTotalPages] = useState(1);
  const TAT_PAGE_SIZE = 5;
  const [allRisks, setAllRisks] = useState([]);
  const [loadingRisks, setLoadingRisks] = useState(true);
  const [toast, setToast] = useState(false);

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
      const rRes = await fetchRisks({ manager: selectedManager });
      const rData = Array.isArray(rRes) ? rRes : (rRes?.data || []);
      setAllRisks(rData);
    } catch (err) {
      console.error("Failed to load risks", err);
    } finally {
      setLoadingRisks(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedManager]);

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

  // Calculate live Priority counts across ALL open risks
  const openRisksList = allRisks.filter(r => {
    const s = String(r.status || r.current_status || "").toLowerCase();
    return s === "open" || s === "in progress" || s === "on hold" || s === "closure submitted";
  });

  const priorityCounts = { High: 0, Medium: 0, Low: 0, Critical: 0 };
  openRisksList.forEach(r => {
    const p = String(r.priority || "").trim();
    if (p.includes("High")) priorityCounts.High++;
    else if (p.includes("Medium")) priorityCounts.Medium++;
    else if (p.includes("Low")) priorityCounts.Low++;
    else if (p.includes("Critical")) priorityCounts.Critical++;
  });

  const donutData = [
    { priority: "High", count: priorityCounts.High },
    { priority: "Medium", count: priorityCounts.Medium },
    { priority: "Low", count: priorityCounts.Low },
  ].filter(d => d.count >= 0);

  // Calculate Aging Metrics
  const totalRisksCount = allRisks.length;
  const openCount = openRisksList.length;
  const openPercentage = totalRisksCount > 0 ? Math.round((openCount / totalRisksCount) * 100) : 0;

  let overdueCount = 0;
  let dueTodayTomorrowCount = 0;
  let dueThisWeekCount = 0;
  let onTrackCount = 0;

  const today = new Date();
  today.setHours(0,0,0,0);

  openRisksList.forEach(r => {
    const dateStr = r.target_mitigation_date || r.planned_closure_date || r.identified_date;
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
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-stretch">
            {/* Command Center Launcher Card */}
            <motion.div
              onClick={() => navigate("/monitoring/command-center")}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
              whileHover={{ y: -2 }}
              className="bg-white rounded-2xl border border-gray-200 border-l-4 border-l-indigo-600 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                  HUB
                </span>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                  <TrendUp size={18} weight="bold" />
                </div>
              </div>
              <div className="my-2">
                <h3 className="text-base font-extrabold text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors">Command Center</h3>
                <p className="text-[11px] font-bold text-gray-400 mt-0.5">
                  {selectedManager ? `Filtered: ${selectedManager}` : "All Enterprise Managers"}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[10px] font-extrabold text-indigo-600 group-hover:text-indigo-800">
                <span>Click to explore</span>
                <span>→</span>
              </div>
            </motion.div>

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
            <Card title="Priority Tracker — Across Your Open Logs" delay={0.2} className="h-64 lg:col-span-2">
              <div className="flex flex-col md:flex-row h-full items-center justify-between gap-4 p-1">
                {/* Left Side: Live Donut & Dynamic Counts */}
                <div className="w-full md:w-1/2 flex flex-col h-full justify-between border-b md:border-b-0 md:border-r border-gray-100 pr-0 md:pr-3 pb-2 md:pb-0">
                  <div className="flex items-center justify-between h-36 gap-2">
                    <div className="w-1/2 h-full relative flex items-center justify-center min-w-0">
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

                    <div className="w-1/2 flex flex-col gap-1 pl-1 justify-center min-w-0">
                      <div className="flex items-center justify-between px-2 py-1 rounded-md bg-red-50 border border-red-100/80">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          <span className="text-[10px] font-bold text-red-700 truncate">High</span>
                        </div>
                        <span className="text-xs font-black text-red-700 ml-1 shrink-0">{priorityCounts.High}</span>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1 rounded-md bg-amber-50 border border-amber-100/80">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span className="text-[10px] font-bold text-amber-700 truncate">Medium</span>
                        </div>
                        <span className="text-xs font-black text-amber-700 ml-1 shrink-0">{priorityCounts.Medium}</span>
                      </div>
                      <div className="flex items-center justify-between px-2 py-1 rounded-md bg-emerald-50 border border-emerald-100/80">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-[10px] font-bold text-emerald-700 truncate">Low</span>
                        </div>
                        <span className="text-xs font-black text-emerald-700 ml-1 shrink-0">{priorityCounts.Low}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-400 text-center italic font-semibold pt-1 border-t border-gray-100/60 truncate">
                    Live dynamic counts from all Open Logs
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
                  onClick={() => setCurrentAppSlide(i => Math.max(0, i - 1))}
                  className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                >
                  ‹
                </button>

                {appreciations.length > 0 ? (
                  <motion.div
                    key={currentAppSlide}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="flex-1 px-1 flex gap-2 items-start min-w-0"
                  >
                    {appreciations[currentAppSlide]?.image_url ? (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(toFileUrl(appreciations[currentAppSlide].image_url))}
                        className="shrink-0 w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden"
                        title="Click to preview"
                      >
                        <img
                          src={toFileUrl(appreciations[currentAppSlide].image_url)}
                          alt="Appreciation attachment"
                          style={{ objectFit: "contain", width: "100%", height: "100%" }}
                        />
                      </button>
                    ) : appreciations[currentAppSlide]?.attachment_url ? (
                      <a
                        href={toFileUrl(appreciations[currentAppSlide].attachment_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                        title="Open attachment"
                      >
                        <FileText size={28} weight="duotone" />
                      </a>
                    ) : null}

                    <div className="min-w-0 flex-1">
                      {/* Medal + Title row */}
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-lg leading-none shrink-0">🥇</span>
                        <p className="font-bold text-[12px] text-gray-900 leading-snug line-clamp-2">
                          {appreciations[currentAppSlide]?.appreciation_type || "Spot Award"} to {appreciations[currentAppSlide]?.appreciated_to || appreciations[currentAppSlide]?.team_members_recognized || "Team Member"}
                        </p>
                      </div>

                      {/* by X for "Y" on Date */}
                      <p className="text-[11px] text-gray-500 leading-snug line-clamp-3">
                        <span className="text-gray-400">by </span>
                        <span className="text-gray-700 font-semibold">{appreciations[currentAppSlide]?.appreciated_by || appreciations[currentAppSlide]?.customer_name || appreciations[currentAppSlide]?.account || "Client"}</span>
                        {(appreciations[currentAppSlide]?.description || appreciations[currentAppSlide]?.subject || appreciations[currentAppSlide]?.details) && (
                          <span> for <span className="text-indigo-600">"{appreciations[currentAppSlide]?.description || appreciations[currentAppSlide]?.subject || appreciations[currentAppSlide]?.details}"</span></span>
                        )}
                        {(appreciations[currentAppSlide]?.created_date || appreciations[currentAppSlide]?.received_date) && (
                          <span className="text-gray-500"> on {new Date(appreciations[currentAppSlide].created_date || appreciations[currentAppSlide].received_date).toDateString()}</span>
                        )}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-300 text-xs font-semibold">
                    No Appreciations Yet
                  </div>
                )}

                {/* Right Arrow */}
                <button
                  onClick={() => setCurrentAppSlide(i => Math.min(appreciations.length - 1, i + 1))}
                  className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                >
                  ›
                </button>
              </div>

              {/* View More */}
              <div className="border-t border-gray-100 py-2.5 text-center flex-shrink-0">
                <button
                  onClick={() => navigate("/monitoring/appreciations")}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors"
                >
                  View More
                </button>
              </div>
            </motion.div>
          </div>

          {previewImage && (
            <div
              className="fixed inset-0 z-[999] bg-black/70 flex items-center justify-center p-6 cursor-zoom-out"
              onClick={() => setPreviewImage(null)}
            >
              <img
                src={previewImage}
                alt="Appreciation attachment preview"
                style={{ objectFit: "contain", maxWidth: "90vw", maxHeight: "90vh" }}
              />
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
              {openCount > 0 ? (
                <>
                  {overdueCount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(overdueCount / openCount) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                      className="bg-[#FF5252] h-full rounded-l-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden"
                      title={`Overdue: ${overdueCount}`}
                    >
                      {overdueCount}
                    </motion.div>
                  )}
                  {dueTodayTomorrowCount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(dueTodayTomorrowCount / openCount) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.35 }}
                      className="bg-[#FFA726] h-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden"
                      title={`Due Today / Tomorrow: ${dueTodayTomorrowCount}`}
                    >
                      {dueTodayTomorrowCount}
                    </motion.div>
                  )}
                  {dueThisWeekCount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(dueThisWeekCount / openCount) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                      className="bg-[#42A5F5] h-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden"
                      title={`Due This Week: ${dueThisWeekCount}`}
                    >
                      {dueThisWeekCount}
                    </motion.div>
                  )}
                  {onTrackCount > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(onTrackCount / openCount) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.65 }}
                      className="bg-[#26A69A] h-full rounded-r-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden"
                      title={`On Track: ${onTrackCount}`}
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
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5252] shrink-0" />
                <span>Overdue ({overdueCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFA726] shrink-0" />
                <span>Due Today/Tomorrow ({dueTodayTomorrowCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#42A5F5] shrink-0" />
                <span>Due This Week ({dueThisWeekCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
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
                      <th className="p-2.5">Module</th>
                      <th className="p-2.5">ID</th>
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5">Project</th>
                      <th className="p-2.5">Owner</th>
                      <th className="p-2.5">Priority</th>
                      <th className="p-2.5">Due Date</th>
                      <th className="p-2.5">Current Status</th>
                      <th className="p-2.5">Latest Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tatRows.map((row, idx) => {
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
                          <td className="p-2.5 font-bold text-gray-500 uppercase text-[10px]">{row.module}</td>
                          <td className="p-2.5 font-bold text-indigo-700">{row.item_id}</td>
                          <td className="p-2.5 font-medium text-gray-800">{row.account || "—"}</td>
                          <td className="p-2.5 text-gray-600">{row.manual_project_id || "—"}</td>
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
                    {tatRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-gray-400 italic">
                          No logs currently nearing target date.
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
                Page {tatPage} of {tatTotalPages}
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
                  disabled={tatPage >= tatTotalPages}
                  onClick={() => setTatPage(p => Math.min(tatTotalPages, p + 1))}
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
