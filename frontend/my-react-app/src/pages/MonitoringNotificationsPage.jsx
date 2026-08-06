import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  fetchRiskNotifications,
  fetchIssueNotifications,
  fetchDependencyNotifications,
  fetchEscalationNotifications,
  fetchActionNotifications,
  decideRiskNotification,
  decideIssueNotification,
  decideDependencyNotification,
  decideEscalationNotification,
  decideActionNotification,
} from "../api/notificationsApi";
import { formatDisplayDate } from "../utils/dateFormat";

const MODULES = [
  { key: "risk", label: "Risk" },
  { key: "issue", label: "Issue" },
  { key: "dependency", label: "Dependency" },
  { key: "escalation", label: "Escalation" },
  { key: "action", label: "Action" },
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

const MonitoringNotificationsPage = () => {
  const navigate = useNavigate();

  const [selectedModule, setSelectedModule] = useState("risk");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [commentById, setCommentById] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const load = async (module = selectedModule) => {
    try {
      setLoading(true);
      const data = await loadByModule(module);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setExpandedId(null);
    load(selectedModule);
  }, [selectedModule]);

  const handleDecision = async (id, decision) => {
    const comment = commentById[id] || "";
    try {
      switch (selectedModule) {
        case "risk": await decideRiskNotification(id, decision, comment); break;
        case "issue": await decideIssueNotification(id, decision, comment); break;
        case "dependency": await decideDependencyNotification(id, decision, comment); break;
        case "escalation": await decideEscalationNotification(id, decision, comment); break;
        case "action": await decideActionNotification(id, decision, comment); break;
        default: return;
      }
      await load();
      setExpandedId(null);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to update");
    }
  };

  const getLabel = () => MODULES.find((m) => m.key === selectedModule)?.label || "Risk";

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
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
                    ? "bg-black text-white shadow-lg transform scale-105"
                    : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                {m.label} Inbox
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border border-gray-100 shadow-sm text-gray-400">
            <span className="text-4xl mb-4">✨</span>
            <p className="font-semibold">No active notifications for {getLabel()}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...items]
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map((n) => {
                const p = n.payload || {};
                const idField =
                  n.item_code ||
                  n.risk_id ||
                  n.issue_id ||
                  n.dependency_id ||
                  n.escalation_id ||
                  n.action_id ||
                  n.id?.substring(0, 8);
                
                const moduleLabel = selectedModule.charAt(0).toUpperCase() + selectedModule.slice(1);
                const isNewRecord = !n.status_before || n.status_before.includes("N/A") || n.status_before.includes("New");

                const titleHeader = isNewRecord
                  ? `New ${moduleLabel} Created: ${idField}`
                  : `${moduleLabel} Status Update: ${idField}`;

                const accountName = p.account || n.project_name || "Acme Corp";
                const projectName = p.manual_project_id || p.project_description || p.risk_title || p.issue_title || p.dependency_title || p.title || "Payments Revamp";
                const ownerName = p.mitigation_owner || p.assigned_to || p.escalated_to || p.identified_by || p.reported_by || p.bm_user || n.bm_user || "J. Rao";

                const subtitleText = `${accountName} · ${projectName} — Dear ${ownerName} (Mitigation Owner), others in CC`;
                const priority = p.priority || "Medium";
                const timeAgo = formatTimeAgo(n.created_at);
                const isExpanded = expandedId === n.id;

                return (
                  <div
                    key={n.id}
                    className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ${
                      isExpanded ? "ring-2 ring-blue-500 shadow-md" : "hover:shadow-md"
                    }`}
                  >
                    <div className="p-5 cursor-pointer" onClick={() => toggleExpand(n.id)}>
                      {/* Top Row Header & Priority */}
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <h3 className="font-montserrat font-bold text-base text-gray-900 tracking-tight leading-snug">
                          {titleHeader}
                        </h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            priority === "Critical" || priority === "High"
                              ? "bg-red-50 text-red-600 border border-red-100"
                              : "bg-blue-50 text-blue-600 border border-blue-100"
                          }`}
                        >
                          {priority}
                        </span>
                      </div>

                      {/* Main Body Description / Details */}
                      <p className="text-xs text-gray-600 font-medium leading-relaxed mb-4">
                        {subtitleText}
                      </p>

                      {/* Card Footer: Timestamp, User Avatar & Action Button */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700 text-xs font-semibold shadow-xs">
                            👤
                          </div>
                          <span className="text-xs font-semibold text-gray-500">{timeAgo}</span>
                        </div>

                        <span className="text-xs text-blue-600 font-bold hover:underline">
                          {isExpanded ? "Hide Details" : "View Details"}
                        </span>
                      </div>
                    </div>

                    {/* Expanded Drawer */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-0 animate-fadeIn bg-gray-50/50 border-t border-gray-100">
                        <div className="mt-4 space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-xs p-3 bg-white border border-gray-200 rounded-xl">
                            <div>
                              <span className="block text-gray-400 text-[10px] uppercase font-bold">Submitting User</span>
                              <span className="font-semibold text-gray-800 break-words">{n.bm_user || ownerName}</span>
                            </div>
                            <div>
                              <span className="block text-gray-400 text-[10px] uppercase font-bold">Status</span>
                              <span className="font-semibold text-gray-800">{n.status_after || "Open"}</span>
                            </div>
                            <div>
                              <span className="block text-gray-400 text-[10px] uppercase font-bold">Record ID</span>
                              <span className="font-semibold text-gray-800">{n.item_code || idField}</span>
                            </div>
                            <div>
                              <span className="block text-gray-400 text-[10px] uppercase font-bold">Timestamp</span>
                              <span className="font-semibold text-gray-800">{formatDisplayDate(n.created_at, true)}</span>
                            </div>
                          </div>

                          {n.documents && n.documents.length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold text-blue-600 uppercase mb-1 block">Attached Files</span>
                              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1">
                                {n.documents.map((doc, idx) => (
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

                          <div className="space-y-3 pt-2">
                            <input
                              type="text"
                              value={commentById[n.id] || ""}
                              onChange={(e) => setCommentById((prev) => ({ ...prev, [n.id]: e.target.value }))}
                              placeholder="VP / Admin comment..."
                              className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDecision(n.id, "Closed")}
                                className="flex-1 py-2 bg-black text-white text-xs font-bold uppercase rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
                              >
                                Approve & Close
                              </button>
                              <button
                                onClick={() => handleDecision(n.id, "On Hold")}
                                className="flex-1 py-2 border border-gray-300 text-gray-700 bg-white text-xs font-bold uppercase rounded-xl hover:bg-gray-100 transition-colors"
                              >
                                Keep Open
                              </button>
                            </div>
                            <button
                              onClick={() => {
                                const base = `${selectedModule}s`;
                                navigate(`/monitoring/${base}?id=${encodeURIComponent(n.item_code || n.risk_id || n.id)}`);
                              }}
                              className="w-full py-2 text-blue-600 text-xs font-bold uppercase hover:bg-blue-50 rounded-xl transition-colors"
                            >
                              Open Item View
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default MonitoringNotificationsPage;
