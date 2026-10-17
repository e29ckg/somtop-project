const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const setup = () => {
    const calls = [];
    const connection = {
        async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
        async query(sql, params) {
            calls.push({ sql, params });
            if (sql.includes('SELECT photo_path')) return [[{ photo_path: null }]];
            // Catch parameter alignment errors when adding a column.
            assert.equal((sql.match(/\?/g) || []).length, params.length);
            return [{ insertId: 1 }];
        }
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/somtopController.js'), 'utf8'), {
        module, exports: module.exports, console,
        require(name) {
            if (name === '../config/db') return { async getConnection() { return connection; } };
            if (name === '../utils/logger') return { logActivity() {} };
            if (name.startsWith('../utils/')) return () => {};
            return require(name);
        }
    });
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() {} };
    return { controller: module.exports, calls, response };
};

test('creating a judge defaults coordinator status to unchecked and parses multipart values', async () => {
    for (const [value, expected] of [[undefined, 0], ['0', 0], ['false', 0], [false, 0], ['1', 1], ['true', 1], [true, 1]]) {
        const { controller, calls, response } = setup();
        await controller.createSomtop({
            body: { title: 'นาย', first_name: 'ทดสอบ', last_name: 'ระบบ', is_meeting_coordinator: value },
            user: { court_code: 'court-a' }
        }, response);
        assert.equal(response.statusCode, 201);
        assert.equal(calls.find(call => call.sql.includes('INSERT INTO somtop')).params.at(-1), expected);
    }
});

test('editing supports checking, unchecking, and preserves status for older clients omitting the field', async () => {
    for (const [value, expected] of [['1', 1], ['0', 0], ['false', 0], [undefined, null]]) {
        const { controller, calls, response } = setup();
        await controller.updateSomtop({
            params: { id: 7 }, body: { is_meeting_coordinator: value }, user: { court_code: 'court-a' }
        }, response);
        assert.equal(response.statusCode, 200);
        const update = calls.find(call => call.sql.includes('UPDATE somtop SET'));
        assert.match(update.sql, /is_meeting_coordinator = COALESCE\(\?, is_meeting_coordinator\)/);
        assert.equal(update.params.at(-3), expected);
        assert.deepEqual(Array.from(update.params.slice(-2)), [7, 'court-a']);
    }
});
