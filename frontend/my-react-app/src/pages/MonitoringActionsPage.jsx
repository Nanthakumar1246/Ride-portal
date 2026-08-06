import { useFilter } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import React, { useEffect, useState, useCallback } from "react";
import { formatDateOnly } from "../utils/dateFormat";
import { motion, AnimatePresence } from "framer-motion";
import { fetchActions, createActionApi, updateActionApi } from "../api/actionsApi";
import useMonitoringExport from "../hooks/useMonitoringExport";
import LayoutBuilder from "../components/LayoutBuilder";
import { getLayoutApi, saveLayoutApi } from "../api/layoutApi";
import { actionsFormConfig } from "../config/formConfig";
import { FiSearch, FiFilter, FiRotateCcw, FiPlusCircle, FiList, FiClock, FiCheckCircle, FiAlertTriangle, FiPauseCircle, FiSave } from "react-icons/fi";
import { DownloadSimple, ShieldWarning, Plus, ClockCounterClockwise } from "phosphor-react";
import TruncatedCell from "../components/TruncatedCell";
import { exportToExcel } from "../utils/exportToExcel";
import { searchProjects, fetchProgramManagers } from "../api/projectsApi";
import { fetchModuleHistoryApi } from "../api/moduleHistoryApi";
import AddProjectModal from "../components/AddProjectModal";
import ProjectHistoryModal from "../components/ProjectHistoryModal";
import BulkUploadActionsModal from "../components/BulkUploadActionsModal";

const ARCHE_EMAIL_REGEX = /^[^\s@]+@arche\.global$/i;

const ALLOWED_STATUSES = [
  "Open",
  "Closure Submitted",
  "Closed & Acknowledged",
  "Hold"
];

const getStatusMeta = (statusStr) => {
  if (!statusStr) return { class: "bg-gray-100 text-gray-700 border-gray-200", rowBg: "bg-red-50/30", label: "Open" };
  const s = String(statusStr).toLowerCase();
  if (s.includes("open")) return { class: "bg-red-50 text-red-700 border-red-200", rowBg: "bg-red-50/30", label: "Open" };
  if (s.includes("closure submitted") || s.includes("submitted") || s.includes("in progress") || s.includes("progress")) return { class: "bg-blue-50 text-blue-700 border-blue-200", rowBg: "bg-blue-50/30", label: "Closure Submitted" };
  if (s.includes("closed & acknowledged") || s.includes("closed") || s.includes("acknowledged") || s.includes("resolved") || s.includes("completed")) return { class: "bg-emerald-50 text-emerald-700 border-emerald-200", rowBg: "bg-emerald-50/30", label: "Closed & Acknowledged" };
  if (s.includes("hold")) return { class: "bg-amber-50 text-amber-700 border-amber-200", rowBg: "bg-amber-50/30", label: "Hold" };
  return { class: "bg-gray-100 text-gray-700 border-gray-200", rowBg: "bg-slate-50/30", label: statusStr };
};

const generateActionId = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `ACT-${num}`;
};

const MonitoringActionsPage = () => {
  const { user } = useAuth();
  const { selectedManager } = useFilter();

  const [activeTab, setActiveTab] = useState("view"); // "view" | "create"
  const [rows, setRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [showAddProject, setShowAddProject] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const [showLayoutBuilder, setShowLayoutBuilder] = useState(false);
  const [layoutFields, setLayoutFields] = useState(actionsFormConfig?.fields || []);

  const userStr = localStorage.getItem("ARCHERIDE_AUTH");
  const userData = userStr ? JSON.parse(userStr) : null;
  const isAdmin = userData?.user?.role === "ADMIN";

  // Filter states
  const [filters, setFilters] = useState({
    account: "",
    status: "",
    priority: "",
  });
  const [globalSearch, setGlobalSearch] = useState("");

  // Projects data for auto-fill logic
  const [projectsList, setProjectsList] = useState([]);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    action_id: generateActionId(),
    account: "",
    manual_project_id: "",
    project_manager: "",
    program_manager: "",
    behalf_of: "",
    reported_date: new Date().toISOString().slice(0, 10),
    reported_by: user?.email || user?.name || "Logged-in User",
    priority: "High",
    action_item: "",
    responsible: "",
    support_required_from: "",
    teams_involved: "",
    target_date: "",
    remarks: "",
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
  const [actionHistory, setActionHistory] = useState([]);
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

    filtered.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.target_date || a.created_at || 0);
      const dateB = new Date(b.updated_at || b.target_date || b.created_at || 0);
      return dateB - dateA;
    });

    setRows(filtered);
  }, [filters, globalSearch]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchActions({ manager: selectedManager });
      const data = Array.isArray(res) ? res : (res?.data || []);
      setAllRows(data);
      applyFiltersAndSearch(data);
    } catch (err) {
      console.error("Failed to load actions", err);
      triggerToast("Failed to load actions");
      setAllRows([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLayout = async () => {
    try {
      const serverLayout = await getLayoutApi("actions");
      if (serverLayout && Array.isArray(serverLayout)) {
        setLayoutFields(serverLayout);
      } else {
        setLayoutFields(actionsFormConfig?.fields || []);
      }
    } catch (err) {
      setLayoutFields(actionsFormConfig?.fields || []);
    }
  };

  useEffect(() => {
    loadData();
    loadLayout();
    loadMasterHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedManager]);

  useEffect(() => {
    if (allRows.length > 0) {
      applyFiltersAndSearch(allRows);
    }
  }, [filters, globalSearch, allRows, applyFiltersAndSearch]);

  useMonitoringExport("actions", rows);

  // Computed Summary Cards Counts
  const openCount = allRows.filter(r => String(r.status || "").toLowerCase().includes("open") || String(r.status || "").toLowerCase().includes("pending")).length;
  const inProgressCount = allRows.filter(r => String(r.status || "").toLowerCase().includes("progress")).length;
  const resolvedCount = allRows.filter(r => String(r.status || "").toLowerCase().includes("resolved") || String(r.status || "").toLowerCase().includes("completed")).length;
  const holdCount = allRows.filter(r => String(r.status || "").toLowerCase().includes("hold") || String(r.status || "").toLowerCase().includes("cancel")).length;

  // Computed Priority Tracker
  const highPriority = allRows.filter(r => String(r.priority || "").toLowerCase().includes("high") || String(r.priority || "").toLowerCase().includes("critical")).length;
  const mediumPriority = allRows.filter(r => String(r.priority || "").toLowerCase().includes("medium")).length;
  const lowPriority = allRows.filter(r => String(r.priority || "").toLowerCase().includes("low")).length;
  const totalPriorityCount = allRows.length || 1;

  // Computed Aging Overview
  const now = new Date();
  let overdue = 0;
  let dueTodayTomorrow = 0;
  let dueThisWeek = 0;
  let onTrack = 0;

  allRows.forEach((item) => {
    const st = String(item.status || "").toLowerCase();
    if (st.includes("resolved") || st.includes("completed")) return;

    const targetDateStr = item.target_date || item.due_date || item.created_at;
    if (!targetDateStr) {
      onTrack++;
      return;
    }
    const target = new Date(targetDateStr);
    const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) overdue++;
    else if (diffDays <= 1) dueTodayTomorrow++;
    else if (diffDays <= 7) dueThisWeek++;
    else onTrack++;
  });

  const activeTotal = openCount + inProgressCount;
  const openPercentage = Math.round((activeTotal / (allRows.length || 1)) * 100);

  // Auto-fill logic when selecting Customer & Project
  const accountOptions = Array.from(new Set(projectsList.map((p) => p.account).filter(Boolean)));

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

  const filteredProjectOptions = projectsList.filter((p) => !createForm.account || p.account === createForm.account);

  const handleProjectChange = (e) => {
    const projName = e.target.value;
    const matched = projectsList.find((p) => p.name === projName || p.id === projName);
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
      await createActionApi(createForm);
      triggerToast("🚀 Action created successfully!");
      setCreateForm({
        action_id: generateActionId(),
        account: "",
        manual_project_id: "",
        project_manager: "",
        program_manager: "",
        behalf_of: "",
        reported_date: new Date().toISOString().slice(0, 10),
        reported_by: user?.email || user?.name || "Logged-in User",
        priority: "High",
        action_item: "",
        responsible: "",
        support_required_from: "",
        teams_involved: "",
        target_date: "",
        remarks: "",
        status: "Open",
      });
      loadData();
      setActiveTab("view");
    } catch (err) {
      console.error("Failed to create action", err);
      triggerToast("Error creating action");
    }
  };

  // Submit Update Status Form
  const handleUpdateStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUpdateId) {
      alert("Please select an Action ID to update");
      return;
    }
    try {
      const target = allRows.find((r) => r.action_id === selectedUpdateId || r.id === selectedUpdateId);
      if (!target) return;

      await updateActionApi(target.id, {
        status: updateStatus,
        remarks: updateRemarks,
        updated_by: user?.name || user?.email || "Admin User",
      });

      triggerToast("✅ Action status updated!");
      setUpdateRemarks("");
      loadData();
      await loadMasterHistory();
    } catch (err) {
      console.error("Failed to update status", err);
      triggerToast("Error updating action status");
    }
  };

  const loadMasterHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await fetchModuleHistoryApi("actions", { limit: 50 });
      setActionHistory(res?.rows || []);
    } catch (err) {
      console.warn("Failed to fetch action history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelectActionForUpdate = (actId) => {
    setSelectedUpdateId(actId);
    const target = allRows.find((r) => r.action_id === actId || r.id === actId);
    if (target) {
      setUpdateStatus(target.status || "Open");
    }
  };

  const handleExport = () => {
    const exportData = window.__EXPORT_DATA__?.["actions"];
    if (!exportData || !exportData.rows?.length) {
      alert(`No data available to export for actions`);
      return;
    }
    exportToExcel(exportData);
    triggerToast("✅ Downloaded successfully");
  };

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
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 font-marcellus">Actions Tracker</h1>
          <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Governance Suite
          </span>
        </div>

        {/* View | Create Tab Switcher & Modal Triggers */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => setShowAddProject(true)}
                className="rounded-xl h-9 w-9 flex items-center justify-center border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors bg-white shadow-2xs"
                title="Add Project"
              >
                <Plus size={16} weight="bold" />
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="rounded-xl h-9 w-9 flex items-center justify-center border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors bg-white shadow-2xs"
                title="Project History"
              >
                <ClockCounterClockwise size={16} weight="duotone" />
              </button>
            </>
          )}

          <button
            onClick={() => setShowBulkUpload(true)}
            className="rounded-xl h-9 px-3 flex items-center justify-center bg-slate-900 text-white hover:bg-black transition-colors shadow-2xs text-xs font-extrabold gap-1.5"
          >
            <Plus size={14} weight="bold" /> Bulk Upload
          </button>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60 ml-1">
            <button
              onClick={() => setActiveTab("view")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === "view"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FiList size={14} /> View Dashboard
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                activeTab === "create"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FiPlusCircle size={14} /> Create Action
            </button>
          </div>
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
                <span className="text-[11px] font-black text-rose-600 uppercase tracking-wider">PENDING ACTIONS</span>
                <span className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                  <FiAlertTriangle size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{openCount}</span>
                <span className="text-xs font-bold text-rose-600">Pending</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Awaiting execution</p>
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
                <span className="text-[11px] font-black text-amber-600 uppercase tracking-wider">IN PROGRESS</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                  <FiClock size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{inProgressCount}</span>
                <span className="text-xs font-bold text-amber-600">Active Task</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Currently being worked on</p>
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
                <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">COMPLETED</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <FiCheckCircle size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{resolvedCount}</span>
                <span className="text-xs font-bold text-emerald-600">Finished</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Actions completed</p>
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
                <span className="text-[11px] font-black text-purple-600 uppercase tracking-wider">ON HOLD</span>
                <span className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                  <FiPauseCircle size={18} />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 tracking-tight">{holdCount}</span>
                <span className="text-xs font-bold text-purple-600">Paused</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Pending review</p>
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
                  <ShieldWarning size={18} className="text-emerald-600" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Action Priority Distribution</h3>
                </div>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                  Total: {allRows.length} Actions
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5 my-4">
                {/* High */}
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
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{highPriority} Actions</span>
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
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{mediumPriority} Actions</span>
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
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{lowPriority} Actions</span>
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
                  {openPercentage}% of Actions are Open
                </span>
              </div>

              {/* Stacked Progress Bar with Framer Motion Width Animations & Inner Numbers */}
              <div className="my-3">
                <div className="w-full h-5 rounded-full bg-slate-100 overflow-hidden flex shadow-inner p-0.5">
                  {activeTotal > 0 ? (
                    <>
                      {overdue > 0 && (
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${(overdue / activeTotal) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                          className="bg-rose-500 h-full rounded-l-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden"
                          title={`Overdue: ${overdue}`}
                        >
                          {overdue}
                        </motion.div>
                      )}
                      {dueTodayTomorrow > 0 && (
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${(dueTodayTomorrow / activeTotal) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.35 }}
                          className="bg-amber-500 h-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden"
                          title={`Due Today/Tomorrow: ${dueTodayTomorrow}`}
                        >
                          {dueTodayTomorrow}
                        </motion.div>
                      )}
                      {dueThisWeek > 0 && (
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${(dueThisWeek / activeTotal) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                          className="bg-sky-500 h-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden"
                          title={`Due This Week: ${dueThisWeek}`}
                        >
                          {dueThisWeek}
                        </motion.div>
                      )}
                      {onTrack > 0 && (
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${(onTrack / activeTotal) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.65 }}
                          className="bg-emerald-500 h-full rounded-r-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden"
                          title={`On Track: ${onTrack}`}
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
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-slate-800">Overdue ({overdue})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-slate-800">Due Today/Tomorrow ({dueTodayTomorrow})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
                  <span className="text-slate-800">Due This Week ({dueThisWeek})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-800">On Track ({onTrack})</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* SECTION 3: Modern Filter Control Panel */}
          <div className="w-full rounded-2xl bg-white border border-slate-200/80 shadow-xs p-4 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 flex-1">
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
                  setFilters({ account: "", status: "", priority: "" });
                  setGlobalSearch("");
                }}
                className="rounded-xl bg-slate-100 text-slate-600 p-2.5 border border-slate-200 hover:bg-slate-200 transition shadow-2xs shrink-0"
                title="Reset Filters"
              >
                <FiRotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* SECTION 5: Master Actions Table */}
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-x-auto min-h-[300px]">
            {loading ? (
              <div className="p-12 text-center text-sm font-bold text-slate-500 flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Loading Master Actions Table...
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse min-w-[1500px]">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider sticky top-0 backdrop-blur z-10">
                  <tr>
                    <th className="p-3.5 w-12 text-center">No</th>
                    <th className="p-3.5 min-w-[120px]">Account</th>
                    <th className="p-3.5 min-w-[110px]">Action ID</th>
                    <th className="p-3.5 min-w-[110px]">Project ID</th>
                    <th className="p-3.5 min-w-[140px]">Status</th>
                    <th className="p-3.5 min-w-[110px]">Priority</th>
                    <th className="p-3.5 min-w-[220px]">Action Item</th>
                    <th className="p-3.5 min-w-[130px]">Target Date</th>
                    <th className="p-3.5 min-w-[140px]">Responsible</th>
                    <th className="p-3.5 min-w-[160px]">Support Required From</th>
                    <th className="p-3.5 min-w-[150px]">Teams Involved</th>
                    <th className="p-3.5 min-w-[200px]">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => {
                    const stMeta = getStatusMeta(row.status || row.current_status);
                    return (
                      <tr key={row.id || idx} className={`${stMeta.rowBg || "bg-white"} hover:bg-slate-50/80 transition-colors text-slate-800 border-b border-slate-100`}>
                        <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3.5 font-bold text-slate-900">{row.account || "—"}</td>
                        <td className="p-3.5 font-black text-emerald-600">{row.action_id || row.id}</td>
                        <td className="p-3.5 font-semibold text-slate-700">{row.manual_project_id || "—"}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black border ${stMeta.class}`}>
                            {stMeta.label}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black border ${
                            String(row.priority).toLowerCase().includes("high") ? "bg-rose-50 text-rose-700 border-rose-200" :
                            String(row.priority).toLowerCase().includes("medium") ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            {row.priority || "High"}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-900 max-w-xs truncate">{row.action_item || row.title || "—"}</td>
                        <td className="p-3.5 font-bold text-rose-700">{formatDateOnly(row.target_date || row.due_date)}</td>
                        <td className="p-3.5 font-semibold text-slate-800">{row.responsible || "—"}</td>
                        <td className="p-3.5 font-medium text-slate-600">{row.support_required_from || "—"}</td>
                        <td className="p-3.5 font-medium text-slate-600">{row.teams_involved || "—"}</td>
                        <td className="p-3.5 max-w-sm"><TruncatedCell content={String(row.remarks || "")} /></td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-10 text-center text-sm font-semibold text-slate-400">
                        No actions found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CREATE ACTION TAB */}
      {activeTab === "create" && (
        <div className="flex flex-col gap-6">
          {/* SECTION A: Dedicated Create Action Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div>
                <h2 className="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                  <FiPlusCircle className="text-indigo-600" /> Create New Action Item
                </h2>
                <p className="text-xs text-gray-500">Fill in official Action parameters into the database</p>
              </div>

              <span className="text-xs font-black px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                Action ID: {createForm.action_id}
              </span>
            </div>

            <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Action ID (Auto Generated) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Action ID (Auto Generated)</label>
                <input
                  type="text"
                  value={createForm.action_id}
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

              {/* Program Manager (filtered by Headed By) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Program Manager</label>
                <select
                  value={createForm.project_manager}
                  onChange={(e) => setCreateForm((p) => ({ ...p, project_manager: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{createForm.program_manager ? "Select Program Manager..." : "Select Project first"}</option>
                  {programManagerOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Behalf Of */}
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

              {/* Responsible Owner */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Responsible Person *</label>
                <input
                  type="text"
                  required
                  placeholder="Person responsible for delivery"
                  value={createForm.responsible}
                  onChange={(e) => setCreateForm((p) => ({ ...p, responsible: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Support Required From */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Support Required From</label>
                <input
                  type="text"
                  placeholder="e.g. Lead Architect / DevOps"
                  value={createForm.support_required_from}
                  onChange={(e) => setCreateForm((p) => ({ ...p, support_required_from: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                />
              </div>

              {/* Teams Involved */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Teams Involved</label>
                <input
                  type="text"
                  placeholder="e.g. Engineering, QA, Support"
                  value={createForm.teams_involved}
                  onChange={(e) => setCreateForm((p) => ({ ...p, teams_involved: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                />
              </div>

              {/* Target Completion Date */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Target Completion Date</label>
                <input
                  type="date"
                  value={createForm.target_date}
                  onChange={(e) => setCreateForm((p) => ({ ...p, target_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                />
              </div>

              {/* Action Item Description */}
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">Action Item Title / Summary *</label>
                <input
                  type="text"
                  required
                  placeholder="Clear description of the action item..."
                  value={createForm.action_item}
                  onChange={(e) => setCreateForm((p) => ({ ...p, action_item: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Remarks */}
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">Remarks & Details</label>
                <textarea
                  rows={3}
                  placeholder="Additional context or notes regarding this action item..."
                  value={createForm.remarks}
                  onChange={(e) => setCreateForm((p) => ({ ...p, remarks: e.target.value }))}
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
                  <span className="font-bold text-gray-600">Current Status: <strong className="text-gray-900">{allRows.find(r => r.action_id === selectedUpdateId || r.id === selectedUpdateId)?.status || "Open"}</strong></span>
                </div>
              </div>

              <form onSubmit={handleUpdateStatusSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Action ID</label>
                  <select
                    value={selectedUpdateId}
                    onChange={(e) => handleSelectActionForUpdate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">[ Select Action ID ]</option>
                    {allRows.map((r) => (
                      <option key={r.id || r.action_id} value={r.action_id || r.id}>
                        {r.action_id || r.id} — {r.account || "Account"} ({r.status || "Open"})
                      </option>
                    ))}
                  </select>
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
                          name="newStatusRadioAct"
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
                  <label className="block text-xs font-bold text-gray-700 mb-1">Remarks</label>
                  <textarea
                    rows={3}
                    placeholder="What changed? Add a short update..."
                    value={updateRemarks}
                    onChange={(e) => setUpdateRemarks(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-3 text-xs outline-none focus:border-indigo-500"
                  />
                </div>

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
                  {actionHistory.map((item, idx) => (
                    <motion.div
                      key={item.id || idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-3 rounded-lg bg-gray-50 border border-gray-200/70 relative pl-4 border-l-4 border-l-indigo-600"
                    >
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-bold text-gray-900">{formatDateOnly(item.created_at)}</span>
                        <span className="font-semibold text-indigo-700">{item.updated_by || "User"}</span>
                      </div>
                      <div className="text-xs font-medium text-gray-700 mb-1">
                        Changed Status: <span className="line-through text-gray-400">{item.old_status || "N/A"}</span> → <strong className="text-indigo-700">{item.new_status}</strong>
                      </div>
                      <p className="text-xs text-gray-500 italic bg-white p-2 rounded border border-gray-100 mt-1">
                        "{item.remarks || "No remarks added"}"
                      </p>
                    </motion.div>
                  ))}

                  {actionHistory.length === 0 && (
                    <div className="p-8 text-center text-xs text-gray-400 italic">
                      {selectedUpdateId ? "No status updates recorded yet for this Action ID." : "Select an Action ID above to view status update timeline."}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <AddProjectModal
        isOpen={showAddProject}
        onClose={() => setShowAddProject(false)}
        onSuccess={() => {
          triggerToast("🚀 Project added successfully!");
          loadData();
        }}
      />

      <ProjectHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />

      {showBulkUpload && (
        <BulkUploadActionsModal
          isOpen={true}
          onClose={() => setShowBulkUpload(false)}
          onSuccess={() => {
            triggerToast("🚀 Bulk upload successful!");
            loadData();
          }}
        />
      )}

      {showLayoutBuilder && (
        <LayoutBuilder
          fields={layoutFields}
          onClose={() => setShowLayoutBuilder(false)}
          onSave={async (newLayout) => {
            await saveLayoutApi("actions", newLayout);
            setLayoutFields(newLayout);
            setShowLayoutBuilder(false);
          }}
        />
      )}
    </motion.div>
  );
};

export default MonitoringActionsPage;
