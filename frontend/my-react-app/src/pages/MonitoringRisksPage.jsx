import { useFilter } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import React, { useEffect, useState, useCallback } from "react";
import { formatDateOnly } from "../utils/dateFormat";
import { motion, AnimatePresence } from "framer-motion";
import { fetchRisks, createRiskApi, updateRiskApi, fetchRiskHistoryApi } from "../api/risksApi";
import { filterConfig } from "../config/filterConfig";
import useMonitoringExport from "../hooks/useMonitoringExport";
import LayoutBuilder from "../components/LayoutBuilder";
import { getLayoutApi, saveLayoutApi } from "../api/layoutApi";
import { risksFormConfig } from "../config/formConfig";
import { FiSearch, FiFilter, FiRotateCcw, FiPlusCircle, FiList, FiClock, FiCheckCircle, FiAlertTriangle, FiPauseCircle, FiSave, FiSend } from "react-icons/fi";
import { RxCross2 } from "react-icons/rx";
import { DownloadSimple, ShieldWarning, ArrowClockwise } from "phosphor-react";
import TruncatedCell from "../components/TruncatedCell";
import { exportToExcel } from "../utils/exportToExcel";
import { searchProjects, fetchProgramManagers } from "../api/projectsApi";

const ARCHE_EMAIL_REGEX = /^[^\s@]+@arche\.global$/i;

const ALLOWED_STATUSES = [
  "Open",
  "Closure Submitted",
  "Closed & Acknowledged",
  "Hold"
];

const getStatusMeta = (statusStr) => {
  if (!statusStr) return { class: "bg-gray-100 text-gray-700 border-gray-200", rowBg: "bg-[#FFF5EB]", label: "Open" };
  const s = String(statusStr).toLowerCase();
  if (s.includes("open")) return { class: "bg-red-50 text-red-700 border-red-200", rowBg: "bg-[#FFF5EB]", label: "Open" };
  if (s.includes("closure submitted") || s.includes("submitted")) return { class: "bg-blue-50 text-blue-700 border-blue-200", rowBg: "bg-[#F0FDFA]", label: "Closure Submitted" };
  if (s.includes("closed & acknowledged") || s.includes("closed") || s.includes("acknowledged") || s.includes("resolved")) return { class: "bg-emerald-50 text-emerald-700 border-emerald-200", rowBg: "bg-[#F1FDF5]", label: "Closed & Acknowledged" };
  if (s.includes("hold")) return { class: "bg-amber-50 text-amber-700 border-amber-200", rowBg: "bg-[#FFFBE6]", label: "Hold" };
  return { class: "bg-gray-100 text-gray-700 border-gray-200", rowBg: "bg-[#F8FAFC]", label: statusStr };
};

const generateRiskId = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `RSK-${num}`;
};

const MonitoringRisksPage = () => {
  const { user } = useAuth();
  const { selectedManager } = useFilter();

  const [activeTab, setActiveTab] = useState("view"); // "view" | "create"
  const [rows, setRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [showLayoutBuilder, setShowLayoutBuilder] = useState(false);
  const [layoutFields, setLayoutFields] = useState(risksFormConfig?.fields || []);

  // Filter states
  const [filters, setFilters] = useState({
    account: "",
    status: "",
    priority: "",
    category: "",
    probability: "",
    impact: "",
  });
  const [globalSearch, setGlobalSearch] = useState("");

  // Projects data for auto-fill logic
  const [projectsList, setProjectsList] = useState([]);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    risk_id: generateRiskId(),
    account: "",
    manual_project_id: "",
    project_manager: "",
    program_manager: "",
    behalf_of: "",
    identified_date: new Date().toISOString().slice(0, 10),
    identified_by: user?.email || user?.name || "Logged-in User",
    priority: "Medium",
    probability: "Possible",
    impact: "Moderate",
    category: "Technical",
    risk_title: "",
    risk_description: "",
    mitigation_strategy: "",
    mitigation_owner: "",
    target_mitigation_date: "",
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
  const [selectedUpdateRiskId, setSelectedUpdateRiskId] = useState("");
  const [selectedUpdateProjectFilter, setSelectedUpdateProjectFilter] = useState("");
  const [updateStatus, setUpdateStatus] = useState("Open");
  const [updateRemarks, setUpdateRemarks] = useState("");
  const [riskHistory, setRiskHistory] = useState([]);
  const [masterHistoryList, setMasterHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  // Trigger Toast Notification
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  // Load Projects for Customer & Project Auto-fill.
  // Re-fetches every time the Create tab is opened (not just on mount) so a
  // freshly-uploaded Project Master is reflected without requiring a page reload.
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
      const dateA = new Date(a.updated_at || a.identified_date || a.created_at || 0);
      const dateB = new Date(b.updated_at || b.identified_date || b.created_at || 0);
      return dateB - dateA;
    });

    setRows(filtered);
  }, [filters, globalSearch]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchRisks({ manager: selectedManager });
      const data = Array.isArray(res) ? res : (res?.data || []);
      setAllRows(data);
      applyFiltersAndSearch(data);
    } catch (err) {
      console.error("Failed to load risks", err);
      triggerToast("Failed to load risks");
      setAllRows([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLayout = async () => {
    try {
      const serverLayout = await getLayoutApi("risks");
      if (serverLayout && Array.isArray(serverLayout)) {
        setLayoutFields(serverLayout);
      } else {
        setLayoutFields(risksFormConfig?.fields || []);
      }
    } catch (err) {
      setLayoutFields(risksFormConfig?.fields || []);
    }
  };

  const loadMasterHistory = useCallback(async (rowsData = allRows) => {
    try {
      setLoadingHistory(true);
      const res = await fetchRiskHistoryApi("ALL");
      let historyData = Array.isArray(res) ? res : (res?.data || []);

      // Read locally stored history so entries never disappear
      const savedLocal = JSON.parse(localStorage.getItem("ride_risk_history") || "[]");

      const combined = [...savedLocal, ...historyData];

      if (rowsData && rowsData.length > 0) {
        rowsData.forEach((r) => {
          if (r.status && r.status !== "Open") {
            combined.push({
              id: `syn-${r.id || r.risk_id}`,
              risk_id: r.risk_id || "RSK-001",
              account: r.account || "Hetero Healthcare Limited",
              project: r.manual_project_id || r.project_description || "Healthcare Core Portal",
              created_at: r.updated_at || r.last_reviewed_date || r.identified_date || new Date().toISOString(),
              updated_by: r.identified_by || r.mitigation_owner || "VP / User",
              old_status: "Open",
              new_status: r.status,
              remarks: r.comments || r.remarks || `Status updated to ${r.status}`,
            });
          }
        });
      }

      // Deduplicate entries by risk_id + new_status
      const uniqueMap = new Map();
      combined.forEach((item) => {
        const key = `${item.risk_id}-${item.new_status}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        }
      });

      const uniqueList = Array.from(uniqueMap.values());
      uniqueList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      setMasterHistoryList(uniqueList);
    } catch (err) {
      console.warn("Failed to fetch master risk history", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [allRows]);

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

  useMonitoringExport("risks", rows);

  // Computed Summary Cards Counts
  const counts = {
    open: 0,
    closureSubmitted: 0,
    closedAcknowledged: 0,
    hold: 0,
  };

  allRows.forEach((r) => {
    const s = String(r.status || r.current_status || "").toLowerCase();
    if (s.includes("closure submitted") || s.includes("submitted")) {
      counts.closureSubmitted++;
    } else if (s.includes("closed") || s.includes("acknowledged") || s.includes("resolved") || s.includes("approved")) {
      counts.closedAcknowledged++;
    } else if (s.includes("hold")) {
      counts.hold++;
    } else {
      counts.open++;
    }
  });

  // Computed Priority Tracker counts
  const priorityCounts = { High: 0, Medium: 0, Low: 0 };
  allRows.forEach((r) => {
    const p = String(r.priority || "").toLowerCase();
    if (p.includes("high") || p.includes("critical")) priorityCounts.High++;
    else if (p.includes("medium")) priorityCounts.Medium++;
    else priorityCounts.Low++;
  });
  const totalPriorityCount = (priorityCounts.High + priorityCounts.Medium + priorityCounts.Low) || 1;

  // Computed Aging Overview
  const totalRisksCount = allRows.length;
  const openCount = counts.open + counts.closureSubmitted;
  const openPercentage = totalRisksCount > 0 ? Math.round((openCount / totalRisksCount) * 100) : 0;

  let overdue = 0;
  let dueTodayTomorrow = 0;
  let dueThisWeek = 0;
  let onTrack = 0;

  const today = new Date();
  today.setHours(0,0,0,0);

  allRows.forEach((r) => {
    const s = String(r.status || r.current_status || "").toLowerCase();
    const isCompleted = s.includes("closed") || s.includes("acknowledged") || s.includes("resolved");
    if (isCompleted) return;

    const targetDateStr = r.target_mitigation_date || r.planned_closure_date || r.identified_date;
    if (!targetDateStr) {
      onTrack++;
      return;
    }
    const targetDate = new Date(targetDateStr);
    targetDate.setHours(0,0,0,0);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) overdue++;
    else if (diffDays === 0 || diffDays === 1) dueTodayTomorrow++;
    else if (diffDays >= 2 && diffDays <= 7) dueThisWeek++;
    else onTrack++;
  });

  const DEFAULT_ACCOUNTS = [
    "Hetero Healthcare Limited",
    "Acme Corp",
    "Global Tech Solutions",
    "Arche Global",
    "Enterprise Systems"
  ];

  const DEFAULT_PROJECTS = [
    { id: "p1", name: "Payments Revamp", account: "Acme Corp", created_by: "J. Rao" },
    { id: "p2", name: "Healthcare Core Portal", account: "Hetero Healthcare Limited", created_by: "S. Sharma" },
    { id: "p3", name: "Governance Suite 1.0", account: "Arche Global", created_by: "Santhosh B" }
  ];

  const activeProjects = projectsList.length > 0 ? projectsList : DEFAULT_PROJECTS;

  // Dynamic project options matching selected account
  const filteredProjectOptions = createForm.account
    ? activeProjects.filter((p) => String(p.account).toLowerCase() === String(createForm.account).toLowerCase())
    : activeProjects;

  // Unique Customer accounts from DB projects + risks + defaults
  const accountOptions = Array.from(
    new Set([
      ...DEFAULT_ACCOUNTS,
      ...activeProjects.map((p) => p.account).filter(Boolean),
      ...allRows.map((r) => r.account).filter(Boolean),
    ])
  );

  // Auto-fill logic for Create Form
  const handleCustomerChange = (e) => {
    const accountVal = e.target.value;
    setCreateForm((prev) => ({
      ...prev,
      account: accountVal,
      manual_project_id: "",
      project_manager: "",
      program_manager: "",
    }));
  };

  const handleProjectChange = (e) => {
    const projId = e.target.value;
    const proj = activeProjects.find((p) => String(p.name || p.id) === String(projId));
    setCreateForm((prev) => ({
      ...prev,
      manual_project_id: projId,
      account: proj?.account || prev.account,
      program_manager: proj?.program_manager || "",
      project_manager: "",
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.risk_title.trim()) {
      triggerToast("Please enter a Risk Title");
      return;
    }
    if (createForm.behalf_of?.trim() && !ARCHE_EMAIL_REGEX.test(createForm.behalf_of.trim())) {
      triggerToast("Behalf Of must be a valid @arche.global email address");
      return;
    }

    try {
      const payload = {
        ...createForm,
        risk_id: createForm.risk_id || generateRiskId(),
        identified_by: createForm.identified_by || user?.email || "VP User",
      };

      await createRiskApi(payload);
      triggerToast("✅ Risk created successfully!");
      
      // Refresh Data without page refresh
      await loadData();

      // Reset form
      setCreateForm({
        risk_id: generateRiskId(),
        account: "",
        manual_project_id: "",
        project_manager: "",
        program_manager: "",
        behalf_of: "",
        identified_date: new Date().toISOString().slice(0, 10),
        identified_by: user?.email || user?.name || "Logged-in User",
        priority: "Medium",
        probability: "Possible",
        impact: "Moderate",
        category: "Technical",
        risk_title: "",
        risk_description: "",
        mitigation_strategy: "",
        mitigation_owner: "",
        target_mitigation_date: "",
        status: "Open",
      });
    } catch (err) {
      console.error("Create risk error", err);
      triggerToast("❌ Failed to create risk");
    }
  };

  // Select a risk for update (without clearing history feed)
  const handleSelectRiskForUpdate = (riskId) => {
    setSelectedUpdateRiskId(riskId);
    const selectedRisk = allRows.find((r) => r.risk_id === riskId || r.id === riskId);
    if (selectedRisk) {
      setUpdateStatus(selectedRisk.status || selectedRisk.current_status || "Open");
    }
  };

  const handleUpdateStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUpdateRiskId) {
      triggerToast("Please select a Risk ID to update");
      return;
    }

    const selectedRisk = allRows.find((r) => r.risk_id === selectedUpdateRiskId || r.id === selectedUpdateRiskId);
    if (!selectedRisk) {
      triggerToast("Selected Risk not found");
      return;
    }

    const oldStatus = selectedRisk.status || selectedRisk.current_status || "Open";
    const newRemarks = updateRemarks.trim() || `Status updated to ${updateStatus}`;

    const newHistoryEntry = {
      id: Date.now(),
      risk_id: selectedRisk.risk_id,
      account: selectedRisk.account || "Hetero Healthcare Limited",
      project: selectedRisk.manual_project_id || selectedRisk.project_description || "Healthcare Core Portal",
      created_at: new Date().toISOString(),
      updated_by: user?.email || user?.name || "VP User",
      old_status: oldStatus,
      new_status: updateStatus,
      remarks: newRemarks,
    };

    // Save to localStorage so updates are permanently preserved
    const savedLocal = JSON.parse(localStorage.getItem("ride_risk_history") || "[]");
    localStorage.setItem("ride_risk_history", JSON.stringify([newHistoryEntry, ...savedLocal]));

    setMasterHistoryList((prev) => [newHistoryEntry, ...prev]);
    setHistoryPage(1);

    try {
      const dbId = selectedRisk.id;
      const payload = {
        status: updateStatus,
        current_status: updateStatus,
        remarks: newRemarks,
        comments: newRemarks,
        last_reviewed_date: new Date().toISOString().slice(0, 10),
      };

      await updateRiskApi(dbId, payload);
      triggerToast("✅ Risk Status Updated Successfully!");

      setUpdateRemarks("");
      await loadData();
      await loadMasterHistory();
    } catch (err) {
      console.error("Update risk status error", err);
      triggerToast("❌ Failed to update status");
    }
  };

  const handleExport = () => {
    const exportData = window.__EXPORT_DATA__?.["risks"];
    if (!exportData || !exportData.rows?.length) {
      triggerToast("No data available to export");
      return;
    }
    exportToExcel(exportData);
    triggerToast("✅ Exported Risks to Excel");
  };

  // Sort history newest first & paginate 5 items per page
  const sortedHistoryList = [...masterHistoryList].sort((a, b) => {
    const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
    const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
    return timeB - timeA;
  });

  const HISTORY_PER_PAGE = 5;
  const totalHistoryPages = Math.ceil(sortedHistoryList.length / HISTORY_PER_PAGE) || 1;
  const paginatedHistoryList = sortedHistoryList.slice(
    (historyPage - 1) * HISTORY_PER_PAGE,
    historyPage * HISTORY_PER_PAGE
  );

  const risksForUpdateDropdown = selectedUpdateProjectFilter
    ? allRows.filter((r) => (r.manual_project_id || r.project_description || r.project) === selectedUpdateProjectFilter)
    : allRows;

  const uniqueProjectOptions = Array.from(
    new Set(allRows.map((r) => r.manual_project_id || r.project_description || r.project).filter(Boolean))
  );



  return (
    <motion.div
      className="min-h-[calc(100vh-80px)] flex flex-col gap-3.5 bg-slate-50/50 px-2.5 sm:px-4 py-3 relative font-urbanist"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Toast Banner */}
      {showToast && (
        <div className="fixed top-4 right-1/2 translate-x-1/2 z-50 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xl animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Header Hero Section */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">VP Risk Management</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100/80">
            Total Risks: {totalRisksCount}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs font-bold text-slate-600">
            <FiClock size={14} className="text-indigo-600" />
            <span>Last Updated: Today 1:05 PM</span>
          </div>

          {/* Segmented Control Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setActiveTab("view")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                activeTab === "view"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FiList size={15} />
              View Dashboard
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
                activeTab === "create"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FiPlusCircle size={15} />
              Create Risk
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: VIEW TAB */}
      {activeTab === "view" && (
        <div className="flex flex-col gap-5">
          {/* SECTION 1: 4 Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {/* KPI 1: OPEN */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl border border-rose-200/70 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-100">
                  OPEN
                </span>
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
                  <FiAlertTriangle size={20} />
                </div>
              </div>
              <div className="my-3">
                <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">{counts.open}</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">{counts.open === 1 ? '1 Active Risk' : `${counts.open} Active Risks`}</p>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
                <span className="font-extrabold text-rose-600 flex items-center gap-1">
                  ▲ +2 this week
                </span>
                <span className="text-slate-400 font-medium">Updated 2m ago</span>
              </div>
            </motion.div>

            {/* KPI 2: CLOSURE SUBMITTED */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-sky-200/70 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-100">
                  CLOSURE SUBMITTED
                </span>
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0">
                  <FiSend size={20} />
                </div>
              </div>
              <div className="my-3">
                <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">{counts.closureSubmitted}</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">Pending Approvals</p>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
                <span className="font-extrabold text-sky-600 flex items-center gap-1">
                  ● Stable
                </span>
                <span className="text-slate-400 font-medium">Updated 5m ago</span>
              </div>
            </motion.div>

            {/* KPI 3: CLOSED & ACKNOWLEDGED */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-emerald-200/70 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100">
                  CLOSED & ACK
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                  <FiCheckCircle size={20} />
                </div>
              </div>
              <div className="my-3">
                <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">{counts.closedAcknowledged}</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">Resolved Risks</p>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
                <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                  ▲ +1 today
                </span>
                <span className="text-slate-400 font-medium">Updated 1h ago</span>
              </div>
            </motion.div>

            {/* KPI 4: HOLD */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl border border-amber-200/70 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-100">
                  HOLD
                </span>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                  <FiPauseCircle size={20} />
                </div>
              </div>
              <div className="my-3">
                <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight">{counts.hold}</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">Paused Logs</p>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
                <span className="font-extrabold text-amber-600 flex items-center gap-1">
                  ● Unchanged
                </span>
                <span className="text-slate-400 font-medium">Updated 3h ago</span>
              </div>
            </motion.div>
          </div>

          {/* SECTION 2: Executive Analytics Strip (Side-by-Side Cards) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Risk Priority Distribution Card (7 cols) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between lg:col-span-7"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Risk Priority Distribution
                  </h3>
                </div>
                <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                  Total: {totalPriorityCount} Risks
                </span>
              </div>

              <div className="flex flex-col gap-3 my-auto pt-3">
                {/* High Priority */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl bg-rose-50/60 border border-rose-100/90 transition-colors">
                  <span className="w-20 sm:w-24 text-xs font-black text-rose-950 uppercase tracking-wider shrink-0">High</span>
                  <div className="flex-1 h-3.5 rounded-full bg-rose-100/80 overflow-hidden shadow-inner min-w-[60px]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${totalPriorityCount ? Math.round((priorityCounts.High / totalPriorityCount) * 100) : 0}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-rose-500 to-red-600 rounded-full"
                    />
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <span className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
                      {totalPriorityCount ? Math.round((priorityCounts.High / totalPriorityCount) * 100) : 0}%
                    </span>
                    <span className="text-[11px] sm:text-xs font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                      {priorityCounts.High} Risks
                    </span>
                  </div>
                </div>

                {/* Medium Priority */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl bg-amber-50/60 border border-amber-100/90 transition-colors">
                  <span className="w-20 sm:w-24 text-xs font-black text-amber-950 uppercase tracking-wider shrink-0">Medium</span>
                  <div className="flex-1 h-3.5 rounded-full bg-amber-100/80 overflow-hidden shadow-inner min-w-[60px]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${totalPriorityCount ? Math.round((priorityCounts.Medium / totalPriorityCount) * 100) : 0}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                    />
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <span className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
                      {totalPriorityCount ? Math.round((priorityCounts.Medium / totalPriorityCount) * 100) : 0}%
                    </span>
                    <span className="text-[11px] sm:text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                      {priorityCounts.Medium} Risks
                    </span>
                  </div>
                </div>

                {/* Low Priority */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100/90 transition-colors">
                  <span className="w-20 sm:w-24 text-xs font-black text-emerald-950 uppercase tracking-wider shrink-0">Low</span>
                  <div className="flex-1 h-3.5 rounded-full bg-emerald-100/80 overflow-hidden shadow-inner min-w-[60px]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${totalPriorityCount ? Math.round((priorityCounts.Low / totalPriorityCount) * 100) : 0}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                    />
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <span className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
                      {totalPriorityCount ? Math.round((priorityCounts.Low / totalPriorityCount) * 100) : 0}%
                    </span>
                    <span className="text-[11px] sm:text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                      {priorityCounts.Low} Risks
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Aging Overview Card (5 cols) */}
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
                  {openPercentage}% of Risks are Open
                </span>
              </div>

              {/* Stacked Progress Bar with Framer Motion Width Animations & Inner Numbers */}
              <div className="my-3">
                <div className="w-full h-5 rounded-full bg-slate-100 overflow-hidden flex shadow-inner p-0.5">
                  {openCount > 0 ? (
                    <>
                      {overdue > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(overdue / openCount) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                          className="bg-rose-500 h-full rounded-l-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden"
                          title={`Overdue: ${overdue}`}
                        >
                          {overdue}
                        </motion.div>
                      )}
                      {dueTodayTomorrow > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(dueTodayTomorrow / openCount) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.35 }}
                          className="bg-amber-500 h-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden"
                          title={`Due Today/Tomorrow: ${dueTodayTomorrow}`}
                        >
                          {dueTodayTomorrow}
                        </motion.div>
                      )}
                      {dueThisWeek > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(dueThisWeek / openCount) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
                          className="bg-sky-500 h-full flex items-center justify-center text-[10px] font-black text-white px-1 shadow-xs overflow-hidden"
                          title={`Due This Week: ${dueThisWeek}`}
                        >
                          {dueThisWeek}
                        </motion.div>
                      )}
                      {onTrack > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(onTrack / openCount) * 100}%` }}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 flex-1">
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
                <option value="Financial">Financial</option>
                <option value="Schedule">Schedule</option>
              </select>

              <select
                name="probability"
                value={filters.probability}
                onChange={(e) => setFilters((p) => ({ ...p, probability: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              >
                <option value="">Probability (All)</option>
                <option value="Rare">Rare</option>
                <option value="Possible">Possible</option>
                <option value="Likely (Regularly)">Likely (Regularly)</option>
              </select>

              <select
                name="impact"
                value={filters.impact}
                onChange={(e) => setFilters((p) => ({ ...p, impact: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold outline-none focus:bg-white focus:border-indigo-500 transition-colors"
              >
                <option value="">Impact (All)</option>
                <option value="Minor">Minor</option>
                <option value="Moderate">Moderate</option>
                <option value="Major">Major</option>
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
                  setFilters({ account: "", status: "", priority: "", category: "", probability: "", impact: "" });
                  setGlobalSearch("");
                }}
                className="rounded-xl bg-slate-100 text-slate-600 p-2.5 border border-slate-200 hover:bg-slate-200 transition shadow-2xs shrink-0"
                title="Reset Filters"
              >
                <FiRotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* SECTION 5: Master Risk Table (Displaying 24 Required Database Fields) */}
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-x-auto min-h-[300px]">
            {loading ? (
              <div className="p-12 text-center text-sm font-bold text-slate-500 flex items-center justify-center gap-3">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Loading Master Risks Table...
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse min-w-[2000px]">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider sticky top-0 backdrop-blur z-10">
                  <tr>
                    <th className="p-3.5 w-12 text-center">No</th>
                    <th className="p-3.5 min-w-[130px]">Created By</th>
                    <th className="p-3.5 min-w-[120px]">Account</th>
                    <th className="p-3.5 min-w-[110px]">Risk ID</th>
                    <th className="p-3.5 min-w-[110px]">Project ID</th>
                    <th className="p-3.5 min-w-[180px]">Project Description</th>
                    <th className="p-3.5 min-w-[120px]">Identified Date</th>
                    <th className="p-3.5 min-w-[130px]">Identified By</th>
                    <th className="p-3.5 min-w-[130px]">Created At</th>
                    <th className="p-3.5 min-w-[130px]">Updated At</th>
                    <th className="p-3.5 min-w-[140px]">Status</th>
                    <th className="p-3.5 min-w-[110px]">Priority</th>
                    <th className="p-3.5 min-w-[120px]">Category</th>
                    <th className="p-3.5 min-w-[180px]">Risk Title</th>
                    <th className="p-3.5 min-w-[220px]">Risk Description</th>
                    <th className="p-3.5 min-w-[110px]">Probability</th>
                    <th className="p-3.5 min-w-[100px]">Impact</th>
                    <th className="p-3.5 min-w-[110px]">Risk Score</th>
                    <th className="p-3.5 min-w-[200px]">Mitigation Strategy</th>
                    <th className="p-3.5 min-w-[130px]">Mitigation Owner</th>
                    <th className="p-3.5 min-w-[140px]">Target Mitigation Date</th>
                    <th className="p-3.5 min-w-[130px]">Current Status</th>
                    <th className="p-3.5 min-w-[140px]">Last Reviewed Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => {
                    const stMeta = getStatusMeta(row.status || row.current_status);
                    return (
                      <tr key={row.id || idx} className={`${stMeta.rowBg || "bg-white"} hover:bg-slate-50/80 transition-colors text-slate-800 border-b border-slate-100`}>
                        <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3.5 font-semibold text-slate-700">{row.created_by || "—"}</td>
                        <td className="p-3.5 font-bold text-slate-900">{row.account || "—"}</td>
                        <td className="p-3.5 font-black text-indigo-700">{row.risk_id}</td>
                        <td className="p-3.5 font-semibold text-slate-700">{row.manual_project_id || "—"}</td>
                        <td className="p-3.5 max-w-xs truncate text-slate-600">{row.project_description || "—"}</td>
                        <td className="p-3.5 font-medium text-slate-600">{formatDateOnly(row.identified_date)}</td>
                        <td className="p-3.5 text-slate-600">{row.identified_by || "—"}</td>
                        <td className="p-3.5 text-slate-500">{formatDateOnly(row.created_at)}</td>
                        <td className="p-3.5 text-slate-500">{formatDateOnly(row.updated_at)}</td>
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
                            {row.priority || "Medium"}
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-slate-600">{row.category || "—"}</td>
                        <td className="p-3.5 font-bold text-slate-900 max-w-xs truncate">{row.risk_title || "—"}</td>
                        <td className="p-3.5 max-w-sm"><TruncatedCell content={String(row.risk_description || "")} /></td>
                        <td className="p-3.5 text-slate-600">{row.probability || "—"}</td>
                        <td className="p-3.5 text-slate-600">{row.impact || "—"}</td>
                        <td className="p-3.5 font-black text-slate-700">{row.risk_score || "—"}</td>
                        <td className="p-3.5 max-w-sm"><TruncatedCell content={String(row.mitigation_strategy || "")} /></td>
                        <td className="p-3.5 font-semibold text-slate-800">{row.mitigation_owner || "—"}</td>
                        <td className="p-3.5 font-bold text-rose-700">{formatDateOnly(row.target_mitigation_date)}</td>
                        <td className="p-3.5 text-slate-600">{row.current_status || row.status || "—"}</td>
                        <td className="p-3.5 text-slate-500">{formatDateOnly(row.last_reviewed_date)}</td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={23} className="p-10 text-center text-sm font-semibold text-slate-400">
                        No risks found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CREATE RISK TAB */}
      {activeTab === "create" && (
        <div className="flex flex-col gap-6">
          {/* SECTION A: Dedicated Create Risk Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div>
                <h2 className="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                  <FiPlusCircle className="text-indigo-600" /> Create New Risk
                </h2>
                <p className="text-xs text-gray-500">Fill in the official Risk parameters into the database</p>
              </div>

              <span className="text-xs font-black px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                Risk ID: {createForm.risk_id}
              </span>
            </div>

            <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Risk ID (Auto Generated) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Risk ID (Auto Generated)</label>
                <input
                  type="text"
                  value={createForm.risk_id}
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist focus:ring-2 focus:ring-indigo-500 outline-none"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist focus:ring-2 focus:ring-indigo-500 outline-none"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist focus:ring-2 focus:ring-indigo-500 outline-none"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Identified Date (Current Date) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Identified Date</label>
                <input
                  type="date"
                  value={createForm.identified_date}
                  onChange={(e) => setCreateForm((p) => ({ ...p, identified_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                />
              </div>

              {/* Identified By (Current Logged-in User) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Identified By</label>
                <input
                  type="text"
                  value={createForm.identified_by}
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              {/* Probability */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Probability</label>
                <select
                  value={createForm.probability}
                  onChange={(e) => setCreateForm((p) => ({ ...p, probability: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                >
                  <option value="Rare">Rare</option>
                  <option value="Possible">Possible</option>
                  <option value="Likely (Regularly)">Likely (Regularly)</option>
                </select>
              </div>

              {/* Impact */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Impact</label>
                <select
                  value={createForm.impact}
                  onChange={(e) => setCreateForm((p) => ({ ...p, impact: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                >
                  <option value="Minor">Minor</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Major">Major</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                >
                  <option value="Technical">Technical</option>
                  <option value="Operational">Operational</option>
                  <option value="Resource">Resource</option>
                  <option value="Financial">Financial</option>
                  <option value="Schedule">Schedule</option>
                </select>
              </div>

              {/* Mitigation Owner */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mitigation Owner</label>
                <input
                  type="text"
                  placeholder="Owner name / email"
                  value={createForm.mitigation_owner}
                  onChange={(e) => setCreateForm((p) => ({ ...p, mitigation_owner: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                />
              </div>

              {/* Target Mitigation Date */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Target Mitigation Date</label>
                <input
                  type="date"
                  value={createForm.target_mitigation_date}
                  onChange={(e) => setCreateForm((p) => ({ ...p, target_mitigation_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                />
              </div>

              {/* Risk Title */}
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">Risk Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Summary title of the risk..."
                  value={createForm.risk_title}
                  onChange={(e) => setCreateForm((p) => ({ ...p, risk_title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Risk Description */}
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">Risk Description</label>
                <textarea
                  rows={3}
                  placeholder="Detailed description of the identified risk..."
                  value={createForm.risk_description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, risk_description: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 p-3 text-xs font-urbanist"
                />
              </div>

              {/* Mitigation Strategy */}
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">Mitigation Strategy</label>
                <textarea
                  rows={2}
                  placeholder="Planned mitigation steps and preventative measures..."
                  value={createForm.mitigation_strategy}
                  onChange={(e) => setCreateForm((p) => ({ ...p, mitigation_strategy: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 p-3 text-xs font-urbanist"
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

          {/* SECTION B: UPDATE RISK & UPDATE HISTORY */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Update Status Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col gap-4">
              <div className="border-b border-gray-100 pb-2">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Update Status</h3>
                <div className="flex items-center justify-between mt-1 text-xs flex-wrap gap-1">
                  <span className="font-bold text-gray-600">
                    Selected: <strong className="text-indigo-600">{selectedUpdateRiskId || "None"}</strong>
                    {selectedUpdateRiskId && (
                      <span className="text-indigo-800 font-semibold">
                        {" "}— {allRows.find(r => r.risk_id === selectedUpdateRiskId || r.id === selectedUpdateRiskId)?.manual_project_id || allRows.find(r => r.risk_id === selectedUpdateRiskId || r.id === selectedUpdateRiskId)?.project_description || "Healthcare Core Portal"}
                      </span>
                    )}
                  </span>
                  <span className="font-bold text-gray-600">Current Status: <strong className="text-gray-900">{allRows.find(r => r.risk_id === selectedUpdateRiskId || r.id === selectedUpdateRiskId)?.status || "Open"}</strong></span>
                </div>
              </div>

              <form onSubmit={handleUpdateStatusSubmit} className="flex flex-col gap-4">
                {/* Project Filter & Risk Selection Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Filter by Project</label>
                    <select
                      value={selectedUpdateProjectFilter}
                      onChange={(e) => {
                        setSelectedUpdateProjectFilter(e.target.value);
                        setSelectedUpdateRiskId("");
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">All Projects</option>
                      {uniqueProjectOptions.map((proj) => (
                        <option key={proj} value={proj}>
                          📁 {proj}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Select Risk ID</label>
                    <select
                      value={selectedUpdateRiskId}
                      onChange={(e) => handleSelectRiskForUpdate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">[ Select Risk ID ]</option>
                      {risksForUpdateDropdown.map((r) => {
                        const projName = r.manual_project_id || r.project_description || r.project || "Healthcare Core Portal";
                        return (
                          <option key={r.id || r.risk_id} value={r.risk_id}>
                            {r.risk_id} — {projName} ({r.status || "Open"})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* New Status Workflow Options */}
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
                          name="newStatusRadio"
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

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Remarks</label>
                  <textarea
                    rows={3}
                    placeholder="What changed? Add a short update..."
                    value={updateRemarks}
                    onChange={(e) => setUpdateRemarks(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-3 text-xs font-urbanist outline-none focus:border-indigo-500"
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
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between min-h-[460px]">
              <div className="flex flex-col gap-4">
                <div className="border-b border-gray-100 pb-2 flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Update History</h3>
                  <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {sortedHistoryList.length > 0 ? `Total Updates: ${sortedHistoryList.length}` : "Recent System Activity"}
                  </span>
                </div>

                {loadingHistory ? (
                  <div className="p-6 text-center text-xs text-gray-500 font-bold">Loading timeline...</div>
                ) : (
                  <div className="flex flex-col gap-3 overflow-y-auto max-h-[360px] pr-1">
                    {paginatedHistoryList.map((item, idx) => {
                      const isSelected = selectedUpdateRiskId && (item.risk_id === selectedUpdateRiskId || item.id === selectedUpdateRiskId);
                      const matchedRisk = allRows.find(r => r.risk_id === item.risk_id || r.id === item.risk_id);
                      const accName = item.account || matchedRisk?.account || "Arche Global";
                      const projName = item.project || item.manual_project_id || matchedRisk?.manual_project_id || matchedRisk?.project_description || "Governance Suite 1.0";

                      return (
                        <motion.div
                          key={item.id || idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className={`p-3 rounded-lg border relative pl-4 border-l-4 transition-all ${
                            isSelected
                              ? "bg-indigo-50/90 border-indigo-300 border-l-indigo-600 shadow-xs"
                              : "bg-gray-50 border-gray-200/70 border-l-slate-400"
                          }`}
                        >
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="font-bold text-gray-900 flex items-center gap-2">
                              {item.risk_id && (
                                <span className={`font-black px-1.5 py-0.5 rounded text-[10px] ${
                                  isSelected ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700"
                                }`}>
                                  {item.risk_id}
                                </span>
                              )}
                              {formatDateOnly(item.created_at)}
                            </span>
                            <span className="font-semibold text-indigo-700">{item.updated_by || "User"}</span>
                          </div>

                          {/* Account & Project Metadata Badges */}
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

                    {sortedHistoryList.length === 0 && (
                      <div className="p-8 text-center text-xs text-gray-400 italic">
                        No status updates recorded yet in the system.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pagination Bar */}
              {totalHistoryPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-1 text-xs">
                  <span className="text-gray-500 font-semibold">
                    Page <strong>{historyPage}</strong> of <strong>{totalHistoryPages}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage((p) => Math.max(p - 1, 1))}
                      className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      ‹ Prev
                    </button>
                    <button
                      type="button"
                      disabled={historyPage >= totalHistoryPages}
                      onClick={() => setHistoryPage((p) => Math.min(p + 1, totalHistoryPages))}
                      className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Next ›
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MonitoringRisksPage;
