-- Migration script to upgrade projects table to full Project Master schema and create import templates table

ALTER TABLE projects ADD COLUMN IF NOT EXISTS so_number VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS manual_project_id VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_manager VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS program_manager VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS scope_description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Populate manual_project_id from name if NULL
UPDATE projects SET manual_project_id = name WHERE manual_project_id IS NULL OR manual_project_id = '';

-- Create Mapping Templates Table
CREATE TABLE IF NOT EXISTS project_import_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL,
    mapping_config JSONB NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
