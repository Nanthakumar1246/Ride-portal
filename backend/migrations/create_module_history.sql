CREATE TABLE IF NOT EXISTS module_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module VARCHAR(50) NOT NULL,
  record_id VARCHAR(100) NOT NULL,
  updated_by VARCHAR(255),
  old_status VARCHAR(100),
  new_status VARCHAR(100),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
