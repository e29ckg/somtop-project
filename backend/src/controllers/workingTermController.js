const pool = require('../config/db');
const { logActivity } = require('../utils/logger');

// ==========================================
// 1. ดึงข้อมูลวาระการทำงานทั้งหมด (ของศาลนั้นๆ)
// ==========================================
exports.getAllTerms = async (req, res) => {
    try {
        const courtCode = req.user.court_code; // ดึงจาก JWT อัตโนมัติ
        
        // ใช้ DATE_FORMAT แปลงวันที่ให้เป็น YYYY-MM-DD เพื่อให้ฝั่ง Vue.js นำไปแสดงผลใน <input type="date"> ได้พอดี
        let query = `
            SELECT 
                id, generation_name, 
                DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, 
                DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, 
                status, note 
            FROM working_terms 
            WHERE court_code = ? 
            ORDER BY start_date DESC
        `;
        
        const [rows] = await pool.query(query, [courtCode]);
        res.status(200).json({ records: rows });
    } catch (error) {
        console.error('Error fetching working terms:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลวาระการทำงาน' });
    }
};

// ==========================================
// 2. เพิ่มข้อมูลวาระการทำงานใหม่
// ==========================================
exports.createTerm = async (req, res) => {
    try {
        const { generation_name, start_date, end_date, status, note } = req.body;
        const courtCode = req.user.court_code;

        if (!generation_name || !start_date || !end_date) {
            return res.status(400).json({ message: 'กรุณากรอกข้อมูล (รุ่นที่, วันที่เริ่มต้น, วันหมดวาระ) ให้ครบถ้วน' });
        }

        const query = `
            INSERT INTO working_terms (generation_name, start_date, end_date, court_code, status, note) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        await pool.query(query, [
            generation_name, start_date, end_date, courtCode, 
            status || 'กำลังดำรงตำแหน่ง', note || null
        ]);

        logActivity(req, 'เพิ่มข้อมูล', 'จัดการวาระการทำงาน', `เพิ่มวาระ: ${generation_name}`);
        res.status(201).json({ message: 'เพิ่มวาระการทำงานสำเร็จ' });
    } catch (error) {
        console.error('Error creating working term:', error);
        res.status(500).json({ message: 'ไม่สามารถบันทึกข้อมูลได้' });
    }
};

// ==========================================
// 3. แก้ไขข้อมูลวาระการทำงาน
// ==========================================
exports.updateTerm = async (req, res) => {
    try {
        const { id } = req.params;
        const { generation_name, start_date, end_date, status, note } = req.body;
        const courtCode = req.user.court_code;

        if (!id || !generation_name || !start_date || !end_date) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
        }

        const query = `
            UPDATE working_terms SET 
                generation_name = ?, start_date = ?, end_date = ?, status = ?, note = ? 
            WHERE id = ? AND court_code = ?
        `;
        
        await pool.query(query, [
            generation_name, start_date, end_date, status, note || null, 
            id, courtCode
        ]);

        logActivity(req, 'อัปเดตข้อมูล', 'จัดการวาระการทำงาน', `อัปเดตวาระ ID: ${id}`);
        res.status(200).json({ message: 'อัปเดตข้อมูลสำเร็จ' });
    } catch (error) {
        console.error('Error updating working term:', error);
        res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลได้' });
    }
};

// ==========================================
// 4. ลบข้อมูลวาระการทำงาน
// ==========================================
exports.deleteTerm = async (req, res) => {
    try {
        const { id } = req.params;
        const courtCode = req.user.court_code;

        if (!id) return res.status(400).json({ message: 'ไม่ได้ระบุ ID ที่ต้องการลบ' });

        await pool.query('DELETE FROM working_terms WHERE id = ? AND court_code = ?', [id, courtCode]);
        logActivity(req, 'ลบข้อมูล', 'จัดการวาระการทำงาน', `ลบวาระ ID: ${id}`);
        res.status(200).json({ message: 'ลบข้อมูลสำเร็จ' });
    } catch (error) {
        console.error('Error deleting working term:', error);
        res.status(500).json({ message: 'ไม่สามารถลบข้อมูลได้ (อาจมีประวัติผูกอยู่กับ พ.สมทบ)' });
    }
};