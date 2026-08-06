import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useFilter } from "../context/FilterContext";

import { fetchRisks } from "../api/risksApi";
import { fetchDependencies } from "../api/dependenciesApi";

import { formatDateOnly } from "../utils/dateFormat";
import TruncatedCell from "../components/TruncatedCell";
import { FiSearch, FiArrowLeft, FiExternalLink, FiX } from "react-icons/fi";
import { RxCross2 } from "react-icons/rx";

/* ── apis that may exist ── */
let fetchIssues, fetchEscalations, fetchActions;
try { fetchIssues = require("../api/issuesApi").fetchIssues; } catch {}
try { fetchEscalations = require("../api/escalationsApi").fetchEscalations; } catch {}
try { fetchActions = require("../api/actionsApi").fetchActions; } catch {}

/* ── form configs ── */
let risksFormConfig, dependenciesFormConfig, issuesFormConfig, escalationsFormConfig, actionsFormConfig;
try { risksFormConfig = require("../config/formConfig").risksFormConfig; } catch {}
try { dependenciesFormConfig = require("../config/formConfig").dependenciesFormConfig; } catch {}
try { issuesFormConfig = require("../config/formConfig").issuesFormConfig; } catch {}
try { escalationsFormConfig = require("../config/formConfig").escalationsFormConfig; } catch {}
try { actionsFormConfig = require("../config/formConfig").actionsFormConfig; } catch {}

/* ── status label → DB value normaliser ── */
const STATUS_LABEL_MAP = {
  open:      "open",
  resolved:  "resolved",
  approved:  "approved",
  cancelled: "cancel",   // partial match
};

const MODULES = [
  { key: "risks",        label: "Risk",       color: "#EF4444", bg: "#FEF2F2", border: "#FECACA", route: "/monitoring/risks",        fetchFn: () => fetchRisks,        columns: () => risksFormConfig?.fields || [] },
  { key: "issues",       label: "Issue",      color: "#F97316", bg: "#FFF7ED", border: "#FED7AA", route: "/monitoring/issues",       fetchFn: () => fetchIssues,       columns: () => issuesFormConfig?.fields || [] },
  { key: "dependencies", label: "Dependency", color: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE", route: "/monitoring/dependencies", fetchFn: () => fetchDependencies, columns: () => dependenciesFormConfig?.fields || [] },
  { key: "escalations",  label: "Escalation", color: "#F43F5E", bg: "#FFF1F2", border: "#FECDD3", route: "/monitoring/escalations",  fetchFn: () => fetchEscalations,  columns: () => escalationsFormConfig?.fields || [] },
  { key: "actions",      label: "Action",     color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0", route: "/monitoring/actions",      fetchFn: () => fetchActions,      columns: () => actionsFormConfig?.fields || [] },
];

/* ── status badge pill styles ── */
const STATUS_BADGE = {
  open:      { dot: "bg-red-500",     pill: "bg-red-100 text-red-700 border-red-200" },
  resolved:  { dot: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  approved:  { dot: "bg-blue-500",    pill: "bg-blue-100 text-blue-700 border-blue-200" },
  cancelled: { dot: "bg-gray-400",    pill: "bg-gray-100 text-gray-600 border-gray-200" },
};

/* ── row status meta ── */
const getStatusMeta = (row) => {
  const raw = row.status || row.Status || row.current_status || "";
  const s = String(raw).toLowerCase().trim();
  if (s.includes("open"))     return { label: "Open",             dot: "bg-red-500",    row: "bg-red-50/40" };
  if (s.includes("progress")) return { label: "In Progress",      dot: "bg-orange-400", row: "bg-orange-50/40" };
  if (s.includes("resolved")) return { label: "Resolved",         dot: "bg-emerald-500",row: "bg-emerald-50/40" };
  if (s.includes("cancel"))   return { label: "Cancelled",        dot: "bg-gray-400",   row: "bg-gray-50" };
  if (s.includes("approved") || s.includes("closed"))
                              return { label: "Approved & Closed",dot: "bg-blue-500",   row: "bg-blue-50/40" };
  return raw ? { label: raw, dot: "bg-gray-300", row: "" } : null;
};

/* ── Lightweight fetcher for inactive tabs (count only, no UI) ── */
const CountFetcher = ({ mod, statusFilter, onCountChange }) => {
  const { selectedManager } = useFilter();

  useEffect(() => {
    const load = async () => {
      try {
        const fn = mod.fetchFn();
        if (!fn) { onCountChange?.(mod.key, 0); return; }
        const res = await fn({ manager: selectedManager });
        const data = Array.isArray(res) ? res : (res?.data || []);
        let filtered = [...data];
        if (statusFilter) {
          const sfLower = statusFilter.toLowerCase();
          const matchKey = STATUS_LABEL_MAP[sfLower] || sfLower;
          filtered = filtered.filter(row => {
            const raw = String(row.status || row.Status || row.current_status || "").toLowerCase();
            return raw.includes(matchKey);
          });
        }
        onCountChange?.(mod.key, filtered.length);
      } catch (e) { console.error(e); }
    };
    load();
  }, [mod, selectedManager, statusFilter, onCountChange]);

  return null; // renders nothing
};

/* ═══════════════════════════════════════════ */
const ModuleTable = ({ mod, statusFilter, onClearStatus, onCountChange }) => {
  const { selectedManager } = useFilter();
  const [rows, setRows] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const columns = mod.columns();

  const applyFilters = useCallback((data, q, sf) => {
    let filtered = [...data];

    // status filter
    if (sf) {
      const sfLower = sf.toLowerCase();
      const matchKey = STATUS_LABEL_MAP[sfLower] || sfLower;
      filtered = filtered.filter(row => {
        const raw = String(row.status || row.Status || row.current_status || "").toLowerCase();
        return raw.includes(matchKey);
      });
    }

    // text search
    if (q.trim()) {
      const term = q.toLowerCase();
      filtered = filtered.filter(row =>
        Object.values(row).some(v => v != null && String(v).toLowerCase().includes(term))
      );
    }

    setRows(filtered);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const fn = mod.fetchFn();
        if (!fn) { setRows([]); setAllRows([]); return; }
        const res = await fn({ manager: selectedManager });
        const data = Array.isArray(res) ? res : (res?.data || []);
        const sorted = [...data].sort((a, b) => {
          const dA = new Date(a.last_updated || a.identified_date || a.reported_date || a.created_at || 0);
          const dB = new Date(b.last_updated || b.identified_date || b.reported_date || b.created_at || 0);
          return dB - dA;
        });
        setAllRows(sorted);
        applyFilters(sorted, search, statusFilter);
      } catch (e) { console.error(e); setRows([]); }
      finally { setLoading(false); }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod, selectedManager]);

  useEffect(() => { applyFilters(allRows, search, statusFilter); }, [search, statusFilter, allRows, applyFilters]);

  // Report count up to parent whenever rows change
  useEffect(() => { onCountChange?.(mod.key, rows.length); }, [rows.length, mod.key, onCountChange]);

  const sfKey = statusFilter?.toLowerCase();
  const badgeStyle = STATUS_BADGE[sfKey] || STATUS_BADGE["open"];

  return (
    <motion.div
      key={mod.key}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-3 flex-1 min-h-0"
    >
      {/* Search / filter bar */}
      <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-2.5 flex-shrink-0">
        <FiSearch className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${mod.label} records…`}
          className="flex-1 text-sm outline-none placeholder-gray-400 font-urbanist"
        />
        {search && (
          <RxCross2
            onClick={() => setSearch("")}
            className="text-gray-400 cursor-pointer hover:text-black"
          />
        )}

        {/* Active status filter pill */}
        {statusFilter && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${badgeStyle.pill} flex-shrink-0`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
            {statusFilter}
            <button
              onClick={onClearStatus}
              className="ml-0.5 hover:opacity-70 transition-opacity"
              title="Clear filter"
            >
              <FiX size={10} />
            </button>
          </motion.div>
        )}

        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-1 flex-shrink-0">
          {rows.length} records
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 rounded-xl bg-white border border-gray-200 shadow-sm overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2">
            <div className="w-5 h-5 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading {mod.label} data…</span>
          </div>
        ) : columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
            <span className="text-3xl">📋</span>
            <span className="text-sm">No column config found for {mod.label}</span>
          </div>
        ) : (
          <table className="min-w-full text-left text-xs sm:text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-wider w-12">#</th>
                {columns.map(c => (
                  <th key={c.name} className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {c.name === "manual_project_id" ? "Project ID" : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const meta = getStatusMeta(row);
                return (
                  <tr key={row.id ?? idx} className={`border-b border-gray-50 hover:bg-gray-50/80 transition-colors ${meta?.row || ""}`}>
                    <td className="px-4 py-2.5 font-bold text-gray-300 w-12">{idx + 1}</td>
                    {columns.map(c => (
                      <td key={c.name} className="px-4 py-2.5 min-w-[140px] align-top text-gray-700 leading-snug">
                        {c.name.toLowerCase() === "status" && meta ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                            <span className="font-semibold text-gray-700">{meta.label}</span>
                          </span>
                        ) : c.type === "date" || c.name.toLowerCase().includes("date") || c.name.toLowerCase().includes("_at") ? (
                          <span className="text-gray-500">{formatDateOnly(row[c.name])}</span>
                        ) : (
                          <TruncatedCell content={String(row[c.name] ?? "")} />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-12 text-sm text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl">🔍</span>
                      <span>No {mod.label.toLowerCase()} records{statusFilter ? ` with status "${statusFilter}"` : ""} found.</span>
                      {statusFilter && (
                        <button onClick={onClearStatus} className="text-xs text-indigo-500 hover:underline mt-1">
                          Clear status filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════ */
const CommandCenterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedManager } = useFilter();
  const [activeTab, setActiveTab] = useState("risks");
  const [statusFilter, setStatusFilter] = useState(null);
  const [counts, setCounts] = useState({});

  const handleCountChange = useCallback((key, count) => {
    setCounts(prev => ({ ...prev, [key]: count }));
  }, []);

  /* Read ?status= from URL on mount */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const s = params.get("status");
    if (s) setStatusFilter(s);
  }, [location.search]);

  const activeMod = MODULES.find(m => m.key === activeTab);

  return (
    <div
      className="font-urbanist flex flex-col"
      style={{
        margin: "-16px -8px",
        height: "calc(100dvh - 76px)",
        background: "#F1F5F9",
        padding: "10px 10px 6px",
        gap: "8px",
        overflow: "hidden",
      }}
    >
      {/* ── Header Strip ── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/monitoring")}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors group"
          >
            <FiArrowLeft className="group-hover:-translate-x-0.5 transition-transform" />
            Dashboard
          </button>
          <span className="text-gray-200">|</span>
          <div>
            <h1 className="text-sm font-black text-gray-900 tracking-tight leading-none">Command Center</h1>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
              {selectedManager ? `Filtered: ${selectedManager}` : "All Managers"}
              {statusFilter && <span className="text-indigo-400 ml-1">· {statusFilter}</span>}
            </p>
          </div>
        </div>

        {/* Open full dedicated page */}
        <button
          onClick={() => navigate(activeMod?.route)}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all hover:shadow-sm"
          style={{ color: activeMod?.color, borderColor: activeMod?.border, background: activeMod?.bg }}
        >
          <FiExternalLink size={12} />
          Open {activeMod?.label} Page
        </button>
      </div>

      {/* ── Module Tab Cards (Priority Breakdown style) ── */}
      <div className="flex-shrink-0 flex gap-2">
        {MODULES.map(mod => {
          const isActive = activeTab === mod.key;
          const count = counts[mod.key];
          return (
            <motion.button
              key={mod.key}
              onClick={() => setActiveTab(mod.key)}
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -2 }}
              className="relative flex-1 rounded-xl px-3 py-3 flex flex-col items-center justify-center gap-1 transition-all font-urbanist cursor-pointer"
              style={{
                background: mod.bg,
                border: isActive ? `2px solid ${mod.color}` : `1.5px solid ${mod.border}`,
                boxShadow: isActive ? `0 6px 20px ${mod.color}35` : "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              {isActive && (
                <span
                  className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: mod.color }}
                />
              )}
              <span
                className="text-[9px] font-black uppercase tracking-widest leading-none"
                style={{ color: mod.color }}
              >
                {mod.label}
              </span>
              <motion.span
                key={count}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="text-2xl font-black leading-none"
                style={{ color: mod.color }}
              >
                {count ?? "—"}
              </motion.span>
            </motion.button>
          );
        })}
      </div>

      {/* ── Count fetchers for inactive tabs ── */}
      {MODULES.filter(m => m.key !== activeTab).map(mod => (
        <CountFetcher
          key={mod.key}
          mod={mod}
          statusFilter={statusFilter}
          onCountChange={handleCountChange}
        />
      ))}

      {/* ── Active module table ── */}
      <AnimatePresence mode="wait">
        {MODULES.filter(m => m.key === activeTab).map(mod => (
          <ModuleTable
            key={mod.key}
            mod={mod}
            statusFilter={statusFilter}
            onClearStatus={() => setStatusFilter(null)}
            onCountChange={handleCountChange}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default CommandCenterPage;
