
import { getAssignedProjects } from "../models/users.model.js";
import { listMembersByManager } from "../models/managers.model.js";

/** How long an approved appreciation stays on display, in days. */
export const APPRECIATION_DISPLAY_DAYS = 20;

export function isPmRole(user) {
  return String(user?.role || "").toUpperCase() === "PM";
}

/**
 * Creator-identity columns used to scope a PM to records they created /
 * reported (not every row that lists them as Project Manager on the form).
 * Keys are bare table names as used by dashboard / metrics / search.
 */
export const PM_CREATOR_SCOPE = {
  risks: { idCol: "created_by", emailCols: ["identified_by"] },
  issues: { idCol: "created_by", emailCols: ["reported_by"] },
  actions: { idCol: null, emailCols: ["created_by"] },
  dependencies: { idCol: "created_by", emailCols: ["reported_by"] },
  escalations: { idCol: "created_by", emailCols: ["reported_by"] },
  appreciations: { idCol: null, emailCols: ["recorded_by"] },
};

/**
 * Build an AND-clause that restricts a bare table to the PM's own records.
 * Mutates `params`. Returns "" for non-PM users.
 */
export function buildPmCreatorAndClause(table, user, params, { alias = "" } = {}) {
  if (!isPmRole(user)) return "";
  const cfg = PM_CREATOR_SCOPE[table];
  if (!cfg) return " AND 1 = 0";

  const prefix = alias ? `${alias}.` : "";
  const clauses = [];

  if (cfg.idCol && user.id) {
    params.push(user.id);
    clauses.push(`${prefix}${cfg.idCol}::text = $${params.length}::text`);
  }

  for (const col of cfg.emailCols || []) {
    if (user.email) {
      params.push(user.email);
      clauses.push(`LOWER(TRIM(${prefix}${col}::text)) = LOWER(TRIM($${params.length}::text))`);
    }
    if (user.name) {
      params.push(user.name);
      clauses.push(`LOWER(TRIM(${prefix}${col}::text)) = LOWER(TRIM($${params.length}::text))`);
    }
  }

  if (!clauses.length) return " AND 1 = 0";
  return ` AND (${clauses.join(" OR ")})`;
}

export async function applyRoleRestrictions(user, query) {
  let augmented = { ...query };
  const role = String(user?.role || "").toUpperCase();

  if (role === "PM") {
    // PM sees only records they created / reported. Master-data pickers
    // (Account / Project / Project Manager) stay unscoped.
    augmented.pmCreatorId = user.id || null;
    augmented.pmCreatorEmail = user.email || null;
    augmented.pmCreatorName = user.name || null;

    // The "manager" (Headed By) filter is an admin-only, portfolio-wide
    // control, but it is remembered per browser — so a selection an admin
    // made could still be sent on a PM's session and silently empty every
    // list. A PM is already limited to their own records, so drop it.
    delete augmented.manager;
  } else if (role !== "ADMIN") {
    const assigned = await getAssignedProjects(user.id);
    const ids = assigned.map((p) => p.id);
    augmented.allowedProjectIds = ids;
    augmented.currentUserId = user.id;
    augmented.currentUserEmail = user.email;
  }

  // Handle Manager Filter resolution
  if (augmented.manager && augmented.manager !== 'All') {
    try {
      const members = await listMembersByManager(query.manager);
      augmented.managerMembers = members;
    } catch (err) {
      console.error("Error resolving manager members:", err);
    }
  }

  return augmented;
}

function _applyManagerFilter(where, params, i, query, ownerCol, tableAlias = "") {
  const { manager, managerMembers } = query;

  if (manager && manager !== "All") {
    const prefix = tableAlias ? `${tableAlias}.` : "";
    const clauses = [];

    // Primary: Headed By (program_manager) matches selected manager
    clauses.push(`${prefix}program_manager::text ILIKE $${i++}`);
    params.push(manager);

    // Also match individual PMs mapped under that manager
    if (managerMembers && managerMembers.length > 0) {
      managerMembers.forEach((member) => {
        clauses.push(`${prefix}project_manager::text = $${i++}`);
        params.push(member);

        if (ownerCol) {
          clauses.push(`${ownerCol}::text = $${i++}`);
          params.push(member);
          clauses.push(`${ownerCol}::text = $${i++}`);
          params.push(`${manager} - ${member}`);
        }
      });
    }

    // Legacy: owner / reporter field may store manager name
    if (ownerCol) {
      clauses.push(`${ownerCol}::text = $${i++}`);
      params.push(manager);
      clauses.push(`${ownerCol}::text ILIKE $${i++}`);
      params.push(`${manager}%`);
    }

    where.push(`(${clauses.join(" OR ")})`);
  }
  return i;
}

/**
 * Restrict list queries to records the logged-in PM created / reported.
 * `scope` uses the same shape as PM_CREATOR_SCOPE entries, with columns
 * already qualified by table alias (e.g. "r.created_by").
 */
function _applyPmCreatorFilter(where, params, i, query, { idCol = null, emailCols = [] } = {}) {
  const hasPmScope = query.pmCreatorId || query.pmCreatorEmail || query.pmCreatorName;
  if (!hasPmScope) return i;

  const clauses = [];

  if (idCol && query.pmCreatorId) {
    clauses.push(`${idCol}::text = $${i++}::text`);
    params.push(query.pmCreatorId);
  }

  for (const col of emailCols) {
    if (query.pmCreatorEmail) {
      clauses.push(`LOWER(TRIM(${col}::text)) = LOWER(TRIM($${i++}::text))`);
      params.push(query.pmCreatorEmail);
    }
    if (query.pmCreatorName) {
      clauses.push(`LOWER(TRIM(${col}::text)) = LOWER(TRIM($${i++}::text))`);
      params.push(query.pmCreatorName);
    }
  }

  if (clauses.length > 0) {
    where.push(`(${clauses.join(" OR ")})`);
  } else {
    where.push("1 = 0");
  }
  return i;
}

function _val(q, a, alt) {
  if (q && q[a] !== undefined && q[a] !== "") return q[a];
  if (q && q[alt] !== undefined && q[alt] !== "") return q[alt];
  return undefined;
}

function _parseAgingBucket(bucket) {
  if (!bucket) return null;
  const parts = String(bucket).split("-").map((s) => Number(s));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return parts;
}

function _buildSearchClause(cols, paramIndexStart, params, searchVal) {
  if (!searchVal) return { snippet: "", nextIndex: paramIndexStart };
  const idx = paramIndexStart;
  const tokens = [];

  params.push(`%${searchVal}%`);
  cols.forEach((col) => {
    tokens.push(`${col} ILIKE $${params.length}`);
  });

  const snippet = tokens.length ? `(${tokens.join(" OR ")})` : "";
  return { snippet, nextIndex: paramIndexStart + 1 };
}

function _applyAllowedProjects(where, params, i, query, alias, creatorCol = null, emailCol = null) {
  if (query.allowedProjectIds) {
    const clauses = [];

    if (query.allowedProjectIds.length > 0) {
      clauses.push(`${alias}.project_id = ANY($${i}::uuid[])`);
      params.push(query.allowedProjectIds);
      i++;
    }

    if (creatorCol && query.currentUserId) {
      clauses.push(`${creatorCol}::text = $${i++}::text`);
      params.push(query.currentUserId);
    }

    if (emailCol && query.currentUserEmail) {
      clauses.push(`${emailCol}::text = $${i++}::text`);
      params.push(query.currentUserEmail);
    }

    if (clauses.length > 0) {
      where.push(`(${clauses.join(" OR ")})`);
    } else {
      where.push("1 = 0");
    }
  }
  return i;
}

export function buildRiskFilters(query = {}) {
  const where = [];
  const params = [];
  let i = 1;

  const status = _val(query, "status", "status");
  const priority = _val(query, "priority", "priority");
  const category = _val(query, "category", "category");
  const account = _val(query, "account", "account");
  const manualProjectId = _val(query, "manual_project_id", "manual_project_id");
  const from = _val(query, "fromDate", "from_date");
  const to = _val(query, "toDate", "to_date");
  const aging = _val(query, "aging", "aging") || _val(query, "aging_bucket", "aging_bucket");
  const search = _val(query, "search", "search");
  const manager = _val(query, "manager", "manager");

  i = _applyAllowedProjects(where, params, i, query, "r", "r.created_by", "r.identified_by");
  i = _applyManagerFilter(where, params, i, query, "r.identified_by", "r");
  i = _applyPmCreatorFilter(where, params, i, query, { idCol: "r.created_by", emailCols: ["r.identified_by"] });

  if (status) { where.push(`r.status::text = $${i++}::text`); params.push(status); }
  if (priority) { where.push(`r.priority::text = $${i++}::text`); params.push(priority); }
  if (category) { where.push(`r.category::text = $${i++}::text`); params.push(category); }
  if (manualProjectId) { where.push(`r.manual_project_id::text = $${i++}::text`); params.push(manualProjectId); }
  if (account) {
    where.push(`r.account::text ILIKE $${i++}::text`);
    params.push(`%${account}%`);
  }
  if (from) { where.push(`r.identified_date >= $${i++}::date`); params.push(from); }
  if (to) { where.push(`r.identified_date <= $${i++}::date`); params.push(to); }

  if (aging) {
    const range = _parseAgingBucket(aging);
    if (range) {
      where.push(`(NOW()::date - r.identified_date) BETWEEN $${i++} AND $${i++}`);
      params.push(range[0], range[1]);
    }
  }

  if (search) {
    params.push(`%${search}%`);
    where.push(`(r.risk_title ILIKE $${i}::text OR r.risk_description ILIKE $${i}::text OR r.risk_id::text ILIKE $${i}::text)`);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { whereSql, params };
}

export function buildIssueFilters(query = {}) {
  const where = [];
  const params = [];
  let i = 1;

  const status = _val(query, "status", "status");
  const priority = _val(query, "priority", "priority");
  const account = _val(query, "account", "account");
  const manualProjectId = _val(query, "manual_project_id", "manual_project_id");
  const from = _val(query, "fromDate", "from_date");
  const to = _val(query, "toDate", "to_date");
  const aging = _val(query, "aging", "aging") || _val(query, "aging_bucket", "aging_bucket");
  const search = _val(query, "search", "search");
  const manager = _val(query, "manager", "manager");

  i = _applyAllowedProjects(where, params, i, query, "i", null, "i.reported_by");
  i = _applyManagerFilter(where, params, i, query, "i.reported_by", "i");
  i = _applyPmCreatorFilter(where, params, i, query, { idCol: "i.created_by", emailCols: ["i.reported_by"] });

  if (status) { where.push(`i.status::text = $${i++}::text`); params.push(status); }
  if (priority) { where.push(`i.priority::text = $${i++}::text`); params.push(priority); }
  if (manualProjectId) { where.push(`i.manual_project_id::text = $${i++}::text`); params.push(manualProjectId); }
  if (account) { where.push(`i.account::text ILIKE $${i++}::text`); params.push(`%${account}%`); }
  if (from) { where.push(`i.reported_date >= $${i++}::date`); params.push(from); }
  if (to) { where.push(`i.reported_date <= $${i++}::date`); params.push(to); }

  if (aging) {
    const range = _parseAgingBucket(aging);
    if (range) {
      where.push(`(NOW()::date - i.reported_date) BETWEEN $${i++} AND $${i++}`);
      params.push(range[0], range[1]);
    }
  }

  if (search) {
    params.push(`%${search}%`);
    where.push(`(i.issue_title ILIKE $${i}::text OR i.issue_description ILIKE $${i}::text OR i.issue_id::text ILIKE $${i}::text)`);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { whereSql, params };
}

export function buildActionFilters(query = {}) {
  const where = [];
  const params = [];
  let i = 1;

  const status = _val(query, "status", "status");
  const priority = _val(query, "priority", "priority");
  const search = _val(query, "search", "search");
  
  // Keep manager filter support for global filtering
  i = _applyManagerFilter(where, params, i, query, "a.created_by", "a");
  i = _applyPmCreatorFilter(where, params, i, query, { emailCols: ["a.created_by"] });

  if (status) { where.push(`a.status::text = $${i++}::text`); params.push(status); }
  if (priority) { where.push(`a.priority::text = $${i++}::text`); params.push(priority); }

  if (search) {
    params.push(`%${search}%`);
    // Search across internal columns that now map to simplified fields
    where.push(`(a.action_title ILIKE $${i}::text OR a.dependencies ILIKE $${i}::text OR a.action_id::text ILIKE $${i}::text OR a.action_owner ILIKE $${i}::text)`);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { whereSql, params };
}

export function buildDependencyFilters(query = {}) {
  const where = [];
  const params = [];
  let i = 1;

  const status = _val(query, "status", "status");
  const priority = _val(query, "priority", "priority");
  const type = _val(query, "type", "type");
  const account = _val(query, "account", "account");
  const manualProjectId = _val(query, "manual_project_id", "manual_project_id");
  const dependentOn = _val(query, "dependent_on", "dependent_on");
  const from = _val(query, "fromDate", "from_date");
  const to = _val(query, "toDate", "to_date");
  const search = _val(query, "search", "search");
  const manager = _val(query, "manager", "manager");

  i = _applyAllowedProjects(where, params, i, query, "d", null, "d.reported_by");
  i = _applyManagerFilter(where, params, i, query, "d.reported_by", "d");
  i = _applyPmCreatorFilter(where, params, i, query, { idCol: "d.created_by", emailCols: ["d.reported_by"] });

  if (status) { where.push(`d.status::text = $${i++}::text`); params.push(status); }
  if (priority) { where.push(`d.priority::text = $${i++}::text`); params.push(priority); }
  if (type) { where.push(`d.type::text = $${i++}::text`); params.push(type); }
  if (manualProjectId) { where.push(`d.manual_project_id::text = $${i++}::text`); params.push(manualProjectId); }
  if (account) {
    where.push(`d.account::text ILIKE $${i++}::text`);
    params.push(`%${account}%`);
  }
  if (dependentOn) { where.push(`d.dependent_on::text ILIKE $${i++}::text`); params.push(`%${dependentOn}%`); }
  if (from) { where.push(`d.reported_date >= $${i++}::date`); params.push(from); }
  if (to) { where.push(`d.reported_date <= $${i++}::date`); params.push(to); }

  if (search) {
    params.push(`%${search}%`);
    where.push(`(d.dependency_title ILIKE $${i}::text OR d.description ILIKE $${i}::text OR d.dependency_id::text ILIKE $${i}::text)`);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { whereSql, params };
}

export function buildEscalationFilters(query = {}) {
  const where = [];
  const params = [];
  let i = 1;

  const status = _val(query, "status", "status");
  const priority = _val(query, "priority", "priority");
  const category = _val(query, "category", "category");
  const account = _val(query, "account", "account");
  const manualProjectId = _val(query, "manual_project_id", "manual_project_id");
  const from = _val(query, "fromDate", "from_date");
  const to = _val(query, "toDate", "to_date");
  const search = _val(query, "search", "search");
  const manager = _val(query, "manager", "manager");

  i = _applyAllowedProjects(where, params, i, query, "e", "e.created_by");
  i = _applyManagerFilter(where, params, i, query, "e.reported_by", "e");
  i = _applyPmCreatorFilter(where, params, i, query, { idCol: "e.created_by", emailCols: ["e.reported_by"] });

  if (status) { where.push(`e.status::text = $${i++}::text`); params.push(status); }
  if (priority) { where.push(`e.priority::text = $${i++}::text`); params.push(priority); }
  if (category) { where.push(`e.category::text = $${i++}::text`); params.push(category); }
  if (manualProjectId) { where.push(`e.manual_project_id::text = $${i++}::text`); params.push(manualProjectId); }
  if (account) {
    where.push(`e.account::text ILIKE $${i++}::text`);
    params.push(`%${account}%`);
  }
  if (from) { where.push(`e.reported_date >= $${i++}::date`); params.push(from); }
  if (to) { where.push(`e.reported_date <= $${i++}::date`); params.push(to); }

  if (search) {
    params.push(`%${search}%`);
    where.push(`(e.title ILIKE $${i}::text OR e.description ILIKE $${i}::text OR e.escalation_id::text ILIKE $${i}::text)`);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { whereSql, params };
}

export function buildAppreciationFilters(query = {}) {
  const where = [];
  const params = [];
  let i = 1;

  const account = _val(query, "account", "account");
  const manualProjectId = _val(query, "manual_project_id", "manual_project_id");
  const from = _val(query, "fromDate", "from_date");
  const to = _val(query, "toDate", "to_date");
  const search = _val(query, "search", "search");
  const manager = _val(query, "manager", "manager");

  i = _applyAllowedProjects(where, params, i, query, "a", null, "a.recorded_by");
  i = _applyManagerFilter(where, params, i, query, "a.recorded_by", "a");
  i = _applyPmCreatorFilter(where, params, i, query, { emailCols: ["a.recorded_by"] });

  // Visibility rules:
  //  * an approved appreciation is on display for APPRECIATION_DISPLAY_DAYS
  //    days from the day it was added, then it drops off;
  //  * the person who submitted one always sees it while it is awaiting (or
  //    has been refused) approval, so they can track it;
  //  * an admin sees every not-yet-approved one, since they action them.
  const visibility = [
    `(a.status = 'APPROVED' AND a.created_at >= NOW() - INTERVAL '${APPRECIATION_DISPLAY_DAYS} days')`,
  ];
  if (String(query.viewerRole || "").toUpperCase() === "ADMIN") {
    visibility.push(`a.status <> 'APPROVED'`);
  } else if (query.viewerEmail) {
    visibility.push(`(a.status <> 'APPROVED' AND a.recorded_by::text = $${i++}::text)`);
    params.push(query.viewerEmail);
  }
  where.push(`(${visibility.join(" OR ")})`);

  if (manualProjectId) { where.push(`a.manual_project_id::text = $${i++}::text`); params.push(manualProjectId); }
  if (account) { where.push(`a.account::text ILIKE $${i++}::text`); params.push(`%${account}%`); }
  if (from) { where.push(`a.received_date >= $${i++}::date`); params.push(from); }
  if (to) { where.push(`a.received_date <= $${i++}::date`); params.push(to); }

  if (search) {
    params.push(`%${search}%`);
    where.push(`(a.subject ILIKE $${i}::text OR a.details ILIKE $${i}::text OR a.customer_name ILIKE $${i}::text)`);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { whereSql, params };
}
