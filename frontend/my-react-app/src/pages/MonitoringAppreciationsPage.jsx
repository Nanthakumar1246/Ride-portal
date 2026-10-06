import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  fetchAppreciations,
  createAppreciationApi,
  uploadAppreciationAttachmentApi,
  decideAppreciationApi,
} from "../api/appreciationsApi";
import { formatDateOnly } from "../utils/dateFormat";
import useMonitoringExport from "../hooks/useMonitoringExport";
import { appreciationsFormConfig } from "../config/formConfig";
import { DownloadSimple, Heart, Paperclip, CheckCircle, ArrowClockwise, Sparkle, UserPlus, Star } from "phosphor-react";
import { FiList, FiPlusCircle, FiSearch, FiRotateCcw, FiSave, FiSend } from "react-icons/fi";
import Pagination from "../components/Pagination";
import { exportToExcel } from "../utils/exportToExcel";
import { searchProjects, fetchProgramManagers } from "../api/projectsApi";
import { useAuth } from "../context/AuthContext";

const ARCHE_EMAIL_REGEX = /^[^\s@]+@arche\.global$/i;

const API_ORIGIN = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/api\/?$/, "");

const resolveUploadUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  // Normalize absolute Windows/Unix paths down to uploads/...
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

/* Round-avatar recognition card — name-first layout (photo/initials, star
   rating, centered team name, Account · Project, date, and a quote). */
const AppreciationTile = ({ item, idx, onOpen }) => {
  const photoUrl = getAppreciationPhotoUrl(item);
  const team = item.team_members_recognized || "—";
  const displayName = team !== "—" ? team.split(/[,;]/)[0].trim() : (item.recorded_by || "Team Member");
  const account = item.account || item.customer_name || "—";
  const project = item.project_description || item.manual_project_id || "";
  const initials = getInitials(team !== "—" ? team : item.recorded_by);
  const quote = item.subject || item.details || "";
  const dateStr = item.received_date || item.created_at;
  const status = String(item.status || "").toUpperCase();

  return (
    <button
      key={item.id || idx}
      type="button"
      onClick={() => onOpen(item)}
      className="relative text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col items-center hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-rose-400"
    >
      {/* Only a not-yet-approved appreciation is badged; an approved one is
          simply on display. */}
      {status && status !== "APPROVED" && (
        <span
          className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
            status === "REJECTED" ? "bg-gray-200 text-gray-600" : "bg-amber-100 text-amber-700"
          }`}
        >
          {status === "REJECTED" ? "Rejected" : "Pending Approval"}
        </span>
      )}

      {photoUrl ? (
        <img
          src={photoUrl}
          alt={displayName}
          className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-rose-400 text-white font-black text-lg flex items-center justify-center shadow-md">
          {initials}
        </div>
      )}

      <div className="flex items-center gap-0.5 mt-3">
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={13} weight="fill" className="text-rose-400" />
        ))}
      </div>

      <p className="text-sm font-black text-gray-900 mt-1.5 text-center truncate max-w-full" title={displayName}>
        {displayName}
      </p>
      <p className="text-[11px] font-semibold text-gray-400 text-center truncate max-w-full">
        {account}{project ? ` · ${project}` : ""}
      </p>
      {dateStr && (
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mt-0.5">
          {formatDateOnly(dateStr)}
        </p>
      )}

      {quote && (
        <div className="mt-3 w-full rounded-lg bg-rose-50 px-3 py-2.5 text-center">
          <p className="text-xs text-gray-700 leading-snug line-clamp-3">{quote}</p>
        </div>
      )}
    </button>
  );
};

const MonitoringAppreciationsPage = () => {
  const { user } = useAuth();
  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  // "Behalf Of" is only shown to an admin, and is optional for them.
  const showBehalfOf = isAdmin;
  const [decidingId, setDecidingId] = useState(null);
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const [filters, setFilters] = useState({
    appreciation_type: "",
    scope: "all", // "all" | "internal" | "external"
  });
  const [globalSearch, setGlobalSearch] = useState("");
  const [detailRow, setDetailRow] = useState(null);

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

    if (filters.scope === "internal") {
      filtered = filtered.filter((row) =>
        String(row.appreciation_scope || "Internal").toLowerCase().includes("internal")
      );
    } else if (filters.scope === "external") {
      filtered = filtered.filter((row) =>
        String(row.appreciation_scope || "").toLowerCase().includes("external")
      );
    }

    if (filters.appreciation_type) {
      filtered = filtered.filter(
        (row) => String(row.appreciation_type || "").toLowerCase() === String(filters.appreciation_type).toLowerCase()
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
    setCurrentPage(1);
  }, [filters, globalSearch, allRows, applyFiltersAndSearch]);

  // Awaiting approval. The server only returns these to an admin (who actions
  // them) or to the person who submitted them (who is tracking them).
  const pendingRows = allRows.filter((r) => String(r.status || "").toUpperCase() === "PENDING");

  const handleDecideAppreciation = async (row, decision) => {
    try {
      setDecidingId(row.id);
      await decideAppreciationApi(row.id, decision);
      triggerToast(
        decision === "APPROVED"
          ? "✅ Appreciation approved — it is now visible to everyone"
          : "Appreciation rejected"
      );
      await loadData();
    } catch (err) {
      console.error("Failed to record the approval decision", err);
      triggerToast("❌ Could not record the decision");
    } finally {
      setDecidingId(null);
    }
  };

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
          {/* ── Approval queue: an appreciation submitted by anyone other than
                 an admin stays hidden until an admin approves it here. ── */}
          {isAdmin && pendingRows.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-300 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200">
                <div>
                  <h3 className="text-sm font-extrabold text-amber-900 tracking-tight">Pending Approval</h3>
                  <p className="text-[11px] font-semibold text-amber-700 mt-0.5">
                    {pendingRows.length} submitted {pendingRows.length === 1 ? "appreciation is" : "appreciations are"} waiting
                    for your review — they stay hidden from everyone until approved.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-xs font-black">
                  {pendingRows.length}
                </span>
              </div>

              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {pendingRows.map((row) => (
                  <div key={row.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDetailRow(row)}
                      className="flex-1 text-left min-w-0"
                      title="View full details"
                    >
                      <p className="text-xs font-black text-gray-900 truncate">
                        {row.subject || "Appreciation"}
                      </p>
                      <p className="text-[11px] font-semibold text-gray-500 truncate">
                        {row.appreciation_id} · {row.account || row.customer_name || "—"} · submitted by{" "}
                        {row.recorded_by || "—"}
                      </p>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={decidingId === row.id}
                        onClick={() => handleDecideAppreciation(row, "REJECTED")}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[11px] font-black uppercase tracking-wide hover:bg-gray-100 disabled:opacity-50 transition"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={decidingId === row.id}
                        onClick={() => handleDecideAppreciation(row, "APPROVED")}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wide hover:bg-emerald-700 disabled:opacity-50 transition"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* A non-admin sees the state of their own submissions. */}
          {!isAdmin && pendingRows.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold text-amber-900">
                {pendingRows.length} of your {pendingRows.length === 1 ? "appreciation is" : "appreciations are"} awaiting
                admin approval — they become visible to everyone once approved.
              </p>
            </div>
          )}

          {/* Summary Cards Strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
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
                  {allRows.filter(r => String(r.appreciation_scope || "Internal").includes("Internal")).length}
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
                  {allRows.filter(r => String(r.appreciation_scope || "").includes("External")).length}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 font-bold">
                <Sparkle size={20} weight="bold" />
              </div>
            </div>

            
          </div>

          {/* Filters Bar — single row */}
          <div className="w-full rounded-xl bg-white border border-gray-200 shadow-sm px-2.5 py-2 flex flex-nowrap items-center gap-2 overflow-x-auto">
            <select
              name="appreciation_type"
              value={filters.appreciation_type}
              onChange={(e) => setFilters((p) => ({ ...p, appreciation_type: e.target.value }))}
              className="shrink-0 w-40 rounded-md border px-2 py-1 text-[11px] font-urbanist outline-none focus:border-rose-500"
            >
              <option value="">Appreciation Type (All)</option>
              {["Email", "Call", "Meeting", "Formal Letter", "Survey Feedback", "Verbal"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <div className="relative w-28 shrink-0">
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border px-2 py-1 text-[11px] pr-6 font-urbanist outline-none"
              />
              <FiSearch className="absolute right-2 top-1.5 text-gray-400" size={12} />
            </div>

            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 shrink-0">
              {[
                { key: "all", label: "All" },
                { key: "internal", label: "Internal" },
                { key: "external", label: "External" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFilters((p) => ({ ...p, scope: opt.key }))}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wide transition-all whitespace-nowrap ${
                    filters.scope === opt.key
                      ? opt.key === "external"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : opt.key === "internal"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-gray-800 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              <button
                type="button"
                onClick={handleExport}
                className="rounded-md bg-rose-50 text-rose-600 p-1.5 border border-rose-200 hover:bg-rose-100 transition shadow-sm"
                title="Export to Excel"
              >
                <DownloadSimple size={14} weight="duotone" />
              </button>

              <button
                type="button"
                onClick={loadData}
                className="rounded-md bg-gray-100 text-gray-700 p-1.5 border border-gray-300 hover:bg-gray-200 transition shadow-sm"
                title="Refresh"
              >
                <ArrowClockwise size={14} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilters({ appreciation_type: "", scope: "all" });
                  setGlobalSearch("");
                }}
                className="rounded-md border border-gray-300 p-1.5 hover:bg-gray-100 transition shadow-sm"
                title="Clear Filters"
              >
                <FiRotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Appreciation Tiles Grid */}
          <div className="min-h-[300px]">
            {loading ? (
              <div className="p-8 text-center text-sm font-bold text-gray-500 flex items-center justify-center gap-2 bg-white rounded-xl border border-gray-200">
                <div className="w-5 h-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                Loading Appreciations...
              </div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-sm font-semibold text-gray-400 bg-white rounded-xl border border-gray-200">
                No appreciations found matching criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {rows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, idx) => (
                  <AppreciationTile key={row.id || idx} item={row} idx={idx} onOpen={setDetailRow} />
                ))}
              </div>
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

              {/* Project Manager (filtered by Headed By) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Project Manager</label>
                <select
                  value={createForm.project_manager}
                  onChange={(e) => setCreateForm((p) => ({ ...p, project_manager: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist outline-none focus:ring-2 focus:ring-rose-500"
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-urbanist outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}

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

              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Photo Upload</label>
                <div className="flex items-center gap-2 border border-dashed border-rose-300 rounded-lg p-2 bg-rose-50/40">
                  <Paperclip size={18} className="text-rose-400" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => setPendingAttachment(e.target.files?.[0] || null)}
                    className="w-full bg-transparent text-xs font-urbanist outline-none"
                  />
                </div>
                {pendingAttachment && (
                  <div className="mt-2 flex items-center gap-2">
                    {pendingAttachment.type?.startsWith("image/") && (
                      <img
                        src={URL.createObjectURL(pendingAttachment)}
                        alt="Preview"
                        className="h-14 w-14 rounded-lg object-cover border border-rose-200"
                      />
                    )}
                    <p className="text-[11px] text-gray-500">Selected: {pendingAttachment.name}</p>
                  </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allRows.slice(0, 6).map((item, idx) => (
                <AppreciationTile key={item.id || idx} item={item} idx={idx} onOpen={setDetailRow} />
              ))}

              {allRows.length === 0 && (
                <div className="col-span-full p-10 text-center text-xs text-gray-400 italic">
                  No recent appreciations found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appreciation Detail Popup */}
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
    </motion.div>
  );
};

export default MonitoringAppreciationsPage;
