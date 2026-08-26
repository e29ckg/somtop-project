const pool = require('../config/db'); // นำเข้าตัวเชื่อมต่อฐานข้อมูล
const { logActivity } = require('../utils/logger'); // นำเข้าฟังก์ชันบันทึกประวัติการใช้งาน

// ==========================================
// ดึงข้อมูลคำนำหน้าชื่อทั้งหมดที่เปิดใช้งาน
// ==========================================
exports.getAllTitles = async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, name FROM name_titles WHERE status = 'ใช้งาน' ORDER BY id ASC"
        );
        res.status(200).json({ records: rows });
    } catch (error) {
        console.error('Error fetching titles:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำนำหน้าชื่อ' });
    }
};

// ==========================================
// ส่วนสำหรับ Admin (ดึงทั้งหมด, เพิ่ม, แก้ไข, ลบ)
// ==========================================
// ดึงข้อมูลทั้งหมด (รวมสถานะระงับ)
exports.getAllAdmin = async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM name_titles ORDER BY id ASC");
        res.status(200).json({ records: rows });
    } catch (error) {
        console.error('Error fetching admin titles:', error);
        res.status(500).json({ message: 'ดึงข้อมูลไม่สำเร็จ' });
    }
};

// เพิ่มคำนำหน้า
exports.createTitle = async (req, res) => {
    try {
        const { name, status } = req.body;
        await pool.query("INSERT INTO name_titles (name, status) VALUES (?, ?)", [name, status || 'ใช้งาน']);
        
        logActivity('createTitle', req.user.id, { name, status });
        res.status(201).json({ message: 'เพิ่มข้อมูลสำเร็จ' });
    } catch (error) {
        console.error('Error creating title:', error);
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'ชื่อนี้มีในระบบแล้ว' });
        res.status(500).json({ message: 'บันทึกไม่ได้' });
    }
};

// แก้ไขคำนำหน้า
exports.updateTitle = async (req, res) => {
    try {
        const { id, name, status } = req.body;
        await pool.query("UPDATE name_titles SET name = ?, status = ? WHERE id = ?", [name, status, id]);
        logActivity('updateTitle', req.user.id, { id, name, status });
        res.status(200).json({ message: 'อัปเดตสำเร็จ' });
    } catch (error) {
        console.error('Error updating title:', error);
        res.status(500).json({ message: 'อัปเดตไม่ได้' });
    }
};

// ลบคำนำหน้า
exports.deleteTitle = async (req, res) => {
    try {
        const { id } = req.body;
        await pool.query("DELETE FROM name_titles WHERE id = ?", [id]);
        logActivity('deleteTitle', req.user.id, { id });
        res.status(200).json({ message: 'ลบข้อมูลสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'ลบไม่ได้ อาจถูกใช้งานอยู่' });
    }
};