const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const { logActivity } = require('../utils/logger');

const BASE_URL = process.env.APP_URL || 'http://localhost:8088';

const deletePhysicalFiles = (filePathsData) => {
    if (!filePathsData) return;
    try {
        let paths = [];
        try {
            // ลองแปลงเป็น Array ก่อน
            paths = JSON.parse(filePathsData);
            if (!Array.isArray(paths)) paths = [paths];
        } catch (e) {
            // ถ้า Parse ไม่ได้ แปลว่าเป็น String ไฟล์เดียวของระบบเก่า
            paths = [filePathsData];
        }

        paths.forEach(fileUrl => {
            if (fileUrl) {
                // ดึงเฉพาะชื่อไฟล์ออกมาจาก URL
                const filename = path.basename(fileUrl);
                const filepath = path.join(__dirname, '../../uploads/leaves/', filename);
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
            }
        });
    } catch (error) {
        console.error('Error deleting files:', error);
    }
};

// ==========================================
// 1. ดึงประวัติการลา (ตามศาลของผู้ใช้งาน)
// ==========================================
exports.getAllLeaves = async (req, res) => {
    try {
        const courtCode = req.user.court_code; 

        // ⭐️ ใช้ DATE_FORMAT ล็อกรูปแบบวันที่ให้เป็น YYYY-MM-DD
        let query = `
            SELECT 
                lr.id, lr.somtop_id, 
                CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name, 
                lr.leave_type_id, lt.name as leave_type_name,
                DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date,
                DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date,
                lr.total_days, lr.note, lr.file_path, lr.status, 
                DATE_FORMAT(lr.created_at, '%Y-%m-%d') AS submit_date
            FROM leave_requests lr
            LEFT JOIN somtop s ON lr.somtop_id = s.id
            LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
        `;
        
        let params = [];
        
        if (courtCode) {
            query += ` WHERE lr.court_code = ?`;
            params.push(courtCode);
        }
        
        query += ` ORDER BY lr.created_at DESC`;

        const [rows] = await pool.query(query, params);

        // ⭐️ แปลงข้อความ JSON ให้เป็น Array ก่อนส่งไป Frontend
        const records = rows.map(row => {
            if (row.file_path) {
                try {
                    // ลองแปลง JSON String เป็น Array
                    let parsedPaths = JSON.parse(row.file_path);
                    // ป้องกันกรณี Parse ได้แต่ไม่ใช่ Array
                    row.file_path = Array.isArray(parsedPaths) ? parsedPaths : [row.file_path];
                } catch (e) {
                    // ถ้า Parse ไม่ได้ แปลว่าเป็นข้อมูลระบบเก่าที่มีไฟล์เดียว ก็จับใส่ Array ให้
                    row.file_path = [row.file_path];
                }
            } else {
                row.file_path = []; // ถ้าไม่มีไฟล์เลย ส่ง Array ว่างไปแทน
            }
            return row;
        });

        res.status(200).json({ records });
    } catch (error) {
        console.error('Error in getAllLeaves:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
};

// ==========================================
// 2. สร้างใบลาใหม่
// ==========================================
exports.createLeave = async (req, res) => {
    try {
        const { somtop_id, leave_type_id, start_date, end_date, total_days, note, status } = req.body;
        const courtCode = req.user.court_code;

        if (!somtop_id || !start_date) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
        }

        let filePaths = [];
        if (req.files && req.files.length > 0) {
            const protocol = req.secure ? 'https' : 'http';
            const host = req.headers.host;
            filePaths = req.files.map(file => `${protocol}://${host}/uploads/leaves/${file.filename}`);
        }
        const filePathDb = filePaths.length > 0 ? JSON.stringify(filePaths) : null;

        const query = `
            INSERT INTO leave_requests 
            (somtop_id, leave_type_id, court_code, start_date, end_date, total_days, note, status, file_path) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await pool.query(query, [
            somtop_id, leave_type_id, courtCode, start_date, end_date, total_days, 
            note || null, status || 'รอตรวจสอบ', filePathDb
        ]);

        logActivity(req, 'เพิ่มข้อมูล', 'จัดการการลา', `สร้างใบลาใหม่: ${somtop_id}`);
        res.status(201).json({ message: 'บันทึกข้อมูลการลาและไฟล์แนบสำเร็จ' });
    } catch (error) {
        console.error('Error in createLeave:', error);
        res.status(500).json({ message: 'ไม่สามารถบันทึกข้อมูลได้' });
    }
};

// ==========================================
// 3. แก้ไขข้อมูลการลา
// ==========================================
exports.updateLeave = async (req, res) => {
    try {
        const { id, somtop_id, leave_type_id, start_date, end_date, total_days, note, status } = req.body;

        if (!id) return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน (ไม่พบ ID)' });

        // ดึงไฟล์เดิมมาก่อนเพื่อตรวจสอบ
        const [existing] = await pool.query('SELECT file_path FROM leave_requests WHERE id = ?', [id]);
        if (existing.length === 0) return res.status(404).json({ message: 'ไม่พบข้อมูลใบลา' });
        
        let filePathDb = existing[0].file_path;

        // ถ้ามีไฟล์ใหม่แนบมา ให้ลบไฟล์เก่าทิ้งทั้งหมด
        if (req.files && req.files.length > 0) {
            deletePhysicalFiles(existing[0].file_path);
            
            // สร้าง Array ของไฟล์ใหม่
            const protocol = req.secure ? 'https' : 'http';
            const host = req.headers.host;
            const newPaths = req.files.map(file => `${protocol}://${host}/uploads/leaves/${file.filename}`);
            
            filePathDb = JSON.stringify(newPaths);
        }

        const query = `
            UPDATE leave_requests SET 
                somtop_id = ?, leave_type_id = ?, start_date = ?, end_date = ?, 
                total_days = ?, note = ?, status = ?, file_path = ?
            WHERE id = ?
        `;

        await pool.query(query, [
            somtop_id, leave_type_id, start_date, end_date, total_days, 
            note || null, status || 'รอตรวจสอบ', filePathDb, id
        ]);

        if (typeof logActivity === 'function') {
            logActivity(req, 'อัปเดตข้อมูล', 'จัดการการลา', `อัปเดตใบลา ID: ${id}`);
        }
        res.status(200).json({ message: 'อัปเดตข้อมูลและไฟล์แนบสำเร็จ' });
    } catch (error) {
        console.error('Error in updateLeave:', error);
        res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลได้' });
    }
};

// ==========================================
// 4. ลบประวัติการลา
// ==========================================
exports.deleteLeave = async (req, res) => {
    try {
        const { id } = req.params; // ใช้ req.params ตามมาตรฐาน REST API

        if (!id) return res.status(400).json({ message: 'ไม่ได้ระบุ ID ที่ต้องการลบ' });

        const [existing] = await pool.query('SELECT file_path FROM leave_requests WHERE id = ?', [id]);
        
        // ลบไฟล์แนบทั้งหมดก่อนลบข้อมูลในฐานข้อมูล
        if (existing.length > 0 && existing[0].file_path) {
            deletePhysicalFiles(existing[0].file_path);
        }

        await pool.query('DELETE FROM leave_requests WHERE id = ?', [id]);
        
        if (typeof logActivity === 'function') {
            logActivity(req, 'ลบข้อมูล', 'จัดการการลา', `ลบใบลา ID: ${id}`);
        }
        res.status(200).json({ message: 'ลบข้อมูลและไฟล์แนบสำเร็จ' });
    } catch (error) {
        console.error('Error in deleteLeave:', error);
        res.status(500).json({ message: 'ไม่สามารถลบข้อมูลได้' });
    }
};

// ==========================================
// พิมพ์แบบฟอร์มใบลา (Word)
// ==========================================
exports.exportToWord = async (req, res) => {
    try {
        const { id } = req.params;

        // ดึงข้อมูลและใช้ CONCAT รวมคำนำหน้า ชื่อ สกุล ให้เป็น full_name
        const query = `
            SELECT 
                lr.*, 
                CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name, 
                lt.name AS leave_type_name
            FROM leave_requests lr
            LEFT JOIN somtop s ON lr.somtop_id = s.id
            LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lr.id = ?
        `;
        const [rows] = await pool.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลใบลา' });
        }

        const leaveData = rows[0];

        // โหลด Template
        const templatePath = path.resolve(__dirname, '../../templates/leave_template.docx');
        const content = fs.readFileSync(templatePath, 'binary');

        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        // ฟังก์ชันแปลงวันที่เป็นภาษาไทย
        const formatThaiDate = (dateString) => {
            if (!dateString) return '-';
            const date = new Date(dateString);
            const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
            return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
        };

        // แมปข้อมูลลงในตัวแปรของเอกสาร Word
        doc.render({
            full_name: leaveData.full_name || '-',
            leave_type_name: leaveData.leave_type_name || '-',
            start_date: formatThaiDate(leaveData.start_date),
            end_date: formatThaiDate(leaveData.end_date),
            total_days: leaveData.total_days ? (leaveData.total_days % 1 === 0 ? parseInt(leaveData.total_days) : parseFloat(leaveData.total_days)) : '0',
            note: leaveData.note || '-'
        });

        const buf = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        });

        const outputFilename = `ใบลา_${leaveData.full_name.replace(/\s+/g, '_')}_${Date.now()}.docx`;
        
        res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(outputFilename)}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buf);

    } catch (error) {
        console.error('Error generating Word file:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างไฟล์ Word' });
    }
};