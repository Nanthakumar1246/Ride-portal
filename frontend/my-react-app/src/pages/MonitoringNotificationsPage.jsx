import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  fetchRiskNotifications,
  fetchIssueNotifications,
  fetchDependencyNotifications,
  fetchEscalationNotifications,
  fetchActionNotifications,
} from "../api/notificationsApi";
import { formatDisplayDate } from "../utils/dateFormat";
import Pagination from "../components/Pagination";

const MODULES = [
  { key: "all", label: "All", activeClass: "bg-amber-400 text-white shadow-lg" },
  { key: "risk", label: "Risk Inbox", activeClass: "bg-rose-500 text-white shadow-lg" },
  { key: "issue", label: "Issue Inbox", activeClass: "bg-sky-600 text-white shadow-lg" },
  { key: "dependency", label: "Dependency Inbox", activeClass: "bg-indigo-700 text-white shadow-lg" },
  { key: "escalation", label: "Escalation Inbox", activeClass: "bg-lime-600 text-white shadow-lg" },
  { key: "action", label: "Action Inbox", activeClass: "bg-red-600 text-white shadow-lg" },
];

async function loadByModule(module) {
  switch (module) {
    case "risk": return await fetchRiskNotifications();
    case "issue": return await fetchIssueNotifications();
    case "dependency": return await fetchDependencyNotifications();
    case "escalation": return await fetchEscalationNotifications();
    case "action": return await fetchActionNotifications();
    default: return [];
  }
}

const DATA_MODULE_KEYS = ["risk", "issue", "dependency", "escalation", "action"];

async function loadAllModules() {
  const results = await Promise.all(
    DATA_MODULE_KEYS.map((m) => loadByModule(m).catch(() => []))
  );
  return DATA_MODULE_KEYS.flatMap((m, idx) =>
    (results[idx] || []).map((n) => ({ ...n, __module: m }))
  );
}

const formatTimeAgo = (dateInput) => {
  if (!dateInput) return "just now";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "just now";
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
};

const DETAIL_FIELD_KEYS = [
  ["risk_id", "Risk ID"],
  ["issue_id", "Issue ID"],
  ["dependency_id", "Dependency ID"],
  ["escalation_id", "Escalation ID"],
  ["action_id", "Action ID"],
  ["manual_project_id", "Project ID"],
  ["account", "Account"],
  ["project_description", "Project Description"],
  ["risk_title", "Risk Title"],
  ["issue_title", "Issue Title"],
  ["dependency_title", "Dependency Title"],
  ["action_title", "Action Title"],
  ["title", "Title"],
  ["priority", "Priority"],
  ["category", "Category"],
  ["type", "Type"],
  ["status", "Status"],
  ["mitigation_owner", "Mitigation Owner"],
  ["assigned_to", "Assigned To"],
  ["action_owner", "Action Owner"],
  ["escalated_to", "Escalated To"],
  ["identified_by", "Identified By"],
  ["reported_by", "Reported By"],
  ["due_date", "Due Date"],
  ["required_by_date", "Required By"],
  ["completion_percent", "Completion %"],
  ["risk_description", "Risk Description"],
  ["issue_description", "Issue Description"],
  ["description", "Description"],
  ["mitigation_plan", "Mitigation Plan"],
  ["impact", "Impact"],
  ["probability", "Probability"],
];

const MonitoringNotificationsPage = () => {
  const navigate = useNavigate();

  const [selectedModule, setSelectedModule] = useState("risk");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  /* Jump from a notification straight to the log it refers to: open that
     module's page, pre-searched on the record's ID so it is already in view. */
  const openItemInModule = (n) => {
    if (!n) return;
    const base = `${n.__module || selectedModule}s`;
    const code = n.item_code || n.risk_id || n.id || "";
    navigate(`/monitoring/${base}?search=${encodeURIComponent(code)}`);
  };

  const sortedItems = [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const totalPages = Math.ceil(sortedItems.length / pageSize) || 1;
  const paginatedItems = sortedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const load = async (module = selectedModule) => {
    try {
      setLoading(true);
      const data = module === "all" ? await loadAllModules() : await loadByModule(module);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert(err?.status === 401 ? "Session expired. Please log in again." : (err?.message || "Failed to load notifications"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDetailItem(null);
    setCurrentPage(1);
    load(selectedModule);
  }, [selectedModule]);

  const getLabel = () => MODULES.find((m) => m.key === selectedModule)?.label || "Risk";

  const getCardMeta = (n) => {
    const p = n.payload || {};
    const idField =
      n.item_code ||
      n.risk_id ||
      n.issue_id ||
      n.dependency_id ||
      n.escalation_id ||
      n.action_id ||
      n.id?.substring(0, 8);

    const rowModule = n.__module || selectedModule;
    const moduleLabel = rowModule.charAt(0).toUpperCase() + rowModule.slice(1);
    const isNewRecord = !n.status_before || n.status_before.includes("N/A") || n.status_before.includes("New");

    const titleHeader = isNewRecord
      ? `New ${moduleLabel} Created: ${idField}`
      : `${moduleLabel} Status Update: ${idField}`;

    const accountName = p.account || n.project_name || "—";
    const projectName = p.manual_project_id || p.project_description || p.risk_title || p.issue_title || p.dependency_title || p.title || "—";
    const ownerName = p.mitigation_owner || p.assigned_to || p.escalated_to || p.identified_by || p.reported_by || p.bm_user || n.bm_user || "—";
    const description =
      p.risk_description || p.issue_description || p.description || p.mitigation_plan ||
      p.risk_title || p.issue_title || p.dependency_title || p.title || p.action_item || "—";

    return {
      p,
      idField,
      rowModule,
      moduleLabel,
      titleHeader,
      subtitleText: `${accountName} · ${projectName} — Dear ${ownerName}`,
      account: accountName,
      description,
      priority: p.priority || "Medium",
      timeAgo: formatTimeAgo(n.created_at),
      ownerName,
    };
  };

  const buildDetailFields = (n) => {
    const p = n.payload || {};
    const fields = [
      { label: "Submitting User", value: n.bm_user || getCardMeta(n).ownerName },
      { label: "Status Before", value: n.status_before },
      { label: "Status After", value: n.status_after || "Open" },
      { label: "Record ID", value: n.item_code || getCardMeta(n).idField },
      { label: "Timestamp", value: formatDisplayDate(n.created_at, true) },
      { label: "Decision", value: n.decision },
      { label: "Comment", value: n.comment },
    ];

    DETAIL_FIELD_KEYS.forEach(([key, label]) => {
      const val = p[key] ?? n[key];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        fields.push({ label, value: String(val) });
      }
    });

    // Catch any remaining payload keys not already listed
    Object.entries(p).forEach(([key, val]) => {
      if (val === undefined || val === null || String(val).trim() === "") return;
      if (DETAIL_FIELD_KEYS.some(([k]) => k === key)) return;
      if (typeof val === "object") return;
      fields.push({
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: String(val),
      });
    });

    // Deduplicate by label keeping first
    const seen = new Set();
    return fields.filter((f) => {
      if (!f.value || seen.has(f.label)) return false;
      seen.add(f.label);
      return true;
    });
  };

  return (
    <motion.div
      className="min-h-[calc(100vh-80px)] bg-gray-50 px-4 sm:px-8 py-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="max-w-7xl mx-auto font-urbanist">
        <div className="mb-8">
          <h1 className="text-3xl font-montserrat font-medium text-gray-900">
            {getLabel()} Notifications & Approval Inbox
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time automated alert log for VP & executive governance center.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {MODULES.map((m) => {
            const active = selectedModule === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedModule(m.key)}
                className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  active
                    ? `${m.activeClass} transform scale-105`
                    : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-gray-200 rounded-xl animate-pulse"></div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border border-gray-100 shadow-sm text-gray-400">
            <span className="text-4xl mb-4">✨</span>
            <p className="font-semibold">No active notifications for {getLabel()}.</p>
          </div>
        ) : (
          <>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[11px] border-b border-gray-200">
                <tr>
                  <th className="p-3.5">ID</th>
                  <th className="p-3.5">Account</th>
                  <th className="p-3.5">Priority</th>
                  <th className="p-3.5">Description</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedItems.map((n) => {
                  const { idField, account, priority, description } = getCardMeta(n);

                  return (
                    <tr key={n.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3.5 font-black text-indigo-700">
                        <button
                          type="button"
                          onClick={() => openItemInModule(n)}
                          title="Open this log in its own module page"
                          className="hover:underline focus:outline-none focus:underline"
                        >
                          {idField}
                        </button>
                      </td>
                      <td className="p-3.5 text-gray-700 font-semibold">{account}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            priority === "Critical" || priority === "High"
                              ? "bg-red-50 text-red-600 border border-red-100"
                              : "bg-blue-50 text-blue-600 border border-blue-100"
                          }`}
                        >
                          {priority}
                        </span>
                      </td>
                      <td className="p-3.5 text-gray-600 max-w-sm truncate" title={description}>{description}</td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailItem(n)}
                          className="px-4 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 transition-colors shadow-xs"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sortedItems.length > pageSize && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={sortedItems.length}
              pageSize={pageSize}
              itemLabel="notifications"
              className="mt-6 border-gray-200"
            />
          )}
          </>
        )}
      </div>

      {/* Full Details Popup */}
      {detailItem && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-slate-50 shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">
                  {getCardMeta(detailItem).titleHeader}
                </h3>
                <p className="text-[11px] text-blue-700 font-bold mt-0.5">
                  {getCardMeta(detailItem).moduleLabel} Notification — Full Details
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 text-lg font-bold leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {buildDetailFields(detailItem).map((field) => (
                  <div
                    key={field.label}
                    className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5"
                  >
                    <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                      {field.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-800 break-words whitespace-pre-wrap">
                      {field.value}
                    </span>
                  </div>
                ))}
              </div>

              {detailItem.documents && detailItem.documents.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase mb-1 block">Attached Files</span>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1">
                    {detailItem.documents.map((doc, idx) => (
                      <a
                        key={idx}
                        href={`${process.env.REACT_APP_API_URL || "http://localhost:5000"}/${doc.file_path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:underline"
                      >
                        📄 {doc.file_name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() => openItemInModule(detailItem)}
                  className="w-full py-2 text-blue-600 text-xs font-bold uppercase hover:bg-blue-50 rounded-xl transition-colors"
                >
                  Open Item View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MonitoringNotificationsPage;
