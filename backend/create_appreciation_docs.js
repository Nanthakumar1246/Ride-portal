import pool from './db.js';

async function createTable() {
    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS appreciation_documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                appreciation_id UUID REFERENCES appreciations(id) ON DELETE CASCADE,
                file_name TEXT NOT NULL,
                file_type TEXT,
                file_path TEXT NOT NULL,
                uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `;
        await pool.query(sql);
        console.log("Table appreciation_documents created successfully.");
    } catch (err) {
        console.error("Error creating table:", err.message);
    } finally {
        pool.end();
    }
}

createTable();
