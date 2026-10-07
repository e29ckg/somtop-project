const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const username = process.argv[2];
if (!username) {
    console.error('Usage: node scripts/activate_central_admin.js <existing-admin-username>');
    process.exit(1);
}

(async () => {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'somtop_db'
    });
    try {
        const [columns] = await connection.query('SHOW COLUMNS FROM users LIKE ?', ['role']);
        if (!columns[0]?.Type.includes("'central_admin'")) {
            throw new Error('Migration 012_central_admin.sql has not been applied. Run it with a database administrator first.');
        }
        await connection.beginTransaction();
        const [users] = await connection.query(
            'SELECT id, role, court_code FROM users WHERE username = ? FOR UPDATE', [username]
        );
        if (users.length !== 1 || !['admin', 'central_admin'].includes(users[0].role)) {
            throw new Error('The named account must exist and have the admin or central_admin role');
        }
        if (users[0].role === 'central_admin') {
            if (users[0].court_code !== null) {
                throw new Error('Existing central_admin account must have NULL court_code');
            }
            await connection.commit();
            console.log(`${username} is already central_admin`);
            return;
        }
        await connection.query(
            'UPDATE users SET role = ?, court_code = NULL WHERE id = ?',
            ['central_admin', users[0].id]
        );
        await connection.commit();
        console.log(`Promoted ${username} to central_admin`);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        await connection.end();
    }
})().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
