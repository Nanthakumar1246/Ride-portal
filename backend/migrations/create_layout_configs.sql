-- backend/migrations/create_layout_configs.sql
CREATE TABLE IF NOT EXISTS layout_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module VARCHAR(50) NOT NULL UNIQUE,
    config JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(255)
);
   


   