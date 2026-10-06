import { useFilter } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import React, { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import RecordDetailModal from "../components/RecordDetailModal";
import { withAttachment } from "../utils/withAttachment";
import { formatDateOnly } from "../utils/dateFormat";
import { motion, AnimatePresence } from "framer-motion";
import { fetchIssues, createIssueApi, updateIssueApi } from "../api/issuesApi";
import { filterConfig } from "../config/filterConfig";
import useMonitoringExport from "../hooks/useMonitoringExport";
import useAutoRefresh from "../hooks/useAutoRefresh";
import LayoutBuilder from "../components/LayoutBuilder";
import { getLayoutApi, saveLayoutApi } from "../api/layoutApi";
import { issuesFormConfig } from "../config/formConfig";
import { FiSearch, FiFilter, FiRotateCcw, FiPlusCircle, FiList, FiClock, FiCheckCircle, FiAlertTriangle, FiPauseCircle, FiSave } from "react-icons/fi";
import { DownloadSimple, ShieldWarning } from "phosphor-react";
import TruncatedCell from "../components/TruncatedCell";
import SearchableSelect from "../components/SearchableSelect";
import { exportToExcel } from "../utils/exportToExcel";
import { searchProjects, fetchProgramManagers } from "../api/projectsApi";
import { fetchModuleHistoryApi } from "../api/moduleHistoryApi";
import Pagination from "../components/Pagination";
import { AGING_BUCKETS, AGING_CONFIGS, computeAgingCounts, matchesAgingFilter } from "../utils/agingUtils";

const agingConfig = AGING_CONFIGS.issues;

const ARCHE_EMAIL_REGEX = /^[^\s@]+@arche\.global$/i;

const ALLOWED_STATUSES = [
  "Open",
  "Closure Submitted",
  "Closed & Acknowledged",
  "Hold"
];

// Closing a log needs evidence: remarks plus a supporting attachment.
const PROOF_STATUSES = ["Closed & Acknowledged", "Hold"];

const getStatusMeta = (statusStr) => {
  if (!statusStr) return { class: "bg-gray-100 text-gray-700 border-gray-200", rowBg: "bg-red-50/30", label: "Open" };
  const s = String(statusStr).toLowerCase();
  if (s.includes("open")) return { class: "bg-red-50 text-red-700 border-red-200", rowBg: "bg-red-50/30", label: "Open" };
  if (s.includes("closure submitted") || s.includes("submitted") || s.includes("in progress") || s.includes("progress")) return { class: "bg-blue-50 text-blue-700 border-blue-200", rowBg: "bg-blue-50/30", label: "Closure Submitted" };
  if (s.includes("closed & acknowledged") || s.includes("closed") || s.includes("acknowledged") || s.includes("resolved") || s.includes("approved")) return { class: "bg-emerald-50 text-emerald-700 border-emerald-200", rowBg: "bg-emerald-50/30", label: "Closed & Acknowledged" };
  if (s.includes("hold")) return { class: "bg-amber-50 text-amber-700 border-amber-200", rowBg: "bg-amber-50/30", label: "Hold" };
  return { class: "bg-gray-100 text-gray-700 border-gray-200", rowBg: "bg-slate-50/30", label: statusStr };
};

const generateIssueId = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `ISS-${num}`;
};

const MonitoringIssuesPage = () => {
  const [detailRecord, setDetailRecord] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  // "Behalf Of" is only shown to an admin, and is optional for them.
  const showBehalfOf = String(user?.role || "").toUpperCase() === "ADMIN";
  const { selectedManager } = useFilter();

  const [activeTab, setActiveTab] = useState("view"); // "view" | "create"
  const [rows, setRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [showLayoutBuilder, setShowLayoutBuilder] = useState(false);
  const [layoutFields, setLayoutFields] = useState(issuesFormConfig?.fields || []);

  // Filter states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [filters, setFilters] = useState({
    account: "",
    status: "",
    priority: "",
    category: "",
  });
  const [globalSearch, setGlobalSearch] = useState("");

  // Opening a log from the dashboard aging drill-down lands here with
  // ?search=<ID>; seeded from the dashboard so the record is already in view.
  const { search: urlSearch } = useLocation();
  useEffect(() => {
    const q = new URLSearchParams(urlSearch).get("search");
    if (q) setGlobalSearch(q);
  }, [urlSearch]);
  const [agingFilter, setAgingFilter] = useState("");

  // Projects data for auto-fill logic
  const [projectsList, setProjectsList] = useState([]);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    issue_id: generateIssueId(),
    account: "",
    manual_project_id: "",
    project_manager: "",
    program_manager: "",
    behalf_of: "",
    reported_date: new Date().toISOString().slice(0, 10),
    reported_by: user?.email || user?.name || "Logged-in User",
    priority: "High",
    category: "Technical",
    issue_title: "",
    issue_description: "",
    resolution_plan: "",
    owner: "",
    target_date: "",
    status: "Open",
  });
  const [programManagerOptions, setProgramManagerOptions] = useState([]);

  useEffect(() => {
    const headedBy = createForm.program_manager;
    if (!headedBy) {
      setProgramManagerOptions([]);
      return;
    }
    fetchProgramManagers(headedBy)
      .then((data) => setProgramManagerOptions(data || []))
      .catch(() => setProgramManagerOptions([]));
  }, [createForm.program_manager]);

  // Update Status Form State
  const [selectedUpdateId, setSelectedUpdateId] = useState("");
  const [updateStatus, setUpdateStatus] = useState("Open");
  const [updateRemarks, setUpdateRemarks] = useState("");
  const [updateAttachment, setUpdateAttachment] = useState(null);
  const proofRequired = PROOF_STATUSES.includes(updateStatus);
  const [issueHistory, setIssueHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Trigger Toast Notification
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  // Load Projects for Customer & Project Auto-fill. Re-fetches every time the
  // Create tab is opened (not just on mount) so a freshly-uploaded Project
  // Master is reflected without a page reload.
  useEffect(() => {
    if (activeTab !== "create") return;
    const loadProjects = async () => {
      try {
        const res = await searchProjects("");
        if (Array.isArray(res)) setProjectsList(res);
      } catch (err) {
        console.warn("Could not fetch projects list", err);
      }
    };
    loadProjects();
  }, [activeTab]);

  // Apply filters & global search
  const applyFiltersAndSearch = useCallback((data) => {
    let filtered = [...data];

    const pName = filters.account?.trim().toLowerCase();
    if (pName) {
      filtered = filtered.filter((row) =>
        String(row.account ?? "").toLowerCase().includes(pName)
      );
    }

    const selectFilters = { ...filters };
    delete selectFilters.account;

    Object.entries(selectFilters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter((row) =>
          String(row[key] ?? "").toLowerCase() === String(value).toLowerCase()
        );
      }
    });

    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase();
      filtered = filtered.filter((row) =>
        Object.values(row).some((v) =>
          v !== null && v !== undefined && String(v).toLowerCase().includes(q)
        )
      );
    }

    if (agingFilter) {
      filtered = filtered.filter((row) => matchesAgingFilter(row, agingConfig, agingFilter));
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.reported_date || a.created_at || 0);
      const dateB = new Date(b.updated_at || b.reported_date || b.created_at || 0);
      return dateB - dateA;
    });

    setRows(filtered);
  }, [filters, globalSearch, agingFilter]);

  const loadData = async (opts = {}) => {
    try {
      if (!opts.silent) setLoading(true);
      const res = await fetchIssues({ manager: selectedManager });
      const data = Array.isArray(res) ? res : (res?.data || []);
      setAllRows(data);
      applyFiltersAndSearch(data);
    } catch (err) {
      console.error("Failed to load issues", err);
      if (!opts.silent && err?.status !== 401) triggerToast("Failed to load issues");
      setAllRows([]);
      setRows([]);
    } finally {
      if (!opts.silent) setLoading(false);
    }
  };

  const loadLayout = async () => {
    try {
      const serverLayout = await getLayoutApi("issues");
      if (serverLayout && Array.isArray(serverLayout)) {
        setLayoutFields(serverLayout);
      } else {
        setLayoutFields(issuesFormConfig?.fields || []);
      }
    } catch (err) {
      setLayoutFields(issuesFormConfig?.fields || []);
    }
  };

  useEffect(() => {
    loadData();
    loadLayout();
    loadMasterHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedManager]);

  useAutoRefresh(() => loadData({ silent: true }), 30000);

  useEffect(() => {
    if (allRows.length > 0) {
      applyFiltersAndSearch(allRows);
    }
  }, [filters, globalSearch, agingFilter, allRows, applyFiltersAndSearch]);

  const handleAgingFilterClick = (bucket) => {
    setAgingFilter((prev) => (prev === bucket ? "" : bucket));
    setCurrentPage(1);
  };

  useMonitoringExport("issues", rows);

  // Computed Summary Cards Counts
  const openCount = allRows.filter(r => String(r.status || "").toLowerCase().includes("open")).length;
  const inProgressCount = allRows.filter(r => String(r.status || "").toLowerCase().includes("progress")).length;
  const resolvedCount = allRows.filter(r => String(r.status || "").toLowerCase().includes("resolved") || String(r.status || "").toLowerCase().includes("approved") || String(r.status || "").toLowerCase().includes("closed")).length;
  const holdCount = allRows.filter(r => String(r.status || "").toLowerCase().includes("hold")).length;

  // Computed Priority Tracker
  const highPriority = allRows.filter(r => String(r.priority || "").toLowerCase().includes("high") || String(r.priority || "").toLowerCase().includes("critical")).length;
  const mediumPriority = allRows.filter(r => String(r.priority || "").toLowerCase().includes("medium")).length;
  const lowPriority = allRows.filter(r => String(r.priority || "").toLowerCase().includes("low")).length;
  const totalPriorityCount = allRows.length || 1;

  // Computed Aging Overview
  const { overdue, dueTodayTomorrow, dueThisWeek, onTrack } = computeAgingCounts(allRows, agingConfig);

  const activeIssuesTotal = openCount + inProgressCount;
  const openPercentage = Math.round((activeIssuesTotal / (allRows.length || 1)) * 100);

  const DEFAULT_ACCOUNTS = [
    "Hetero Healthcare Limited",
    "Acme Corp",
    "Global Tech Solutions",
    "Arche Global",
    "Enterprise Systems"
  ];

  const DEFAULT_PROJECTS = [
    { id: "p1", name: "Payments Revamp", account: "Acme Corp", programme_manager: "J. Rao" },
    { id: "p2", name: "Healthcare Core Portal", account: "Hetero Healthcare Limited", programme_manager: "S. Sharma" },
    { id: "p3", name: "Governance Suite 1.0", account: "Arche Global", programme_manager: "Santhosh B" }
  ];

  const activeProjects = projectsList.length > 0 ? projectsList : DEFAULT_PROJECTS;

  // Auto-fill logic when selecting Customer & Project
  const accountOptions = Array.from(
    new Set([
      ...DEFAULT_ACCOUNTS,
      ...activeProjects.map((p) => p.account).filter(Boolean),
      ...allRows.map((r) => r.account).filter(Boolean),
    ])
  );

  const handleCustomerChange = (e) => {
    const acc = e.target.value;
    setCreateForm((prev) => ({
      ...prev,
      account: acc,
      manual_project_id: "",
      project_manager: "",
      program_manager: "",
    }));
  };

  const filteredProjectOptions = activeProjects.filter((p) => !createForm.account || p.account === createForm.account);

  const handleProjectChange = (e) => {
    const projName = e.target.value;
    const matched = activeProjects.find((p) => p.name === projName || p.id === projName);
    setCreateForm((prev) => ({
      ...prev,
      manual_project_id: projName,
      account: matched?.account || prev.account,
      program_manager: matched?.program_manager || "",
      project_manager: "",
    }));
  };

  // Submit Create Form
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (createForm.behalf_of?.trim() && !ARCHE_EMAIL_REGEX.test(createForm.behalf_of.trim())) {
      triggerToast("Behalf Of must be a valid @arche.global email address");
      return;
    }
    try {
      await createIssueApi(createForm);
      triggerToast("🚀 Issue created successfully!");
      setCreateForm({
        issue_id: generateIssueId(),
        account: "",
        manual_project_id: "",
        project_manager: "",
        program_manager: "",
        behalf_of: "",
        reported_date: new Date().toISOString().slice(0, 10),
        reported_by: user?.email || user?.name || "Logged-in User",
        priority: "High",
        category: "Technical",
        issue_title: "",
        issue_description: "",
        resolution_plan: "",
        owner: "",
        target_date: "",
        status: "Open",
      });
      loadData();
      setActiveTab("view");
    } catch (err) {
      console.error("Failed to create issue", err);
      triggerToast("Error creating issue");
    }
  };

  // Submit Update Status Form
  const handleUpdateStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUpdateId) {
      alert("Please select an Issue ID to update");
      return;
    }
    try {
      const targetIssue = allRows.find((r) => r.issue_id === selectedUpdateId || r.id === selectedUpdateId);
      if (!targetIssue) return;

      // Closing or holding a log has to be evidenced.
      if (proofRequired) {
        if (!updateRemarks.trim()) {
          triggerToast(`Remarks are required to set status to ${updateStatus}`);
          return;
        }
        if (!updateAttachment) {
          triggerToast(`An attachment is required to set status to ${updateStatus}`);
          return;
        }
      }

      await updateIssueApi(targetIssue.id, withAttachment({
        status: updateStatus,
        remarks: updateRemarks,
        updated_by: user?.name || user?.email || "Admin User",
      }, updateAttachment));

      triggerToast("✅ Issue status updated!");
      setUpdateRemarks("");
      setUpdateAttachment(null);
      loadData();
      await loadMasterHistory();
    } catch (err) {
      console.error("Failed to update status", err);
      triggerToast("Error updating issue status");
    }
  };

  const loadMasterHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetchModuleHistoryApi("issues", { limit: 50 });
      setIssueHistory(res?.rows || []);
    } catch (err) {
      console.warn("Failed to fetch issue history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelectIssueForUpdate = (issueId) => {
    setSelectedUpdateId(issueId);
    const target = allRows.find((r) => r.issue_id === issueId || r.id === issueId);
    if (target) {
      setUpdateStatus(target.status || "Open");
    }
  };

  const handleExport = () => {
    const exportData = window.__EXPORT_DATA__?.["issues"];
    if (!exportData || !exportData.rows?.length) {
      alert(`No data available to export for issues`);
      return;
    }
    exportToExcel(exportData);
    triggerToast("✅ Downloaded successfully");
  };

  const columns = issuesFormConfig?.fields || [];

  return (
    <motion.div
      className="min-h-screen bg-slate-50/50 px-2.5 sm:px-4 py-3 flex flex-col gap-3.5 font-urbanist"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-1/2 translate-x-1/2 z-50 rounded-xl bg-slate-900 text-white px-5 py-3 text-xs font-bold shadow-2xl border border-slate-800 flex items-center gap-2"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PAGE HEADER & VIEW / CREATE TAB SWITCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 font-marcellus">Issues Management</h1>
          <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            Governance Suite
          </span>
        </div>

        {/* View | Create Tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl self-start sm:self-auto border border-slate-200/60">
          <button
            onClick={() => setActiveTab("view")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
              activeTab === "view"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FiList size={14} /> View Dashboard
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all ${
              activeTab === "create"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FiPlusCircle size={14} /> Create Issue
          </button>

          <button
            type="button"
            onClick={() => navigate("/monitoring/issues/update")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold text-slate-600 hover:text-slate-900 transition-all"
          >
            <FiRotateCcw size={14} /> Update Status
          </button>
        </div>
      </div>

      {/* TAB 1: VIEW DASHBOARD TAB */}
      {activeTab === "view" && (
        <div className="flex flex-col gap-3.5">
          {/* SECTION 1: 4 Executive KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Open */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl border border-rose-100 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden group hover:border-rose-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-rose-600 uppercase tracking-wider">OPEN</span>
                <span className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                  <FiAlertTriangle size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{openCount}</span>
                <span className="text-xs font-bold text-rose-600">Active</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Requires immediate attention</p>
              <div className="h-1 w-full bg-rose-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, (openCount / (allRows.length || 1)) * 100)}%` }} />
              </div>
            </motion.div>

            {/* Card 2: In Progress */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-amber-100 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden group hover:border-amber-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-amber-600 uppercase tracking-wider">closure submitted</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                  <FiClock size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{inProgressCount}</span>
                <span className="text-xs font-bold text-amber-600">Active Resolution</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Under investigation</p>
              <div className="h-1 w-full bg-amber-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, (inProgressCount / (allRows.length || 1)) * 100)}%` }} />
              </div>
            </motion.div>

            {/* Card 3: Resolved */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden group hover:border-emerald-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">closed and ack</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <FiCheckCircle size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{resolvedCount}</span>
                <span className="text-xs font-bold text-emerald-600">Closed</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Successfully resolved</p>
              <div className="h-1 w-full bg-emerald-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (resolvedCount / (allRows.length || 1)) * 100)}%` }} />
              </div>
            </motion.div>

            {/* Card 4: On Hold */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl border border-purple-100 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden group hover:border-purple-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-purple-600 uppercase tracking-wider">HOLD</span>
                <span className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                  <FiPauseCircle size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{holdCount}</span>
                <span className="text-xs font-bold text-purple-600">Paused</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Pending external dependency</p>
              <div className="h-1 w-full bg-purple-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, (holdCount / (allRows.length || 1)) * 100)}%` }} />
              </div>
            </motion.div>
          </div>

          {/* SECTION 2: Priority Tracker & Aging Overview Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Priority Tracker Component (7 cols) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between lg:col-span-7"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldWarning size={18} className="text-rose-600" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Issue Priority Distribution</h3>
                </div>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                  Total: {allRows.length} Issues
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5 my-4">
                {/* High / Critical */}
                <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-rose-50/50 border border-rose-100/70">
                  <span className="text-xs font-black text-rose-900 w-16 uppercase">HIGH</span>
                  <div className="flex-1 h-3 rounded-full bg-rose-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${(highPriority / totalPriorityCount) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }} className="h-full bg-rose-500 rounded-full"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-24 justify-end">
                    <span className="text-xs font-extrabold text-rose-900">{Math.round((highPriority / totalPriorityCount) * 100)}%</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{highPriority} Issues</span>
                  </div>
                </div>

                {/* Medium */}
                <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-amber-50/50 border border-amber-100/70">
                  <span className="text-xs font-black text-amber-900 w-16 uppercase">MEDIUM</span>
                  <div className="flex-1 h-3 rounded-full bg-amber-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${(mediumPriority / totalPriorityCount) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }} className="h-full bg-amber-500 rounded-full"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-24 justify-end">
                    <span className="text-xs font-extrabold text-amber-900">{Math.round((mediumPriority / totalPriorityCount) * 100)}%</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{mediumPriority} Issues</span>
                  </div>
                </div>

                {/* Low */}
                <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100/70">
                  <span className="text-xs font-black text-emerald-900 w-16 uppercase">LOW</span>
                  <div className="flex-1 h-3 rounded-full bg-emerald-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }} animate={{ width: `${(lowPriority / totalPriorityCount) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }} className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-24 justify-end">
                    <span className="text-xs font-extrabold text-emerald-900">{Math.round((lowPriority / totalPriorityCount) * 100)}%</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{lowPriority} Issues</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Aging Overview Component (5 cols) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between lg:col-span-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FiClock size={16} className="text-indigo-600" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Aging Overview</h3>
                </div>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {openPercentage}% of Issues are Open
                </span>
              </div>

              {/* Stacked Progress Bar with Framer Motion Width Animations & Inner Numbers */}
              <div className="my-3">
                <div className="w-full h-5 rounded-full bg-slate-100 overflow-hidden flex shadow-inner p-0.5">
                  {activeIssuesTotal > 0 ? (
                    <>
                      {overdue > 0 && (
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${(overdue / activeIssuesTotal) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                          className={`bg-rose-500 h-full rounded-l-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden cursor-pointer hover:opacity-90 ${agingFilter === AGING_BUCKETS.OVERDUE ? "ring-2 ring-rose-300 ring-offset-1" : ""}`}
                          title={`Overdue: ${overdue}`}
                          onClick={() => handleAgingFilterClick(AGING_BUCKETS.OVERDUE)}
                        >
                          {overdue}
                        </motion.div>
                      )}
                      {dueTodayTomorrow > 0 && (
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${(dueTodayTomorrow / activeIssuesTotal) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.35 }}
                          className={`bg-amber-500 h-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden cursor-pointer hover:opacity-90 ${agingFilter === AGING_BUCKETS.DUE_TODAY_TOMORROW ? "ring-2 ring-amber-300 ring-offset-1" : ""}`}
                          title={`Due Today/Tomorrow: ${dueTodayTomorrow}`}
                          onClick={() => handleAgingFilterClick(AGING_BUCKETS.DUE_TODAY_TOMORROW)}
                        >
                          {dueTodayTomorrow}
                        </motion.div>
                      )}
                      {dueThisWeek > 0 && (
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${(dueThisWeek / activeIssuesTotal) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                          className={`bg-sky-500 h-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden cursor-pointer hover:opacity-90 ${agingFilter === AGING_BUCKETS.DUE_THIS_WEEK ? "ring-2 ring-sky-300 ring-offset-1" : ""}`}
                          title={`Due This Week: ${dueThisWeek}`}
                          onClick={() => handleAgingFilterClick(AGING_BUCKETS.DUE_THIS_WEEK)}
                        >
                          {dueThisWeek}
                        </motion.div>
                      )}
                      {onTrack > 0 && (
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${(onTrack / activeIssuesTotal) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.65 }}
                          className={`bg-emerald-500 h-full rounded-r-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden cursor-pointer hover:opacity-90 ${agingFilter === AGING_BUCKETS.ON_TRACK ? "ring-2 ring-emerald-300 ring-offset-1" : ""}`}
                          title={`On Track: ${onTrack}`}
                          onClick={() => handleAgingFilterClick(AGING_BUCKETS.ON_TRACK)}
                        >
                          {onTrack}
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black text-white">
                      100% On Track
                    </div>
                  )}
                </div>
              </div>

              {/* Word-based Legend with counts in parentheses */}
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-xs font-bold text-slate-700 pt-2 border-t border-slate-100">
                <div
                  className={`flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${!agingFilter ? "bg-slate-100 ring-1 ring-slate-300" : "hover:bg-slate-50"}`}
                  onClick={() => setAgingFilter("")}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                  <span className="text-slate-800">All ({overdue + dueTodayTomorrow + dueThisWeek + onTrack})</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${agingFilter === AGING_BUCKETS.OVERDUE ? "bg-rose-50 ring-1 ring-rose-200" : "hover:bg-slate-50"}`}
                  onClick={() => handleAgingFilterClick(AGING_BUCKETS.OVERDUE)}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-slate-800">Overdue ({overdue})</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${agingFilter === AGING_BUCKETS.DUE_TODAY_TOMORROW ? "bg-amber-50 ring-1 ring-amber-200" : "hover:bg-slate-50"}`}
                  onClick={() => handleAgingFilterClick(AGING_BUCKETS.DUE_TODAY_TOMORROW)}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-slate-800">Due Today/Tomorrow ({dueTodayTomorrow})</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${agingFilter === AGING_BUCKETS.DUE_THIS_WEEK ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-slate-50"}`}
                  onClick={() => handleAgingFilterClick(AGING_BUCKETS.DUE_THIS_WEEK)}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                  <span className="text-slate-800">Due This Week ({dueThisWeek})</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ${agingFilter === AGING_BUCKETS.ON_TRACK ? "bg-emerald-50 ring-1 ring-emerald-200" : "hover:bg-slate-50"}`}
                  onClick={() => handleAgingFilterClick(AGING_BUCKETS.ON_TRACK)}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-800">On Track ({onTrack})</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* SECTION 3: Modern Filter Control Panel */}
          <div className="w-full rounded-2xl bg-white border border-slate-200/80 shadow-xs p-4 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 flex-1">
              <input
                type="text"
                name="account"
                placeholder="Customer (Account)"
                value={filters.account}
                onChange={(e) => setFilters((p) => ({ ...p, account: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              />

              <select
                name="status"
                value={filters.status}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              >
                <option value="">Status (All)</option>
                <option value="Open">Open</option>
                <option value="Closure Submitted">Closure Submitted</option>
                <option value="Closed & Acknowledged">Closed & Acknowledged</option>
                <option value="Hold">Hold</option>
              </select>

              <select
                name="priority"
                value={filters.priority}
                onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              >
                <option value="">Priority (All)</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="Critical">Critical</option>
              </select>

              <select
                name="category"
                value={filters.category}
                onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              >
                <option value="">Category (All)</option>
                <option value="Technical">Technical</option>
                <option value="Operational">Operational</option>
                <option value="Resource">Resource</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Application">Application</option>
              </select>
            </div>

            {/* Global Search & Export Buttons */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1 sm:w-52">
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Global Search..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs pl-9 font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-colors"
                />
                <FiSearch className="absolute left-3 top-2.5 text-slate-400" size={15} />
              </div>

              <button
                type="button"
                onClick={handleExport}
                className="rounded-xl bg-indigo-50 text-indigo-600 p-2.5 border border-indigo-100 hover:bg-indigo-100 transition shadow-2xs shrink-0"
                title="Export to Excel"
              >
                <DownloadSimple size={16} weight="duotone" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilters({ account: "", status: "", priority: "", category: "" });
                  setGlobalSearch("");
                  setAgingFilter("");
                }}
                className="rounded-xl bg-slate-100 text-slate-600 p-2.5 border border-slate-200 hover:bg-slate-200 transition shadow-2xs shrink-0"
                title="Reset Filters"
              >
                <FiRotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* SECTION 5: Master Issues Table */}
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs min-h-[300px]">
            {loading ? (
              <div className="p-12 text-center text-sm font-bold text-slate-500 flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Loading Master Issues Table...
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3 w-[64px] text-center">S.No</th>
                    <th className="p-3 w-[140px]">Issue ID</th>
                    <th className="p-3">Issue Title</th>
                    <th className="p-3 w-[180px]">Customer / Account</th>
                    <th className="p-3 w-[110px]">Priority</th>
                    <th className="p-3 w-[130px]">Due Date</th>
                    <th className="p-3 w-[110px] text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, idx) => {
                    const stMeta = getStatusMeta(row.status || row.current_status);
                    const recordId = row.issue_id || row.id;
                    const dueDate = row.target_resolution_date || row.target_date || row.due_date;
                    const priority = row.priority || "Medium";
                    return (
                      <tr
                        key={row.id || idx}
                        className={`${stMeta.rowBg || "bg-white"} hover:bg-slate-50/80 transition-colors text-slate-800`}
                      >
                        <td className="p-3 text-center font-bold text-slate-400">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td className="p-3 font-black text-indigo-700 truncate" title={recordId}>
                          <button
                            type="button"
                            onClick={() => setDetailRecord({ module: "issue", id: recordId })}
                            className="hover:underline focus:outline-none focus:underline"
                            title="View full details"
                          >
                            {recordId || "—"}
                          </button>
                        </td>
                        <td className="p-3 font-bold text-slate-900 truncate" title={row.issue_title || row.title || ""}>
                          {row.issue_title || row.title || "—"}
                        </td>
                        <td className="p-3 font-semibold text-slate-700 truncate" title={row.account || row.customer_name || ""}>
                          {row.account || row.customer_name || "—"}
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black border ${
                            String(priority).toLowerCase().includes("critical") || String(priority).toLowerCase().includes("high")
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : String(priority).toLowerCase().includes("medium")
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            {priority}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-700">{dueDate ? formatDateOnly(dueDate) : "—"}</td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => navigate(`/monitoring/issues/update?id=${encodeURIComponent(recordId)}`)}
                            title="Open this record to view details and update its status"
                            className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-black uppercase tracking-wide hover:bg-indigo-100 transition"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-sm font-semibold text-slate-400">
                        No issues found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Pagination Controls */}
          {activeTab === "view" && rows.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(rows.length / pageSize) || 1}
              onPageChange={setCurrentPage}
              totalItems={rows.length}
              pageSize={pageSize}
            />
          )}
        </div>
      )}

      {/* TAB 2: CREATE ISSUE TAB */}
      {activeTab === "create" && (
        <div className="flex flex-col gap-6">
          {/* SECTION A: Dedicated Create Issue Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div>
                <h2 className="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                  <FiPlusCircle className="text-indigo-600" /> Create New Issue
                </h2>
                <p className="text-xs text-gray-500">Fill in the official Issue parameters into the database</p>
              </div>

              <span className="text-xs font-black px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                Issue ID: {createForm.issue_id}
              </span>
            </div>

            <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Issue ID (Auto Generated) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Issue ID (Auto Generated)</label>
                <input
                  type="text"
                  value={createForm.issue_id}
                  disabled
                  className="w-full rounded-lg border bg-gray-100 px-3 py-2 text-xs font-bold text-indigo-700"
                />
              </div>

              {/* Customer / Account */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Customer / Account *</label>
                <select
                  value={createForm.account}
                  onChange={handleCustomerChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Account / Customer</option>
                  {accountOptions.map((acc) => (
                    <option key={acc} value={acc}>{acc}</option>
                  ))}
                </select>
              </div>

              {/* Project */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Project *</label>
                <select
                  value={createForm.manual_project_id}
                  onChange={handleProjectChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Project</option>
                  {filteredProjectOptions.map((p) => (
                    <option key={p.id || p.name} value={p.name}>
                      {p.name} — {p.account}
                    </option>
                  ))}
                </select>
              </div>

              {/* Headed By (Auto Filled) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Headed By (Auto Filled)</label>
                <input
                  type="text"
                  value={createForm.program_manager}
                  readOnly
                  placeholder="Auto-filled on project selection"
                  className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700"
                />
              </div>

              {/* Project Manager (filtered by Headed By) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Project Manager</label>
                <select
                  value={createForm.project_manager}
                  onChange={(e) => setCreateForm((p) => ({ ...p, project_manager: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{createForm.program_manager ? "Select Project Manager..." : "Select Project first"}</option>
                  {programManagerOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Behalf Of — admin only */}
              {showBehalfOf && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Behalf Of (@arche.global Email ID)</label>
                  <input
                    type="email"
                    value={createForm.behalf_of}
                    onChange={(e) => setCreateForm((p) => ({ ...p, behalf_of: e.target.value }))}
                    placeholder="Optional — name@arche.global"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Reported Date */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Reported Date</label>
                <input
                  type="date"
                  value={createForm.reported_date}
                  onChange={(e) => setCreateForm((p) => ({ ...p, reported_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                />
              </div>

              {/* Reported By */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Reported By</label>
                <input
                  type="text"
                  value={createForm.reported_by}
                  readOnly
                  className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Priority</label>
                <select
                  value={createForm.priority}
                  onChange={(e) => setCreateForm((p) => ({ ...p, priority: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                >
                  <option value="Technical">Technical</option>
                  <option value="Operational">Operational</option>
                  <option value="Resource">Resource</option>
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Application">Application</option>
                </select>
              </div>

              {/* Owner */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Issue Owner</label>
                <input
                  type="text"
                  placeholder="Owner name / email"
                  value={createForm.owner}
                  onChange={(e) => setCreateForm((p) => ({ ...p, owner: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                />
              </div>

              {/* Target Resolution Date */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Target Resolution Date</label>
                <input
                  type="date"
                  value={createForm.target_date}
                  onChange={(e) => setCreateForm((p) => ({ ...p, target_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                />
              </div>

              {/* Issue Title */}
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">Issue Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Summary title of the issue..."
                  value={createForm.issue_title}
                  onChange={(e) => setCreateForm((p) => ({ ...p, issue_title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Issue Description */}
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">Issue Description</label>
                <textarea
                  rows={3}
                  placeholder="Detailed description of the operational issue..."
                  value={createForm.issue_description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, issue_description: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 p-3 text-xs"
                />
              </div>

              {/* Resolution Plan */}
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">Resolution Plan</label>
                <textarea
                  rows={2}
                  placeholder="Planned steps for resolving the issue..."
                  value={createForm.resolution_plan}
                  onChange={(e) => setCreateForm((p) => ({ ...p, resolution_plan: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 p-3 text-xs"
                />
              </div>

              {/* Buttons */}
              <div className="md:col-span-3 flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => triggerToast("Saved draft locally")}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <FiSave size={15} /> Save Draft
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-indigo-600 text-white text-xs font-extrabold hover:bg-indigo-700 shadow-md flex items-center gap-1.5"
                >
                  <FiPlusCircle size={15} /> Submit & Create
                </button>
              </div>
            </form>
          </div>

          {/* SECTION B: UPDATE STATUS & HISTORY */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Update Status Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4">
              <div className="border-b border-gray-100 pb-2">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Update Status</h3>
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="font-bold text-gray-600">Selected: <strong className="text-indigo-600">{selectedUpdateId || "None"}</strong></span>
                  <span className="font-bold text-gray-600">Current Status: <strong className="text-gray-900">{allRows.find(r => r.issue_id === selectedUpdateId || r.id === selectedUpdateId)?.status || "Open"}</strong></span>
                </div>
              </div>

              <form onSubmit={handleUpdateStatusSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Issue ID</label>
                  <SearchableSelect
                    value={selectedUpdateId}
                    onChange={handleSelectIssueForUpdate}
                    emptyLabel="[ Select Issue ID ]"
                    placeholder="Type to search Issue ID…"
                    options={allRows.map((r) => ({
                      value: r.issue_id || r.id,
                      label: `${r.issue_id || r.id} — ${r.account || "Account"} (${r.status || "Open"})`,
                      sublabel: r.account,
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">New Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALLOWED_STATUSES.map((st) => (
                      <label
                        key={st}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-bold transition-all ${
                          updateStatus === st
                            ? "border-indigo-600 bg-indigo-50 text-indigo-800 shadow-xs"
                            : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <input
                          type="radio"
                          name="newStatusRadioIssue"
                          value={st}
                          checked={updateStatus === st}
                          onChange={(e) => setUpdateStatus(e.target.value)}
                          className="accent-indigo-600"
                        />
                        {st}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Remarks{proofRequired && <span className="text-red-600"> *</span>}
                  </label>
                  <textarea
                    rows={3}
                    placeholder="What changed? Add a short update..."
                    value={updateRemarks}
                    onChange={(e) => setUpdateRemarks(e.target.value)}
                    required={proofRequired}
                    className="w-full rounded-lg border border-gray-300 p-3 text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                {proofRequired && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Attachment <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setUpdateAttachment(e.target.files?.[0] || null)}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs outline-none focus:border-indigo-500"
                    />
                    <p className="mt-1 text-[11px] font-semibold text-gray-500">
                      Required when closing or holding a log.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-extrabold text-xs hover:bg-indigo-700 transition shadow-md"
                >
                  Update Status
                </button>
              </form>
            </div>

            {/* Update History Timeline */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4">
              <div className="border-b border-gray-100 pb-2 flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Update History</h3>
                <span className="text-xs text-gray-400 font-semibold">Newest First</span>
              </div>

              {loadingHistory ? (
                <div className="p-6 text-center text-xs text-gray-500 font-bold">Loading timeline...</div>
              ) : (
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[380px] pr-1">
                  {issueHistory.map((item, idx) => {
                    const matchedIssue = allRows.find(r => r.issue_id === item.record_id || r.id === item.record_id);
                    const accName = matchedIssue?.account;
                    const projName = matchedIssue?.manual_project_id || matchedIssue?.project_description;

                    return (
                      <motion.div
                        key={item.id || idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-3 rounded-lg bg-gray-50 border border-gray-200/70 relative pl-4 border-l-4 border-l-indigo-600"
                      >
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="font-bold text-gray-900 flex items-center gap-2">
                            {(item.record_id || matchedIssue?.issue_id) && (
                              <span className="font-black bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">
                                {item.record_id || matchedIssue?.issue_id}
                              </span>
                            )}
                            {formatDateOnly(item.created_at)}
                          </span>
                          <span className="font-semibold text-indigo-700">{item.updated_by || "User"}</span>
                        </div>

                        {/* Account & Project Badges */}
                        {(accName || projName) && (
                          <div className="flex items-center gap-2 text-[10px] font-bold my-1 flex-wrap">
                            {accName && (
                              <span className="bg-slate-200/80 text-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
                                🏢 {accName}
                              </span>
                            )}
                            {projName && (
                              <span className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded flex items-center gap-1 border border-indigo-200/50">
                                📁 {projName}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="text-xs font-medium text-gray-700 mb-1">
                          Changed Status: <span className="line-through text-gray-400">{item.old_status || "N/A"}</span> → <strong className="text-indigo-700">{item.new_status}</strong>
                        </div>
                        <p className="text-xs text-gray-500 italic bg-white p-2 rounded border border-gray-100 mt-1">
                          "{item.remarks || "No remarks added"}"
                        </p>
                      </motion.div>
                    );
                  })}

                  {issueHistory.length === 0 && (
                    <div className="p-8 text-center text-xs text-gray-400 italic">
                      {selectedUpdateId ? "No status updates recorded yet for this Issue ID." : "Select an Issue ID above to view status update timeline."}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showLayoutBuilder && (
        <LayoutBuilder
          fields={layoutFields}
          onClose={() => setShowLayoutBuilder(false)}
          onSave={async (newLayout) => {
            await saveLayoutApi("issues", newLayout);
            setLayoutFields(newLayout);
            setShowLayoutBuilder(false);
          }}
        />
      )}
      {detailRecord && (
        <RecordDetailModal
          module={detailRecord.module}
          id={detailRecord.id}
          onClose={() => setDetailRecord(null)}
        />
      )}
    </motion.div>
  );
};

export default MonitoringIssuesPage;
