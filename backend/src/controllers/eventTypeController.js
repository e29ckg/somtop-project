const pool = require('../config/db'); 

// ==========================================
// ดึงข้อมูลประเภทกิจกรรมทั้งหมดที่เปิดใช้งาน
// ==========================================
exports.getAllEventTypes = async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, name FROM event_types WHERE status = 'ใช้งาน' ORDER BY id ASC"
        );
        res.status(200).json({ records: rows });
    } catch (error) {
        console.error('Error fetching event types:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทกิจกรรม' });
    }
};

// ==========================================
// ส่วนสำหรับ Admin (ดึงทั้งหมด, เพิ่ม, แก้ไข, ลบ)
// ==========================================
exports.getAllAdmin = async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM event_types ORDER BY id ASC");
        res.status(200).json({ records: rows });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
};

exports.createEventType = async (req, res) => {
    try {
        const { name, status } = req.body;
        await pool.query("INSERT INTO event_types (name, status) VALUES (?, ?)", [name, status || 'ใช้งาน']);
        res.status(201).json({ message: 'เพิ่มข้อมูลสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'ไม่สามารถบันทึกได้' });
    }
};

exports.updateEventType = async (req, res) => {
    try {
        const { id, name, status } = req.body;
        await pool.query("UPDATE event_types SET name = ?, status = ? WHERE id = ?", [name, status, id]);
        res.status(200).json({ message: 'อัปเดตข้อมูลสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'ไม่สามารถอัปเดตได้' });
    }
};

exports.deleteEventType = async (req, res) => {
    try {
        const { id } = req.params; // รับค่าผ่าน URL Param
        await pool.query("DELETE FROM event_types WHERE id = ?", [id]);
        res.status(200).json({ message: 'ลบข้อมูลสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'ไม่สามารถลบได้ (อาจมีกิจกรรมที่ใช้ประเภทนี้อยู่)' });
    }
};