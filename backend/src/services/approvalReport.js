const pool = require('../config/db');
const ExcelJS = require('exceljs');
const { thaiBahtText } = require('../utils/thaiBahtText');

const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const text = (value, fallback, max = 255) => {
    if (value === undefined || value === '') return fallback;
    if (typeof value !== 'string' || value.length > max) fail(400, 'ข้อความในรายงานไม่ถูกต้องหรือยาวเกินกำหนด');
    return value.trim();
};
const dateText = date => {
    const [year, month, day] = date.split('-').map(Number);
    return `${day} ${months[month - 1]} ${year + 543}`;
};
function options(query, courtCode) {
    if (typeof query.month !== 'string' || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(query.month)) fail(400, 'กรุณาระบุเดือนในรูปแบบ YYYY-MM');
    const orderId = query.order_id === undefined || query.order_id === '' ? null : Number(query.order_id);
    if (orderId !== null && (!Number.isSafeInteger(orderId) || orderId < 1)) fail(400, 'คำสั่งที่เลือกไม่ถูกต้อง');
    const rateText = String(query.rate ?? '1250');
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(rateText)) fail(400, 'อัตราต่อวันต้องเป็นจำนวนเงินที่มีทศนิยมไม่เกิน 2 ตำแหน่ง');
    const rateSatang = Math.round(Number(rateText) * 100);
    if (rateSatang <= 0 || rateSatang > 100000000) fail(400, 'อัตราต่อวันต้องมากกว่า 0 และไม่เกิน 1,000,000 บาท');
    const withholding = query.withholding_tax ?? '0';
    if (!['0', '1'].includes(withholding)) fail(400, 'เลือกหักภาษีได้เฉพาะ 0% หรือ 1%');
    const memoDate = query.memo_date;
    if (typeof memoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(memoDate) ||
        !Number.isFinite(Date.parse(`${memoDate}T00:00:00Z`)) || new Date(`${memoDate}T00:00:00Z`).toISOString().slice(0, 10) !== memoDate) {
        fail(400, 'กรุณาระบุวันที่บันทึกให้ถูกต้อง');
    }
    return { month: query.month, orderId, rateSatang, withholding: withholding === '1', memoDate,
        title: text(query.title, 'หน้างบประกอบการอนุมัติโอนเงินเข้าบัญชีในระบบ K-Cash Connect Plus'),
        budgetName: text(query.budget_name, 'งบดำเนินการ', 100),
        savingsAccount: text(query.savings_account ?? (courtCode === 'pkkjc' ? '133-2-29018-1' : ''), '', 50),
        currentAccount: text(query.current_account ?? (courtCode === 'pkkjc' ? '133-1-02413-5' : ''), '', 50),
        item: text(query.item, 'เงินค่าป่วยการและค่าตอบแทนผู้พิพากษาสมทบ (นั่งเวร)') };
}

async function loadReport(user, query) {
    const settings = options(query, user.court_code);
    if (!user.court_code) fail(400, 'กรุณากำหนดศาลให้บัญชีก่อนจัดทำรายงาน');
    const [courts] = await pool.query('SELECT court_name FROM courts WHERE court_code = ? LIMIT 1', [user.court_code]);
    if (!courts.length) fail(404, 'ไม่พบข้อมูลศาล');
    if (settings.orderId !== null) {
        const [orders] = await pool.query('SELECT id FROM duty_orders WHERE id = ? AND court_code = ? AND order_month = ? LIMIT 1',
            [settings.orderId, user.court_code, `${settings.month}-01`]);
        if (!orders.length) fail(404, 'ไม่พบคำสั่งในเดือนและศาลที่เลือก');
    }
    const firstDay = `${settings.month}-01`;
    const [records] = await pool.query(`
        SELECT ds.somtop_id, DATE_FORMAT(ds.duty_date, '%Y-%m-%d') AS duty_date,
            CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name,
            s.bank_account_number, s.bank_branch, s.phone
        FROM duty_schedules ds
        JOIN somtop s ON s.id = ds.somtop_id AND s.court_code = ds.court_code
        LEFT JOIN somtop_positions sp ON s.position_id = sp.id
        WHERE ds.court_code = ? AND ds.duty_date >= ? AND ds.duty_date < DATE_ADD(?, INTERVAL 1 MONTH)
            ${settings.orderId !== null ? 'AND ds.order_id = ?' : ''}
        ORDER BY sp.level ASC, s.join_date ASC, s.first_name ASC, s.last_name ASC, s.id ASC, ds.duty_date ASC
    `, [user.court_code, firstDay, firstDay, ...(settings.orderId !== null ? [settings.orderId] : [])]);
    const people = new Map();
    for (const row of records) {
        if (!people.has(row.somtop_id)) people.set(row.somtop_id, { ...row, dates: new Set() });
        people.get(row.somtop_id).dates.add(String(row.duty_date).slice(0, 10));
    }
    const rows = [...people.values()].map((person, index) => {
        const gross = person.dates.size * settings.rateSatang;
        const tax = settings.withholding ? Math.round(gross / 100) : 0;
        return { number: index + 1, somtop_id: person.somtop_id, reference: '', name: person.full_name,
            bank_account_number: person.bank_account_number || '', phone: person.phone || '',
            note: person.bank_branch || '', item: settings.item, days: person.dates.size,
            gross: gross / 100, tax: tax / 100, net: (gross - tax) / 100 };
    });
    const totalSatang = rows.reduce((total, row) => ({ gross: total.gross + Math.round(row.gross * 100),
        tax: total.tax + Math.round(row.tax * 100), net: total.net + Math.round(row.net * 100) }), { gross: 0, tax: 0, net: 0 });
    const totals = Object.fromEntries(Object.entries(totalSatang).map(([key, value]) => [key, value / 100]));
    const [year, month] = settings.month.split('-').map(Number);
    return { title: settings.title,
        account_line: `${settings.budgetName} บัญชีออมทรัพย์ ${settings.savingsAccount || '................'} บัญชีกระแสรายวัน ${settings.currentAccount || '................'}`,
        memo_line: `ตามบันทึก${courts[0].court_name} ลงวันที่ ${dateText(settings.memoDate)} (เวรเดือน${months[month - 1]} ${year + 543})`,
        month: settings.month, order_id: settings.orderId, rate: settings.rateSatang / 100, withholding_tax: settings.withholding,
        rows, totals, total_text: thaiBahtText(totals.net),
        missing_bank_accounts: rows.filter(row => !row.bank_account_number.trim()).length };
}

function buildWorkbook(report) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('หน้างบประกอบการอนุมัติ');
    sheet.views = [{ showGridLines: false }];
    sheet.columns = [{ width: 5 }, { width: 10 }, { width: 30 }, { width: 22 }, { width: 45 },
        { width: 18 }, { width: 12 }, { width: 18 }, { width: 19 }, { width: 35 }];
    [report.title, report.account_line, report.memo_line].forEach((line, index) => {
        sheet.mergeCells(index + 1, 1, index + 1, 10);
        sheet.getCell(index + 1, 1).value = line;
        sheet.getRow(index + 1).height = 25;
    });
    sheet.addRow(['ที่', 'เลข\nอ้างอิง', 'ชื่อผู้รับ', 'เลขบัญชีผู้รับ\nโอน', 'รายการ', 'จำนวนเงินที่\nขอเบิก', 'ภาษี\n1%', 'จำนวนเงินที่\nจ่ายเช็ค', 'เบอร์โทรศัพท์', 'หมายเหตุ']);
    sheet.getRow(4).height = 45;
    for (const row of report.rows) sheet.addRow([row.number, row.reference, row.name, row.bank_account_number,
        row.item, row.gross, row.tax || null, row.net, row.phone, row.note]);
    const totalRow = 5 + report.rows.length;
    sheet.mergeCells(totalRow, 1, totalRow, 5);
    sheet.getCell(totalRow, 1).value = `รวมเงินจ่ายทั้งสิ้น(ตัวอักษร) ${report.total_text}`;
    sheet.getCell(totalRow, 6).value = report.totals.gross;
    sheet.getCell(totalRow, 7).value = report.totals.tax || null;
    sheet.getCell(totalRow, 8).value = report.totals.net;
    sheet.mergeCells(totalRow, 9, totalRow, 10);
    sheet.getRow(totalRow).height = 30;
    sheet.eachRow((row, rowNumber) => {
        row.font = { name: 'TH Sarabun New', size: 16, color: { argb: 'FF112E51' } };
        row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        if (rowNumber > 4 && rowNumber < totalRow) {
            row.height = 30;
            [3, 4, 5, 9, 10].forEach(column => { row.getCell(column).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }; });
        }
        if (rowNumber >= 4) for (let column = 1; column <= 10; column++) {
            row.getCell(column).border = Object.fromEntries(['top','bottom','left','right'].map(edge => [edge, { style: 'thin', color: { argb: 'FFD6DCE4' } }]));
        }
        if (rowNumber > 4) [6, 7, 8].forEach(column => {
            row.getCell(column).numFmt = '#,##0.00';
            row.getCell(column).alignment = { horizontal: 'right', vertical: 'middle' };
        });
    });
    sheet.getCell(totalRow, 1).alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
    for (const column of [6, 8]) sheet.getCell(totalRow, column).border = { ...sheet.getCell(totalRow, column).border,
        bottom: { style: 'double', color: { argb: 'FF31558A' } } };
    sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        printTitlesRow: '1:4', printArea: `A1:J${totalRow}`, margins: { left: .2, right: .2, top: .25, bottom: .25, header: 0, footer: 0 } };
    return workbook;
}

module.exports = { loadReport, buildWorkbook };
