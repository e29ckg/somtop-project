const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.APP_URL || 'http://localhost:8088';
const { logActivity } = require('../utils/logger');

const deletePhysicalFile = (relativePath) => {
    if (relativePath) {
        const fullPath = path.join(__dirname, '../../', relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }
};

// ==========================================
// 1. ดึงข้อมูล พ.สมทบ ทั้งหมด (จัดเรียงตามอาวุโสแบบไดนามิก)
// ==========================================
exports.getAllSomtop = async (req, res) => {
    try {
        const courtCode = req.user.court_code; 
        
        // ⭐️ ใช้ LEFT JOIN เพื่อดึงชื่อตำแหน่งและ Level จากตาราง somtop_positions
        let query = `
            SELECT 
                s.id, s.title, s.first_name, s.last_name, s.id_card, s.court_code, 
                DATE_FORMAT(s.dob, '%Y-%m-%d') AS dob,
                DATE_FORMAT(s.join_date, '%Y-%m-%d') AS join_date,
                s.position_id, 
                sp.name AS role_position, -- ส่งกลับไปในชื่อเดิมเพื่อให้ Frontend ไม่พัง
                sp.level AS position_level,
                s.address, s.phone, s.status, s.note, s.photo_path, 
                CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name 
            FROM somtop s
            LEFT JOIN somtop_positions sp ON s.position_id = sp.id
        `;
        let params = [];
        
        if (courtCode) {
            query += ' WHERE s.court_code = ?';
            params.push(courtCode);
        }
        
        // ⭐️ เปลี่ยนมาจัดเรียงตาม sp.level ที่ตั้งไว้ในตารางแทน
        query += ` 
            ORDER BY 
                sp.level ASC,       -- 1. เรียงตามระดับอาวุโสของตำแหน่ง (เลขน้อยขึ้นก่อน)
                s.join_date ASC,    -- 2. เรียงตามวันที่เข้ารับตำแหน่ง
                s.first_name ASC,   -- 3. เรียงตามตัวอักษรชื่อ
                s.last_name ASC     -- 4. เรียงตามตัวอักษรนามสกุล
        `;
        
        const [rows] = await pool.query(query, params);

        const records = rows.map(row => {
            if (row.photo_path) row.photo_path = `${process.env.APP_URL || 'http://localhost:8088'}/${row.photo_path}`;
            return row;
        });

        res.status(200).json({ records });
    } catch (error) {
        console.error('Error fetching somtop data:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
};

// ==========================================
// 2. เพิ่มข้อมูลใหม่
// ==========================================
exports.createSomtop = async (req, res) => {
    let photoPath = null;
    try {
        // ⭐️ เปลี่ยน role_position เป็น position_id และเพิ่ม join_date
        const { title, first_name, last_name, id_card, dob, join_date, position_id, address, phone, status, note } = req.body;
        const courtCode = req.user.court_code; 
        
        if (!title || !first_name || !last_name) {
            if (req.file) deletePhysicalFile(`uploads/somtop/${req.file.filename}`);
            return res.status(400).json({ message: 'กรุณาระบุคำนำหน้า ชื่อ และสกุล ให้ครบถ้วน' });
        }

        if (req.file) {
            photoPath = `uploads/somtop/${req.file.filename}`;
        }

        const query = `
            INSERT INTO somtop 
            (title, first_name, last_name, id_card, court_code, dob, join_date, position_id, address, phone, status, note, photo_path) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await pool.query(query, [
            title, first_name, last_name, id_card || null, courtCode, 
            dob || null, join_date || null, position_id || null, 
            address || null, phone || null, status || 'ใช้งาน', 
            note || null, photoPath
        ]);

        res.status(201).json({ message: 'เพิ่มข้อมูลผู้พิพากษาสมทบสำเร็จ' });
    } catch (error) {
        console.error('Error creating somtop:', error);
        
        if (photoPath) deletePhysicalFile(photoPath);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'เลขบัตรประชาชนนี้ถูกใช้งานแล้ว กรุณาตรวจสอบอีกครั้ง' });
        }

        res.status(500).json({ message: 'ไม่สามารถบันทึกข้อมูลได้' });
    }
};

// ==========================================
// 3. แก้ไขข้อมูล
// ==========================================
exports.updateSomtop = async (req, res) => {
    try {
        // ⭐️ เปลี่ยน role_position เป็น position_id และเพิ่ม join_date
        const { id, title, first_name, last_name, id_card, dob, join_date, position_id, address, phone, status, note } = req.body;

        if (!id || !title || !first_name || !last_name) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน (ต้องการคำนำหน้า ชื่อ และสกุล)' });
        }

        const [existing] = await pool.query('SELECT photo_path FROM somtop WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
        }
        
        let photoPath = existing[0].photo_path;

        if (req.file) {
            photoPath = `uploads/somtop/${req.file.filename}`;
        }

        const query = `
            UPDATE somtop SET 
                title = ?, first_name = ?, last_name = ?, id_card = ?, dob = ?, join_date = ?, 
                position_id = ?, address = ?, phone = ?, status = ?, note = ?, photo_path = ? 
            WHERE id = ?
        `;
        
        await pool.query(query, [
            title, first_name, last_name, id_card || null, dob || null, join_date || null,
            position_id || null, address || null, phone || null, status || 'ใช้งาน', 
            note || null, photoPath, id
        ]);

        if (req.file && existing[0].photo_path) {
            deletePhysicalFile(existing[0].photo_path);
        }

        res.status(200).json({ message: 'อัปเดตข้อมูลสำเร็จ' });
    } catch (error) {
        console.error('Error updating somtop:', error);
        
        if (req.file) {
            deletePhysicalFile(`uploads/somtop/${req.file.filename}`);
        }

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'เลขบัตรประชาชนนี้ถูกใช้งานโดยบุคคลอื่นในระบบแล้ว กรุณาตรวจสอบอีกครั้ง' });
        }

        res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลได้' });
    }
};

// ==========================================
// 4. ลบข้อมูล (ฟังก์ชันเดิม ไม่ต้องแก้)
// ==========================================
exports.deleteSomtop = async (req, res) => {
    try {
        const { id } = req.body; // รองรับทั้งจาก req.body และ req.params

        if (!id) return res.status(400).json({ message: `ไม่ได้ระบุ ID ที่ต้องการลบ` });

        const [existing] = await pool.query('SELECT photo_path FROM somtop WHERE id = ?', [id]);
        
        if (existing.length > 0) {
            deletePhysicalFile(existing[0].photo_path);
        }

        await pool.query('DELETE FROM somtop WHERE id = ?', [id]);
        logActivity(req, 'ลบข้อมูล', 'จัดการ พ.สมทบ', `ลบข้อมูล ID: ${id}`);
        res.status(200).json({ message: 'ลบข้อมูลสำเร็จ' });
    } catch (error) {
        console.error('Error deleting somtop:', error);
        res.status(500).json({ message: 'ไม่สามารถลบข้อมูลได้' });
    }
};