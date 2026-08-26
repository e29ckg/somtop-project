const pool = require('../config/db');
const { logActivity } = require('../utils/logger');

// ดึงข้อมูลศาลทั้งหมด
exports.getAllCourts = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM courts ORDER BY created_at DESC');
        res.status(200).json({ records: rows });
    } catch (error) {
        console.error('Error fetching courts:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลศาล' });
    }
};

// เพิ่มข้อมูลศาลใหม่
exports.createCourt = async (req, res) => {
    try {
        const { court_code, court_name, address, phone, email, province, status } = req.body;

        if (!court_code || !court_name) {
            return res.status(400).json({ message: 'กรุณาระบุรหัสศาลและชื่อศาลให้ครบถ้วน' });
        }

        const query = `
            INSERT INTO courts (court_code, court_name, address, phone, email, province, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        await pool.query(query, [
            court_code.toLowerCase(), court_name, address || null, 
            phone || null, email || null, province || null, status || 'ใช้งาน'
        ]);

        logActivity(req, 'เพิ่มข้อมูล', 'จัดการศาล', `เพิ่มศาล: ${court_code} - ${court_name}`);
        res.status(201).json({ message: 'เพิ่มข้อมูลศาลสำเร็จ' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'รหัสศาลนี้มีในระบบแล้ว กรุณาตรวจสอบอีกครั้ง' });
        }
        console.error('Error creating court:', error);
        res.status(500).json({ message: 'ไม่สามารถบันทึกข้อมูลได้' });
    }
};

// แก้ไขข้อมูลศาล
exports.updateCourt = async (req, res) => {
    try {
        const { id, court_code, court_name, address, phone, email, province, status } = req.body;

        if (!id || !court_code || !court_name) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
        }

        const query = `
            UPDATE courts SET 
                court_code = ?, court_name = ?, address = ?, 
                phone = ?, email = ?, province = ?, status = ? 
            WHERE id = ?
        `;
        
        await pool.query(query, [
            court_code.toLowerCase(), court_name, address || null, 
            phone || null, email || null, province || null, status || 'ใช้งาน', id
        ]);

        logActivity(req, 'อัปเดตข้อมูล', 'จัดการศาล', `อัปเดตศาล ID: ${id}`);
        res.status(200).json({ message: 'อัปเดตข้อมูลศาลสำเร็จ' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'รหัสศาลนี้ถูกใช้งานโดยรายการอื่นแล้ว' });
        }
        console.error('Error updating court:', error);
        res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลได้' });
    }
};

// ลบข้อมูลศาล
exports.deleteCourt = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) return res.status(400).json({ message: 'ไม่ได้ระบุ ID ที่ต้องการลบ' });

        await pool.query('DELETE FROM courts WHERE id = ?', [id]);
        logActivity(req, 'ลบข้อมูล', 'จัดการศาล', `ลบศาล ID: ${id}`);
        res.status(200).json({ message: 'ลบข้อมูลศาลสำเร็จ' });
    } catch (error) {
        console.error('Error deleting court:', error);
        res.status(500).json({ message: 'ไม่สามารถลบข้อมูลได้ (อาจมีข้อมูลที่เชื่อมโยงอยู่)' });
    }
};