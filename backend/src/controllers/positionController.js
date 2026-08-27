const pool = require('../config/db');

// ==========================================
// 1. สำหรับ Dropdown หน้าฟอร์ม (ดึงเฉพาะที่ 'ใช้งาน' เรียงตามลำดับอาวุโส)
// ==========================================
exports.getAllActive = async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, name, level FROM somtop_positions WHERE status = 'ใช้งาน' ORDER BY level ASC"
        );
        res.status(200).json({ records: rows });
    } catch (error) {
        console.error('Error fetching active positions:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตำแหน่ง' });
    }
};

// ==========================================
// 2. สำหรับหน้าจัดการของ Admin (CRUD)
// ==========================================
exports.getAllAdmin = async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM somtop_positions ORDER BY level ASC");
        res.status(200).json({ records: rows });
    } catch (error) {
        console.error('Error fetching all positions:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
};

exports.createPosition = async (req, res) => {
    try {
        const { name, level, status } = req.body;
        
        if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อตำแหน่ง' });

        await pool.query(
            "INSERT INTO somtop_positions (name, level, status) VALUES (?, ?, ?)", 
            [name, level || 99, status || 'ใช้งาน']
        );
        res.status(201).json({ message: 'เพิ่มตำแหน่งใหม่สำเร็จ' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'ชื่อตำแหน่งนี้มีอยู่ในระบบแล้ว' });
        }
        res.status(500).json({ message: 'ไม่สามารถบันทึกได้' });
    }
};

exports.updatePosition = async (req, res) => {
    try {
        const { id, name, level, status } = req.body;
        
        if (!id || !name) return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });

        await pool.query(
            "UPDATE somtop_positions SET name = ?, level = ?, status = ? WHERE id = ?", 
            [name, level || 99, status, id]
        );
        res.status(200).json({ message: 'อัปเดตข้อมูลสำเร็จ' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'ชื่อตำแหน่งนี้มีอยู่ในระบบแล้ว' });
        }
        res.status(500).json({ message: 'ไม่สามารถอัปเดตได้' });
    }
};

exports.deletePosition = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM somtop_positions WHERE id = ?", [id]);
        res.status(200).json({ message: 'ลบข้อมูลสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'ไม่สามารถลบได้ (อาจมีรายชื่อ พ.สมทบ ที่ใช้ตำแหน่งนี้อยู่)' });
    }
};