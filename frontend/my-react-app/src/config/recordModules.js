import { fetchRisks, fetchRiskApi, updateRiskApi } from "../api/risksApi";
import { fetchIssues, fetchIssueApi, updateIssueApi } from "../api/issuesApi";
import { fetchDependencies, fetchDependencyApi, updateDependencyApi } from "../api/dependenciesApi";
import { fetchEscalations, fetchEscalationApi, updateEscalationApi } from "../api/escalationsApi";
import { fetchActions, fetchActionApi, updateActionApi } from "../api/actionsApi";

/**
 * One registry describing each record module, so the detail popup, the status
 * update page and anything else added later all agree on how a module is
 * named, fetched, updated and identified.
 */

/** Statuses a log can be moved to. */
export const ALLOWED_STATUSES = ["Open", "Closure Submitted", "Closed & Acknowledged", "Hold"];

/** Closing a log needs evidence: remarks plus a supporting attachment. */
export const PROOF_STATUSES = ["Closed & Acknowledged", "Hold"];

export const RECORD_MODULES = {
  risk: {
    key: "risk",
    label: "Risk",
    plural: "Risks",
    route: "/monitoring/risks",
    accent: "indigo",
    list: fetchRisks,
    getById: fetchRiskApi,
    update: updateRiskApi,
    idOf: (r) => r.risk_id || r.id,
    titleOf: (r) => r.risk_title || r.title,
    // The Risk form keeps a separate "current status" narrative and uses
    // `comments` for the remark, so its payload differs from the others.
    buildStatusPayload: ({ status, remarks, user }) => ({
      status,
      current_status: status,
      remarks,
      comments: remarks,
      last_reviewed_date: new Date().toISOString().slice(0, 10),
      updated_by: user?.name || user?.email || "",
    }),
  },
  issue: {
    key: "issue",
    label: "Issue",
    plural: "Issues",
    route: "/monitoring/issues",
    accent: "rose",
    list: fetchIssues,
    getById: fetchIssueApi,
    update: updateIssueApi,
    idOf: (r) => r.issue_id || r.id,
    titleOf: (r) => r.issue_title || r.title,
  },
  dependency: {
    key: "dependency",
    label: "Dependency",
    plural: "Dependencies",
    route: "/monitoring/dependencies",
    accent: "blue",
    list: fetchDependencies,
    getById: fetchDependencyApi,
    update: updateDependencyApi,
    idOf: (r) => r.dependency_id || r.id,
    titleOf: (r) => r.dependency_title || r.summary || r.title,
  },
  escalation: {
    key: "escalation",
    label: "Escalation",
    plural: "Escalations",
    route: "/monitoring/escalations",
    accent: "amber",
    list: fetchEscalations,
    getById: fetchEscalationApi,
    update: updateEscalationApi,
    idOf: (r) => r.escalation_id || r.id,
    titleOf: (r) => r.escalation_title || r.title,
  },
  action: {
    key: "action",
    label: "Action",
    plural: "Actions",
    route: "/monitoring/actions",
    accent: "emerald",
    list: fetchActions,
    getById: fetchActionApi,
    update: updateActionApi,
    idOf: (r) => r.action_id || r.id,
    titleOf: (r) => r.action_item || r.action_title || r.title,
  },
};

/** Default payload for a status change — used unless a module overrides it. */
export const defaultStatusPayload = ({ status, remarks, user }) => ({
  status,
  remarks,
  updated_by: user?.name || user?.email || "",
});

export const getRecordModule = (key) => RECORD_MODULES[String(key || "").toLowerCase()] || null;

export const ACCENT_CLASSES = {
  indigo: { soft: "bg-indigo-50/60 text-indigo-700", ring: "focus:ring-indigo-500", solid: "bg-indigo-600 hover:bg-indigo-700" },
  rose: { soft: "bg-rose-50/60 text-rose-700", ring: "focus:ring-rose-500", solid: "bg-rose-600 hover:bg-rose-700" },
  blue: { soft: "bg-blue-50/60 text-blue-700", ring: "focus:ring-blue-500", solid: "bg-blue-600 hover:bg-blue-700" },
  amber: { soft: "bg-amber-50/60 text-amber-700", ring: "focus:ring-amber-500", solid: "bg-amber-600 hover:bg-amber-700" },
  emerald: { soft: "bg-emerald-50/60 text-emerald-700", ring: "focus:ring-emerald-500", solid: "bg-emerald-600 hover:bg-emerald-700" },
};
