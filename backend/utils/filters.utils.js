
import { getAssignedProjects } from "../models/users.model.js";
import { listMembersByManager } from "../models/managers.model.js";

export async function applyRoleRestrictions(user, query) {
  let augmented = { ...query };

  if (user.role === "PM") {
    // PM-role users are scoped entirely by name-match against the record's
    // individual PM (project_manager column), replacing the project-assignment restriction.
    augmented.pmName = user.name;
  } else if (user.role !== "ADMIN") {
    const assigned = await getAssignedProjects(user.id);
    const ids = assigned.map((p) => p.id);
    augmented.allowedProjectIds = ids;
    augmented.currentUserId = user.id;
    augmented.currentUserEmail = user.email;
  }

  // Handle Manager Filter resolution
  if (query.manager && query.manager !== 'All') {
    try {
      const members = await listMembersByManager(query.manager);
      augmented.managerMembers = members;
    } catch (err) {
      console.error("Error resolving manager members:", err);
    }
  }

  return augmented;
}

function _applyManagerFilter(where, params, i, query, col) {
  const { manager, managerMembers } = query;

  if (manager && manager !== 'All') {
    if (managerMembers && managerMembers.length > 0) {
      const clauses = [];
      managerMembers.forEach(member => {
        // Rule 5: Hybrid support for Old (Vishal) and New (Ajay - Vishal)
        clauses.push(`${col}::text = $${i++}::text`);
        params.push(member);
        
        clauses.push(`${col}::text = $${i++}::text`);
        params.push(`${manager} - ${member}`);
      });

      // Also support the manager name itself just in case
      clauses.push(`${col}::text = $${i++}::text`);
      params.push(manager);

      where.push(`(${clauses.join(' OR ')})`);
    } else {
      // Rule 4: Stored as Manager + Member (Ajay - Vishal) -> fallback to LIKE for broad filtering
      where.push(`${col}::text LIKE $${i++}::text || '%'`);
      params.push(manager);
    }
  }
  return i;
}

function _applyProgramManagerFilter(where, params, i, query, alias) {
  if (query.pmName) {
    where.push(`${alias}.project_manager::text = $${i++}::text`);
    params.push(query.pmName);
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
  i = _applyManagerFilter(where, params, i, query, "r.identified_by");
  i = _applyProgramManagerFilter(where, params, i, query, "r");

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
  i = _applyManagerFilter(where, params, i, query, "i.reported_by");
  i = _applyProgramManagerFilter(where, params, i, query, "i");

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
  i = _applyManagerFilter(where, params, i, query, "a.created_by");
  i = _applyProgramManagerFilter(where, params, i, query, "a");

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
  i = _applyManagerFilter(where, params, i, query, "d.reported_by");
  i = _applyProgramManagerFilter(where, params, i, query, "d");

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
  i = _applyManagerFilter(where, params, i, query, "e.reported_by");
  i = _applyProgramManagerFilter(where, params, i, query, "e");

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
  i = _applyManagerFilter(where, params, i, query, "a.recorded_by");
  i = _applyProgramManagerFilter(where, params, i, query, "a");

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
