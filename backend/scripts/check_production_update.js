const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const username = process.argv[2] || 'admin';

(async () => {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'somtop_db'
    });
    try {
        const [roleColumns] = await connection.query("SHOW COLUMNS FROM users LIKE 'role'");
        const [courtColumns] = await connection.query("SHOW COLUMNS FROM users LIKE 'court_code'");
        const [holidayTables] = await connection.query("SHOW TABLES LIKE 'holidays'");
        const [users] = await connection.query(
            'SELECT role, court_code FROM users WHERE username = ? LIMIT 1', [username]
        );
        const failures = [];
        if (!roleColumns[0]?.Type.includes("'central_admin'")) failures.push('Run migration 012_central_admin.sql');
        if (courtColumns[0]?.Null !== 'YES') failures.push('users.court_code must allow NULL');
        if (!holidayTables.length) failures.push('Run migration 011_holidays.sql');
        if (!users.length) failures.push(`Account ${username} does not exist`);
        else if (!['admin', 'central_admin'].includes(users[0].role)) failures.push(`Account ${username} is not an admin`);
        else if (users[0].role === 'central_admin' && users[0].court_code !== null) {
            failures.push(`Account ${username} must have NULL court_code`);
        }
        if (failures.length) {
            failures.forEach(item => console.error(`FAIL: ${item}`));
            process.exitCode = 1;
        } else {
            console.log(`PASS: holidays, central_admin schema and ${username} account are ready`);
            console.log(`Account role: ${users[0].role}`);
        }
    } finally {
        await connection.end();
    }
})().catch(error => {
    console.error(`Preflight failed: ${error.message}`);
    process.exitCode = 1;
});
