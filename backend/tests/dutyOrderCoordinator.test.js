const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('order printing marks only trained and registered coordinators on each duty date', async () => {
    const filename = path.join(__dirname, '../src/controllers/dutyController.js');
    const calls = [];
    const records = [
        { duty_date: '2026-11-02', full_name: 'นายทดสอบ สมทบ', is_meeting_coordinator: 1 },
        { duty_date: '2026-11-02', full_name: 'นางตัวอย่าง สมทบ', is_meeting_coordinator: 0 },
        { duty_date: '2026-11-03', full_name: 'นายทดสอบ สมทบ', is_meeting_coordinator: '1' },
        { duty_date: '2026-11-03', full_name: 'นางตัวอย่าง สมทบ', is_meeting_coordinator: '0' },
        { duty_date: '2026-11-04', full_name: 'นายทดสอบ สมทบ', is_meeting_coordinator: true },
        { duty_date: '2026-11-04', full_name: 'นางตัวอย่าง สมทบ', is_meeting_coordinator: null }
    ].map((row, index) => ({ ...row, duty_type_name: 'เวรประชุม', team_name: 'คณะที่ 1', team_id: 1, team_member_order: index % 2 + 1 })).reverse();
    let rendered;
    const output = Buffer.from('generated-word-document');
    class Docxtemplater {
        render(data) { rendered = data; }
        getZip() { return { generate: () => output }; }
    }
    const pool = { async query(sql, params) {
        calls.push({ sql, params });
        return sql.includes('FROM duty_orders dor')
            ? [[{ order_number: '1/2569', order_month: '2026-11', court_name: 'ศาลทดสอบ' }]]
            : [records];
    } };
    const moduleMock = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module: moduleMock, exports: moduleMock.exports,
        require(name) {
            if (name === '../config/db') return pool;
            if (name === 'docxtemplater') return Docxtemplater;
            if (name === 'pizzip' || name === 'exceljs') return class {};
            if (name === '../utils/logger') return { logActivity() {} };
            if (name === '../utils/thaiBahtText') return { thaiBahtText() {} };
            if (name === '../utils/dutyScheduleOrder') return require('../src/utils/dutyScheduleOrder');
            return require(name);
        },
        console, __dirname: path.dirname(filename), Buffer, process
    }, { filename });
    let sent;
    const res = {
        setHeader() {}, send(data) { sent = data; },
        status(code) { assert.fail(`Unexpected status: ${code}`); }, json() {}
    };
    await moduleMock.exports.exportOrderWord({ params: { id: '7' }, user: { court_code: 'COURT-A' } }, res);
    assert.equal(sent, output);
    assert.equal(rendered.schedules.length, 3);
    for (const schedule of rendered.schedules) {
        assert.equal(schedule.names, 'นายทดสอบ สมทบ*\n\t\t\tนางตัวอย่าง สมทบ');
        assert.equal(schedule.team_name, 'คณะที่ 1');
    }
    assert.match(calls[1].sql, /s\.is_meeting_coordinator/);
    assert.match(calls[1].sql, /ds\.court_code = \?/);
    assert.deepEqual(Array.from(calls[1].params), ['7', 'COURT-A']);
});
