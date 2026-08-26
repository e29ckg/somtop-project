const jwt = require('jsonwebtoken');
require('dotenv').config();

// ==========================================
// 1. ตรวจสอบว่าเข้าสู่ระบบหรือยัง (Verify Token)
// ==========================================
const verifyToken = (req, res, next) => {
    // ดึง Token จาก HttpOnly Cookie ที่ชื่อ 'jwt'
    const token = req.cookies.jwt;

    // ถ้าไม่มี Token (ยังไม่ล็อกอิน หรือ Cookie หมดอายุ)
    if (!token) {
        return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
    }

    try {
        // ตรวจสอบความถูกต้องของ Token ด้วย Secret Key
        const secretKey = process.env.JWT_SECRET || 'your_super_secret_jwt_key';
        const decoded = jwt.verify(token, secretKey);
        
        // นำข้อมูล Payload (id, username, full_name, role, court_code) ไปแปะไว้ที่ req.user
        req.user = decoded.data;
        
        // ปล่อยให้ไปทำงานที่ Controller ถัดไป
        next();
    } catch (error) {
        // กรณี Token ถูกแก้ไข (Invalid) หรือหมดอายุ (Expired)
        return res.status(401).json({ message: 'เซสชันหมดอายุหรือไม่ได้รับสิทธิ์ กรุณาเข้าสู่ระบบใหม่' });
    }
};

// ==========================================
// 2. ตรวจสอบสิทธิ์ว่าเป็นผู้ดูแลระบบหรือไม่ (Verify Admin)
// ==========================================
const verifyAdmin = (req, res, next) => {
    // ต้องให้ผ่าน verifyToken มาก่อน ถึงจะมี req.user
    if (req.user && req.user.role === 'admin') {
        next(); // อนุญาตให้ผ่านได้
    } else {
        return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึง (สำหรับผู้ดูแลระบบเท่านั้น)' });
    }
};

module.exports = {
    verifyToken,
    verifyAdmin
};