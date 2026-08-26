const pool = require('../config/db');

/**
 * ฟังก์ชันสำหรับบันทึกประวัติการใช้งาน
 * @param {Object} req - Request object (เพื่อดึงข้อมูล user จาก Token)
 * @param {String} action - การกระทำ เช่น 'เพิ่มข้อมูล', 'เข้าสู่ระบบ'
 * @param {String} moduleName - ชื่อส่วนที่จัดการ เช่น 'ผู้พิพากษาสมทบ'
 * @param {String|Object} details - รายละเอียดเพิ่มเติม (ถ้ามี)
 */
const logActivity = async (req, action, moduleName, details = null) => {
    try {
        // ดึงข้อมูล User จาก Token (รองรับทั้งโครงสร้างปกติ และแบบซ้อนใน data)
        const user = req.user?.data || req.user || {};
        const userId = user.id || null;
        const username = user.username || 'System';

        // แปลงรายละเอียดให้เป็นข้อความ (ถ้าส่งมาเป็น Object)
        const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;

        const query = `
            INSERT INTO activity_logs (user_id, username, action, module, details) 
            VALUES (?, ?, ?, ?, ?)
        `;
        
        // ไม่ต้อง await เพื่อรอผลลัพธ์ก็ได้ ให้มันบันทึกอยู่เบื้องหลัง จะได้ไม่ทำให้ API ช้าลง
        pool.query(query, [userId, username, action, moduleName, detailsStr]).catch(console.error);
        
    } catch (error) {
        console.error('Logger Error:', error);
    }
};

module.exports = { logActivity };