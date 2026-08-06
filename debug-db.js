
import pool from './backend/db.js';

async function checkCollections() {
    try {
        const res = await pool.query('SELECT count(*) FROM collections');
        console.log('Collections count:', res.rows[0].count);

        if (res.rows[0].count > 0) {
            const sample = await pool.query('SELECT * FROM collections LIMIT 1');
            console.log('Sample row:', sample.rows[0]);
        }
    } catch (err) {
        console.error('Error checking collections:', err);
    } finally {
        pool.end();
    }
}
checkCollections();
