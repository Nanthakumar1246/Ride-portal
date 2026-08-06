import pool from './db.js';

async function checkUsers() {
    try {
        const res = await pool.query('SELECT * FROM users LIMIT 10;');
        console.table(res.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
    } finally {
        pool.end();
    }
}

checkUsers();
