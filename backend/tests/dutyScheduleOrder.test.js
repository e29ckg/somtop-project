const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { compareDutySchedules } = require('../src/utils/dutyScheduleOrder');

const records = () => [
    { id: 12, team_id: 2, team_name: 'คณะที่ 2', team_member_order: 2, full_name: 'ก สมาชิกสอง' },
    { id: 21, team_id: 10, team_name: 'คณะที่ 10', team_member_order: 1, full_name: 'ข สมาชิกหนึ่ง' },
    { id: 11, team_id: 2, team_name: 'คณะที่ 2', team_member_order: 1, full_name: 'ฮ สมาชิกหนึ่ง' },
    { id: 22, team_id: 10, team_name: 'คณะที่ 10', team_member_order: 2, full_name: 'ก สมาชิกสอง' },
    { id: 31, team_id: null, team_name: null, full_name: 'ฮ รายบุคคล' },
    { id: 32, team_id: null, team_name: null, full_name: 'ก รายบุคคล' }
].map(row => ({ ...row, duty_type_id: 1, duty_date: '2026-11-02', duty_type_name: 'เวรประชุม' }));
const expected = [11, 12, 21, 22, 32, 31];

test('members follow configured slots even when names sort in reverse; teams use numeric order', () => {
    assert.deepEqual(records().sort(compareDutySchedules).map(row => row.id), expected);
    const nextDay = { ...records()[0], id: 99, duty_date: '2026-11-03' };
    assert.equal([...records(), nextDay].sort(compareDutySchedules).at(-1).id, 99);
});

const loadController = () => {
    const filename = path.join(__dirname, '../src/controllers/dutyController.js');
    const moduleMock = { exports: {} };
    const calls = [];
    const pool = { async query(sql, params) {
        calls.push({ sql, params });
        if (sql.includes('FROM duty_orders')) return [[{ id: 7 }]];
        if (sql.includes('FROM duty_schedules')) return [records()];
        return [[]];
    } };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module: moduleMock, exports: moduleMock.exports,
        require(name) {
            if (name === '../config/db') return pool;
            if (['pizzip', 'docxtemplater', 'exceljs'].includes(name)) return class {};
            if (name === '../utils/logger') return { logActivity() {} };
            if (name === '../utils/thaiBahtText') return { thaiBahtText() {} };
            if (name === '../utils/dutyScheduleOrder') return require('../src/utils/dutyScheduleOrder');
            return require(name);
        }, console, __dirname: path.dirname(filename), Buffer, process
    });
    return { controller: moduleMock.exports, calls };
};

test('calendar and print data return the same member order and respect court scope', async () => {
    for (const method of ['getCalendar', 'getOrderPrintData']) {
        const { controller, calls } = loadController();
        let payload;
        await controller[method]({ query: { month: '2026-11', order_id: '7' }, params: { id: '7' }, user: { court_code: 'COURT-A' } }, {
            json(data) { payload = data; }, status(code) { assert.fail(`Unexpected status: ${code}`); }
        });
        const rows = payload.schedules || payload.records;
        assert.deepEqual(Array.from(rows, row => row.id), expected, method);
        const query = calls.find(call => call.sql.includes('FROM duty_schedules'));
        assert.match(query.sql, /WHEN t\.member_one_somtop_id THEN 1/);
        assert.match(query.sql, /WHEN t\.member_two_somtop_id THEN 2/);
        assert.match(query.sql, /SELECT sw\.requester_somtop_id/);
        assert.match(query.sql, /ds\.court_code = \?/);
        assert.equal(query.params.at(-1), 'COURT-A');
    }
});

test('calendar grouping retains server member order for both calendar and day details', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/views/DutyScheduleView.vue'), 'utf8');
    const grouping = source.match(/const schedulesByDate = computed\(\(\) => \{[\s\S]*?\n\}\)/)[0];
    const ordered = records().sort(compareDutySchedules);
    const context = { schedules: { value: ordered }, computed: fn => ({ value: fn() }) };
    vm.runInNewContext(`${grouping}\nresult = schedulesByDate.value`, context);
    assert.deepEqual(Array.from(context.result['2026-11-02'], row => row.id), expected);
});
