const test = require('node:test');
const assert = require('node:assert/strict');
const { migrateSomtopCoordinator } = require('../scripts/migrate_somtop_coordinator');

test('deployment adds the missing column once and preserves existing coordinator values on rerun', async () => {
    let exists = false;
    let alterations = 0;
    const db = { async query(sql) {
        if (sql.includes('information_schema.COLUMNS')) return [exists ? [{ COLUMN_NAME: 'is_meeting_coordinator' }] : []];
        assert.match(sql, /ALTER TABLE somtop\s+ADD COLUMN is_meeting_coordinator/);
        assert.match(sql, /NOT NULL DEFAULT 0/);
        alterations++;
        exists = true;
        return [{}];
    } };
    assert.equal(await migrateSomtopCoordinator(db), true);
    assert.equal(await migrateSomtopCoordinator(db), false);
    assert.equal(alterations, 1);
});

test('migration tolerates a concurrent deployment adding the column', async () => {
    const db = { async query(sql) {
        if (sql.includes('information_schema.COLUMNS')) return [[]];
        throw Object.assign(new Error('Duplicate column'), { code: 'ER_DUP_FIELDNAME' });
    } };
    await migrateSomtopCoordinator(db);
});

test('migration propagates database failures to stop deployment', async () => {
    for (const code of ['ER_TABLEACCESS_DENIED_ERROR', 'ER_NO_SUCH_TABLE', 'ECONNREFUSED']) {
        const db = { async query(sql) {
            if (sql.includes('information_schema.COLUMNS')) return [[]];
            throw Object.assign(new Error(code), { code });
        } };
        await assert.rejects(migrateSomtopCoordinator(db), { code });
    }
});
