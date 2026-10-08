const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

// ==========================================
// 1. ตรวจสอบว่าเข้าสู่ระบบหรือยัง (Verify Token)
// ==========================================
const verifyToken = async (req, res, next) => {
    // ดึง Token จาก HttpOnly Cookie ที่ชื่อ 'jwt'
    const token = req.cookies.jwt;

    // ถ้าไม่มี Token (ยังไม่ล็อกอิน หรือ Cookie หมดอายุ)
    if (!token) {
        return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
    }

    try {
        // ตรวจสอบความถูกต้องของ Token ด้วย Secret Key
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: 'somtop-api',
            audience: 'somtop-web'
        });
        if (!Number.isSafeInteger(decoded.data?.id)) {
            return res.status(401).json({ message: 'เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' });
        }
        
        // อ่านสิทธิ์ล่าสุดจากฐานข้อมูล เพื่อให้การเปลี่ยนสิทธิ์หรือการลบบัญชีมีผลทันที
        const [rows] = await pool.query(
            'SELECT id, username, full_name, role, court_code, auth_version FROM users WHERE id = ? LIMIT 1',
            [decoded.data.id]
        );
        if (!rows.length) return res.status(401).json({ message: 'ไม่พบบัญชีผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่' });
        if (!Number.isSafeInteger(decoded.auth_version) || decoded.auth_version !== rows[0].auth_version) {
            return res.status(401).json({ message: 'เซสชันถูกยกเลิก กรุณาเข้าสู่ระบบใหม่' });
        }
        const { auth_version, ...currentUser } = rows[0];
        req.user = currentUser;
        if (!['admin', 'view'].includes(req.user.role)) {
            return res.status(401).json({ message: 'สิทธิ์บัญชีไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ' });
        }

        // ปล่อยให้ไปทำงานที่ Controller ถัดไป
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
            return res.status(401).json({ message: 'เซสชันหมดอายุหรือไม่ได้รับสิทธิ์ กรุณาเข้าสู่ระบบใหม่' });
        }
        return next(error);
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
