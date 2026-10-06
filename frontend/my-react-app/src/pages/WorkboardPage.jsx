import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDateOnly } from "../utils/dateFormat";
import useMonitoringExport from "../hooks/useMonitoringExport";
import ProjectSearchInput from "../components/ProjectSearchInput";
import ManagerSubPersonInput from "../components/ManagerSubPersonInput";

import EscalationResolutionModal from "../components/EscalationResolutionModal";
import LayoutBuilder from "../components/LayoutBuilder";
import { getLayoutApi, saveLayoutApi, deleteLayoutApi } from "../api/layoutApi";
import { DownloadSimple, Trash } from "phosphor-react";
import SuccessNotification from "../components/SuccessNotification";
import TruncatedCell from "../components/TruncatedCell";
import { exportToExcel } from "../utils/exportToExcel";
import { fetchPreviewId } from "../api/utilsApi";
import * as XLSX from "xlsx";
import { bulkUploadActionsApi } from "../api/actionsApi";
import { fetchManagers, fetchProgramManagers } from "../api/projectsApi";
import { uploadAppreciationAttachmentApi } from "../api/appreciationsApi";
import { fetchModuleHistoryApi } from "../api/moduleHistoryApi";
import { fetchRiskHistoryApi } from "../api/risksApi";

const toDateInputValue = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toYYYYMMDD = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};


const getStatusRowClass = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "open" || s === "identified") return "status-open";
  if (s === "in progress") return "status-inprogress";
  if (s === "resolved" || s === "completed") return "status-resolved";
  if (s === "approved" || s === "approved & closed") return "status-approved";
  if (s === "cancelled" || s === "rejected") return "status-cancelled";
  return "";
};

const stepFieldsMap = {
  issues: {
    step1: [
      "issue_id",
      "manual_project_id",
      "account",
      "project_description",
      "issue_title",
      "issue_description",
      "reported_date",
      "reported_by",
      "status",
      "priority",
      "category"
    ],
    step2: [
      "impact_on_project",
      "affected_system",
      "assigned_to",
      "target_resolution_date",
      "actual_resolution_date",
      "resolution_details",
      "root_cause_analysis",
      "last_updated"
    ]
  },
  risks: {
    step1: [
      "risk_id",
      "manual_project_id",
      "account",
      "project_description",
      "risk_title",
      "risk_description",
      "identified_date",
      "identified_by",
      "status",
      "priority",
      "category"
    ],
    step2: [
      "probability",
      "impact",
      "risk_score",
      "mitigation_strategy",
      "mitigation_owner",
      "target_mitigation_date",
      "current_status",
      "last_reviewed_date"
    ]
  },
  actions: {
    step1: [
      "action_id",
      "action_item",
      "priority",
      "target_date",
      "status",
      "responsible"
    ],
    step2: [
      "support_required_from",
      "teams_involved",
      "remarks"
    ]
  },
  dependencies: {
    step1: [
      "dependency_id",
      "manual_project_id",
      "account",
      "project_description",
      "dependency_title",
      "description",
      "reported_date",
      "reported_by",
      "status",
      "priority",
      "type",
      "dependent_on"
    ],
    step2: [
      "impact_if_not_resolved",
      "required_by_date",
      "current_status",
      "follow_up_date",
      "contact_person",
      "contact_details",
      "last_updated"
    ]
  },
  escalations: {
    step1: [
      "escalation_id",
      "manual_project_id",
      "account",
      "project_description",
      "title",
      "description",
      "reported_date",
      "reported_by",
      "status",
      "priority",
      "category",
      "impact"
    ],
    step2: [
      "customer_name",
      "escalated_to",
      "target_resolution_date",
      "actual_resolution_date",
      "resolution_details",
      "root_cause",
      "preventive_actions",
      "last_updated"
    ]
  },
  appreciations: {
    step1: [
      "appreciation_id",
      "manual_project_id",
      "account",
      "project_description",
      "subject",
      "details",
      "recorded_by",
      "customer_name",
      "customer_contact",
      "received_date"
    ],
    step2: [
      "appreciation_type",
      "team_members_recognized",
      "shared_with_team",
      "follow_up_action",
      "last_updated"
    ]
  }
};

const issueSections = {
  basic: {
    title: "Basic Information",
    fields: ["issue_id", "manual_project_id", "account", "project_description", "project_manager", "program_manager", "behalf_of", "issue_title", "issue_description", "reported_date", "reported_by", "category"]
  },
  assignment: {
    title: "Assignment Details",
    fields: ["status", "priority", "impact_on_project", "affected_system", "assigned_to"]
  },
  resolution: {
    title: "Resolution Details",
    fields: ["target_resolution_date", "actual_resolution_date", "resolution_details"]
  },
  root_cause: {
    title: "Root Cause Analysis",
    fields: ["root_cause_analysis", "last_updated"]
  }
};

const riskSections = {
  basic: {
    title: "Basic Information",
    fields: ["risk_id", "manual_project_id", "account", "project_description", "project_manager", "program_manager", "behalf_of", "risk_title", "risk_description", "identified_date", "identified_by", "category"]
  },
  assessment: {
    title: "Risk Assessment",
    fields: ["status", "priority", "probability", "impact", "risk_score", "current_status"]
  },
  mitigation: {
    title: "Mitigation Details",
    fields: ["mitigation_strategy", "mitigation_owner", "target_mitigation_date", "last_reviewed_date"]
  }
};



const ARCHE_EMAIL_REGEX = /^[^\s@]+@arche\.global$/i;

const COMMON_FIELD_GUIDANCE_MAP = {
  manual_project_id: {
    title: "Project ID",
    purpose: "Select the specific project related to this record.",
    whatToEnter: [
      "Use the search box to find the relevant Project ID by typing its name or code.",
      "Ensure the project selected corresponds to the active engagement."
    ],
    example: "PRJ-9042 - Cloud Migration Phase 2",
    commonMistakes: [
      "Typing a manual ID that is not registered.",
      "Leaving the Project ID blank for project-specific tasks."
    ]
  },
  account: {
    title: "Account",
    purpose: "The client account associated with the project.",
    whatToEnter: [
      "This is read-only and automatically populated based on the selected Project ID.",
      "Displays the client name or account entity."
    ],
    example: "Acme Corporation",
    commonMistakes: [
      "Trying to manually edit this field (it will auto-fill)."
    ]
  },
  status: {
    title: "Status",
    purpose: "The current lifecycle state of this record.",
    whatToEnter: [
      "Select 'Open' when the record is newly created and requires action.",
      "Select 'In Progress' when resolution or mitigation is active.",
      "Select 'Resolved' or 'Completed' only when the final validation is done."
    ],
    example: "In Progress",
    commonMistakes: [
      "Leaving a resolved item as 'Open'.",
      "Setting status to 'Resolved' without entering resolution details."
    ]
  },
  priority: {
    title: "Priority",
    purpose: "Determine the business urgency of this record.",
    whatToEnter: [
      "High: Critical blocker; requires immediate attention.",
      "Medium: Requires planned mitigation; non-blocking.",
      "Low: Tracked for informational purposes; minimal impact."
    ],
    example: "High",
    commonMistakes: [
      "Marking everything as 'High' priority.",
      "Failing to review Low priority items regularly."
    ]
  },
  category: {
    title: "Category",
    purpose: "Select the category that best matches the nature of this item.",
    whatToEnter: [
      "Operational: Relating to daily project operations and processes.",
      "Financial: Relating to budget, billing, or cost overruns.",
      "Technical: Relating to architecture, code, environments, or bugs.",
      "Compliance: Relating to legal or regulatory guidelines."
    ],
    example: "Technical",
    commonMistakes: [
      "Misclassifying a technical bug as operational."
    ]
  }
};

const FIELD_GUIDANCE_MAP = {
  risks: {
    risk_title: {
      title: "Risk Title",
      purpose: "Provide a concise business title describing the identified risk.",
      whatToEnter: [
        "Keep it under 10 words.",
        "State the potential threat clearly.",
        "Avoid generic names."
      ],
      example: "Vendor Delivery Delay due to Port Congestion",
      commonMistakes: [
        "Naming it simply 'Risk' or 'Vendor Issue'.",
        "Using obscure acronyms."
      ]
    },
    risk_description: {
      title: "Risk Description",
      purpose: "Explain the potential risk event, its triggers, and consequences.",
      whatToEnter: [
        "Describe what could happen.",
        "Detail the root cause or triggers.",
        "Specify the direct business consequences.",
        "Detail the possible project impact."
      ],
      example: "If the chip vendor delays shipment by more than 2 weeks, the hardware staging phase will be blocked, pushing back the client integration testing schedule.",
      commonMistakes: [
        "Writing a one-sentence description without context.",
        "Confusing the risk (uncertain event) with an active issue (already occurred)."
      ]
    },
    probability: {
      title: "Probability",
      purpose: "Estimate the likelihood of the risk occurring.",
      whatToEnter: [
        "Rare (1): Highly unlikely to happen.",
        "Possible (2): Reasonable chance of occurrence.",
        "Likely (3): Expected to occur unless mitigated."
      ],
      example: "Possible (2)",
      commonMistakes: [
        "Underestimating probability to make the project look healthier."
      ]
    },
    impact: {
      title: "Impact",
      purpose: "Estimate the severity of the consequences if the risk materializes.",
      whatToEnter: [
        "Minor (1): Negligible effect on cost/schedule.",
        "Moderate (2): Manageable delay or cost increase.",
        "Major (3): Severe disruption to project milestones or SLA breaches."
      ],
      example: "Major (3)",
      commonMistakes: [
        "Marking impact as Minor when it blocks critical milestones."
      ]
    },
    mitigation_strategy: {
      title: "Mitigation Strategy",
      purpose: "Detailed plan to reduce the probability or impact of the risk.",
      whatToEnter: [
        "Define preventative actions to stop the risk from occurring.",
        "Define contingency plans if the risk occurs.",
        "Assign clear responsibilities and check points."
      ],
      example: "Establish a secondary vendor source and pre-approve backup component specifications.",
      commonMistakes: [
        "Writing generic strategies like 'monitor closely' or 'escalate if needed'."
      ]
    },
    mitigation_owner: {
      title: "Mitigation Owner",
      purpose: "The individual responsible for executing the mitigation strategy.",
      whatToEnter: [
        "Select the specific team member.",
        "Ensure the owner has the authority to act."
      ],
      example: "Ajay Kumar - Project Manager",
      commonMistakes: [
        "Leaving the field blank or assigning to a non-existent group."
      ]
    },
    target_mitigation_date: {
      title: "Target Mitigation Date",
      purpose: "Expected completion date for mitigation actions.",
      whatToEnter: [
        "Select a realistic date before the risk trigger event.",
        "Must align with overall schedule milestones."
      ],
      example: "2026-08-15",
      commonMistakes: [
        "Setting the date past the project launch date."
      ]
    }
  },
  issues: {
    issue_title: {
      title: "Issue Title",
      purpose: "Provide a concise business title describing the active issue.",
      whatToEnter: [
        "Keep it under 10 words.",
        "Mention the actual problem.",
        "Avoid generic names."
      ],
      example: "Network Latency Affecting Finance Portal",
      commonMistakes: [
        "Naming it simply 'Issue' or 'Problem'.",
        "Using terms like 'Testing' without context."
      ]
    },
    issue_description: {
      title: "Issue Description",
      purpose: "Describe the active issue in detail.",
      whatToEnter: [
        "What happened: Detail the active failure.",
        "When it happened: Log the timestamp of occurrence.",
        "Who is affected: Specify business units or users.",
        "Business impact: Detail cost or SLA implications.",
        "Current status: Mention immediate workarounds in place."
      ],
      example: "Users cannot access the SAP portal after deployment. The outage impacts Finance and Procurement users, delaying end-of-month reconciliation.",
      commonMistakes: [
        "Vague descriptions like 'system is down'.",
        "No details about which users are impacted."
      ]
    },
    affected_system: {
      title: "Affected System",
      purpose: "Identify the primary software, hardware, or process affected.",
      whatToEnter: [
        "Specify system name, API, or infrastructure component.",
        "Include module name if relevant."
      ],
      example: "SAP Finance Portal API",
      commonMistakes: [
        "Writing 'Software' or 'Everything'."
      ]
    },
    assigned_to: {
      title: "Assigned To",
      purpose: "The individual responsible for investigating and resolving the issue.",
      whatToEnter: [
        "Select the primary investigator or developer.",
        "Must be an active team member."
      ],
      example: "Sanjay Kumar - Senior Backend Engineer",
      commonMistakes: [
        "Leaving the issue unassigned."
      ]
    },
    root_cause_analysis: {
      title: "Root Cause Analysis",
      purpose: "Identify the underlying reason why the issue occurred.",
      whatToEnter: [
        "Explain why the defect or incident occurred.",
        "Specify why it wasn't caught earlier.",
        "Describe preventive measures to block recurrence."
      ],
      example: "A database index was dropped during the migration script run, causing query timeouts under heavy read loads.",
      commonMistakes: [
        "Writing superficial causes like 'user error' or 'bug'."
      ]
    },
    resolution_details: {
      title: "Resolution Details",
      purpose: "Document the steps taken to fix the issue.",
      whatToEnter: [
        "Detail the fix applied.",
        "Mention testing results and validation.",
        "Specify deployment date."
      ],
      example: "Re-created the missing index and verified API response time dropped back to normal (<200ms).",
      commonMistakes: [
        "Writing generic responses like 'fixed' or 'resolved'."
      ]
    }
  },
  dependencies: {
    dependency_title: {
      title: "Dependency Title",
      purpose: "Provide a short title describing the dependency.",
      whatToEnter: [
        "Be specific about the deliverable.",
        "Include the name of the external entity if applicable."
      ],
      example: "OAuth2 API Specifications from Client Security Team",
      commonMistakes: [
        "Using titles like 'Client Info' or 'Waiting for Specs'."
      ]
    },
    description: {
      title: "Description",
      purpose: "Describe the dependency in detail.",
      whatToEnter: [
        "What deliverable is needed.",
        "Who must provide it.",
        "Why it is blocking subsequent activities.",
        "Consequences of delay on timeline."
      ],
      example: "We require the security architecture specs to complete backend API integration. Without this, user authentication testing will slide.",
      commonMistakes: [
        "Not explaining why the deliverable is critical."
      ]
    },
    type: {
      title: "Dependency Type",
      purpose: "Classify the nature of the dependency.",
      whatToEnter: [
        "Internal: Dependent on another project team member.",
        "External: Dependent on client, vendor, or third-party.",
        "Regulatory: Dependent on compliance audits or approvals."
      ],
      example: "External",
      commonMistakes: [
        "Selecting Internal when the deliverable belongs to the client."
      ]
    },
    required_by_date: {
      title: "Required By Date",
      purpose: "The date when this dependency must be resolved to avoid delaying subsequent activities.",
      whatToEnter: [
        "Align with the project schedule and milestones.",
        "Allow adequate buffer time."
      ],
      example: "2026-08-01",
      commonMistakes: [
        "Setting the required date on the same day the dependent task starts."
      ]
    }
  },
  escalations: {
    title: {
      title: "Escalation Title",
      purpose: "Provide a short, impactful title summarizing the escalation.",
      whatToEnter: [
        "State the core issue clearly.",
        "Identify the customer or team if relevant."
      ],
      example: "SLA Breach on Payment Gateway API Integration",
      commonMistakes: [
        "Using overly generic names like 'Urgent Escalation'."
      ]
    },
    description: {
      title: "Description",
      purpose: "Describe the escalation in detail.",
      whatToEnter: [
        "Root issue causing the escalation.",
        "Current operational impact.",
        "Customer response or feedback.",
        "Attempted steps before escalation."
      ],
      example: "Standard payment transactions fail for 5% of users. Standard ticket raised 4 days ago with no response from the gateway provider.",
      commonMistakes: [
        "Escalating without trying standard support channels first."
      ]
    },
    escalation_type: {
      title: "Escalation Type",
      purpose: "Categorize the escalation channel or nature.",
      whatToEnter: [
        "Client: Escalation raised by the client.",
        "Internal: Escalation raised within the project team.",
        "Executive: Direct escalation to company executives."
      ],
      example: "Client",
      commonMistakes: [
        "Using incorrect classification for client-raised complaints."
      ]
    },
    escalated_to: {
      title: "Escalated To",
      purpose: "The senior leader or manager assigned to resolve the escalation.",
      whatToEnter: [
        "Select the manager or executive sponsor.",
        "Ensure they have been informed."
      ],
      example: "Vikram Sen - VP of Delivery",
      commonMistakes: [
        "Escalating to an engineer instead of management."
      ]
    },
    escalated_by: {
      title: "Escalated By",
      purpose: "The person raising this escalation.",
      whatToEnter: [
        "Usually the customer representative or project lead."
      ],
      example: "Client Product Owner",
      commonMistakes: [
        "Leaving this field blank."
      ]
    }
  },
  actions: {
    action_item: {
      title: "Action Item",
      purpose: "Provide a clear description of the task to be performed.",
      whatToEnter: [
        "Use active, clear verbs (e.g. Deploy, Review, Create).",
        "Be specific about the required outcome."
      ],
      example: "Create Q3 Backup and Restore Verification Report",
      commonMistakes: [
        "Using passive sentences or vague words."
      ]
    },
    responsible: {
      title: "Responsible",
      purpose: "Specify the team member assigned to execute this task.",
      whatToEnter: [
        "Ensure the assignee is aware of this task.",
        "Assign to a single owner for accountability."
      ],
      example: "Sanjay Kumar",
      commonMistakes: [
        "Assigning multiple people to a single action item."
      ]
    },
    target_date: {
      title: "Target Date",
      purpose: "The expected completion date for this action item.",
      whatToEnter: [
        "Must be set to monitor task timeline.",
        "Verify with assignee before setting."
      ],
      example: "2026-07-20",
      commonMistakes: [
        "Setting impossible deadlines."
      ]
    }
  },
  appreciations: {
    subject: {
      title: "Subject",
      purpose: "A summary line for the appreciation.",
      whatToEnter: [
        "Summarize the reason for appreciation.",
        "Mention the event or project milestone."
      ],
      example: "Exemplary Performance during Cloud Infrastructure Migration",
      commonMistakes: [
        "Writing 'Good Job' or 'Congrats'."
      ]
    },
    details: {
      title: "Appreciation Details",
      purpose: "Provide the context and writeup of the achievement.",
      whatToEnter: [
        "Describe what the team/individual did.",
        "Include customer feedback or quotes if any.",
        "Highlight the business value created."
      ],
      example: "The engineering team worked over the weekend to resolve a critical deployment block, saving the client's launch schedule. Client VP sent a formal note thanking them.",
      commonMistakes: [
        "Keeping details too brief or lacking specifics."
      ]
    },
    appreciation_type: {
      title: "Appreciation Type",
      purpose: "The channel or format through which this appreciation was received.",
      whatToEnter: [
        "Email, Call, Meeting, Formal Letter, Survey Feedback, or Verbal."
      ],
      example: "Email",
      commonMistakes: [
        "Selecting the wrong type."
      ]
    }
  }
};

const GENERAL_MODULE_GUIDANCE = {
  risks: {
    title: "Risk Identification & Mitigation",
    subtitle: "Qualitative Risk Management Protocol",
    description: "Guide stakeholders in identifying, logging, and planning mitigations for potential project threats before they impact the schedule.",
    principles: [
      { name: "Proactive Logging", detail: "Log potential threats as early as possible. A risk is an uncertain event; do not wait for it to materialize." },
      { name: "Severity Assessment", detail: "Rate Probability (1-3) and Impact (1-3) objectively. The system automatically calculates the Risk Score." },
      { name: "Assigned Mitigation", detail: "Every active risk must have an assigned mitigation owner and target date to be considered under control." }
    ]
  },
  issues: {
    title: "Issue Resolution & RCA",
    subtitle: "Active Problem Resolution Protocol",
    description: "Record active problems that have already occurred, require immediate resolution, assignment, and root cause analysis.",
    principles: [
      { name: "Immediate Logging", detail: "Document operational incidents and system failures immediately to notify dependent streams." },
      { name: "Root Cause Analysis (RCA)", detail: "Investigate why the issue occurred, rather than just resolving the symptom, to prevent future recurrence." },
      { name: "Target Resolution Tracking", detail: "Commit to a realistic target resolution date based on severity and SLA agreements." }
    ]
  },
  dependencies: {
    title: "Dependency & Blocker Tracking",
    subtitle: "Critical Path Alignment Protocol",
    description: "Track requirements from other teams, clients, or third parties that are critical for your milestones.",
    principles: [
      { name: "Clear Deliverables", detail: "Be precise about the exact specification, system access, or resource needed to clear the block." },
      { name: "Timeline Buffer", detail: "Set 'Required By' dates with sufficient buffer prior to the start of the dependent project task." },
      { name: "Ownership", detail: "Assign a specific point of contact on the providing side to ensure accountability." }
    ]
  },
  escalations: {
    title: "Escalation & Governance",
    subtitle: "Stakeholder Management Protocol",
    description: "Track high-visibility issues that require management or executive intervention because standard channels failed.",
    principles: [
      { name: "Escalation Criteria", detail: "Only escalate items that have breached standard SLAs or have significant timeline impacts." },
      { name: "Leadership Assignment", detail: "Assign to a senior leader who has the authority to allocate emergency resources or interface with client executives." },
      { name: "Remediation Path", detail: "Document clear resolution steps and expected target dates committed to stakeholders." }
    ]
  },
  actions: {
    title: "Action Item Execution",
    subtitle: "Task Management Protocol",
    description: "Track individual action items, due dates, and single-point-of-accountability for deliverables.",
    principles: [
      { name: "Action-Oriented Titles", detail: "Use active verbs (e.g. 'Audit', 'Deploy', 'Configure') to make tasks immediately understandable." },
      { name: "Single Accountability", detail: "Assign a single owner responsible for completion to avoid shared responsibility confusion." },
      { name: "Due Date Enforcement", detail: "Keep target dates updated and track delay metrics to maintain project velocity." }
    ]
  },
  appreciations: {
    title: "Appreciation & Feedback",
    subtitle: "Recognition Protocol",
    description: "Record client compliments, accolades, and recognition of exceptional team performance.",
    principles: [
      { name: "Specific Contribution", detail: "Focus on exact actions and deliverables rather than general praise to make recognition meaningful." },
      { name: "Business Impact", detail: "Highlight how the contribution helped the client, reduced cost, or saved the schedule." },
      { name: "Official Logging", detail: "Track client satisfaction index (CSAT) inputs by logging all written and verbal accolades." }
    ]
  }
};

/* ============================================================
   EnterpriseWorkspaceLayout — 3-column workspace for edit mode
   Left: nav sidebar (fixed), Center: form, Right: contextual assistant (sticky)
   ============================================================ */


const ContextualAssistantContent = ({ moduleKey, activeField, formData, FIELD_GUIDANCE_MAP, COMMON_FIELD_GUIDANCE_MAP, GENERAL_MODULE_GUIDANCE }) => {
  const moduleKeyClean = moduleKey?.toLowerCase();
  const moduleFieldGuidance = FIELD_GUIDANCE_MAP[moduleKeyClean];
  const currentGuidance = (moduleFieldGuidance && moduleFieldGuidance[activeField]) || COMMON_FIELD_GUIDANCE_MAP[activeField];
  const generalGuidance = GENERAL_MODULE_GUIDANCE[moduleKeyClean];

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          Contextual Assistant
        </h3>
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
          Context-aware guidelines for the active form field.
        </p>
      </div>

      <hr className="border-gray-100" />

      {/* Guidance Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto gap-3">
        {currentGuidance ? (
          <div className="space-y-3 animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                Field Guidance
              </span>
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Active</span>
            </div>

            <h4 className="text-xs font-bold text-gray-900">{currentGuidance.title}</h4>

            {currentGuidance.purpose && (
              <div className="bg-gray-50/80 rounded-lg p-2.5 border border-gray-100">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Purpose</span>
                <p className="text-[11px] text-gray-700 leading-relaxed font-medium">{currentGuidance.purpose}</p>
              </div>
            )}

            {currentGuidance.whatToEnter?.length > 0 && (
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">What to Enter</span>
                <ul className="list-disc pl-4 text-[11px] text-gray-600 space-y-1 font-medium">
                  {currentGuidance.whatToEnter.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {currentGuidance.example && (
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Example</span>
                <div className="bg-indigo-50/50 border border-indigo-100/70 rounded-lg p-2.5 text-[11px] font-medium text-indigo-900 leading-relaxed">
                  {currentGuidance.example}
                </div>
              </div>
            )}

            {currentGuidance.commonMistakes?.length > 0 && (
              <div className="bg-rose-50/40 border border-rose-100/60 rounded-lg p-2.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500 block mb-1.5">Avoid</span>
                <ul className="list-disc pl-4 text-[11px] text-rose-600/90 space-y-1 font-medium">
                  {currentGuidance.commonMistakes.map((m, idx) => (
                    <li key={idx} className="leading-relaxed">{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : generalGuidance ? (
          <div className="space-y-3 animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                {generalGuidance.title}
              </span>
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Protocol</span>
            </div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">{generalGuidance.subtitle}</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed font-medium">{generalGuidance.description}</p>
            <div className="space-y-2.5">
              {generalGuidance.principles.map((pr, idx) => (
                <div key={idx} className="bg-gray-50/50 border border-gray-100 rounded-lg p-2.5">
                  <h5 className="text-[11px] font-bold text-gray-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                    {pr.name}
                  </h5>
                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed font-medium">{pr.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8 flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-medium">Click any field to see guidance.</p>
          </div>
        )}

        {/* Context-Sensitive alerts */}
        {formData.priority === "High" && (
          <div className="mt-2 p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-800 text-[10px] leading-relaxed">
            <strong>⚠️ Urgent:</strong> High priority items need immediate attention and realistic timelines.
          </div>
        )}
        {(formData.status === "Resolved" || formData.status === "Completed") && (
          <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-[10px] leading-relaxed">
            <strong>✓ Resolution:</strong> Document root cause, actual resolution date, and completion notes before finalizing.
          </div>
        )}
      </div>
    </div>
  );
};

const EnterpriseWorkspaceLayout = ({
  children,
  moduleKey,
  activeField,
  formData,
  FIELD_GUIDANCE_MAP,
  COMMON_FIELD_GUIDANCE_MAP,
  GENERAL_MODULE_GUIDANCE,
}) => {
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const assistantPanelRef = useRef(null);

  // Close drawer on outside click for mobile
  useEffect(() => {
    const handleOutside = (e) => {
      if (assistantPanelRef.current && !assistantPanelRef.current.contains(e.target)) {
        setAssistantOpen(false);
      }
    };
    if (assistantOpen) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [assistantOpen]);

  return (
    <div
      className="wb-workspace font-urbanist"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 280px',
        gap: '0',
        width: '100%',
        minHeight: 'calc(100vh - 4rem)',
        alignItems: 'start',
        position: 'relative',
      }}
    >
      {/* ── CENTER FORM ────────────────────────────── */}
      <main
        className="wb-center-form"
        style={{ padding: '20px 32px', minWidth: 0, overflowX: 'hidden' }}
      >
        {children}
      </main>

      {/* ── RIGHT ASSISTANT PANEL (Desktop ≥768px) ── */}
      <aside
        className="wb-right-assistant wb-assistant-desktop"
        style={{
          position: 'sticky',
          top: 0,
          height: 'calc(100vh - 4rem)',
          overflowY: 'auto',
          borderLeft: '1px solid #e5e7eb',
          background: '#fff',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ContextualAssistantContent
          moduleKey={moduleKey}
          activeField={activeField}
          formData={formData}
          FIELD_GUIDANCE_MAP={FIELD_GUIDANCE_MAP}
          COMMON_FIELD_GUIDANCE_MAP={COMMON_FIELD_GUIDANCE_MAP}
          GENERAL_MODULE_GUIDANCE={GENERAL_MODULE_GUIDANCE}
        />
      </aside>

      {/* ── MOBILE: Floating Assistant FAB ──────────── */}
      <button
        className="wb-assistant-trigger-mobile"
        type="button"
        onClick={() => setAssistantOpen(true)}
        style={{
          position: 'fixed',
          right: '16px',
          bottom: '80px',
          zIndex: 60,
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: '#4f46e5',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(79,70,229,0.35)',
          display: 'none',
        }}
        title="Open Assistant"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>

      {/* ── MOBILE: Bottom-sheet Drawer ──────────────── */}
      {assistantOpen && (
        <>
          <div
            onClick={() => setAssistantOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 59 }}
          />
          <div
            ref={assistantPanelRef}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#fff',
              zIndex: 60,
              borderRadius: '16px 16px 0 0',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
              padding: '20px 16px',
              maxHeight: '70vh',
              overflowY: 'auto',
            }}
          >
            <button
              type="button"
              onClick={() => setAssistantOpen(false)}
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px', fontSize: '16px' }}
            >
              ✕
            </button>
            <ContextualAssistantContent
              moduleKey={moduleKey}
              activeField={activeField}
              formData={formData}
              FIELD_GUIDANCE_MAP={FIELD_GUIDANCE_MAP}
              COMMON_FIELD_GUIDANCE_MAP={COMMON_FIELD_GUIDANCE_MAP}
              GENERAL_MODULE_GUIDANCE={GENERAL_MODULE_GUIDANCE}
            />
          </div>
        </>
      )}

      {/* ── RESPONSIVE CSS ───────────────────────────── */}
      <style>{`
        /* Desktop (≥768px): form + assistant side-by-side */
        @media (min-width: 768px) {
          .wb-workspace { grid-template-columns: 1fr 280px !important; }
          .wb-right-assistant.wb-assistant-desktop { display: flex !important; }
          .wb-assistant-trigger-mobile { display: none !important; }
        }
        /* Mobile (<768px): single column, assistant as bottom sheet */
        @media (max-width: 767px) {
          .wb-workspace { grid-template-columns: 1fr !important; }
          .wb-right-assistant.wb-assistant-desktop { display: none !important; }
          .wb-assistant-trigger-mobile { display: flex !important; }
          .wb-center-form { padding: 12px !important; }
        }
      `}</style>
    </div>
  );
};

const WorkboardPage = ({
  title,
  moduleKey,
  mode,
  fetchList,
  fetchItem,
  createItem,
  updateItem,
  deleteItem,
  formConfig,
}) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useMonitoringExport(moduleKey, rows);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [resolutionId, setResolutionId] = useState(null);

  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [showToast, setShowToast] = useState(false); // For export toast


  const [layoutFields, setLayoutFields] = useState([]);
  const [showLayoutBuilder, setShowLayoutBuilder] = useState(false);
  const [userRole, setUserRole] = useState("USER");

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddNotice, setShowAddNotice] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [globalAlert, setGlobalAlert] = useState(null);

  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [bannerError, setBannerError] = useState(false);
  const [openSection, setOpenSection] = useState("basic");
  const [activeField, setActiveField] = useState(null);

  const [programManagerOptions, setProgramManagerOptions] = useState([]);
  const [headedByOptions, setHeadedByOptions] = useState([]);
  const [pendingAttachment, setPendingAttachment] = useState(null);

  const [viewSearch, setViewSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const HISTORY_PAGE_SIZE = 5;

  const toggleSection = (sectionKey) => {
    setOpenSection(prev => prev === sectionKey ? null : sectionKey);
  };

  // Headed By list for modules with no linked project (Actions)
  useEffect(() => {
    if (moduleKey !== "actions") return;
    fetchManagers()
      .then((data) => setHeadedByOptions(data?.program_managers || []))
      .catch(() => setHeadedByOptions([]));
  }, [moduleKey]);

  // Project Manager list filtered by the selected Headed By
  useEffect(() => {
    const headedBy = formData.program_manager;
    if (!headedBy) {
      setProgramManagerOptions([]);
      return;
    }
    fetchProgramManagers(headedBy)
      .then((data) => setProgramManagerOptions(data || []))
      .catch(() => setProgramManagerOptions([]));
  }, [formData.program_manager]);

  // Update History panel
  useEffect(() => {
    if (!showHistory) return;
    if (moduleKey === "risks") {
      fetchRiskHistoryApi("ALL")
        .then((data) => {
          const all = Array.isArray(data) ? data : data?.data || [];
          setHistoryTotalPages(Math.max(1, Math.ceil(all.length / HISTORY_PAGE_SIZE)));
          setHistoryRows(all.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE));
        })
        .catch((err) => console.error("Failed to load risk history", err));
      return;
    }
    fetchModuleHistoryApi(moduleKey, { limit: HISTORY_PAGE_SIZE, page: historyPage })
      .then((res) => {
        setHistoryRows(res?.rows || []);
        setHistoryTotalPages(res?.totalPages || 1);
      })
      .catch((err) => console.error("Failed to load module history", err));
  }, [showHistory, historyPage, moduleKey]);

  useEffect(() => {
    const stored = localStorage.getItem("ARCHERIDE_AUTH");
    if (stored) {
      const { user } = JSON.parse(stored);
      setUserRole(user?.role || "USER");
    }
  }, []);

  const location = useLocation();
  const navigate = useNavigate();


  const searchParams = new URLSearchParams(location.search);
  const editId = searchParams.get("id");



  useEffect(() => {
    const initLayout = async () => {
      const serverLayout = await getLayoutApi(moduleKey);
      if (serverLayout && Array.isArray(serverLayout) && serverLayout.length > 0) {

        const mergedLayout = serverLayout
          .filter(sField => sField.name?.toLowerCase() !== "comments")
          .map(sField => {
            const cField = formConfig?.fields?.find(f => f.name === sField.name);
            if (cField) {
              return {
                ...sField,
                type: cField.type,
                options: cField.options,
                required: cField.required,
                readOnly: cField.readOnly,
                placeholder: cField.placeholder
              };
            }
            return null;
          })
          .filter(Boolean);
        setLayoutFields(mergedLayout);
      } else {
        setLayoutFields(formConfig?.fields || []);
      }
    };
    initLayout();
  }, [moduleKey, formConfig]);


  const activeFields = React.useMemo(() => {
    const visible = layoutFields.filter(f => !f.hidden);

    // Sort logic: ID first, then manual_project_id, then others
    return visible.sort((a, b) => {
      const isIdA = a.readOnly && a.name.endsWith("_id") && !a.name.includes("project_id");
      const isIdB = b.readOnly && b.name.endsWith("_id") && !b.name.includes("project_id");

      if (isIdA) return -1;
      if (isIdB) return 1;

      if (a.name === "manual_project_id") return -1;
      if (b.name === "manual_project_id") return 1;

      return 0;
    });
  }, [layoutFields]);

  const handleEditState = React.useCallback(
    (row) => {
      setEditingId(
        row.id ||
        row.issue_id ||
        row.risk_id ||
        row.escalation_id ||
        row.action_id ||
        row.dependency_id ||
        row.appreciation_id
      );
      const mapped = { ...row };
      layoutFields
        .filter((f) => f.type === "date")
        .forEach((f) => {
          mapped[f.name] = toDateInputValue(row[f.name]);
        });
      setFormData(mapped);
      setFormData(mapped);
    },
    [layoutFields]
  );

  const handleNew = () => {
    setEditingId(null);
    const initial = {};
    activeFields.forEach((f) => (initial[f.name] = ""));
    setFormData(initial);
    setFormData(initial);



    navigate(`${location.pathname}?mode=edit`);
  };

  const handleNewClick = () => {
    if (deleteItem && userRole !== "ADMIN") {
      setShowAddNotice(true);
    } else {
      handleNew();
    }
  };

  const proceedToNew = () => {
    setShowAddNotice(false);
    handleNew();
  };

  const handleDeleteClick = () => {
    if (selectedIds.length > 0) {
      setShowConfirmDelete(true);
    } else {
      setIsDeleteMode(!isDeleteMode);
    }
  };

  const executeDelete = async () => {
    setShowConfirmDelete(false);
    if (selectedIds.length === 0) return;
    try {
      setIsDeleting(true);
      await deleteItem({ ids: selectedIds });
      setIsDeleteMode(false);
      setSelectedIds([]);
      await loadData();
    } catch (err) {
      console.error("Delete failed", err);
      // Use structured messages based on status code
      if (err.status === 403) {
        setGlobalAlert({
          title: "Restriction Notice",
          message: "Deletion is restricted. Only records created on the current day can be deleted."
        });
      } else if (err.status === 404) {
        setGlobalAlert({
          title: "System Error",
          message: "The requested delete endpoint could not be found or the records do not exist. Please contact support."
        });
      } else {
        setGlobalAlert({
          title: "Deletion Failed",
          message: err.message || "An unexpected error occurred while deleting entries."
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = { ...formData };



      const isEscalation = moduleKey === "escalation" || moduleKey === "escalations";
      if (isEscalation && payload.status === "Resolved") {

        let currentId = editingId || formData.id || formData.escalation_id;


        if (!currentId) {
          const tempPayload = { ...payload, status: "Open" };
          try {
            if (!createItem) throw new Error("Create function execution failed.");


            const res = await createItem(tempPayload);
            const created = res.data || res;
            currentId = created.id || created.escalation_id;

            if (!currentId) throw new Error("Backend did not return an ID for the new Escalation.");


            setEditingId(currentId);
            setFormData(prev => ({ ...prev, ...created, id: currentId }));

          } catch (autoCreateErr) {
            console.error("Auto-create failed during resolution", autoCreateErr);
            setGlobalAlert(`Could not proceed with resolution: ${autoCreateErr.message}`);
            setSaving(false);
            return;
          }
        }


        setGlobalAlert("For Escalations, you MUST upload proof of resolution. Please upload documents in the popup window.");
        setResolutionId(currentId);
        setShowResolutionModal(true);
        setSaving(false);
        return;
      }
      layoutFields
        .filter((f) => f.type === "date")
        .forEach((f) => {
          payload[f.name] = payload[f.name] ? toYYYYMMDD(payload[f.name]) : null;
        });

      delete payload.attachment;

      let savedId = editingId;
      if (editingId) {
        await updateItem(editingId, payload);
      } else {
        const res = await createItem(payload);
        const created = res?.data || res;
        savedId = created?.id;
      }

      if ((moduleKey === "appreciation" || moduleKey === "appreciations") && pendingAttachment && savedId) {
        try {
          await uploadAppreciationAttachmentApi(savedId, pendingAttachment);
        } catch (uploadErr) {
          console.error("Attachment upload failed:", uploadErr);
        }
        setPendingAttachment(null);
      }

      setEditingId(null);
      setFormData({});


      await loadData();


      setShowSuccessNotification(true);


      navigate(`${location.pathname}?mode=view`);
    } catch (err) {
      console.error("Save error:", err);

      const errMsg = err.message || "Failed to save record. Please check inputs.";
      setGlobalAlert({
        title: "Save Failed",
        message: errMsg
      });
    } finally {
      setSaving(false);
    }
  };

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);


      const res = await fetchList({});
      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
          ? res
          : [];

      setRows(list);


      if (editId) {
        let found = null;
        if (fetchItem) {
          try {
            const itemRes = await fetchItem(editId);
            found = itemRes?.data || itemRes;
          } catch (err) {
            console.warn("Failed to fetch item by ID directly:", err);
          }
        }

        if (!found) {
          found = list.find(
            (r) =>
              String(
                r.id ||
                r.issue_id ||
                r.risk_id ||
                r.action_id ||
                r.dependency_id ||
                r.escalation_id ||
                r.appreciation_id
              ) === String(editId)
          );
        }

        if (found) {
          handleEditState(found);
        }
      }
    } catch (err) {
      console.error(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [editId, fetchList, fetchItem, handleEditState]);


  useEffect(() => {
    loadData();
  }, [moduleKey, editId, loadData]);


  useEffect(() => {
    if (moduleKey !== "risk" && moduleKey !== "risks") return;

    const probMap = {
      "Rare": 1,
      "Possible": 2,
      "Likely (Regularly)": 3
    };
    const impactMap = {
      "Minor": 1,
      "Moderate": 2,
      "Major": 3
    };

    const getRiskScoreLabel = (score) => {
      if (score === 1 || score === 2) return "Low";
      if (score === 3) return "Medium";
      if (score === 4 || score === 6) return "High";
      if (score === 9) return "Critical";
      return "";
    };

    const pVal = formData.probability;
    const iVal = formData.impact;

    if (pVal && iVal) {
      const pScore = probMap[pVal] || 0;
      const iScore = impactMap[iVal] || 0;
      if (pScore > 0 && iScore > 0) {
        const scoreNum = pScore * iScore;
        const label = getRiskScoreLabel(scoreNum);
        const scoreDisplay = label ? `${scoreNum} - ${label}` : String(scoreNum);

        setFormData(prev => {
          if (prev.risk_score === scoreDisplay) return prev;
          return { ...prev, risk_score: scoreDisplay };
        });
      }
    }
  }, [moduleKey, formData.probability, formData.impact]);




  const handleChange = (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setFormData((prev) => ({ ...prev, [e.target.name]: val }));



  };



  useEffect(() => {
    setStep(1);
    setErrors({});
    if (!editId) {
      setEditingId(null);
    }
  }, [editId, mode]);

  const columnsToHide = ["id", "project_id", "created_at", "updated_at", "comments"];

  const getSortedColumns = () => {
    if (!rows[0]) return [];

    const keys = Object.keys(rows[0]).filter(c => !columnsToHide.includes(c));







    const creatorKeys = ["created_by", "reported_by", "recorded_by", "raised_by", "identified_by"];

    return keys.sort((a, b) => {

      const isIdA = a.endsWith("_id") && !a.includes("project_id");
      const isIdB = b.endsWith("_id") && !b.includes("project_id");

      if (isIdA && !isIdB) return -1;
      if (!isIdA && isIdB) return 1;


      const isCreatorA = creatorKeys.includes(a);
      const isCreatorB = creatorKeys.includes(b);

      if (isCreatorA && !isCreatorB) return -1;
      if (!isCreatorA && isCreatorB) return 1;


      if (a === "manual_project_id" && b !== "manual_project_id") return -1;
      if (a !== "manual_project_id" && b === "manual_project_id") return 1;

      return 0;
    });
  };

  const columns = getSortedColumns();

  const filteredRows = viewSearch
    ? rows.filter((r) =>
        columns.some((c) => String(r[c] ?? "").toLowerCase().includes(viewSearch.toLowerCase()))
      )
    : rows;

  const STATUS_OPTIONS = ["Open", "In Progress", "On Hold", "Resolved", "Cancelled", "Approved & Closed"];

  const handleInlineStatusChange = async (row, rowId, newStatus) => {
    try {
      await updateItem(rowId, { ...row, status: newStatus });
      await loadData();
    } catch (err) {
      console.error("Failed to update status", err);
      setGlobalAlert("Failed to update status");
    }
  };

  const handleExport = () => {
    const exportData = window.__EXPORT_DATA__?.[moduleKey];

    if (!exportData || !exportData.rows?.length) {
      setGlobalAlert(`No data available to export for ${moduleKey}`);
      return;
    }

    exportToExcel(exportData);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const stepCfg = stepFieldsMap[moduleKey?.toLowerCase()] || { step1: [], step2: [] };
  
  const step1Fields = activeFields.filter(f => {
    if (stepCfg.step2.length > 0) {
      return !stepCfg.step2.includes(f.name);
    }
    const idx = activeFields.indexOf(f);
    return idx < activeFields.length / 2;
  });

  const step2Fields = activeFields.filter(f => {
    if (stepCfg.step2.length > 0) {
      return stepCfg.step2.includes(f.name);
    }
    const idx = activeFields.indexOf(f);
    return idx >= activeFields.length / 2;
  });

  const validateStep1 = () => {
    const newErrors = {};
    step1Fields.forEach(field => {
      const val = formData[field.name];
      if (field.required) {
        if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
          newErrors[field.name] = `${field.label} is required`;
        }
      }
      if (field.name === "behalf_of" && val && !ARCHE_EMAIL_REGEX.test(val.trim())) {
        newErrors[field.name] = "Only @arche.global email addresses are allowed";
      }
    });
    setErrors(newErrors);
    return newErrors;
  };

  const validateStep2 = () => {
    const newErrors = {};
    step2Fields.forEach(field => {
      const val = formData[field.name];
      if (field.required) {
        if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
          newErrors[field.name] = `${field.label} is required`;
        }
      }
      if (field.name === "behalf_of" && val && !ARCHE_EMAIL_REGEX.test(val.trim())) {
        newErrors[field.name] = "Only @arche.global email addresses are allowed";
      }
    });
    setErrors(newErrors);
    return newErrors;
  };

  const handleNext = () => {
    const step1Errors = validateStep1();
    if (Object.keys(step1Errors).length === 0) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveWithValidation = async (e) => {
    if (e) e.preventDefault();
    
    if (moduleKey === "issues" || moduleKey === "risks") {
      const step1Errors = validateStep1();
      const step2Errors = validateStep2();
      const allErrors = { ...step1Errors, ...step2Errors };
      
      if (Object.keys(allErrors).length > 0) {
        // Find the first field with an error
        const firstErrField = Object.keys(allErrors)[0];
        // Find which section it belongs to
        const sectionsCfg = moduleKey === "issues" ? issueSections : riskSections;
        const foundSec = Object.entries(sectionsCfg).find(([secKey, sec]) => 
          sec.fields.includes(firstErrField)
        );
        if (foundSec) {
          setOpenSection(foundSec[0]);
        }
        setErrors(allErrors);
        return;
      }
    } else {
      const step1Errors = validateStep1();
      if (Object.keys(step1Errors).length > 0) {
        setStep(1);
        return;
      }
      
      const step2Errors = validateStep2();
      if (Object.keys(step2Errors).length > 0) {
        return;
      }
    }
    
    await handleSave();
  };

  return (
    <div className={`text-brandDark relative ${mode === 'edit' ? 'p-0' : 'p-8'}`}>
      {/* Export Toast */}
      {showToast && (
        <div className="absolute top-4 right-1/2 translate-x-1/2 z-50
                      rounded-md bg-green-600 px-3 py-1.5
                      text-xs text-white shadow-lg
                      animate-fade">
          ✅ Downloaded successfully
        </div>
      )}

      {mode === "view" && (
      <header className="mb-6 flex justify-between items-end border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-3xl font-marcellus font-medium text-gray-900 leading-tight">
            {title}
            { }
          </h1>
          { }

          { }
          {rows.length > 0 && (
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mt-3">
              {rows.length} Data entries have been filled
            </p>
          )}
          <div className="mt-3 relative max-w-xs">
            <input
              type="text"
              value={viewSearch}
              onChange={(e) => setViewSearch(e.target.value)}
              placeholder="Search..."
              className="w-full h-9 pl-3 pr-3 rounded-lg text-xs text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowHistory((v) => !v); setHistoryPage(1); }}
            className={`rounded h-10 px-4 flex items-center gap-1.5 border text-xs font-bold uppercase tracking-widest transition-colors shadow-sm ${
              showHistory ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
            }`}
          >
            Update History
          </button>
          {/* Re-added Export Button Near Add New */}
          {mode === "view" && rows.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              className="rounded-full h-10 w-10 flex items-center justify-center border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
              title="Export to Excel"
            >
              <DownloadSimple size={20} weight="duotone" />
            </button>
          )}

          {deleteItem && userRole !== "ADMIN" && mode === "view" && rows.length > 0 && (
            <>
              {isDeleteMode && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteMode(false);
                    setSelectedIds([]);
                  }}
                  className="rounded h-10 px-4 flex items-center gap-1.5 border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 font-semibold text-sm transition-colors shadow-sm"
                  title="Cancel deletion"
                >
                  ✕ Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className={`rounded flex items-center justify-center transition-colors shadow-sm h-10 ${isDeleteMode
                    ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-4 gap-2 font-semibold text-sm"
                    : "w-10 border border-gray-200 text-gray-500 hover:bg-gray-100 bg-white"
                  }`}
                title="Delete Mode"
              >
                <Trash size={20} weight={isDeleteMode ? "fill" : "duotone"} />
                {isDeleteMode && selectedIds.length > 0 && <span>Delete ({selectedIds.length})</span>}
              </button>
            </>
          )}

          {moduleKey === "actions" && (
            <label className="cursor-pointer rounded flex items-center justify-center border border-brandDark text-brandDark hover:bg-gray-50 transition-colors bg-white shadow-sm text-xs font-bold gap-2 px-4 h-10 w-auto">
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setLoading(true);
                try {
                  const data = await file.arrayBuffer();
                  const workbook = XLSX.read(data);
                  const sheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[sheetName];
                  const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                  
                  if (json.length === 0) {
                    throw new Error("Excel file is empty");
                  }
                  if (json.length > 40) {
                    throw new Error("Maximum of 40 records allowed per upload.");
                  }

                  const getVal = (row, keys) => {
                    for (const k of Object.keys(row)) {
                      if (keys.map(x => x.toLowerCase().trim()).includes(k.toLowerCase().trim())) {
                        return row[k];
                      }
                    }
                    return "";
                  };

                  const parseExcelDate = (val) => {
                    if (!val) return null;
                    let str = String(val).trim();
                    if (str.toUpperCase() === "NA" || str.toUpperCase() === "TBD") return null;
                    
                    if (str.includes('\n')) str = str.split('\n')[0].trim();
                    if (str.includes(',')) str = str.split(',')[0].trim();

                    const numVal = Number(str);
                    if (!isNaN(numVal) && typeof numVal === 'number' && numVal > 10000) {
                      const date = new Date(Math.round((numVal - 25569) * 86400 * 1000));
                      return date.toISOString().split('T')[0];
                    }

                    const parts = str.split(/[-/]/);
                    if (parts.length === 3) {
                       let [d, m, y] = parts;
                       if (y.length === 2) y = "20" + y;
                       if (d.length === 4) return `${d}-${m.padStart(2, '0')}-${y.padStart(2, '0')}`;
                       return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                    }
                    return null;
                  };

                  const actions = json.map(row => ({
                    action_id: getVal(row, ["action_id", "Action ID"]),
                    action_item: getVal(row, ["action_item", "Action Item", "Action item"]),
                    priority: getVal(row, ["priority", "Priority"]) || "Medium",
                    target_date: parseExcelDate(getVal(row, ["target_date", "Target Date", "Target date"])),
                    status: getVal(row, ["status", "Status"]) || "Open",
                    responsible: getVal(row, ["responsible", "Responsible", "Responsib"]),
                    support_required_from: getVal(row, ["support_required_from", "Support Required From", "Support required from", "Support re"]),
                    teams_involved: getVal(row, ["teams_involved", "Teams Involved", "Teams involved", "Teams Inv"]),
                    remarks: getVal(row, ["remarks", "Remarks"])
                  }));

                  await bulkUploadActionsApi(actions);
                  alert("Bulk upload successful!");
                  loadData();
                } catch (err) {
                  console.error("Bulk upload error:", err);
                  alert(err.message || "Failed to process bulk upload");
                } finally {
                  setLoading(false);
                  e.target.value = "";
                }
              }} />
              BULK UPLOAD
            </label>
          )}

          {(userRole === "ADMIN" || userRole === "BM" || userRole === "PM") && mode === "view" && (
            <button
              onClick={async () => {
                if (window.confirm("Are you sure you want to reset the layout to default? This will clear all custom column ordering and visibility.")) {
                  try {
                    await deleteLayoutApi(moduleKey);
                    window.location.reload();
                  } catch (error) {
                    alert("Failed to reset layout. Please try again.");
                  }
                }
              }}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 text-xs font-bold uppercase tracking-widest rounded transition-all shadow-sm flex items-center gap-2"
            >
              Reset Layout
            </button>
          )}
          <button
            onClick={handleNewClick}
            className="px-8 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-widest rounded hover:bg-gray-800 transition-all shadow-sm hover:shadow-md transform active:scale-95 flex items-center gap-2"
          >
            <span>ADD NEW</span>
          </button>
        </div>
      </header>
      )}

      {mode === "view" && (
        <div className="bg-white border rounded shadow overflow-hidden">
          {loading ? (
            <div className="p-20 text-center">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    {isDeleteMode && <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase w-10">Select</th>}
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Actions</th>
                    {columns.map(col => (
                      <th key={col} className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">
                        {col === "manual_project_id" ? "Project ID" : col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const rowId = row.id || row.issue_id || row.risk_id || row.action_id || row.dependency_id || row.escalation_id || row.appreciation_id;
                    return (
                      <tr key={rowId} className={`${getStatusRowClass(row.status || row.current_status)} border-b hover:bg-opacity-80 transition-colors text-sm`}>
                        {isDeleteMode && (
                          <td className="px-6 py-3 align-top">
                            <input
                              type="checkbox"
                              className="w-4 h-4 cursor-pointer mt-2"
                              checked={selectedIds.includes(rowId)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds([...selectedIds, rowId]);
                                else setSelectedIds(selectedIds.filter(id => id !== rowId));
                              }}
                            />
                          </td>
                        )}
                        <td className="px-6 py-3 font-medium">
                          <button
                            onClick={() => navigate(`${location.pathname}?mode=edit&id=${rowId}`)}
                            className="text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                        </td>
                        {columns.map(col => {
                          const val = row[col];
                          if (col === "documents" && Array.isArray(val) && val.length > 0) {
                            return (
                              <td key={col} className="px-6 py-4 whitespace-normal break-words min-w-[180px] align-top text-gray-700 leading-relaxed">
                                <div className="flex flex-col gap-1">
                                  {val.map((doc, idx) => (
                                    <a
                                      key={idx}
                                      href={`${process.env.REACT_APP_API_URL || "http://localhost:5000"}/${doc.file_path}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium bg-blue-50 px-2 py-1 rounded border border-blue-100 w-fit"
                                      title={doc.file_name}
                                    >
                                      📄 {doc.file_name?.length > 20 ? doc.file_name.substring(0, 18) + "..." : doc.file_name}
                                    </a>
                                  ))}
                                </div>
                              </td>
                            );
                          }

                          if (col === "status") {
                            return (
                              <td key={col} className="px-6 py-4 min-w-[160px] align-top">
                                <select
                                  value={val || ""}
                                  onChange={(e) => handleInlineStatusChange(row, rowId, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs font-bold rounded-lg border border-gray-200 px-2 py-1.5 bg-white hover:bg-gray-50 outline-none focus:border-indigo-500"
                                >
                                  {!STATUS_OPTIONS.includes(val) && val && <option value={val}>{val}</option>}
                                  {STATUS_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </td>
                            );
                          }

                          const isDate = col.toLowerCase().includes('date') || col.toLowerCase().includes('_at');
                          return (
                            <td key={col} className="px-6 py-4 min-w-[180px] align-top text-gray-700 leading-relaxed"> {/* Removed break-words and whitespace-normal here, TruncatedCell handles it */}
                              {isDate ?
                                <span>{formatDateOnly(val)}</span> :
                                <TruncatedCell content={typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-')} />
                              }
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + (isDeleteMode ? 2 : 1)} className="p-10 text-center text-gray-500">
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {mode === "view" && showHistory && (
        <div className="mt-4 bg-white border rounded shadow overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Update History</h3>
            <span className="text-[11px] text-gray-500 font-semibold">Page {historyPage} of {historyTotalPages}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2">Updated By</th>
                  <th className="px-4 py-2">Old Status</th>
                  <th className="px-4 py-2">New Status</th>
                  <th className="px-4 py-2">Remarks</th>
                  <th className="px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((h, idx) => (
                  <tr key={h.id || idx} className="border-b hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{h.updated_by || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600">{h.old_status || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600">{h.new_status || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-sm truncate">{h.remarks || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{h.created_at ? String(h.created_at).slice(0, 10) : "—"}</td>
                  </tr>
                ))}
                {historyRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400 italic">No history entries yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t">
            <button
              type="button"
              disabled={historyPage <= 1}
              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={historyPage >= historyTotalPages}
              onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
              className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {mode === "edit" && (
        <EnterpriseWorkspaceLayout
          moduleKey={moduleKey}
          activeField={activeField}
          formData={formData}
          FIELD_GUIDANCE_MAP={FIELD_GUIDANCE_MAP}
          COMMON_FIELD_GUIDANCE_MAP={COMMON_FIELD_GUIDANCE_MAP}
          GENERAL_MODULE_GUIDANCE={GENERAL_MODULE_GUIDANCE}
        >
          <div className="w-full min-w-0 space-y-1.5 animate-fade-in">
          
          {/* Registration Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden relative min-w-0 w-full">
            
            {/* Floating Navigation Controls on Banner */}
            <div className="absolute top-2 left-3 right-3 z-30 flex justify-between items-center pointer-events-none">
              <button
                type="button"
                onClick={() => navigate(`${location.pathname}?mode=view`)}
                className="pointer-events-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-gray-700 bg-white/90 hover:bg-white rounded-md border border-gray-200 shadow-sm transition-all"
              >
                ← Back
              </button>
              <div className="flex items-center gap-1 pointer-events-auto">
                {(userRole === "ADMIN" || userRole === "BM" || userRole === "PM") && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm("Are you sure you want to reset the layout to default?")) {
                          try {
                            await deleteLayoutApi(moduleKey);
                            window.location.reload();
                          } catch (error) {
                            alert("Failed to reset layout.");
                          }
                        }
                      }}
                      className="px-2 py-0.5 text-[10px] font-bold text-gray-700 bg-white/90 hover:bg-white rounded-md border border-gray-200 shadow-sm transition-all"
                    >
                      Reset
                    </button>
                    {userRole === "ADMIN" && (
                      <button
                        type="button"
                        onClick={() => setShowLayoutBuilder(true)}
                        className="px-2 py-0.5 text-[10px] font-bold text-gray-700 bg-white/90 hover:bg-white rounded-md border border-gray-200 shadow-sm transition-all"
                      >
                        Layout
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`${location.pathname}?mode=view`)}
                  className="w-5 h-5 rounded-md bg-white/90 hover:bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 shadow-sm font-bold text-xs transition-all"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Banner Section with Fade & Text Overlay */}
            <div className="relative w-full h-36 sm:h-44 overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50">
              {!bannerError && (
                <img 
                  src="/banner.png" 
                  alt="Form Banner" 
                  className="w-full h-full object-cover" 
                  onError={() => setBannerError(true)} 
                />
              )}
              {/* White Fade Gradient overlay at the bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent"></div>
              
              {/* Title & Subtitle Overlay on top of faded image */}
              <div className="absolute bottom-2 left-5 z-10">
                <h2 className="text-base md:text-lg font-bold text-[#006699] font-marcellus tracking-wide">
                  {(() => {
                    const singular = moduleKey?.toLowerCase() === "appreciations" ? "appreciation" : moduleKey?.replace(/s$/, '') || '';
                    const capitalized = singular.charAt(0).toUpperCase() + singular.slice(1);
                    return `${capitalized} Registration Form`;
                  })()}
                </h2>
                <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                  Please fill in the form below
                </p>
              </div>
            </div>

            {/* Progress Indicator */}
            {moduleKey !== "issues" && moduleKey !== "risks" && (
              <div className="flex items-center justify-center gap-4 px-6 py-3 bg-gray-50/30 border-b border-gray-100">
                {/* Step 1 */}
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold transition-all ${step > 1 ? 'bg-emerald-500 text-white' : step === 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {step > 1 ? '✓' : '1'}
                  </span>
                  <span className={`text-xs font-bold tracking-wide transition-all ${step === 1 ? 'text-gray-900' : step > 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
                    Basic Info
                  </span>
                </div>
                {/* Connector */}
                <div className={`flex-1 h-px max-w-[40px] transition-all ${step > 1 ? 'bg-emerald-400' : 'bg-gray-200'}`}></div>
                {/* Step 2 */}
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold transition-all ${step === 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    2
                  </span>
                  <span className={`text-xs font-bold tracking-wide transition-all ${step === 2 ? 'text-gray-900' : 'text-gray-400'}`}>
                    Assignment
                  </span>
                </div>
              </div>
            )}

            {/* Form Fields Section */}
            <form
              onSubmit={handleSaveWithValidation}
              className="relative z-10"
            >
              {moduleKey === "issues" || moduleKey === "risks" ? (
                // Accordion Sections (Option 2) for issues and risks
                <div className="divide-y divide-gray-100 bg-white">
                  {Object.entries(moduleKey === "issues" ? issueSections : riskSections).map(([secKey, sec]) => {
                    const isOpen = openSection === secKey;
                    const fields = activeFields.filter(f => sec.fields.includes(f.name));
                    
                    if (fields.length === 0) return null;

                    return (
                      <div key={secKey} className="border-b border-gray-100 last:border-b-0">
                        {/* Accordion Header */}
                        <button
                          type="button"
                          onClick={() => toggleSection(secKey)}
                          className="w-full flex items-center justify-between px-6 py-3.5 bg-gray-50/20 hover:bg-gray-50/65 transition-all text-left border-b border-gray-100/50"
                        >
                          <span className="text-xs font-bold text-gray-800 flex items-center gap-2">
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-[13px] font-bold leading-none transition-all duration-200 ${
                                isOpen
                                  ? "bg-indigo-600 text-white"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {isOpen ? "−" : "+"}
                            </span>
                            {sec.title}
                          </span>
                          <span className="text-[10px] text-gray-500 font-semibold px-2.5 py-0.5 bg-gray-100 rounded-full border border-gray-200/50">
                            {fields.filter(f => formData[f.name]).length} / {fields.length} filled
                          </span>
                        </button>

                        {/* Accordion Body */}
                        {isOpen && (
                          <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 bg-white animate-fade-in">
                            {fields.map((field) => {
                              const value = formData[field.name] ?? "";
                              const isFullWidth = field.type === "textarea" || field.name.includes("title") || field.name === "subject" || field.name.includes("description");

                              return (
                                <div key={field.name} className={isFullWidth ? "md:col-span-2" : ""}>
                                  <label className="block text-xs font-bold text-gray-700 mb-1.5 tracking-wide">
                                    {field.label} {field.required && <span className="text-red-600 font-bold">*</span>}
                                  </label>

                                  {field.type === "project-search" ? (
                                    <ProjectSearchInput
                                      value={value}
                                      onChange={(val) => {
                                        setFormData(prev => ({ ...prev, [field.name]: val }));
                                        if (errors[field.name]) {
                                          setErrors(prev => {
                                            const next = { ...prev };
                                            delete next[field.name];
                                            return next;
                                          });
                                        }
                                      }}
                                      onSelect={async (project) => {
                                        const newData = {
                                          manual_project_id: project.manual_project_id || project.name,
                                          project_description: project.project_description || project.description,
                                          account: project.account,
                                          project_manager: project.project_manager,
                                          program_manager: project.program_manager,
                                          so_number: project.so_number
                                        };

                                        if (!editingId) {
                                          try {
                                            const res = await fetchPreviewId("issue", project.name, project.account);
                                            const previewId = res?.previewId || res?.data?.previewId;

                                            if (previewId) {
                                              newData.issue_id = previewId;
                                            }
                                          } catch (err) {
                                            console.error("Failed to auto-generate ID", err);
                                          }
                                        }

                                        setFormData(prev => ({ ...prev, ...newData }));
                                        setErrors(prev => {
                                          const next = { ...prev };
                                          delete next[field.name];
                                          delete next.account;
                                          delete next.project_description;
                                          return next;
                                        });
                                      }}
                                      required={field.required}
                                      onFocus={() => setActiveField(field.name)}
                                      onBlur={() => setActiveField(null)}
                                      className="w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white hover:bg-gray-50/20 transition-all duration-150 shadow-sm"
                                    />
                                  ) : field.type === "textarea" ? (
                                    <textarea
                                      name={field.name}
                                      value={value}
                                      rows={2}
                                      required={field.required}
                                      disabled={field.readOnly}
                                      onChange={handleChange}
                                      onFocus={() => setActiveField(field.name)}
                                      onBlur={() => setActiveField(null)}
                                      className={`w-full px-3 py-2 rounded-lg text-xs text-gray-900 border transition-all duration-150 shadow-sm focus:ring-2 outline-none min-h-[90px] resize-y ${
                                        errors[field.name] 
                                          ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" 
                                          : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                                      } ${field.readOnly ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100 hover:bg-gray-50" : "bg-white hover:bg-gray-50/20"}`}
                                    />
                                  ) : field.type === "pm-select" ? (
                                    <select
                                      name={field.name}
                                      value={value}
                                      required={field.required}
                                      onChange={handleChange}
                                      onFocus={() => setActiveField(field.name)}
                                      onBlur={() => setActiveField(null)}
                                      className="w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white hover:bg-gray-50/20 transition-all duration-150 shadow-sm"
                                    >
                                      <option value="">{formData.program_manager ? "Select Project Manager..." : "Select Headed By first"}</option>
                                      {programManagerOptions.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : field.type === "headed-by-select" ? (
                                    <select
                                      name={field.name}
                                      value={value}
                                      required={field.required}
                                      onChange={handleChange}
                                      onFocus={() => setActiveField(field.name)}
                                      onBlur={() => setActiveField(null)}
                                      className="w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white hover:bg-gray-50/20 transition-all duration-150 shadow-sm"
                                    >
                                      <option value="">Select Headed By...</option>
                                      {headedByOptions.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : field.type === "file" ? (
                                    <input
                                      type="file"
                                      name={field.name}
                                      onFocus={() => setActiveField(field.name)}
                                      onBlur={() => setActiveField(null)}
                                      onChange={(e) => setPendingAttachment(e.target.files?.[0] || null)}
                                      className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50/20"
                                    />
                                  ) : field.type === "select" ? (
                                    <select
                                      name={field.name}
                                      value={value}
                                      required={field.required}
                                      disabled={field.readOnly}
                                      onChange={handleChange}
                                      onFocus={() => setActiveField(field.name)}
                                      onBlur={() => setActiveField(null)}
                                      className={`w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border transition-all duration-150 shadow-sm focus:ring-2 outline-none appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:0.8em_0.8em] ${
                                        errors[field.name]
                                          ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                                          : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                                      } ${field.readOnly ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100 hover:bg-gray-50" : "bg-white hover:bg-gray-50/20"}`}
                                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23374151'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                                    >
                                      <option value="">Select...</option>
                                      {field.options?.map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : field.type === "manager-sub-person" ? (
                                    <div className={errors[field.name] ? "rounded-lg ring-2 ring-rose-500/20 border border-rose-500 overflow-hidden" : ""}>
                                      <ManagerSubPersonInput
                                        value={value}
                                        onChange={(val) => {
                                          setFormData(prev => ({ ...prev, [field.name]: val }));
                                          if (errors[field.name]) {
                                            setErrors(prev => {
                                              const next = { ...prev };
                                              delete next[field.name];
                                              return next;
                                            });
                                          }
                                        }}
                                        required={field.required}
                                        readOnly={field.readOnly}
                                        onFocus={() => setActiveField(field.name)}
                                        onBlur={() => setActiveField(null)}
                                      />
                                    </div>
                                  ) : (
                                    <input
                                      type={field.type === "date" ? "date" : "text"}
                                      name={field.name}
                                      value={value}
                                      required={field.required}
                                      disabled={field.readOnly}
                                      readOnly={field.readOnly}
                                      placeholder={field.readOnly && !value ? "Auto-generated" : ""}
                                      onChange={handleChange}
                                      onFocus={() => setActiveField(field.name)}
                                      onBlur={() => setActiveField(null)}
                                      className={`w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border transition-all duration-150 shadow-sm focus:ring-2 outline-none ${
                                        errors[field.name] 
                                          ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" 
                                          : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                                      } ${field.readOnly ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100 hover:bg-gray-50" : "bg-white hover:bg-gray-50/20"}`}
                                    />
                                  )}
                                  {errors[field.name] && (
                                    <p className="text-[10px] text-rose-500 mt-1 font-semibold flex items-center gap-1">
                                      ⚠️ {errors[field.name]}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Original Paginated Steps
                <>
                  {/* Step 1 Fields */}
                  <div className={`px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 bg-white ${step === 1 ? 'block animate-fade-in' : 'hidden'}`}>
                    {step1Fields.map((field) => {
                      const value = formData[field.name] ?? "";
                      const isFullWidth = field.type === "textarea" || field.name.includes("title") || field.name === "subject" || field.name.includes("description");

                      return (
                        <div key={field.name} className={isFullWidth ? "md:col-span-2" : ""}>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5 tracking-wide">
                            {field.label} {field.required && <span className="text-red-600 font-bold">*</span>}
                          </label>

                          {field.type === "project-search" ? (
                            <ProjectSearchInput
                              value={value}
                              onChange={(val) => {
                                setFormData(prev => ({ ...prev, [field.name]: val }));
                                if (errors[field.name]) {
                                  setErrors(prev => {
                                    const next = { ...prev };
                                    delete next[field.name];
                                    return next;
                                  });
                                }
                              }}
                              onSelect={async (project) => {
                                const newData = {
                                  manual_project_id: project.name,
                                  project_description: project.description,
                                  account: project.account
                                };

                                if (!editingId) {
                                  try {
                                    const singularMap = {
                                      risks: "risk",
                                      issues: "issue",
                                      actions: "action",
                                      dependencies: "dependency",
                                      escalations: "escalation",
                                      appreciations: "appreciation"
                                    };
                                    const module = singularMap[moduleKey] || moduleKey.replace(/s$/, "");
                                    const res = await fetchPreviewId(module, project.name, project.account);
                                    const previewId = res?.previewId || res?.data?.previewId;

                                    if (previewId) {
                                      const idField = `${module}_id`;
                                      newData[idField] = previewId;
                                    }
                                  } catch (err) {
                                    console.error("Failed to auto-generate ID", err);
                                  }
                                }

                                setFormData(prev => ({
                                  ...prev,
                                  ...newData
                                }));

                                setErrors(prev => {
                                  const next = { ...prev };
                                  delete next[field.name];
                                  delete next.account;
                                  delete next.project_description;
                                  return next;
                                });
                              }}
                              required={field.required}
                              onFocus={() => setActiveField(field.name)}
                              onBlur={() => setActiveField(null)}
                              className="w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white hover:bg-gray-50/20 transition-all duration-150 shadow-sm"
                            />
                          ) : field.type === "textarea" ? (
                            <textarea
                              name={field.name}
                              value={value}
                              rows={2}
                              required={field.required}
                              disabled={field.readOnly}
                              onChange={handleChange}
                              onFocus={() => setActiveField(field.name)}
                              onBlur={() => setActiveField(null)}
                              className={`w-full px-3 py-2 rounded-lg text-xs text-gray-900 border transition-all duration-150 shadow-sm focus:ring-2 outline-none min-h-[90px] resize-y ${
                                errors[field.name] 
                                  ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" 
                                  : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                              } ${field.readOnly ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100 hover:bg-gray-50" : "bg-white hover:bg-gray-50/20"}`}
                            />
                          ) : field.type === "pm-select" ? (
                            <select
                              name={field.name}
                              value={value}
                              required={field.required}
                              onChange={handleChange}
                              onFocus={() => setActiveField(field.name)}
                              onBlur={() => setActiveField(null)}
                              className="w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white hover:bg-gray-50/20 transition-all duration-150 shadow-sm"
                            >
                              <option value="">{formData.program_manager ? "Select Project Manager..." : "Select Headed By first"}</option>
                              {programManagerOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.type === "headed-by-select" ? (
                            <select
                              name={field.name}
                              value={value}
                              required={field.required}
                              onChange={handleChange}
                              onFocus={() => setActiveField(field.name)}
                              onBlur={() => setActiveField(null)}
                              className="w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white hover:bg-gray-50/20 transition-all duration-150 shadow-sm"
                            >
                              <option value="">Select Headed By...</option>
                              {headedByOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.type === "file" ? (
                            <input
                              type="file"
                              name={field.name}
                              onFocus={() => setActiveField(field.name)}
                              onBlur={() => setActiveField(null)}
                              onChange={(e) => setPendingAttachment(e.target.files?.[0] || null)}
                              className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50/20"
                            />
                          ) : field.type === "select" ? (
                            <select
                              name={field.name}
                              value={value}
                              required={field.required}
                              disabled={field.readOnly}
                              onChange={handleChange}
                              onFocus={() => setActiveField(field.name)}
                              onBlur={() => setActiveField(null)}
                              className={`w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border transition-all duration-150 shadow-sm focus:ring-2 outline-none appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:0.8em_0.8em] ${
                                errors[field.name]
                                  ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                                  : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                              } ${field.readOnly ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100 hover:bg-gray-50" : "bg-white hover:bg-gray-50/20"}`}
                              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23374151'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                            >
                              <option value="">Select...</option>
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.type === "manager-sub-person" ? (
                            <div className={errors[field.name] ? "rounded-lg ring-2 ring-rose-500/20 border border-rose-500 overflow-hidden" : ""}>
                              <ManagerSubPersonInput
                                value={value}
                                onChange={(val) => {
                                  setFormData(prev => ({ ...prev, [field.name]: val }));
                                  if (errors[field.name]) {
                                    setErrors(prev => {
                                      const next = { ...prev };
                                      delete next[field.name];
                                      return next;
                                    });
                                  }
                                }}
                                required={field.required}
                                readOnly={field.readOnly}
                                onFocus={() => setActiveField(field.name)}
                                onBlur={() => setActiveField(null)}
                              />
                            </div>
                          ) : (
                            <input
                              type={field.type === "date" ? "date" : "text"}
                              name={field.name}
                              value={value}
                              required={field.required}
                              disabled={field.readOnly}
                              readOnly={field.readOnly}
                              placeholder={field.readOnly && !value ? "Auto-generated" : ""}
                              onChange={handleChange}
                              onFocus={() => setActiveField(field.name)}
                              onBlur={() => setActiveField(null)}
                              className={`w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border transition-all duration-150 shadow-sm focus:ring-2 outline-none ${
                                errors[field.name] 
                                  ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" 
                                  : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                              } ${field.readOnly ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100 hover:bg-gray-50" : "bg-white hover:bg-gray-50/20"}`}
                            />
                          )}
                          {errors[field.name] && (
                            <p className="text-[10px] text-rose-500 mt-1 font-semibold flex items-center gap-1">
                              ⚠️ {errors[field.name]}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

              {/* Step 2 Fields */}
              <div className={`px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 bg-white ${step === 2 ? 'block animate-fade-in' : 'hidden'}`}>
                {step2Fields.map((field) => {
                  const value = formData[field.name] ?? "";
                  const isFullWidth = field.type === "textarea" || field.name.includes("title") || field.name === "subject" || field.name.includes("description");

                  return (
                    <div key={field.name} className={isFullWidth ? "md:col-span-2" : ""}>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 tracking-wide">
                        {field.label} {field.required && <span className="text-red-600 font-bold">*</span>}
                      </label>

                      {/* Attached Documents display for escalations/status */}
                      {moduleKey === "escalation" && field.name === "status" && formData.documents && formData.documents.length > 0 && (
                        <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <span className="block text-[10px] font-bold text-gray-700 uppercase mb-1.5">Attached Documents</span>
                          <div className="space-y-1">
                            {formData.documents.map((doc, idx) => (
                              <a
                                key={doc.id || idx}
                                href={`${process.env.REACT_APP_API_URL || "http://localhost:5000"}/${doc.file_path}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-[11px] text-blue-700 hover:underline font-semibold"
                              >
                                📄 {doc.file_name} <span className="text-[9px] text-gray-400">({new Date(doc.uploaded_at).toLocaleDateString()})</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {field.type === "project-search" ? (
                        <ProjectSearchInput
                          value={value}
                          onChange={(val) => {
                            setFormData(prev => ({ ...prev, [field.name]: val }));
                            if (errors[field.name]) {
                              setErrors(prev => {
                                const next = { ...prev };
                                delete next[field.name];
                                return next;
                              });
                            }
                          }}
                          onSelect={async (project) => {
                            const newData = {
                              manual_project_id: project.name,
                              project_description: project.description,
                              account: project.account
                            };

                            if (!editingId) {
                              try {
                                const singularMap = {
                                  risks: "risk",
                                  issues: "issue",
                                  actions: "action",
                                  dependencies: "dependency",
                                  escalations: "escalation",
                                  appreciations: "appreciation"
                                };
                                const module = singularMap[moduleKey] || moduleKey.replace(/s$/, "");
                                const res = await fetchPreviewId(module, project.name, project.account);
                                const previewId = res?.previewId || res?.data?.previewId;

                                if (previewId) {
                                  const idField = `${module}_id`;
                                  newData[idField] = previewId;
                                }
                              } catch (err) {
                                console.error("Failed to auto-generate ID", err);
                              }
                            }

                            setFormData(prev => ({
                              ...prev,
                              ...newData
                            }));

                            setErrors(prev => {
                              const next = { ...prev };
                              delete next[field.name];
                              delete next.account;
                              delete next.project_description;
                              return next;
                            });
                          }}
                          required={field.required}
                          onFocus={() => setActiveField(field.name)}
                          onBlur={() => setActiveField(null)}
                          className="w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white hover:bg-gray-50/20 transition-all duration-150 shadow-sm"
                        />
                      ) : field.type === "textarea" ? (
                        <textarea
                          name={field.name}
                          value={value}
                          rows={2}
                          required={field.required}
                          disabled={field.readOnly}
                          onChange={handleChange}
                          onFocus={() => setActiveField(field.name)}
                          onBlur={() => setActiveField(null)}
                          className={`w-full px-3 py-2 rounded-lg text-xs text-gray-900 border transition-all duration-150 shadow-sm focus:ring-2 outline-none min-h-[90px] resize-y ${
                            errors[field.name] 
                              ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" 
                              : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                          } ${field.readOnly ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100 hover:bg-gray-50" : "bg-white hover:bg-gray-50/20"}`}
                        />
                      ) : field.type === "pm-select" ? (
                        <select
                          name={field.name}
                          value={value}
                          required={field.required}
                          onChange={handleChange}
                          onFocus={() => setActiveField(field.name)}
                          onBlur={() => setActiveField(null)}
                          className="w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white hover:bg-gray-50/20 transition-all duration-150 shadow-sm"
                        >
                          <option value="">{formData.program_manager ? "Select Project Manager..." : "Select Headed By first"}</option>
                          {programManagerOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === "headed-by-select" ? (
                        <select
                          name={field.name}
                          value={value}
                          required={field.required}
                          onChange={handleChange}
                          onFocus={() => setActiveField(field.name)}
                          onBlur={() => setActiveField(null)}
                          className="w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white hover:bg-gray-50/20 transition-all duration-150 shadow-sm"
                        >
                          <option value="">Select Headed By...</option>
                          {headedByOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === "file" ? (
                        <input
                          type="file"
                          name={field.name}
                          onFocus={() => setActiveField(field.name)}
                          onBlur={() => setActiveField(null)}
                          onChange={(e) => setPendingAttachment(e.target.files?.[0] || null)}
                          className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white hover:bg-gray-50/20"
                        />
                      ) : field.type === "select" ? (
                        <select
                          name={field.name}
                          value={value}
                          required={field.required}
                          disabled={field.readOnly}
                          onChange={handleChange}
                          onFocus={() => setActiveField(field.name)}
                          onBlur={() => setActiveField(null)}
                          className={`w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border transition-all duration-150 shadow-sm focus:ring-2 outline-none appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:0.8em_0.8em] ${
                            errors[field.name]
                              ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"
                              : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                          } ${field.readOnly ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100 hover:bg-gray-50" : "bg-white hover:bg-gray-50/20"}`}
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23374151'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")` }}
                        >
                          <option value="">Select...</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === "manager-sub-person" ? (
                        <div className={errors[field.name] ? "rounded-lg ring-2 ring-rose-500/20 border border-rose-500 overflow-hidden" : ""}>
                          <ManagerSubPersonInput
                            value={value}
                            onChange={(val) => {
                              setFormData(prev => ({ ...prev, [field.name]: val }));
                              if (errors[field.name]) {
                                setErrors(prev => {
                                  const next = { ...prev };
                                  delete next[field.name];
                                  return next;
                                });
                              }
                            }}
                            required={field.required}
                            readOnly={field.readOnly}
                            onFocus={() => setActiveField(field.name)}
                            onBlur={() => setActiveField(null)}
                          />
                        </div>
                      ) : (
                        <input
                          type={field.type === "date" ? "date" : "text"}
                          name={field.name}
                          value={value}
                          required={field.required}
                          disabled={field.readOnly}
                          readOnly={field.readOnly}
                          placeholder={field.readOnly && !value ? "Auto-generated" : ""}
                          onChange={handleChange}
                          onFocus={() => setActiveField(field.name)}
                          onBlur={() => setActiveField(null)}
                          className={`w-full h-10 px-3 py-2 rounded-lg text-xs text-gray-900 border transition-all duration-150 shadow-sm focus:ring-2 outline-none ${
                            errors[field.name] 
                              ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" 
                              : "border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                          } ${field.readOnly ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100 hover:bg-gray-50" : "bg-white hover:bg-gray-50/20"}`}
                        />
                      )}
                      {errors[field.name] && (
                        <p className="text-[10px] text-rose-500 mt-1 font-semibold flex items-center gap-1">
                          ⚠️ {errors[field.name]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

              {/* Action Buttons Footer */}
              <div className="flex justify-between items-center px-6 py-4 bg-gray-50/30 border-t border-gray-100 rounded-b-xl flex-shrink-0 gap-3">
                {moduleKey === "issues" || moduleKey === "risks" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(`${location.pathname}?mode=view`)}
                      className="px-4 py-2 border border-gray-200 bg-white rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm focus:ring-2 focus:ring-gray-200 outline-none"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 shadow-sm hover:shadow-md active:scale-95"
                    >
                      {saving ? "Saving..." : "Save Record"}
                    </button>
                  </>
                ) : step === 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(`${location.pathname}?mode=view`)}
                      className="px-4 py-2 border border-gray-200 bg-white rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm focus:ring-2 focus:ring-gray-200 outline-none"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                      Next <span>→</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 border border-gray-200 bg-white rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm focus:ring-2 focus:ring-gray-200 outline-none flex items-center gap-1.5"
                      disabled={saving}
                    >
                      <span>←</span> Previous
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 shadow-sm hover:shadow-md active:scale-95"
                    >
                      {saving ? "Saving..." : "Save Record"}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>

        </EnterpriseWorkspaceLayout>
      )}
      <EscalationResolutionModal
        isOpen={showResolutionModal}
        onClose={() => {
          setShowResolutionModal(false);
          setResolutionId(null);
        }}
        escalationId={resolutionId}
        onSuccess={() => {
          loadData();
          navigate(`/modules/${moduleKey}`);
        }}
      />
      <SuccessNotification
        isOpen={showSuccessNotification}
        onClose={() => setShowSuccessNotification(false)}
      />
      {
        showLayoutBuilder && (
          <LayoutBuilder
            fields={layoutFields}
            onClose={() => setShowLayoutBuilder(false)}
            onSave={async (newLayout) => {
              await saveLayoutApi(moduleKey, newLayout);
              setLayoutFields(newLayout);
              setShowLayoutBuilder(false);
            }}
          />
        )
      }
      {showAddNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center transform scale-100 transition-all">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-50 border border-blue-100 mb-4 shadow-inner">
              <span className="text-blue-600 text-xl font-bold font-serif">i</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 font-marcellus">Important Notice</h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Entries can be added or edited anytime, but <strong>deletion is strictly limited</strong> to the same day of creation. Please ensure your data entry is precise and accurate.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowAddNotice(false)}
                className="px-6 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={proceedToNew}
                className="px-6 py-2.5 rounded-lg bg-black text-white font-semibold text-sm hover:bg-gray-800 shadow-md transition-all"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-fade-in transition-all">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform scale-100 animate-slide-up transition-all">
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100 mb-5 shadow-inner">
              <Trash size={28} weight="duotone" className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Confirm Deletion</h3>
            <p className="text-sm text-gray-600 mb-8 leading-relaxed">
              Are you sure you want to permanently delete the <strong className="text-gray-900">{selectedIds.length} select {selectedIds.length === 1 ? 'entry' : 'entries'}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmDelete(false);
                  setSelectedIds([]);
                  setIsDeleteMode(false);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 outline-none transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 shadow-md hover:shadow-lg focus:ring-2 focus:ring-red-500 focus:ring-offset-1 outline-none transition-all"
              >
                Delete ({selectedIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {globalAlert && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-fade-in transition-all">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform scale-100 animate-slide-up transition-all">
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-blue-50 mb-5 shadow-inner border border-blue-100">
              <span className="text-blue-500 text-2xl font-bold font-serif">i</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">{globalAlert.title || "System Notice"}</h3>
            <p className="text-sm text-gray-600 mb-8 leading-relaxed">
              {globalAlert.message || globalAlert}
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setGlobalAlert(null)}
                className="w-full px-4 py-2.5 rounded-lg bg-black text-white font-semibold text-sm hover:bg-gray-800 shadow-md transition-all outline-none focus:ring-2 focus:ring-gray-400"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

    </div >
  );
};

export default WorkboardPage;
