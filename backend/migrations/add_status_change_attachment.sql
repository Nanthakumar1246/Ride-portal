-- Proof-of-closure attachment for status changes.
-- When a log moves to "Closed & Acknowledged" or "Hold", the user must supply
-- remarks plus a supporting file; the file is recorded against the status-change
-- history row (module_history for most modules, risk_history for Risks).
ALTER TABLE module_history
  ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(500);

ALTER TABLE risk_history
  ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(500);
