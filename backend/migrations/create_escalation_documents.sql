-- backend/migrations/create_escalation_documents.sql
CREATE TABLE IF NOT EXISTS escalation_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escalation_id UUID NOT NULL REFERENCES escalations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_path TEXT NOT NULL,
  uploaded_by TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_escalation_documents_escalation_id ON escalation_documents(escalation_id);
