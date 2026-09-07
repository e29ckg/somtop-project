const pool = require('../config/db');

// ==========================================
// เพิ่ม พ.สมทบ เข้าสู่วาระการทำงาน
// ==========================================
exports.addTermHistory = async (req, res) => {
    try {
        const { somtop_id, term_id, status, note } = req.body;

        if (!somtop_id || !term_id) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน (ต้องการ พ.สมทบ และ รุ่นวาระ)' });
        }

        // ⭐️ (Optional) ถ้าตั้งสถานะเป็น 'กำลังดำรงตำแหน่ง' อาจจะสั่งเปลี่ยนประวัติเก่าๆ ของคนนี้ให้เป็น 'หมดวาระ' ก่อน
        if (status === 'กำลังดำรงตำแหน่ง' || !status) {
            await pool.query(
                `UPDATE somtop_term_history SET status = 'หมดวาระ' WHERE somtop_id = ? AND status = 'กำลังดำรงตำแหน่ง'`, 
                [somtop_id]
            );
        }

        const query = `
            INSERT INTO somtop_term_history (somtop_id, term_id, status, note) 
            VALUES (?, ?, ?, ?)
        `;
        
        await pool.query(query, [
            somtop_id, 
            term_id, 
            status || 'กำลังดำรงตำแหน่ง', 
            note || null
        ]);

        res.status(201).json({ message: 'เพิ่มประวัติวาระการทำงานสำเร็จ' });
    } catch (error) {
        console.error('Error adding term history:', error);
        
        // ดัก Error UNIQUE KEY (1062) ป้องกันคนซ้ำในรุ่นเดิม
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'พ.สมทบ ท่านนี้มีประวัติอยู่ในวาระรุ่นนี้แล้ว' });
        }
        
        res.status(500).json({ message: 'ไม่สามารถบันทึกข้อมูลได้' });
    }
};

// ==========================================
// ดึงประวัติวาระทั้งหมดของ พ.สมทบ 1 ท่าน
// ==========================================
exports.getHistoryBySomtop = async (req, res) => {
    try {
        const { somtop_id } = req.params;

        const query = `
            SELECT 
                sth.id, sth.status, sth.note, sth.created_at,
                wt.generation_name, DATE_FORMAT(wt.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(wt.end_date, '%Y-%m-%d') AS end_date
            FROM somtop_term_history sth
            JOIN working_terms wt ON sth.term_id = wt.id
            WHERE sth.somtop_id = ?
            ORDER BY wt.start_date DESC
        `;
        
        const [rows] = await pool.query(query, [somtop_id]);
        res.status(200).json({ records: rows });
    } catch (error) {
        console.error('Error fetching term history:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงประวัติ' });
    }
};

// ==========================================
// ลบประวัติ
// ==========================================
exports.deleteTermHistory = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM somtop_term_history WHERE id = ?', [id]);
        res.status(200).json({ message: 'ลบข้อมูลประวัติสำเร็จ' });
    } catch (error) {
        console.error('Error deleting term history:', error);
        res.status(500).json({ message: 'ไม่สามารถลบข้อมูลได้' });
    }
};