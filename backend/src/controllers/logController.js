const pool = require('../config/db');

exports.getAllLogs = async (req, res) => {
    try {
        // ดึงข้อมูลล่าสุด 500 รายการ เพื่อไม่ให้โหลดหนักเกินไป
        const [rows] = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 500');
        res.status(200).json({ records: rows });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการใช้งาน' });
    }
};