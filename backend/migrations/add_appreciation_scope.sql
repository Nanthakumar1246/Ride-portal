-- Internal vs External appreciation scope
ALTER TABLE appreciations
  ADD COLUMN IF NOT EXISTS appreciation_scope VARCHAR(50) DEFAULT 'Internal Appreciation';

UPDATE appreciations
SET appreciation_scope = 'Internal Appreciation'
WHERE appreciation_scope IS NULL OR appreciation_scope = '';
