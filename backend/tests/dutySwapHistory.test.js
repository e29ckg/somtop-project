const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const calls = [];
const pool = { query: async (...args) => {
    calls.push(args);
    return [[{ id: 7, requester_name: 'ผู้เข้าเวรเดิม', replacement_name: 'ผู้เข้าเวรแทน' }]];
} };
const filename = path.join(__dirname, '../src/controllers/dutyController.js');
const moduleMock = { exports: {} };
vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module: moduleMock,
    exports: moduleMock.exports,
    require(name) {
        if (name === '../config/db') return pool;
        if (name === 'pizzip' || name === 'docxtemplater' || name === 'exceljs') return class {};
        if (name === '../utils/logger') return { logActivity() {} };
        if (name === '../utils/thaiBahtText') return { thaiBahtText() {} };
        return require(name);
    },
    console,
    __dirname: path.dirname(filename),
    Buffer,
    process
}, { filename });

test('swap history filters by duty month and signed-in court', async () => {
    let payload;
    const res = { json(value) { payload = value; } };
    await moduleMock.exports.getSwaps({ query: { month: '2026-10' }, user: { court_code: 'COURT-A' } }, res);
    assert.equal(payload.records[0].id, 7);
    assert.match(calls[0][0], /sw\.court_code = \?/);
    assert.match(calls[0][0], /ds\.duty_date >= \?/);
    assert.deepEqual(Array.from(calls[0][1]), ['2026-10-01', '2026-10-01', 'COURT-A']);
});

test('swap history rejects an invalid month before querying', async () => {
    calls.length = 0;
    let statusCode;
    let payload;
    const res = { status(code) { statusCode = code; return this; }, json(value) { payload = value; } };
    await moduleMock.exports.getSwaps({ query: { month: '2026-13' }, user: { court_code: 'COURT-A' } }, res);
    assert.equal(statusCode, 400);
    assert.match(payload.message, /YYYY-MM/);
    assert.equal(calls.length, 0);
});
