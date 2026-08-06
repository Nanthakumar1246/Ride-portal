CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email VARCHAR(255) NOT NULL,
  module VARCHAR(50),
  record_id VARCHAR(100),
  event_type VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_recipient ON app_notifications (recipient_email, is_read);
