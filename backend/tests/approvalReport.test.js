const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const express = require('express');
const calls = [];
let orderFound = true;
let rows = [];
const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
    query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes('FROM courts')) return [[{ court_name: params[0] === 'pkkjc' ? 'ศาลเยาวชนและครอบครัวจังหวัดประจวบคีรีขันธ์' : 'ศาลเยาวชนและครอบครัวจังหวัดทดสอบ' }]];
        if (sql.includes('FROM duty_orders')) return [orderFound ? [{ id: 7 }] : []];
        if (sql.includes('FROM duty_schedules')) return [rows];
        throw new Error('Unexpected query');
    }
} };
const { loadReport, buildWorkbook } = require('../src/services/approvalReport');
const base = { month: '2026-10', memo_date: '2026-10-22' };
const user = { role: 'admin', court_code: 'COURT-A' };
const fixtures = () => [
    { somtop_id: 1, duty_date: '2026-10-01', full_name: 'นายทดสอบ หนึ่ง', bank_account_number: '001-8-46694-5', bank_branch: 'กสิกร/ทดสอบ', phone: '081-234-5678' },
    { somtop_id: 1, duty_date: '2026-10-01', full_name: 'นายทดสอบ หนึ่ง', bank_account_number: '001-8-46694-5', bank_branch: 'กสิกร/ทดสอบ', phone: '081-234-5678' },
    { somtop_id: 1, duty_date: '2026-10-02', full_name: 'นายทดสอบ หนึ่ง', bank_account_number: '001-8-46694-5', bank_branch: 'กสิกร/ทดสอบ', phone: '081-234-5678' },
    { somtop_id: 2, duty_date: '2026-10-03', full_name: 'นางตัวอย่าง สอง', bank_account_number: '', bank_branch: null, phone: null }
];

test('approval report matches payment totals and exports the reference layout', async t => {
    let report;
    await t.test('Prachuap cover matches requested three-line header in preview and Excel', async () => {
        rows = fixtures();
        const cover = await loadReport({ ...user, court_code: 'pkkjc' }, { ...base, month: '2026-08' });
        const expected = [
            'หน้างบประกอบการอนุมัติโอนเงินเข้าบัญชีในระบบ K-Cash Connect Plus',
            'งบดำเนินการ บัญชีออมทรัพย์ 133-2-29018-1 บัญชีกระแสรายวัน 133-1-02413-5',
            'ตามบันทึกศาลเยาวชนและครอบครัวจังหวัดประจวบคีรีขันธ์ ลงวันที่ 22 ตุลาคม 2569 (เวรเดือนสิงหาคม 2569)'
        ];
        assert.deepEqual([cover.title, cover.account_line, cover.memo_line], expected);
        assert.equal(cover.rows[0].item, 'ค่าตอบแทนผู้พิพากษาสมทบ');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await buildWorkbook(cover).xlsx.writeBuffer());
        assert.deepEqual([1,2,3].map(row => workbook.worksheets[0].getCell(row, 1).value), expected);
        assert.equal(workbook.worksheets[0].getCell('E5').value, 'ค่าตอบแทนผู้พิพากษาสมทบ');
        const otherCourt = await loadReport(user, base);
        assert.ok(!otherCourt.account_line.includes('133-2-29018-1'));
    });
    await t.test('deduplicates days, preserves bank/phone text and reads scoped database records', async () => {
        rows = fixtures(); calls.length = 0;
        report = await loadReport(user, base);
        assert.equal(report.rows.length, 2);
        assert.equal(report.rows[0].days, 2);
        assert.equal(report.rows[0].gross, 2500);
        assert.equal(report.rows[0].net, 2500);
        assert.equal(report.rows[0].tax, 0);
        assert.equal(report.rows[0].bank_account_number, '001-8-46694-5');
        assert.equal(report.rows[0].phone, '081-234-5678');
        assert.deepEqual(report.totals, { gross: 3750, tax: 0, net: 3750 });
        assert.equal(report.total_text, 'สามพันเจ็ดร้อยห้าสิบบาทถ้วน');
        assert.equal(report.missing_bank_accounts, 1);
        assert.match(report.memo_line, /22 ตุลาคม 2569 \(เวรเดือนตุลาคม 2569\)/);
        const query = calls.find(call => call.sql.includes('FROM duty_schedules'));
        assert.match(query.sql, /s\.court_code = ds\.court_code/);
        assert.match(query.sql, /ds\.court_code = \?/);
        assert.match(query.sql, /sp\.level ASC, s\.join_date ASC/);
        assert.deepEqual(query.params, ['COURT-A','2026-10-01','2026-10-01']);
    });
    await t.test('selected order must belong to the requested month and court', async () => {
        calls.length = 0;
        await loadReport(user, { ...base, order_id: '7' });
        assert.deepEqual(calls.find(call => call.sql.includes('FROM duty_orders')).params, [7,'COURT-A','2026-10-01']);
        assert.equal(calls.find(call => call.sql.includes('FROM duty_schedules')).params.at(-1), 7);
        orderFound = false;
        await assert.rejects(loadReport(user, { ...base, order_id: '99' }), error => error.status === 404);
        orderFound = true;
    });
    await t.test('editable rate, tax rounding and net totals use satang arithmetic', async () => {
        const taxed = await loadReport(user, { ...base, rate: '1000.25', withholding_tax: '1', savings_account: '133-2-00000-1', current_account: '133-1-00000-2' });
        assert.deepEqual(taxed.rows.map(row => [row.gross,row.tax,row.net]), [[2000.5,20.01,1980.49],[1000.25,10,990.25]]);
        assert.deepEqual(taxed.totals, { gross: 3000.75, tax: 30.01, net: 2970.74 });
        assert.equal(taxed.total_text, 'สองพันเก้าร้อยเจ็ดสิบบาทเจ็ดสิบสี่สตางค์');
        assert.match(taxed.account_line, /133-2-00000-1.*133-1-00000-2/);
    });
    await t.test('rejects invalid month/date/order/rate/tax before querying the database', async () => {
        const invalid = [{month:'2026-13'},{month:'2026-00'},{memo_date:'2026-02-30'},{memo_date:'bad'},
            {order_id:'1 OR 1=1'},{order_id:'-1'},{rate:'-1'},{rate:'0'},{rate:'1000001'},{rate:'1.005'},{rate:'Infinity'},{withholding_tax:'2'}];
        for (const query of invalid) {
            calls.length = 0;
            await assert.rejects(loadReport(user,{...base,...query}),error=>error.status===400);
            assert.equal(calls.length,0);
        }
        await assert.rejects(loadReport({ role:'admin',court_code:null },base),error=>error.status===400);
    });
    await t.test('Excel contains the ten reference columns, merged titles and numeric totals', async () => {
        const buffer = await buildWorkbook(report).xlsx.writeBuffer();
        const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
        const sheet = workbook.worksheets[0];
        assert.equal(sheet.columnCount,10);
        assert.equal(sheet.getCell('A1').value,report.title);
        assert.equal(sheet.getCell('A2').value,report.account_line);
        assert.equal(sheet.getCell('A3').value,report.memo_line);
        assert.equal(sheet.getCell('D4').value,'เลขบัญชีผู้รับ\nโอน');
        assert.equal(sheet.getCell('H4').value,'จำนวนเงินที่\nจ่ายเช็ค');
        assert.equal(sheet.getCell('D5').value,'001-8-46694-5');
        assert.equal(sheet.getCell('I5').value,'081-234-5678');
        assert.equal(sheet.getCell('F5').value,2500);
        assert.equal(sheet.getCell('G5').value,null);
        assert.equal(sheet.getCell('H5').value,2500);
        assert.match(sheet.getCell('A7').value,/สามพันเจ็ดร้อยห้าสิบบาทถ้วน/);
        assert.equal(sheet.getCell('F7').value,3750);
        assert.equal(sheet.getCell('H7').value,3750);
        assert.equal(sheet.getCell('F7').border.bottom.style,'double');
        assert.equal(sheet.pageSetup.orientation,'portrait');
        assert.equal(sheet.pageSetup.paperSize,9);
        assert.equal(sheet.pageSetup.fitToWidth,1);
        assert.equal(sheet.pageSetup.printTitlesRow,'1:4');
    });
    await t.test('untrusted text remains literal text in Excel', async () => {
        rows = [{ ...fixtures()[0], full_name:'=HYPERLINK("https://invalid.example")', bank_account_number:'0000123456', phone:'0001234567' }];
        const literal = await loadReport(user,base);
        const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await buildWorkbook(literal).xlsx.writeBuffer());
        assert.equal(workbook.worksheets[0].getCell('C5').type, ExcelJS.ValueType.String);
        assert.equal(workbook.worksheets[0].getCell('D5').value,'0000123456');
        assert.equal(workbook.worksheets[0].getCell('I5').value,'0001234567');
    });
    await t.test('empty data produces no recipients and zero totals', async () => {
        rows = [];
        const empty = await loadReport(user,base);
        assert.equal(empty.rows.length,0);
        assert.equal(empty.total_text,'ศูนย์บาทถ้วน');
        assert.equal(empty.totals.net,0);
    });
});

test('preview and Excel routes require admin and prevent out-of-scope order access', async () => {
    rows = fixtures(); orderFound = true;
    const authPath = require.resolve('../src/middlewares/authMiddleware');
    const { verifyAdmin } = require(authPath);
    require.cache[authPath].exports = { verifyAdmin, verifyToken(req,res,next) {
        if (!req.get('X-Test-Role')) return res.sendStatus(401);
        req.user={ role:req.get('X-Test-Role'), court_code:'COURT-A' }; next();
    } };
    const app = express();
    app.use('/duties',require('../src/routes/dutyRoutes'));
    app.use((error,req,res,next)=>res.status(error.status||500).json({message:error.message}));
    const server=app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const url=`http://127.0.0.1:${server.address().port}/duties/approval-report`;
    const query='?month=2026-10&memo_date=2026-10-22';
    try {
        for (const suffix of ['', '/excel']) {
            assert.equal((await fetch(url+suffix+query)).status,401);
            calls.length=0;
            assert.equal((await fetch(url+suffix+query,{headers:{'X-Test-Role':'view'}})).status,403);
            assert.equal(calls.length,0);
            const res=await fetch(url+suffix+query,{headers:{'X-Test-Role':'admin'}});
            assert.equal(res.status,200);
            assert.equal(res.headers.get('cache-control'),'no-store');
            if(suffix) {
                assert.match(res.headers.get('content-type'),/spreadsheetml/);
                const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await res.arrayBuffer()));
                assert.equal(book.worksheets[0].getCell('F7').value,3750);
            } else assert.equal((await res.json()).report.rows.length,2);
        }
        orderFound=false;
        assert.equal((await fetch(url+query+'&order_id=99',{headers:{'X-Test-Role':'admin'}})).status,404);
        orderFound=true; rows=[];
        assert.equal((await fetch(url+'/excel'+query,{headers:{'X-Test-Role':'admin'}})).status,400);
    } finally { await new Promise(resolve=>server.close(resolve)); }
});
