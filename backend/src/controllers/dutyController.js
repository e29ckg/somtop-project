const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { logActivity } = require('../utils/logger');

const validMonth = value => /^\d{4}-\d{2}$/.test(String(value || ''));
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const inScope = (courtCode, alias = '') => courtCode ? ` AND ${alias}court_code = ?` : '';
const scopeParams = (courtCode, values = []) => courtCode ? [...values, courtCode] : values;

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

exports.getPeople = async (req, res) => {
    const [rows] = await pool.query(
        `SELECT id, CONCAT(title, first_name, ' ', last_name) AS full_name
         FROM somtop WHERE status = 'ใช้งาน'${inScope(req.user.court_code)}
         ORDER BY first_name, last_name`,
        scopeParams(req.user.court_code)
    );
    res.json({ records: rows });
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
            SELECT ds.id, ds.order_id, ds.somtop_id, ds.duty_type_id, ds.duty_date, ds.note, ds.status,
                CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name,
                dt.name AS duty_type_name, dor.order_number, dor.title AS order_title
            FROM duty_schedules ds
            JOIN somtop s ON ds.somtop_id = s.id
            JOIN duty_types dt ON ds.duty_type_id = dt.id
            LEFT JOIN duty_orders dor ON ds.order_id = dor.id
            WHERE DATE_FORMAT(ds.duty_date, '%Y-%m') = ?${orderFilter}${inScope(courtCode, 'ds.')}
            ORDER BY ds.duty_date, s.first_name, s.last_name
        `, scopeParams(courtCode, params));
        const [types] = await pool.query("SELECT id, name FROM duty_types WHERE status = 'ใช้งาน' ORDER BY id");
        res.json({ orders, schedules, duty_types: types });
    } catch (error) {
        console.error('Duty calendar error:', error);
        res.status(500).json({ message: 'ไม่สามารถโหลดปฏิทินเวรได้' });
    }
};

exports.createOrder = async (req, res) => {
    try {
        const { order_number, title, order_month, note } = req.body;
        if (!order_number?.trim() || !title?.trim() || !validMonth(order_month)) return res.status(400).json({ message: 'ข้อมูลคำสั่งไม่ครบถ้วน' });
        const [result] = await pool.query(
            `INSERT INTO duty_orders (order_number, title, order_month, court_code, note, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [order_number.trim(), title.trim(), `${order_month}-01`, req.user.court_code, note || null, req.user.id]
        );
        logActivity(req, 'เพิ่มข้อมูล', 'เวรปฏิบัติหน้าที่', `เพิ่มคำสั่ง ${order_number}`);
        res.status(201).json({ message: 'เพิ่มคำสั่งสำเร็จ', id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'เลขที่คำสั่งนี้มีอยู่แล้ว' });
        res.status(500).json({ message: 'ไม่สามารถเพิ่มคำสั่งได้' });
    }
};

exports.updateOrder = async (req, res) => {
    const { order_number, title, note, status } = req.body;
    const params = scopeParams(req.user.court_code, [order_number, title, note || null, status || 'ใช้งาน', req.params.id]);
    const [result] = await pool.query(
        `UPDATE duty_orders SET order_number = ?, title = ?, note = ?, status = ? WHERE id = ?${inScope(req.user.court_code)}`,
        params
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'ไม่พบคำสั่ง' });
    res.json({ message: 'แก้ไขคำสั่งสำเร็จ' });
};

exports.deleteOrder = async (req, res) => {
    const [result] = await pool.query(
        `DELETE FROM duty_orders WHERE id = ?${inScope(req.user.court_code)}`,
        scopeParams(req.user.court_code, [req.params.id])
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'ไม่พบคำสั่ง' });
    res.json({ message: 'ลบคำสั่งและรายการเวรสำเร็จ' });
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
        SELECT ds.duty_date, dt.name AS duty_type_name, CONCAT(s.title,s.first_name,' ',s.last_name) AS full_name
        FROM duty_schedules ds JOIN somtop s ON ds.somtop_id=s.id JOIN duty_types dt ON ds.duty_type_id=dt.id
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
    res.json({ order: orders[0], records });
};
