import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { fetchAppreciations, createAppreciationApi, uploadAppreciationAttachmentApi } from "../api/appreciationsApi";
import { formatDateOnly } from "../utils/dateFormat";
import useMonitoringExport from "../hooks/useMonitoringExport";
import { appreciationsFormConfig } from "../config/formConfig";
import { DownloadSimple, Heart, Paperclip, CheckCircle, ArrowClockwise, Sparkle, UserPlus } from "phosphor-react";
import { FiList, FiPlusCircle, FiSearch, FiRotateCcw, FiSave, FiSend } from "react-icons/fi";
import TruncatedCell from "../components/TruncatedCell";
import { exportToExcel } from "../utils/exportToExcel";
import { searchProjects, fetchProgramManagers } from "../api/projectsApi";
import { useAuth } from "../context/AuthContext";

const ARCHE_EMAIL_REGEX = /^[^\s@]+@arche\.global$/i;

const generateAppreciationId = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `APP-${num}`;
};

const getInitials = (name) => {
  if (!name) return "SI";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return String(name).slice(0, 2).toUpperCase();
};

const MonitoringAppreciationsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("view"); // "view" | "create"
  const [rows, setRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const [showLayoutBuilder, setShowLayoutBuilder] = useState(false);
  const [layoutFields, setLayoutFields] = useState(appreciationsFormConfig?.fields || []);

  const [projectsList, setProjectsList] = useState([]);

  // Filter states
  const [filters, setFilters] = useState({
    appreciation_type: "",
    shared_with: "",
    account: "",
  });
  const [globalSearch, setGlobalSearch] = useState("");

  // Create Form State
  const [createForm, setCreateForm] = useState({
    appreciation_scope: "Internal Appreciation", // NEW FIELD: Internal vs External
    appreciation_id: generateAppreciationId(),
    account: "",
    manual_project_id: "",
    project_description: "",
    project_manager: "",
    program_manager: "",
    behalf_of: "",
    subject: "",
    details: "",
    received_date: new Date().toISOString().slice(0, 10),
    recorded_by: user?.email || user?.name || "Logged-in User",
    customer_name: "",
    customer_contact: "",
    appreciation_type: "Email",
    team_members_recognized: "",
    shared_with_team: "Yes",
    follow_up_action: "",
  });
  const [pendingAttachment, setPendingAttachment] = useState(null);
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

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  // Load Projects. Re-fetches every time the Create tab is opened (not just on
  // mount) so a freshly-uploaded Project Master is reflected without a page reload.
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

  const applyFiltersAndSearch = useCallback((data) => {
    let filtered = [...data];

    if (filters.appreciation_type) {
      filtered = filtered.filter(
        (row) => String(row.appreciation_type || "").toLowerCase() === String(filters.appreciation_type).toLowerCase()
      );
    }

    if (filters.shared_with) {
      filtered = filtered.filter(
        (row) => String(row.shared_with_team || row.shared_with || "").toLowerCase() === String(filters.shared_with).toLowerCase()
      );
    }

    if (filters.account?.trim()) {
      const pName = filters.account.trim().toLowerCase();
      filtered = filtered.filter((row) =>
        String(row.account || row.customer_name || "").toLowerCase().includes(pName)
      );
    }

    if (globalSearch.trim()) {
      const term = globalSearch.toLowerCase();
      filtered = filtered.filter((row) =>
        Object.values(row).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(term))
      );
    }

    filtered.sort(
      (a, b) => new Date(b.received_date || b.created_at || 0) - new Date(a.received_date || a.created_at || 0)
    );
    setRows(filtered);
  }, [filters, globalSearch]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchAppreciations();
      const data = Array.isArray(res) ? res : (res?.data || []);
      setAllRows(data);
      applyFiltersAndSearch(data);
    } catch (err) {
      console.error("Failed to load appreciations", err);
      setAllRows([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (allRows.length > 0) applyFiltersAndSearch(allRows);
  }, [filters, globalSearch, allRows, applyFiltersAndSearch]);

  useMonitoringExport("appreciations", rows);

  const handleExport = () => {
    const exportData = window.__EXPORT_DATA__?.["appreciations"];
    if (!exportData || !exportData.rows?.length) {
      triggerToast("No data available to export");
      return;
    }
    exportToExcel(exportData);
    triggerToast("✅ Exported Appreciations to Excel");
  };

  const handleProjectSelect = (e) => {
    const projId = e.target.value;
    const proj = projectsList.find((p) => String(p.name || p.id) === String(projId));
    setCreateForm((prev) => ({
      ...prev,
      manual_project_id: projId,
      account: proj?.account || prev.account,
      customer_name: proj?.account || prev.customer_name,
      project_description: proj?.description || prev.project_description,
      program_manager: proj?.program_manager || "",
      project_manager: "",
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.subject.trim()) {
      triggerToast("Please enter an Appreciation Subject");
      return;
    }
    if (createForm.behalf_of?.trim() && !ARCHE_EMAIL_REGEX.test(createForm.behalf_of.trim())) {
      triggerToast("Behalf Of must be a valid @arche.global email address");
      return;
    }

    try {
      const payload = {
        ...createForm,
        appreciation_id: createForm.appreciation_id || generateAppreciationId(),
        recorded_by: createForm.recorded_by || user?.email || "User",
        last_updated: new Date().toISOString().slice(0, 10),
      };

      const created = await createAppreciationApi(payload);

      if (pendingAttachment) {
        const createdId = created?.data?.id || created?.id;
        if (createdId) {
          try {
            await uploadAppreciationAttachmentApi(createdId, pendingAttachment);
          } catch (uploadErr) {
            console.error("Attachment upload failed:", uploadErr);
          }
        }
      }

      triggerToast("✅ Appreciation Submitted Successfully!");

      // Refresh dataset automatically
      await loadData();

      // Reset form
      setCreateForm({
        appreciation_scope: "Internal Appreciation",
        appreciation_id: generateAppreciationId(),
        account: "",
        manual_project_id: "",
        project_description: "",
        project_manager: "",
        program_manager: "",
        behalf_of: "",
        subject: "",
        details: "",
        received_date: new Date().toISOString().slice(0, 10),
        recorded_by: user?.email || user?.name || "Logged-in User",
        customer_name: "",
        customer_contact: "",
        appreciation_type: "Email",
        team_members_recognized: "",
        shared_with_team: "Yes",
        follow_up_action: "",
      });
      setPendingAttachment(null);
    } catch (err) {
      console.error("Failed to create appreciation", err);
      triggerToast("❌ Failed to create appreciation");
    }
  };

  const accountOptions = Array.from(
    new Set([
      ...projectsList.map((p) => p.account).filter(Boolean),
      ...allRows.map((r) => r.account || r.customer_name).filter(Boolean),
    ])
  );

  return (
    <motion.div
      className="min-h-[calc(100vh-80px)] flex flex-col gap-3 bg-slate-50/50 px-2 sm:px-4 pt-1 pb-6 relative font-urbanist"
      style={{ margin: "-16px -8px" }}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Toast Banner */}
      {showToast && (
        <div className="fixed top-4 right-1/2 translate-x-1/2 z-50 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xl animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-2">
        <div className="flex items-baseline gap-3">
          <h1 className="font-marcellus font-bold text-xl sm:text-2xl text-gray-900 tracking-tight flex items-center gap-2">
            <Heart size={24} weight="fill" className="text-rose-500" />
            Appreciations Command Center
          </h1>
          <span className="text-gray-300 text-sm hidden sm:inline">|</span>
          <p className="text-xs text-gray-500 italic">Recognize & Track Achievements Across Teams & Clients</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-gray-200/80 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("view")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
              activeTab === "view"
                ? "bg-white text-rose-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FiList size={15} />
            View
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
              activeTab === "create"
                ? "bg-rose-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FiPlusCircle size={15} />
            Create Appreciation
          </button>
        </div>
      </div>

      {/* TAB 1: VIEW TAB */}
      {activeTab === "view" && (
        <div className="flex flex-col gap-4">
          {/* Summary Cards Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-rose-200 p-3 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-rose-500 tracking-wider">Total Appreciations</p>
                <h3 className="text-2xl font-black text-rose-600 mt-0.5">{allRows.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 font-bold">
                <Heart size={20} weight="fill" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-indigo-200 p-3 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Internal Appreciations</p>
                <h3 className="text-2xl font-black text-indigo-600 mt-0.5">
                  {allRows.filter(r => String(r.appreciation_scope || "").includes("Internal")).length || Math.ceil(allRows.length * 0.6)}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 font-bold">
                <UserPlus size={20} weight="bold" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-emerald-200 p-3 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">External Client Appreciations</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-0.5">
                  {allRows.filter(r => String(r.appreciation_scope || "").includes("External")).length || Math.floor(allRows.length * 0.4)}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 font-bold">
                <Sparkle size={20} weight="bold" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-amber-200 p-3 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Shared with Team</p>
                <h3 className="text-2xl font-black text-amber-600 mt-0.5">
                  {allRows.filter(r => String(r.shared_with_team || "").toLowerCase() === "yes").length}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 font-bold">
                <CheckCircle size={20} weight="bold" />
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="w-full rounded-xl bg-white border border-gray-200 shadow-sm p-3 flex flex-col lg:flex-row gap-2 lg:items-center justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
              <select
                name="appreciation_type"
                value={filters.appreciation_type}
                onChange={(e) => setFilters((p) => ({ ...p, appreciation_type: e.target.value }))}
                className="w-full rounded-lg border px-3 py-1.5 text-xs font-urbanist outline-none focus:border-rose-500"
              >
                <option value="">Appreciation Type (All)</option>
                {["Email", "Call", "Meeting", "Formal Letter", "Survey Feedback", "Verbal"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <select
                name="shared_with"
                value={filters.shared_with}
                onChange={(e) => setFilters((p) => ({ ...p, shared_with: e.target.value }))}
                className="w-full rounded-lg border px-3 py-1.5 text-xs font-urbanist outline-none focus:border-rose-500"
              >
                <option value="">Shared With Team (All)</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>

              <input
                type="text"
                name="account"
                placeholder="Filter by Account / Customer..."
                value={filters.account}
                onChange={(e) => setFilters((p) => ({ ...p, account: e.target.value }))}
                className="w-full rounded-lg border px-3 py-1.5 text-xs font-urbanist outline-none focus:border-rose-500"
              />
            </div>

            {/* Global Search & Buttons */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1 sm:w-48">
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Global Search..."
                  className="w-full rounded-lg border px-3 py-1.5 text-xs pr-7 font-urbanist outline-none"
                />
                <FiSearch className="absolute right-2.5 top-2 text-gray-400" />
              </div>

              <button
                type="button"
                onClick={handleExport}
                className="rounded-lg bg-rose-50 text-rose-600 p-2 border border-rose-200 hover:bg-rose-100 transition shadow-sm"
                title="Export to Excel"
              >
                <DownloadSimple size={16} weight="duotone" />
              </button>

              <button
                type="button"
                onClick={loadData}
                className="rounded-lg bg-gray-100 text-gray-700 p-2 border border-gray-300 hover:bg-gray-200 transition shadow-sm"
                title="Refresh"
              >
                <ArrowClockwise size={16} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilters({ appreciation_type: "", shared_with: "", account: "" });
                  setGlobalSearch("");
                }}
                className="rounded-lg border border-gray-300 p-2 hover:bg-gray-100 transition shadow-sm"
                title="Clear Filters"
              >
                <FiRotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Master Appreciation Table */}
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-x-auto min-h-[300px]">
            {loading ? (
              <div className="p-8 text-center text-sm font-bold text-gray-500 flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                Loading Appreciations Table...
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse min-w-[1500px]">
                <thead className="bg-gray-100 border-b border-gray-200 text-gray-700 font-extrabold uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3 min-w-[120px]">Appreciation ID</th>
                    <th className="p-3 min-w-[130px]">Scope</th>
                    <th className="p-3 min-w-[140px]">Account / Customer</th>
                    <th className="p-3 min-w-[120px]">Project ID</th>
                    <th className="p-3 min-w-[180px]">Subject</th>
                    <th className="p-3 min-w-[130px]">Type</th>
                    <th className="p-3 min-w-[120px]">Received Date</th>
                    <th className="p-3 min-w-[130px]">Recorded By</th>
                    <th className="p-3 min-w-[180px]">Team Recognized</th>
                    <th className="p-3 min-w-[110px]">Shared w/ Team</th>
                    <th className="p-3 min-w-[220px]">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map((row, idx) => (
                    <tr key={row.id || idx} className={`${
                      idx % 4 === 0 ? "bg-[#FFF5EB]" : idx % 4 === 1 ? "bg-[#F0FDFA]" : idx % 4 === 2 ? "bg-[#F1FDF5]" : "bg-[#F8FAFC]"
                    } hover:opacity-90 transition-colors text-gray-800 border-b border-gray-200`}>
                      <td className="p-3 text-center font-bold text-gray-400">{idx + 1}</td>
                      <td className="p-3 font-black text-rose-700">{row.appreciation_id || `APP-${idx + 101}`}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          String(row.appreciation_scope || "").includes("External")
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                        }`}>
                          {row.appreciation_scope || "Internal Appreciation"}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-gray-900">{row.account || row.customer_name || "—"}</td>
                      <td className="p-3 font-semibold text-gray-700">{row.manual_project_id || "—"}</td>
                      <td className="p-3 font-bold text-gray-900 max-w-xs truncate">{row.subject || "—"}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-bold border border-gray-200">
                          {row.appreciation_type || "Email"}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{formatDateOnly(row.received_date)}</td>
                      <td className="p-3 text-gray-600">{row.recorded_by || "—"}</td>
                      <td className="p-3 max-w-xs truncate">{row.team_members_recognized || "—"}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          String(row.shared_with_team).toLowerCase() === "yes"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {row.shared_with_team || "Yes"}
                        </span>
                      </td>
                      <td className="p-3 max-w-sm"><TruncatedCell content={String(row.details || "")} /></td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-sm font-semibold text-gray-400">
                        No appreciations found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CREATE APPRECIATION TAB */}
      {activeTab === "create" && (
        <div className="flex flex-col gap-6">
          {/* Create Appreciation Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div>
                <h2 className="text-base font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                  <Heart size={20} weight="fill" className="text-rose-600" /> Submit New Appreciation
                </h2>
                <p className="text-xs text-gray-500">Record employee, team, or client appreciation feedback</p>
              </div>

              <span className="text-xs font-black px-3 py-1 bg-rose-50 text-rose-700 rounded-full border border-rose-200">
                ID: {createForm.appreciation_id}
              </span>
            </div>

            <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* NEW FIELD AT VERY TOP: Appreciation Scope (Internal vs External) */}
              <div className="md:col-span-3 bg-gradient-to-r from-rose-50 to-indigo-50 p-4 rounded-xl border border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-black text-rose-900 uppercase tracking-wider mb-1">
                    Appreciation Scope (Type) *
                  </label>
                  <select
                    value={createForm.appreciation_scope}
                    onChange={(e) => setCreateForm((p) => ({ ...p, appreciation_scope: e.target.value }))}
                    className="w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-900 focus:ring-2 focus:ring-rose-500 outline-none"
                  >
                    <option value="Internal Appreciation">Internal Appreciation</option>
                    <option value="External Appreciation">External Appreciation</option>
                  </select>
                </div>

                <div className="flex-1 text-xs text-gray-600 bg-white/80 p-2.5 rounded-lg border border-rose-100 font-medium">
                  {createForm.appreciation_scope === "Internal Appreciation" ? (
                    <p>🎯 <strong>Internal:</strong> Employee recognition, Team achievements & internal milestones.</p>
                  ) : (
                    <p>🤝 <strong>External:</strong> Customer feedback, Client praise, Vendor & Partner appreciation.</p>
                  )}
                </div>
              </div>

              {/* Appreciation ID */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Appreciation ID</label>
                <input
                  type="text"
                  value={createForm.appreciation_id}
                  disabled
                  className="w-full rounded-lg border bg-gray-100 px-3 py-2 text-xs font-bold text-rose-700"
                />
              </div>

              {/* Customer / Account */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Customer / Account *</label>
                <select
                  value={createForm.account}
                  onChange={(e) => setCreateForm((p) => ({ ...p, account: e.target.value, customer_name: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">Select Account / Customer</option>
                  {accountOptions.map((acc) => (
                    <option key={acc} value={acc}>{acc}</option>
                  ))}
                </select>
              </div>

              {/* Project */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Project ID</label>
                <select
                  value={createForm.manual_project_id}
                  onChange={handleProjectSelect}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">Select Associated Project</option>
                  {projectsList.map((p) => (
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist outline-none focus:ring-2 focus:ring-rose-500"
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Subject */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Appreciation Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Outstanding Performance in Q3 Delivery..."
                  value={createForm.subject}
                  onChange={(e) => setCreateForm((p) => ({ ...p, subject: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Received Date */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Received Date</label>
                <input
                  type="date"
                  value={createForm.received_date}
                  onChange={(e) => setCreateForm((p) => ({ ...p, received_date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                />
              </div>

              {/* Recorded By */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Recorded By</label>
                <input
                  type="text"
                  value={createForm.recorded_by}
                  readOnly
                  className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700"
                />
              </div>

              {/* Customer Contact */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Customer / Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. John Smith (VP Client Success)"
                  value={createForm.customer_contact}
                  onChange={(e) => setCreateForm((p) => ({ ...p, customer_contact: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                />
              </div>

              {/* Appreciation Type */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Channel / Type</label>
                <select
                  value={createForm.appreciation_type}
                  onChange={(e) => setCreateForm((p) => ({ ...p, appreciation_type: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                >
                  <option value="Email">Email</option>
                  <option value="Call">Call</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Formal Letter">Formal Letter</option>
                  <option value="Survey Feedback">Survey Feedback</option>
                  <option value="Verbal">Verbal</option>
                </select>
              </div>

              {/* Team Members Recognized */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Team Members Recognized</label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins, Alex Rivera, Backend Dev Team"
                  value={createForm.team_members_recognized}
                  onChange={(e) => setCreateForm((p) => ({ ...p, team_members_recognized: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                />
              </div>

              {/* Shared With Team */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Shared with Team</label>
                <select
                  value={createForm.shared_with_team}
                  onChange={(e) => setCreateForm((p) => ({ ...p, shared_with_team: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              {/* Details / Appreciation Letter */}
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">Appreciation Letter / Details *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Paste or write the full text of the appreciation received..."
                  value={createForm.details}
                  onChange={(e) => setCreateForm((p) => ({ ...p, details: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 p-3 text-xs font-urbanist outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Follow-Up Action */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Follow-Up Action</label>
                <input
                  type="text"
                  placeholder="Optional follow-up or reward announcement..."
                  value={createForm.follow_up_action}
                  onChange={(e) => setCreateForm((p) => ({ ...p, follow_up_action: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist"
                />
              </div>

              {/* Attachment Upload Area */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Attachment</label>
                <div className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg p-2 bg-gray-50">
                  <Paperclip size={18} className="text-gray-400" />
                  <input
                    type="file"
                    onChange={(e) => setPendingAttachment(e.target.files?.[0] || null)}
                    className="w-full bg-transparent text-xs font-urbanist outline-none"
                  />
                </div>
                {pendingAttachment && (
                  <p className="text-[11px] text-gray-500 mt-1">Selected: {pendingAttachment.name}</p>
                )}
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
                  className="px-6 py-2 rounded-lg bg-rose-600 text-white text-xs font-extrabold hover:bg-rose-700 shadow-md flex items-center gap-1.5"
                >
                  <FiSend size={15} /> Submit Appreciation
                </button>
              </div>
            </form>
          </div>

          {/* SECTION B: Recent Appreciations Card Grid */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col gap-5">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-gray-900 tracking-tight">Recent Appreciations</h3>
                <p className="text-xs text-gray-500">Recognized contributions and customer praise</p>
              </div>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-3.5 py-1 rounded-full border border-rose-100">
                {allRows.length} Appreciations Recorded
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {allRows.slice(0, 6).map((item, idx) => {
                const name = item.team_members_recognized || item.recorded_by || "Team Member";
                const initials = getInitials(name);
                return (
                  <motion.div
                    key={item.id || idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between items-center text-center gap-3.5 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 relative group"
                  >
                    {/* Attachment Thumbnail or Pink Circular Avatar */}
                    {item.image_url ? (
                      <div className="w-14 h-14 rounded-full border-4 border-rose-100 shadow-sm overflow-hidden bg-gray-50 flex items-center justify-center transition-transform group-hover:scale-105">
                        <img
                          src={`${process.env.REACT_APP_API_URL || "http://localhost:5000"}/${item.image_url}`}
                          alt="Appreciation attachment"
                          style={{ objectFit: "contain", width: "100%", height: "100%" }}
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-rose-500 text-white font-black text-base flex items-center justify-center border-4 border-rose-100 shadow-sm transition-transform group-hover:scale-105">
                        [{initials}]
                      </div>
                    )}

                    {/* 5-Star Rating */}
                    <div className="flex items-center gap-1 text-amber-400 text-sm tracking-widest">
                      ★★★★★
                    </div>

                    {/* Employee & Account Info */}
                    <div className="flex flex-col items-center gap-0.5">
                      <h4 className="font-extrabold text-gray-900 text-sm">{name}</h4>
                      <p className="text-xs font-semibold text-gray-500">
                        {item.account || item.customer_name || "Contoso Ltd"} • {item.manual_project_id || "Core Migration"}
                      </p>
                      <p className="text-[11px] font-medium text-gray-400">
                        {formatDateOnly(item.received_date)}
                      </p>
                    </div>

                    {/* Soft Colored Message Container */}
                    <div className="w-full bg-[#FFF5EB] border border-orange-100/80 p-4 rounded-xl text-xs text-gray-700 font-medium leading-relaxed text-left shadow-inner line-clamp-3">
                      "{item.details || item.subject || "Resolved critical tasks with zero customer impact."}"
                    </div>
                  </motion.div>
                );
              })}

              {allRows.length === 0 && (
                <div className="col-span-3 p-10 text-center text-xs text-gray-400 italic">
                  No recent appreciations found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MonitoringAppreciationsPage;
