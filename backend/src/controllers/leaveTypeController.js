const pool = require('../config/db');

exports.getAllActive = async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM leave_types WHERE status = 'ใช้งาน' ORDER BY id ASC");
        res.status(200).json({ records: rows });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }   
}    

exports.getAllAdmin = async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM leave_types ORDER BY id ASC");
        res.status(200).json({ records: rows });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
};

exports.createLeaveType = async (req, res) => {
    try {
        const { name, status } = req.body;
        await pool.query("INSERT INTO leave_types (name, status) VALUES (?, ?)", [name, status || 'ใช้งาน']);
        res.status(201).json({ message: 'เพิ่มข้อมูลสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'ไม่สามารถบันทึกได้' });
    }
};

exports.updateLeaveType = async (req, res) => {
    try {
        const { id, name, status } = req.body;
        await pool.query("UPDATE leave_types SET name = ?, status = ? WHERE id = ?", [name, status, id]);
        res.status(200).json({ message: 'อัปเดตข้อมูลสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'ไม่สามารถอัปเดตได้' });
    }
};

exports.deleteLeaveType = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM leave_types WHERE id = ?", [id]);
        res.status(200).json({ message: 'ลบข้อมูลสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'ไม่สามารถลบได้ (อาจมีประวัติการลาที่อ้างอิงประเภทนี้อยู่)' });
    }
};