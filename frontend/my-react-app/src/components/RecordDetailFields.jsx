import React from "react";
import { formatDateOnly } from "../utils/dateFormat";

/**
 * Renders every populated field of a record as a read-only grid, with
 * long-form text given its own full-width block. Shared by the detail popup
 * and the status update page so both describe a record the same way.
 */

// Internal plumbing the reader does not need to see.
const HIDDEN = new Set([
  "id",
  "project_id",
  "created_by",
  "last_updated",
  "team_members_count",
  "documents",
]);

const DATE_KEY = /(_date|_at)$/i;

const LABELS = {
  risk_id: "Risk ID",
  issue_id: "Issue ID",
  dependency_id: "Dependency ID",
  escalation_id: "Escalation ID",
  action_id: "Action ID",
  manual_project_id: "Project ID",
  project_description: "Project",
  account: "Customer / Account",
  behalf_of: "Behalf Of",
  program_manager: "Headed By",
  project_manager: "Project Manager",
  risk_score: "Risk Score",
  target_mitigation_date: "Target Mitigation Date",
  target_resolution_date: "Target Resolution Date",
  required_by_date: "Required By Date",
  impact_if_not_resolved: "Impact If Not Resolved",
  root_cause_analysis: "Root Cause Analysis",
  support_required_from: "Support Required From",
  teams_involved: "Teams Involved",
  action_item: "Action Item",
  target_date: "Target Date",
};

export const labelFor = (key) =>
  LABELS[key] || String(key).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const valueFor = (key, value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (DATE_KEY.test(key)) return formatDateOnly(value) || String(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const isLongText = (key, value) =>
  String(value || "").length > 90 ||
  /description|details|remarks|comments|strategy|reason|impact|analysis|action_required|resolution/i.test(key);

export default function RecordDetailFields({ record, emptyMessage = "This record has no details to show." }) {
  const entries = record
    ? Object.entries(record).filter(
        ([k, v]) => !HIDDEN.has(k) && v !== null && v !== undefined && v !== ""
      )
    : [];

  if (entries.length === 0) {
    return <p className="text-xs font-semibold text-gray-500 py-6 text-center">{emptyMessage}</p>;
  }

  const shortRows = entries.filter(([k, v]) => !isLongText(k, v));
  const longRows = entries.filter(([k, v]) => isLongText(k, v));

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shortRows.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5">
            <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
              {labelFor(k)}
            </span>
            <span className="text-sm font-semibold text-gray-800 break-words">{valueFor(k, v)}</span>
          </div>
        ))}
      </div>

      {longRows.map(([k, v]) => (
        <div key={k} className="mt-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
          <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
            {labelFor(k)}
          </span>
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
            {valueFor(k, v)}
          </p>
        </div>
      ))}
    </>
  );
}
