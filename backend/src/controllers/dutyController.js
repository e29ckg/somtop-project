const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ExcelJS = require('exceljs');
const { logActivity } = require('../utils/logger');
const { thaiBahtText } = require('../utils/thaiBahtText');

const validMonth = value => /^\d{4}-\d{2}$/.test(String(value || ''));
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const validCalendarDate = value => validDate(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const inScope = (courtCode, alias = '') => courtCode ? ` AND ${alias}court_code = ?` : '';
const scopeParams = (courtCode, values = []) => courtCode ? [...values, courtCode] : values;
const getHolidayDatesForMonth = async (month, courtCode) => {
    const firstDay = `${month}-01`;
    try {
        const [rows] = await pool.query(`
            SELECT DISTINCT DATE_FORMAT(holiday_date, '%Y-%m-%d') AS holiday_date
            FROM holidays
            WHERE holiday_date >= ? AND holiday_date < DATE_ADD(?, INTERVAL 1 MONTH)
              AND status = 'ใช้งาน' AND (court_code IS NULL OR court_code = ?)
        `, [firstDay, firstDay, courtCode]);
        return rows.map(row => row.holiday_date);
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') return [];
        throw error;
    }
};

exports.getHolidays = async (req, res) => {
    const courtCode = req.user.court_code || null;
    const [rows] = await pool.query(`
        SELECT id, name, DATE_FORMAT(holiday_date, '%Y-%m-%d') AS holiday_date, court_code, status
        FROM holidays
        WHERE court_code IS NULL OR court_code = ?
        ORDER BY holiday_date DESC, id DESC
    `, [courtCode]);
    res.json({ records: rows.map(row => ({ ...row, editable: row.court_code === courtCode })) });
};

exports.createHoliday = async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const date = req.body?.holiday_date;
    const status = req.body?.status || 'ใช้งาน';
    if (!name || name.length > 255 || !validCalendarDate(date) || !['ใช้งาน', 'ระงับ'].includes(status)) {
        return res.status(400).json({ message: 'กรุณาระบุชื่อ วันที่ และสถานะวันหยุดให้ถูกต้อง' });
    }
    const [result] = await pool.query(
        'INSERT INTO holidays (name, holiday_date, court_code, status) VALUES (?, ?, ?, ?)',
        [name, date, req.user.court_code || null, status]
    );
    logActivity(req, 'เพิ่มข้อมูล', 'วันหยุดพิเศษ', `เพิ่มวันหยุด ID: ${result.insertId}`);
    res.status(201).json({ message: 'เพิ่มวันหยุดสำเร็จ', id: result.insertId });
};

exports.updateHoliday = async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const date = req.body?.holiday_date;
    const status = req.body?.status;
    if (!name || name.length > 255 || !validCalendarDate(date) || !['ใช้งาน', 'ระงับ'].includes(status)) {
        return res.status(400).json({ message: 'กรุณาระบุชื่อ วันที่ และสถานะวันหยุดให้ถูกต้อง' });
    }
    const [result] = await pool.query(
        'UPDATE holidays SET name = ?, holiday_date = ?, status = ? WHERE id = ? AND court_code <=> ?',
        [name, date, status, req.params.id, req.user.court_code || null]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'ไม่พบวันหยุดที่แก้ไขได้' });
    logActivity(req, 'อัปเดตข้อมูล', 'วันหยุดพิเศษ', `แก้ไขวันหยุด ID: ${req.params.id}`);
    res.json({ message: 'แก้ไขวันหยุดสำเร็จ' });
};

exports.deleteHoliday = async (req, res) => {
    const [result] = await pool.query('DELETE FROM holidays WHERE id = ? AND court_code <=> ?',
        [req.params.id, req.user.court_code || null]);
    if (!result.affectedRows) return res.status(404).json({ message: 'ไม่พบวันหยุดที่ลบได้' });
    logActivity(req, 'ลบข้อมูล', 'วันหยุดพิเศษ', `ลบวันหยุด ID: ${req.params.id}`);
    res.json({ message: 'ลบวันหยุดสำเร็จ' });
};
const uploadsRoot = path.resolve(__dirname, '../../uploads');

const removeDutyOrderFile = filePath => {
    if (!filePath) return;
    const absolutePath = path.resolve(__dirname, '../../', filePath);
    if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) return;
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
};

const isPdfFile = async filePath => {
    const handle = await fs.promises.open(filePath, 'r');
    try {
        const signature = Buffer.alloc(5);
        const { bytesRead } = await handle.read(signature, 0, 5, 0);
        return bytesRead === 5 && signature.toString('ascii') === '%PDF-';
    } finally {
        await handle.close();
    }
};

const formatThaiDate = value => {
    const date = new Date(`${value}T00:00:00+07:00`);
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
};
const formatThaiMonth = value => {
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00+07:00`);
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${months[date.getMonth()]} ${date.getFullYear() + 543}`;
};
const formatThaiTransferDate = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return '';
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${String(Number(match[1]) + 543).slice(-2)}`;
};
const formatThaiDutyDate = value => {
    const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
    return `วัน${dayNames[date.getUTCDay()]}ที่ ${formatThaiDate(value)}`;
};
const getBangkokDate = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date()).reduce((result, part) => {
        result[part.type] = part.value;
        return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
};

exports.getPeople = async (req, res) => {
    const [rows] = await pool.query(
        `SELECT s.id, CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name,
            sp.name AS position_name, sp.level AS position_level
         FROM somtop s
         LEFT JOIN somtop_positions sp ON s.position_id = sp.id
         WHERE s.status = 'ใช้งาน'${inScope(req.user.court_code, 's.')}
         ORDER BY COALESCE(sp.level, 999999), s.first_name, s.last_name`,
        scopeParams(req.user.court_code)
    );
    res.json({ records: rows });
};

exports.getTeams = async (req, res) => {
    const [rows] = await pool.query(`
        SELECT t.id, t.team_name, t.member_one_somtop_id, t.member_two_somtop_id, t.status,
            CONCAT(a.title, a.first_name, ' ', a.last_name) AS member_one_name,
            CONCAT(b.title, b.first_name, ' ', b.last_name) AS member_two_name
        FROM duty_teams t
        JOIN somtop a ON t.member_one_somtop_id = a.id
        JOIN somtop b ON t.member_two_somtop_id = b.id
        WHERE t.status = 'ใช้งาน'${inScope(req.user.court_code, 't.')}
        ORDER BY t.team_name
    `, scopeParams(req.user.court_code));
    res.json({ records: rows });
};

exports.createTeam = async (req, res) => {
    const { team_name: teamName, member_one_somtop_id: memberOne, member_two_somtop_id: memberTwo } = req.body;
    if (!req.user.court_code) return res.status(400).json({ message: 'ผู้ใช้งานต้องสังกัดศาลก่อนสร้างคณะ' });
    if (!teamName?.trim() || !memberOne || !memberTwo || Number(memberOne) === Number(memberTwo)) {
        return res.status(400).json({ message: 'กรุณาระบุชื่อคณะและสมาชิก 2 คนที่ไม่ซ้ำกัน' });
    }
    const [people] = await pool.query(
        'SELECT id FROM somtop WHERE id IN (?, ?) AND court_code = ? AND status = ?',
        [memberOne, memberTwo, req.user.court_code, 'ใช้งาน']
    );
    if (people.length !== 2) return res.status(400).json({ message: 'สมาชิกคณะต้องเป็นรายชื่อที่ใช้งานในศาลเดียวกัน' });
    try {
        const [result] = await pool.query(
            `INSERT INTO duty_teams (court_code, team_name, member_one_somtop_id, member_two_somtop_id)
             VALUES (?, ?, ?, ?)`,
            [req.user.court_code, teamName.trim(), memberOne, memberTwo]
        );
        res.status(201).json({ message: 'เพิ่มคณะปฏิบัติหน้าที่สำเร็จ', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'ชื่อคณะนี้มีอยู่แล้ว' });
        throw error;
    }
};

exports.updateTeam = async (req, res) => {
    const { team_name: teamName, member_one_somtop_id: memberOne, member_two_somtop_id: memberTwo } = req.body;
    if (!teamName?.trim() || !memberOne || !memberTwo || Number(memberOne) === Number(memberTwo)) {
        return res.status(400).json({ message: 'กรุณาระบุชื่อคณะและสมาชิก 2 คนที่ไม่ซ้ำกัน' });
    }
    const [people] = await pool.query(
        'SELECT id FROM somtop WHERE id IN (?, ?) AND (? IS NULL OR court_code = ?) AND status = ?',
        [memberOne, memberTwo, req.user.court_code, req.user.court_code, 'ใช้งาน']
    );
    if (people.length !== 2) return res.status(400).json({ message: 'สมาชิกคณะไม่ถูกต้อง' });
    const [result] = await pool.query(
        `UPDATE duty_teams SET team_name = ?, member_one_somtop_id = ?, member_two_somtop_id = ?
         WHERE id = ?${inScope(req.user.court_code)}`,
        scopeParams(req.user.court_code, [teamName.trim(), memberOne, memberTwo, req.params.id])
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'ไม่พบคณะปฏิบัติหน้าที่' });
    res.json({ message: 'แก้ไขคณะปฏิบัติหน้าที่สำเร็จ' });
};

exports.deleteTeam = async (req, res) => {
    const [result] = await pool.query(
        `DELETE FROM duty_teams WHERE id = ?${inScope(req.user.court_code)}`,
        scopeParams(req.user.court_code, [req.params.id])
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'ไม่พบคณะปฏิบัติหน้าที่' });
    res.json({ message: 'ลบคณะปฏิบัติหน้าที่สำเร็จ' });
};

exports.getCalendar = async (req, res) => {
    try {
        const { month, order_id: orderId } = req.query;
        if (!validMonth(month)) return res.status(400).json({ message: 'กรุณาระบุเดือนในรูปแบบ YYYY-MM' });
        const courtCode = req.user.court_code;
        const start = `${month}-01`;
        const [orders] = await pool.query(
            `SELECT * FROM duty_orders WHERE order_month = ?${inScope(courtCode)} ORDER BY order_number`,
            scopeParams(courtCode, [start])
        );
        const params = [month];
        let orderFilter = '';
        if (orderId) { orderFilter = ' AND ds.order_id = ?'; params.push(Number(orderId)); }
        const [schedules] = await pool.query(`
            SELECT ds.id, ds.order_id, ds.team_id, ds.somtop_id, ds.duty_type_id, ds.duty_date, ds.note, ds.status,
                CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name,
                s.first_name, s.last_name, s.join_date, sp.level AS position_level,
                dt.name AS duty_type_name, dor.order_number, dor.title AS order_title, t.team_name
            FROM duty_schedules ds
            JOIN somtop s ON ds.somtop_id = s.id
            LEFT JOIN somtop_positions sp ON s.position_id = sp.id
            JOIN duty_types dt ON ds.duty_type_id = dt.id
            LEFT JOIN duty_orders dor ON ds.order_id = dor.id
            LEFT JOIN duty_teams t ON ds.team_id = t.id
            WHERE DATE_FORMAT(ds.duty_date, '%Y-%m') = ?${orderFilter}${inScope(courtCode, 'ds.')}
            ORDER BY ds.duty_date, s.first_name, s.last_name
        `, scopeParams(courtCode, params));
        const [types] = await pool.query("SELECT id, name FROM duty_types WHERE status = 'ใช้งาน' ORDER BY id");
        const holidayDates = await getHolidayDatesForMonth(month, courtCode);
        const safeOrders = orders.map(({ signed_order_file_path: filePath, ...order }) => ({
            ...order,
            has_signed_order_pdf: Boolean(filePath)
        }));
        res.json({ orders: safeOrders, schedules, duty_types: types, holiday_dates: holidayDates });
    } catch (error) {
        console.error('Duty calendar error:', error);
        res.status(500).json({ message: 'ไม่สามารถโหลดปฏิทินเวรได้' });
    }
};

exports.createOrder = async (req, res) => {
    try {
        const { order_number, title, order_month, duty_type_id, note } = req.body;
        const dutyTypeId = Number(duty_type_id);
        if (!order_number?.trim() || !title?.trim() || !validMonth(order_month) || !Number.isSafeInteger(dutyTypeId) || dutyTypeId < 1) return res.status(400).json({ message: 'ข้อมูลคำสั่งไม่ครบถ้วน' });
        const [types] = await pool.query("SELECT id FROM duty_types WHERE id = ? AND status = 'ใช้งาน'", [dutyTypeId]);
        if (!types.length) return res.status(400).json({ message: 'ไม่พบประเภทเวรที่เลือก' });
        const [result] = await pool.query(
            `INSERT INTO duty_orders (order_number, title, order_month, duty_type_id, court_code, note, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [order_number.trim(), title.trim(), `${order_month}-01`, dutyTypeId, req.user.court_code, note || null, req.user.id]
        );
        logActivity(req, 'เพิ่มข้อมูล', 'เวรปฏิบัติหน้าที่', `เพิ่มคำสั่ง ${order_number}`);
        res.status(201).json({ message: 'เพิ่มคำสั่งสำเร็จ', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'เลขที่คำสั่งนี้มีอยู่แล้ว' });
        res.status(500).json({ message: 'ไม่สามารถเพิ่มคำสั่งได้' });
    }
};

exports.updateOrder = async (req, res) => {
    const { order_number, title, duty_type_id, note, status } = req.body;
    const dutyTypeId = Number(duty_type_id);
    if (!Number.isSafeInteger(dutyTypeId) || dutyTypeId < 1) return res.status(400).json({ message: 'กรุณาเลือกประเภทเวร' });
    const [types] = await pool.query("SELECT id FROM duty_types WHERE id = ? AND status = 'ใช้งาน'", [dutyTypeId]);
    if (!types.length) return res.status(400).json({ message: 'ไม่พบประเภทเวรที่เลือก' });
    const params = scopeParams(req.user.court_code, [order_number, title, dutyTypeId, note || null, status || 'ใช้งาน', req.params.id]);
    const [result] = await pool.query(
        `UPDATE duty_orders SET order_number = ?, title = ?, duty_type_id = ?, note = ?, status = ? WHERE id = ?${inScope(req.user.court_code)}`,
        params
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'ไม่พบคำสั่ง' });
    res.json({ message: 'แก้ไขคำสั่งสำเร็จ' });
};

exports.deleteOrder = async (req, res) => {
    const [orders] = await pool.query(
        `SELECT signed_order_file_path FROM duty_orders WHERE id = ?${inScope(req.user.court_code)}`,
        scopeParams(req.user.court_code, [req.params.id])
    );
    const [result] = await pool.query(
        `DELETE FROM duty_orders WHERE id = ?${inScope(req.user.court_code)}`,
        scopeParams(req.user.court_code, [req.params.id])
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'ไม่พบคำสั่ง' });
    removeDutyOrderFile(orders[0]?.signed_order_file_path);
    res.json({ message: 'ลบคำสั่งและรายการเวรสำเร็จ' });
};

exports.uploadSignedOrderPdf = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'กรุณาเลือกไฟล์ PDF คำสั่งที่ลงนามแล้ว' });
    const newFilePath = `uploads/duty-orders/${req.file.filename}`;
    try {
        if (!(await isPdfFile(req.file.path))) {
            removeDutyOrderFile(newFilePath);
            return res.status(400).json({ message: 'เนื้อหาไฟล์ไม่ใช่ PDF ที่ถูกต้อง' });
        }
        const [orders] = await pool.query(
            `SELECT signed_order_file_path FROM duty_orders WHERE id = ?${inScope(req.user.court_code)}`,
            scopeParams(req.user.court_code, [req.params.id])
        );
        if (!orders.length) {
            removeDutyOrderFile(newFilePath);
            return res.status(404).json({ message: 'ไม่พบคำสั่ง' });
        }
        await pool.query(
            `UPDATE duty_orders SET signed_order_file_path = ? WHERE id = ?${inScope(req.user.court_code)}`,
            scopeParams(req.user.court_code, [newFilePath, req.params.id])
        );
        removeDutyOrderFile(orders[0].signed_order_file_path);
        logActivity(req, 'อัปโหลดไฟล์', 'เวรปฏิบัติหน้าที่', `แนบ PDF คำสั่ง ID: ${req.params.id}`);
        res.json({ message: 'แนบไฟล์คำสั่ง PDF สำเร็จ', has_signed_order_pdf: true });
    } catch (error) {
        removeDutyOrderFile(newFilePath);
        throw error;
    }
};

exports.downloadSignedOrderPdf = async (req, res) => {
    const [orders] = await pool.query(
        `SELECT order_number, signed_order_file_path FROM duty_orders WHERE id = ?${inScope(req.user.court_code)}`,
        scopeParams(req.user.court_code, [req.params.id])
    );
    if (!orders.length) return res.status(404).json({ message: 'ไม่พบคำสั่ง' });
    if (!orders[0].signed_order_file_path) return res.status(404).json({ message: 'ยังไม่ได้แนบไฟล์คำสั่งที่ลงนามแล้ว' });
    const absolutePath = path.resolve(__dirname, '../../', orders[0].signed_order_file_path);
    if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`) || !fs.existsSync(absolutePath)) {
        return res.status(404).json({ message: 'ไม่พบไฟล์คำสั่งในระบบ' });
    }
    res.download(absolutePath, `คำสั่งเวร_${orders[0].order_number}_ลงนามแล้ว.pdf`);
};

exports.deleteSignedOrderPdf = async (req, res) => {
    const [orders] = await pool.query(
        `SELECT signed_order_file_path FROM duty_orders WHERE id = ?${inScope(req.user.court_code)}`,
        scopeParams(req.user.court_code, [req.params.id])
    );
    if (!orders.length) return res.status(404).json({ message: 'ไม่พบคำสั่ง' });
    await pool.query(
        `UPDATE duty_orders SET signed_order_file_path = NULL WHERE id = ?${inScope(req.user.court_code)}`,
        scopeParams(req.user.court_code, [req.params.id])
    );
    removeDutyOrderFile(orders[0].signed_order_file_path);
    logActivity(req, 'ลบไฟล์', 'เวรปฏิบัติหน้าที่', `ลบ PDF คำสั่ง ID: ${req.params.id}`);
    res.json({ message: 'ลบไฟล์คำสั่ง PDF สำเร็จ' });
};

const validateSchedule = async (req, excludeId) => {
    const { order_id: orderId, somtop_id: somtopId, duty_type_id: dutyTypeId, duty_date: dutyDate } = req.body;
    if (!orderId || !somtopId || !dutyTypeId || !validDate(dutyDate)) return { error: 'ข้อมูลเวรไม่ครบถ้วน' };
    const courtCode = req.user.court_code;
    const [orders] = await pool.query(`SELECT id, order_month FROM duty_orders WHERE id = ?${inScope(courtCode)}`, scopeParams(courtCode, [orderId]));
    const [people] = await pool.query(`SELECT id FROM somtop WHERE id = ?${inScope(courtCode)}`, scopeParams(courtCode, [somtopId]));
    if (!orders.length || !people.length) return { error: 'ไม่พบคำสั่งหรือรายชื่อในหน่วยงานของคุณ' };
    if (String(orders[0].order_month).slice(0, 7) !== dutyDate.slice(0, 7)) return { error: 'วันที่อยู่เวรต้องอยู่ในเดือนของคำสั่ง' };
    const countParams = [orderId, dutyDate];
    let exclude = '';
    if (excludeId) { exclude = ' AND id <> ?'; countParams.push(excludeId); }
    const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM duty_schedules WHERE order_id = ? AND duty_date = ?${exclude}`, countParams);
    if (Number(count.total) >= 4) return { error: 'แต่ละวันกำหนดผู้ปฏิบัติหน้าที่ได้ไม่เกิน 4 ท่าน' };
    return { orderId, somtopId, dutyTypeId, dutyDate };
};

exports.createSchedule = async (req, res) => {
    try {
        const valid = await validateSchedule(req);
        if (valid.error) return res.status(400).json({ message: valid.error });
        await pool.query(
            `INSERT INTO duty_schedules (order_id, somtop_id, duty_type_id, court_code, duty_date, note, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [valid.orderId, valid.somtopId, valid.dutyTypeId, req.user.court_code, valid.dutyDate, req.body.note || null, req.body.status || 'รอปฏิบัติหน้าที่']
        );
        res.status(201).json({ message: 'เพิ่มผู้ปฏิบัติหน้าที่สำเร็จ' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'รายชื่อนี้อยู่ในเวรวันดังกล่าวแล้ว' });
        res.status(500).json({ message: 'ไม่สามารถเพิ่มเวรได้' });
    }
};

exports.createTeamSchedule = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            order_id: orderId, team_id: teamId, duty_type_id: dutyTypeId,
            duty_date: dutyDate, note, status
        } = req.body;
        if (!orderId || !teamId || !dutyTypeId || !validDate(dutyDate)) {
            return res.status(400).json({ message: 'ข้อมูลจัดเวรเป็นคณะไม่ครบถ้วน' });
        }
        await connection.beginTransaction();
        const [orders] = await connection.query(
            `SELECT id, order_month FROM duty_orders WHERE id = ?${inScope(req.user.court_code)}`,
            scopeParams(req.user.court_code, [orderId])
        );
        const [teams] = await connection.query(
            `SELECT member_one_somtop_id, member_two_somtop_id FROM duty_teams
             WHERE id = ? AND status = 'ใช้งาน'${inScope(req.user.court_code)}`,
            scopeParams(req.user.court_code, [teamId])
        );
        if (!orders.length || !teams.length) {
            await connection.rollback();
            return res.status(400).json({ message: 'ไม่พบคำสั่งหรือคณะที่เลือก' });
        }
        if (String(orders[0].order_month).slice(0, 7) !== dutyDate.slice(0, 7)) {
            await connection.rollback();
            return res.status(400).json({ message: 'วันที่อยู่เวรต้องอยู่ในเดือนของคำสั่ง' });
        }
        const [[count]] = await connection.query(
            'SELECT COUNT(*) AS total FROM duty_schedules WHERE order_id = ? AND duty_date = ?',
            [orderId, dutyDate]
        );
        if (Number(count.total) > 2) {
            await connection.rollback();
            return res.status(400).json({ message: 'วันที่นี้เหลือพื้นที่ไม่พอสำหรับเพิ่มคณะ 2 คน' });
        }
        const members = [teams[0].member_one_somtop_id, teams[0].member_two_somtop_id];
        const [duplicates] = await connection.query(
            'SELECT somtop_id FROM duty_schedules WHERE order_id = ? AND duty_date = ? AND somtop_id IN (?, ?)',
            [orderId, dutyDate, ...members]
        );
        if (duplicates.length) {
            await connection.rollback();
            return res.status(400).json({ message: 'สมาชิกบางคนในคณะมีรายชื่ออยู่ในเวรวันนี้แล้ว' });
        }
        await connection.query(
            `INSERT INTO duty_schedules
                (order_id, team_id, somtop_id, duty_type_id, court_code, duty_date, note, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderId, teamId, members[0], dutyTypeId, req.user.court_code, dutyDate, note || null, status || 'รอปฏิบัติหน้าที่',
                orderId, teamId, members[1], dutyTypeId, req.user.court_code, dutyDate, note || null, status || 'รอปฏิบัติหน้าที่'
            ]
        );
        await connection.commit();
        res.status(201).json({ message: 'เพิ่มคณะปฏิบัติหน้าที่ 2 คนสำเร็จ' });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'สมาชิกคณะมีรายชื่อในเวรวันนี้แล้ว' });
        throw error;
    } finally {
        connection.release();
    }
};

exports.updateSchedule = async (req, res) => {
    const valid = await validateSchedule(req, req.params.id);
    if (valid.error) return res.status(400).json({ message: valid.error });
    const [result] = await pool.query(
        `UPDATE duty_schedules SET order_id=?, somtop_id=?, duty_type_id=?, duty_date=?, note=?, status=?
         WHERE id=?${inScope(req.user.court_code)}`,
        scopeParams(req.user.court_code, [valid.orderId, valid.somtopId, valid.dutyTypeId, valid.dutyDate, req.body.note || null, req.body.status || 'รอปฏิบัติหน้าที่', req.params.id])
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'ไม่พบรายการเวร' });
    res.json({ message: 'แก้ไขรายการเวรสำเร็จ' });
};

exports.deleteSchedule = async (req, res) => {
    const [result] = await pool.query(`DELETE FROM duty_schedules WHERE id=?${inScope(req.user.court_code)}`, scopeParams(req.user.court_code, [req.params.id]));
    if (!result.affectedRows) return res.status(404).json({ message: 'ไม่พบรายการเวร' });
    res.json({ message: 'ลบรายการเวรสำเร็จ' });
};

exports.createSwap = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { schedule_id: scheduleId, replacement_somtop_id: replacementId, reason } = req.body;
        if (!scheduleId || !replacementId || !reason?.trim()) {
            await connection.rollback();
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลใบเปลี่ยนเวรให้ครบ' });
        }
        const [rows] = await connection.query(`SELECT * FROM duty_schedules WHERE id=?${inScope(req.user.court_code)}`, scopeParams(req.user.court_code, [scheduleId]));
        if (!rows.length) {
            await connection.rollback();
            return res.status(404).json({ message: 'ไม่พบรายการเวรเดิม' });
        }
        const [people] = await connection.query(`SELECT id FROM somtop WHERE id=?${inScope(req.user.court_code)}`, scopeParams(req.user.court_code, [replacementId]));
        if (!people.length || Number(replacementId) === Number(rows[0].somtop_id)) {
            await connection.rollback();
            return res.status(400).json({ message: 'ผู้ปฏิบัติหน้าที่แทนไม่ถูกต้อง' });
        }
        const [duplicate] = await connection.query(
            'SELECT id FROM duty_schedules WHERE order_id=? AND duty_date=? AND somtop_id=? AND id<>?',
            [rows[0].order_id, rows[0].duty_date, replacementId, scheduleId]
        );
        if (duplicate.length) {
            await connection.rollback();
            return res.status(400).json({ message: 'ผู้ปฏิบัติหน้าที่แทนมีรายชื่อในเวรวันนี้แล้ว' });
        }
        const [result] = await connection.query(
            `INSERT INTO duty_swaps (schedule_id, requester_somtop_id, replacement_somtop_id, reason, request_date, court_code, created_by)
             VALUES (?, ?, ?, ?, CURDATE(), ?, ?)`,
            [scheduleId, rows[0].somtop_id, replacementId, reason.trim(), req.user.court_code, req.user.id]
        );
        await connection.query("UPDATE duty_schedules SET somtop_id=?, note=CONCAT(COALESCE(note,''), ?) WHERE id=?", [replacementId, ` เปลี่ยนเวร: ${reason.trim()}`, scheduleId]);
        await connection.commit();
        res.status(201).json({ message: 'บันทึกการเปลี่ยนเวรสำเร็จ', id: result.insertId });
    } catch (error) {
        await connection.rollback();
        console.error('Duty swap error:', error);
        res.status(500).json({ message: 'ไม่สามารถเปลี่ยนเวรได้' });
    } finally {
        connection.release();
    }
};

exports.exportSwapWord = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT sw.*, ds.duty_date, dor.order_number, dor.order_month,
                CONCAT(a.title,a.first_name,' ',a.last_name) AS requester_name,
                CONCAT(b.title,b.first_name,' ',b.last_name) AS replacement_name,
                c.court_name, c.chief_judge_name, c.chief_judge_position,
                c.director_name, c.director_position
            FROM duty_swaps sw JOIN duty_schedules ds ON sw.schedule_id=ds.id
            LEFT JOIN duty_orders dor ON ds.order_id=dor.id
            JOIN somtop a ON sw.requester_somtop_id=a.id JOIN somtop b ON sw.replacement_somtop_id=b.id
            LEFT JOIN courts c ON sw.court_code=c.court_code
            WHERE sw.id=?${inScope(req.user.court_code, 'sw.')}
        `, scopeParams(req.user.court_code, [req.params.id]));
        if (!rows.length) return res.status(404).json({ message: 'ไม่พบใบเปลี่ยนเวร' });
        const template = fs.readFileSync(path.join(__dirname, '../../templates/duty_swap_template.docx'), 'binary');
        const doc = new Docxtemplater(new PizZip(template), { paragraphLoop: true, linebreaks: true });
        doc.render({
            ...rows[0],
            duty_date_th: formatThaiDate(rows[0].duty_date),
            request_date_th: formatThaiDate(rows[0].request_date),
            order_month_th: formatThaiMonth(rows[0].order_month),
            approver_name: rows[0].chief_judge_name || '................................................',
            approver_title: rows[0].chief_judge_position || 'ผู้พิพากษาหัวหน้าศาล',
            chief_judge_name: rows[0].chief_judge_name || '-',
            chief_judge_position: rows[0].chief_judge_position || '-',
            director_name: rows[0].director_name || '-',
            director_position: rows[0].director_position || '-'
        });
        const buffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`ใบเปลี่ยนเวร_${rows[0].id}.docx`)}`);
        res.send(buffer);
    } catch (error) {
        console.error('Export duty swap error:', error);
        res.status(500).json({ message: 'ไม่สามารถสร้างใบเปลี่ยนเวรได้' });
    }
};

exports.getOrderPrintData = async (req, res) => {
    const [orders] = await pool.query(`SELECT * FROM duty_orders WHERE id=?${inScope(req.user.court_code)}`, scopeParams(req.user.court_code, [req.params.id]));
    if (!orders.length) return res.status(404).json({ message: 'ไม่พบคำสั่ง' });
    const [records] = await pool.query(`
        SELECT ds.duty_date, dt.name AS duty_type_name, t.team_name,
            CONCAT(s.title,s.first_name,' ',s.last_name) AS full_name
        FROM duty_schedules ds JOIN somtop s ON ds.somtop_id=s.id JOIN duty_types dt ON ds.duty_type_id=dt.id
        LEFT JOIN duty_teams t ON ds.team_id=t.id
        WHERE ds.order_id=?${inScope(req.user.court_code, 'ds.')} ORDER BY ds.duty_date, s.first_name
    `, scopeParams(req.user.court_code, [req.params.id]));
    const countsByDate = records.reduce((result, item) => {
        result[item.duty_date] = (result[item.duty_date] || 0) + 1;
        return result;
    }, {});
    const understaffedDates = Object.entries(countsByDate).filter(([, count]) => count < 2).map(([date]) => date);
    if (understaffedDates.length) {
        return res.status(400).json({
            message: `ยังพิมพ์คำสั่งไม่ได้ มีวันที่จัดเวรไม่ครบ 2 ท่าน จำนวน ${understaffedDates.length} วัน`,
            understaffed_dates: understaffedDates
        });
    }
    const { signed_order_file_path: filePath, ...safeOrder } = orders[0];
    res.json({ order: { ...safeOrder, has_signed_order_pdf: Boolean(filePath) }, records });
};

exports.getCourtInfo = async (req, res) => {
    const [rows] = await pool.query(
        `SELECT court_name, province, director_name, director_position, finance_officer_name, finance_officer_position
         FROM courts WHERE court_code = ? LIMIT 1`,
        [req.user.court_code]
    );
    if (!rows.length) return res.status(404).json({ message: 'ไม่พบข้อมูลศาล' });
    res.json({ court: rows[0] });
};

exports.exportPaymentExcel = async (req, res) => {
    const orderId = req.params.id;
    const month = req.query.month;
    if (!orderId && !validMonth(month)) return res.status(400).json({ message: 'กรุณาระบุเดือนในรูปแบบ YYYY-MM' });
    const orderFilter = orderId ? 'dor.id = ?' : 'dor.order_month = ?';
    const orderValue = orderId || `${month}-01`;
    const [orders] = await pool.query(`SELECT dor.*, c.court_name, c.province FROM duty_orders dor LEFT JOIN courts c ON dor.court_code = c.court_code WHERE ${orderFilter}${inScope(req.user.court_code, 'dor.')} ORDER BY dor.id`, scopeParams(req.user.court_code, [orderValue]));
    if (!orders.length) return res.status(404).json({ message: 'ไม่พบคำสั่งในเดือนที่เลือก' });
    const scheduleFilter = orderId ? 'ds.order_id = ?' : 'dor.order_month = ?';
    const [records] = await pool.query(`
        SELECT ds.duty_date, ds.somtop_id,
            CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name
        FROM duty_schedules ds
        JOIN duty_orders dor ON ds.order_id = dor.id
        JOIN somtop s ON ds.somtop_id = s.id
        LEFT JOIN somtop_positions sp ON s.position_id = sp.id
        WHERE ${scheduleFilter}${inScope(req.user.court_code, 'ds.')}
        ORDER BY sp.level ASC, s.join_date ASC, s.first_name ASC, s.last_name ASC, s.id ASC, ds.duty_date ASC
    `, scopeParams(req.user.court_code, [orderValue]));
    if (!records.length) return res.status(400).json({ message: 'เดือนนี้ยังไม่มีรายชื่อผู้ปฏิบัติหน้าที่' });
    const rate = 1250;
    const orderMonth = String(orders[0].order_month).slice(0, 7);
    const [year, monthNumber] = orderMonth.split('-').map(Number);
    const dates = Array.from({ length: new Date(year, monthNumber, 0).getDate() }, (_, index) => `${orderMonth}-${String(index + 1).padStart(2, '0')}`);
    const holidayDates = new Set(await getHolidayDatesForMonth(orderMonth, req.user.court_code));
    const people = [...records.reduce((map, row) => { const key = row.somtop_id; if (!map.has(key)) map.set(key, { name: row.full_name, dates: new Set() }); map.get(key).dates.add(String(row.duty_date).slice(0, 10)); return map; }, new Map()).values()];
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('หลักฐานการรับเงิน');
    const lastColumn = dates.length + 8;
    const dayStartColumn = 4;
    const dayEndColumn = dates.length + 3;
    const countColumn = dates.length + 4;
    const amountColumn = dates.length + 5;
    sheet.mergeCells(1, 1, 1, lastColumn); sheet.getCell(1, 1).value = req.query.title || 'หลักฐานการจ่ายเงินค่าป่วยการและค่าตอบแทนของผู้พิพากษาสมทบ'; sheet.getCell(1, 1).font = { name: 'TH Sarabun New', size: 18, bold: true }; sheet.getCell(1, 1).alignment = { horizontal: 'center' };
    const province = String(orders[0].province || '').replace(/^จังหวัด/, '').trim();
    sheet.mergeCells(2, 1, 2, lastColumn); sheet.getCell(2, 1).value = `ชื่อส่วนราชการ ${orders[0].court_name || ''}${province ? ` จังหวัด${province}` : ''} ประจำเดือน ${formatThaiMonth(orders[0].order_month)}`; sheet.getCell(2, 1).font = { name: 'TH Sarabun New', size: 16, bold: true }; sheet.getCell(2, 1).alignment = { horizontal: 'center', wrapText: true };
    sheet.getRow(1).height = 28; sheet.getRow(2).height = 30;
    const headingLabels = new Map([[1, 'ลำดับ'], [2, 'ชื่อ - สกุล'], [3, 'อัตราเงินค่าตอบแทน\n(ต่อคนต่อวัน)'], [countColumn, 'รวมวัน\nปฏิบัติงาน'], [amountColumn, 'จำนวนเงิน'], [amountColumn + 1, 'วันเดือนปี\nที่รับเงิน'], [amountColumn + 2, 'ลายมือชื่อ\nผู้รับเงิน'], [amountColumn + 3, 'หมายเหตุ']]);
    for (const [column, label] of headingLabels) {
        sheet.mergeCells(3, column, 4, column);
        sheet.getCell(3, column).value = label;
    }
    sheet.mergeCells(3, dayStartColumn, 3, dayEndColumn);
    sheet.getCell(3, dayStartColumn).value = 'วันที่ปฏิบัติงาน';
    dates.forEach((date, index) => { sheet.getCell(4, dayStartColumn + index).value = index + 1; });
    for (const rowNumber of [3, 4]) {
        const headerRow = sheet.getRow(rowNumber);
        headerRow.height = rowNumber === 3 ? 38 : 24;
        headerRow.font = { name: 'TH Sarabun New', size: 14, bold: true };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
    people.forEach((person, index) => { const count = person.dates.size; const row = sheet.addRow([index + 1, person.name, rate, ...dates.map(date => person.dates.has(date) ? '✓' : ''), count, count * rate, formatThaiTransferDate(req.query.payment_date), 'โอนเงินเข้าบัญชี', '']); row.height = 25; row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: false }; });
    const total = people.reduce((sum, person) => sum + person.dates.size * rate, 0);
    const totalRow = sheet.addRow(['รวมเป็นเงินทั้งสิ้น', ...Array(lastColumn - 1).fill('')]);
    sheet.mergeCells(totalRow.number, 1, totalRow.number, countColumn);
    totalRow.getCell(amountColumn).value = total;
    sheet.mergeCells(totalRow.number, amountColumn + 1, totalRow.number, lastColumn);
    totalRow.getCell(1).alignment = { horizontal: 'right' };
    totalRow.font = { name: 'TH Sarabun New', size: 16, bold: true };
    sheet.eachRow(row => { row.eachCell(cell => { cell.font = { ...(cell.font || {}), name: 'TH Sarabun New', size: cell.font?.size || (row.number >= 5 ? 16 : 14) }; if (row.number >= 3) cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; }); });
    sheet.getCell(2, 1).border = { bottom: { style: 'thin' } };
    sheet.getColumn(1).width = 7; sheet.getColumn(2).width = 34; sheet.getColumn(3).width = 19;
    dates.forEach((date, index) => {
        const column = sheet.getColumn(dayStartColumn + index);
        column.width = 4;
        if ([0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) || holidayDates.has(date)) {
            for (let rowNumber = 4; rowNumber < totalRow.number; rowNumber++) sheet.getCell(rowNumber, dayStartColumn + index).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF999999' } };
        }
    });
    [12, 16, 16, 19, 15].forEach((width, index) => { sheet.getColumn(countColumn + index).width = width; });
    sheet.getColumn(3).numFmt = '#,##0.00'; sheet.getColumn(amountColumn).numFmt = '#,##0.00';
    sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 } };
    const noteRow = sheet.addRow([]); sheet.mergeCells(noteRow.number, 1, noteRow.number, lastColumn); sheet.getCell(noteRow.number, 1).value = `ขอรับรองว่าได้มีการมาปฏิบัติหน้าที่ตามระเบียบฯ และได้จ่ายค่าตอบแทนให้แก่ผู้มีสิทธิรับ จำนวน ${people.length} คน รวมเป็นเงินทั้งสิ้น ${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท (${thaiBahtText(total)}) จริง`; sheet.getCell(noteRow.number, 1).alignment = { wrapText: true, vertical: 'middle' }; noteRow.height = 32;
    const signatureSpacer = sheet.addRow([]); signatureSpacer.height = 42; const signRow = sheet.addRow([]); signRow.height = 68; sheet.mergeCells(signRow.number, 1, signRow.number, Math.ceil(lastColumn / 3)); sheet.getCell(signRow.number, 1).value = `ลงชื่อ ................................ (ผู้รับรอง)\n${req.query.director_name || ''}\n${req.query.director_position || 'ผู้อำนวยการ'}`; sheet.mergeCells(signRow.number, Math.ceil(lastColumn / 3) + 1, signRow.number, Math.ceil(lastColumn * 2 / 3)); sheet.getCell(signRow.number, Math.ceil(lastColumn / 3) + 1).value = `ลงชื่อ ................................ (ผู้จัดทำ)\n${req.query.finance_name || ''}\n${req.query.finance_position || 'เจ้าหน้าที่การเงิน'}`; sheet.mergeCells(signRow.number, Math.ceil(lastColumn * 2 / 3) + 1, signRow.number, lastColumn); sheet.getCell(signRow.number, Math.ceil(lastColumn * 2 / 3) + 1).value = `ลงชื่อ ................................ (ผู้จ่ายเงิน)\n${req.query.finance_name || ''}\n${req.query.finance_position || 'เจ้าหน้าที่การเงิน'}`; signRow.eachCell(cell => { cell.font = { name: 'TH Sarabun New', size: 14 }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
    const remarksRow = sheet.addRow([]); sheet.mergeCells(remarksRow.number, 1, remarksRow.number, lastColumn); sheet.getCell(remarksRow.number, 1).value = 'หมายเหตุ : กรณีจ่ายเป็นการโอนผ่านระบบอินเทอร์เน็ต ผู้รับเงินไม่ต้องลงลายมือชื่อผู้รับเงินในช่องผู้รับเงิน'; sheet.getCell(remarksRow.number, 1).font = { name: 'TH Sarabun New', size: 14 }; sheet.getCell(remarksRow.number, 1).alignment = { wrapText: true, vertical: 'middle' }; remarksRow.height = 28;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`หลักฐานการรับเงิน_${orderId ? orders[0].order_number : month}.xlsx`)}`); res.send(await workbook.xlsx.writeBuffer());
};

exports.exportOrderWord = async (req, res) => {
    try {
        const [orders] = await pool.query(`
            SELECT dor.*, c.court_name, c.chief_judge_name, c.chief_judge_position,
                c.director_name, c.director_position
            FROM duty_orders dor
            LEFT JOIN courts c ON dor.court_code = c.court_code
            WHERE dor.id = ?${inScope(req.user.court_code, 'dor.')}
        `, scopeParams(req.user.court_code, [req.params.id]));
        if (!orders.length) return res.status(404).json({ message: 'ไม่พบคำสั่ง' });

        const [records] = await pool.query(`
            SELECT ds.duty_date, dt.name AS duty_type_name, t.team_name,
                CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name
            FROM duty_schedules ds
            JOIN somtop s ON ds.somtop_id = s.id
            JOIN duty_types dt ON ds.duty_type_id = dt.id
            LEFT JOIN duty_teams t ON ds.team_id = t.id
            WHERE ds.order_id = ?${inScope(req.user.court_code, 'ds.')}
            ORDER BY ds.duty_date, s.first_name, s.last_name
        `, scopeParams(req.user.court_code, [req.params.id]));

        if (!records.length) return res.status(400).json({ message: 'คำสั่งนี้ยังไม่มีรายชื่อผู้ปฏิบัติหน้าที่' });
        const countsByDate = records.reduce((result, item) => {
            result[item.duty_date] = (result[item.duty_date] || 0) + 1;
            return result;
        }, {});
        const understaffedDates = Object.entries(countsByDate)
            .filter(([, count]) => count < 2)
            .map(([date]) => date);
        if (understaffedDates.length) {
            return res.status(400).json({
                message: `ยังพิมพ์คำสั่งไม่ได้ มีวันที่จัดเวรไม่ครบ 2 ท่าน จำนวน ${understaffedDates.length} วัน`,
                understaffed_dates: understaffedDates
            });
        }

        const grouped = records.reduce((result, item) => {
            const entry = result.get(item.duty_date) || { duty_date: item.duty_date, types: new Set(), teams: new Set(), names: [] };
            entry.types.add(item.duty_type_name);
            if (item.team_name) entry.teams.add(item.team_name);
            entry.names.push(item.full_name);
            result.set(item.duty_date, entry);
            return result;
        }, new Map());
        const schedules = Array.from(grouped.values()).map((entry) => ({
            duty_date_th: formatThaiDutyDate(entry.duty_date),
            duty_type_name: Array.from(entry.types).join(', '),
            team_name: entry.teams.size ? Array.from(entry.teams).join(', ') : Array.from(entry.types).join(', '),
            names: entry.names.join('\n\t\t\t')
        }));

        const order = orders[0];
        const template = fs.readFileSync(path.join(__dirname, '../../templates/duty_order_template.docx'), 'binary');
        const doc = new Docxtemplater(new PizZip(template), { paragraphLoop: true, linebreaks: true });
        doc.render({
            court_name: order.court_name || 'ศาล',
            order_number: order.order_number,
            order_title: order.title,
            order_month_th: formatThaiMonth(order.order_month),
            start_time: '09.00',
            end_time: '16.30',
            schedules,
            issued_date_th: formatThaiDate(getBangkokDate()),
            chief_judge_name: order.chief_judge_name || '................................................',
            chief_judge_position: order.chief_judge_position || 'ผู้พิพากษาหัวหน้าศาล',
            chief_judge_acting_position: '',
            director_name: order.director_name || '-',
            director_position: order.director_position || '-'
        });

        const buffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        const filename = `คำสั่งเวร_${order.order_number}.docx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.send(buffer);
    } catch (error) {
        console.error('Export duty order error:', error);
        res.status(500).json({ message: 'ไม่สามารถสร้างเอกสารคำสั่งเวรได้' });
    }
};
