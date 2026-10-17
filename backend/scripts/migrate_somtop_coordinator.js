const fs = require('node:fs');
const path = require('node:path');

async function migrateSomtopCoordinator(db) {
    const [columns] = await db.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'somtop'
           AND COLUMN_NAME = 'is_meeting_coordinator'`
    );
    if (columns.length) return false;

    const sql = fs.readFileSync(path.join(__dirname, '../migrations/015_somtop_meeting_coordinator.sql'), 'utf8');
    try {
        await db.query(sql);
    } catch (error) {
        // Another deployment may have added the same column after our check.
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
    }
    return true;
}

if (require.main === module) {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
    dotenv.config({ path: path.resolve(__dirname, '../.env') });
    const db = require('../src/config/db');
    (async () => {
        try {
            const changed = await migrateSomtopCoordinator(db);
            console.log(changed ? 'Added somtop meeting coordinator column.' : 'Somtop meeting coordinator column already exists.');
        } catch (error) {
            console.error('Somtop meeting coordinator migration failed:', error.message);
            process.exitCode = 1;
        } finally {
            await db.end();
        }
    })();
}

module.exports = { migrateSomtopCoordinator };
