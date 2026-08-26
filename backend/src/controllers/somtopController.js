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
// 1. ดึงข้อมูล พ.สมทบ ทั้งหมด
// ==========================================
exports.getAllSomtop = async (req, res) => {
    try {
        const courtCode = req.user.court_code; 
        
        // ⭐️ ระบุชื่อคอลัมน์ทั้งหมด และใช้ DATE_FORMAT จัดการฟิลด์ dob
        let query = `
            SELECT 
                id, title, first_name, last_name, id_card, court_code, 
                DATE_FORMAT(dob, '%Y-%m-%d') AS dob, 
                address, phone, status, note, photo_path, 
                CONCAT(title, first_name, ' ', last_name) AS full_name 
            FROM somtop
        `;
        let params = [];
        
        if (courtCode) {
            query += ' WHERE court_code = ?';
            params.push(courtCode);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const [rows] = await pool.query(query, params);

        const records = rows.map(row => {
            if (row.photo_path) row.photo_path = `${BASE_URL}/${row.photo_path}`;
            return row;
        });

        res.status(200).json({ records });
    } catch (error) {
        console.error('Error fetching somtop data:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
};

// ==========================================
// 2. เพิ่มข้อมูลใหม่ (พร้อมรูปภาพ และบันทึกศาล)
// ==========================================
exports.createSomtop = async (req, res) => {
    let photoPath = null;
    try {
        const { title, first_name, last_name, id_card, dob, address, phone, status, note } = req.body;
        const courtCode = req.user.data?.court_code || req.user.court_code;

        if (!title || !first_name || !last_name) {
            // ⭐️ แก้ไข: ลบ ../ ออก
            if (req.file) deletePhysicalFile(`uploads/somtop/${req.file.filename}`);
            return res.status(400).json({ message: 'กรุณาระบุคำนำหน้า ชื่อ และสกุล ให้ครบถ้วน' });
        }

        if (req.file) {
            // ⭐️ แก้ไข: ลบ ../ ออก เพื่อให้เก็บใน DB เป็น uploads/somtop/filename.jpg
            photoPath = `uploads/somtop/${req.file.filename}`;
        }

        const query = `
            INSERT INTO somtop 
            (title, first_name, last_name, id_card, court_code, dob, address, phone, status, note, photo_path) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await pool.query(query, [
            title, first_name, last_name, id_card || null, courtCode, 
            dob || null, address || null, phone || null, status || 'ใช้งาน', 
            note || null, photoPath
        ]);

        logActivity(req, 'เพิ่มข้อมูล', 'จัดการ พ.สมทบ', `เพิ่มรายชื่อ: ${title}${first_name} ${last_name}`);
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
// 3. แก้ไขข้อมูล (และจัดการไฟล์รูปใหม่ทับรูปเก่า)
// ==========================================
exports.updateSomtop = async (req, res) => {
    try {
        const { id, title, first_name, last_name, id_card, dob, address, phone, status, note } = req.body;

        if (!id || !title || !first_name || !last_name) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน (ต้องการคำนำหน้า ชื่อ และสกุล)' });
        }

        const [existing] = await pool.query('SELECT photo_path FROM somtop WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
        }
        
        let photoPath = existing[0].photo_path;

        if (req.file) {
            // ⭐️ แก้ไข: ลบ ../ ออก
            photoPath = `uploads/somtop/${req.file.filename}`;
        }

        const query = `
            UPDATE somtop SET 
                title = ?, first_name = ?, last_name = ?, id_card = ?, dob = ?, 
                address = ?, phone = ?, status = ?, note = ?, photo_path = ? 
            WHERE id = ?
        `;
        
        await pool.query(query, [
            title, first_name, last_name, id_card || null, dob || null, 
            address || null, phone || null, status || 'ใช้งาน', 
            note || null, photoPath, id
        ]);

        if (req.file && existing[0].photo_path) {
            deletePhysicalFile(existing[0].photo_path);
        }
        logActivity(req, 'อัปเดตข้อมูล', 'จัดการ พ.สมทบ', `อัปเดตข้อมูล ID: ${id}`);
        res.status(200).json({ message: 'อัปเดตข้อมูลสำเร็จ' });
    } catch (error) {
        console.error('Error updating somtop:', error);
        
        if (req.file) {
            // ⭐️ แก้ไข: ลบ ../ ออก
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