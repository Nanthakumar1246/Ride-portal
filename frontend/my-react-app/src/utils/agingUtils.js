export const AGING_BUCKETS = {
  OVERDUE: "overdue",
  DUE_TODAY_TOMORROW: "dueTodayTomorrow",
  DUE_THIS_WEEK: "dueThisWeek",
  ON_TRACK: "onTrack",
};

const DEFAULT_COMPLETED_KEYWORDS = [
  "resolved",
  "approved",
  "closed",
  "acknowledged",
  "completed",
  "cancelled",
];

export const AGING_CONFIGS = {
  dependencies: {
    dateFields: ["target_date", "due_date", "required_by_date", "reported_date", "created_at"],
  },
  issues: {
    dateFields: ["target_date", "due_date", "target_resolution_date", "reported_date", "created_at"],
  },
  escalations: {
    dateFields: ["target_date", "due_date", "target_resolution_date", "reported_date", "created_at"],
  },
  risks: {
    dateFields: ["target_mitigation_date", "planned_closure_date", "identified_date", "created_at"],
  },
  actions: {
    dateFields: ["target_date", "due_date", "created_at"],
  },
  dashboard: {
    dateFields: ["due_date", "target_date", "target_mitigation_date", "planned_closure_date", "identified_date", "created_at"],
  },
};

const isCompletedStatus = (row, config) => {
  const status = String(row[config.statusField || "status"] || row.current_status || "").toLowerCase();
  const keywords = config.completedKeywords || DEFAULT_COMPLETED_KEYWORDS;
  return keywords.some((kw) => status.includes(kw));
};

const resolveTargetDate = (row, config) => {
  const fields = config.dateFields || ["target_date", "due_date", "created_at"];
  for (const field of fields) {
    if (row[field]) return row[field];
  }
  return null;
};

const getDiffDays = (targetDateStr) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const getAgingBucket = (row, config) => {
  if (isCompletedStatus(row, config)) return null;

  const targetDateStr = resolveTargetDate(row, config);
  if (!targetDateStr) return AGING_BUCKETS.ON_TRACK;

  const diffDays = getDiffDays(targetDateStr);
  if (diffDays < 0) return AGING_BUCKETS.OVERDUE;
  if (diffDays <= 1) return AGING_BUCKETS.DUE_TODAY_TOMORROW;
  if (diffDays <= 7) return AGING_BUCKETS.DUE_THIS_WEEK;
  return AGING_BUCKETS.ON_TRACK;
};

export const computeAgingCounts = (rows, config) => {
  const counts = {
    overdue: 0,
    dueTodayTomorrow: 0,
    dueThisWeek: 0,
    onTrack: 0,
  };

  (rows || []).forEach((row) => {
    const bucket = getAgingBucket(row, config);
    if (!bucket) return;
    counts[bucket]++;
  });

  return counts;
};

export const matchesAgingFilter = (row, config, filter) => {
  if (!filter) return true;
  return getAgingBucket(row, config) === filter;
};
