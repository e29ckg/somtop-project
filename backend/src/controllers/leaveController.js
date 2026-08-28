const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const { logActivity } = require('../utils/logger');

const BASE_URL = process.env.APP_URL || 'http://localhost:8088';

// ฟังก์ชันลบไฟล์จริงออกจากเซิร์ฟเวอร์
const deletePhysicalFile = (relativePath) => {
    if (relativePath) {
        const fullPath = path.join(__dirname, '../../', relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }
};

/// ==========================================
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

        const records = rows.map(row => {
            if (row.file_path) {
                row.file_path = `${BASE_URL}/${row.file_path}`;
            }
            if (row.total_days !== null) {
                row.total_days = Number(row.total_days);
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

        let filePath = null;
        if (req.file) {
            filePath = `uploads/leaves/${req.file.filename}`;
        }

        const query = `
            INSERT INTO leave_requests 
            (somtop_id, leave_type_id, court_code, start_date, end_date, total_days, note, status, file_path) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await pool.query(query, [
            somtop_id, leave_type_id, courtCode, start_date, end_date, total_days, 
            note || null, status || 'รอตรวจสอบ', filePath
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
        
        let filePath = existing[0].file_path;

        // ถ้ามีไฟล์ใหม่แนบมา ให้ลบไฟล์เก่าทิ้ง
        if (req.file) {
            deletePhysicalFile(filePath);
            filePath = `uploads/leaves/${req.file.filename}`;
        }

        const query = `
            UPDATE leave_requests SET 
                somtop_id = ?, leave_type_id = ?, start_date = ?, end_date = ?, 
                total_days = ?, note = ?, status = ?, file_path = ?
            WHERE id = ?
        `;

        await pool.query(query, [
            somtop_id, leave_type_id, start_date, end_date, total_days, 
            note || null, status || 'รอตรวจสอบ', filePath, id
        ]);

        logActivity(req, 'อัปเดตข้อมูล', 'จัดการการลา', `อัปเดตใบลา ID: ${id}`);
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
        const { id } = req.params; 

        if (!id) return res.status(400).json({ message: 'ไม่ได้ระบุ ID ที่ต้องการลบ' });

        const [existing] = await pool.query('SELECT file_path FROM leave_requests WHERE id = ?', [id]);
        
        // ลบไฟล์ PDF ก่อนลบข้อมูล
        if (existing.length > 0) {
            deletePhysicalFile(existing[0].file_path);
        }

        await pool.query('DELETE FROM leave_requests WHERE id = ?', [id]);
        logActivity(req, 'ลบข้อมูล', 'จัดการการลา', `ลบใบลา ID: ${id}`);
        res.status(200).json({ message: 'ลบข้อมูลและไฟล์แนบสำเร็จ' });
    } catch (error) {
        console.error('Error in deleteLeave:', error);
        res.status(500).json({ message: 'ไม่สามารถลบข้อมูลได้' });
    }
};