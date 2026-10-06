-- Appreciation approval workflow.
-- A PM-submitted appreciation starts as PENDING and only becomes visible to
-- everyone once an admin approves it. An admin-created appreciation is
-- approved on the spot.
ALTER TABLE appreciations
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- Appreciations that predate the workflow were already visible, so they stay
-- visible (subject to the 20-day display window applied at query time).
UPDATE appreciations
SET status = 'APPROVED'
WHERE status IS NULL OR status = '' OR status = 'PENDING';
