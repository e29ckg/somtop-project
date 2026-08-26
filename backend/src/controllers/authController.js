const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/logger');

// ==========================================
// 1. ระบบเข้าสู่ระบบ (Login)
// ==========================================
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // ตรวจสอบการส่งข้อมูล
        if (!username || !password) {
            return res.status(400).json({ message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
        }

        // ค้นหาผู้ใช้ในฐานข้อมูล (ดึงฟิลด์ตามโครงสร้างเดิม)
        const [rows] = await pool.query(
            'SELECT id, username, password_hash, full_name, role, court_code FROM users WHERE username = ? LIMIT 1',
            [username]
        );

        // ถ้าไม่พบผู้ใช้
        if (rows.length === 0) {
            return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        const user = rows[0];

        // ตรวจสอบรหัสผ่าน (เทียบกับ bcrypt hash ในฐานข้อมูล)
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        // อัปเดตเวลาเข้าสู่ระบบล่าสุด (แบบ Asynchronous โดยไม่รอผลลัพธ์ก็ได้เพื่อความเร็ว)
        pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]).catch(console.error);

        // สร้าง JWT Payload (เก็บข้อมูลเดียวกับเวอร์ชัน PHP)
        const payload = {
            data: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                court_code: user.court_code
            }
        };

        // เข้ารหัส JWT (หมดอายุใน 1 วัน)
        const token = jwt.sign(
            payload, 
            process.env.JWT_SECRET || 'your_super_secret_jwt_key', 
            { expiresIn: '1d' }
        );

        // ⭐️ ฝัง JWT ลงใน HttpOnly Cookie
        res.cookie('jwt', token, {
            httpOnly: true, // ป้องกัน XSS (JavaScript ฝั่ง Client อ่านไม่ได้)
            secure: process.env.NODE_ENV === 'production', // ใช้ true ถ้าเป็น HTTPS
            maxAge: 24 * 60 * 60 * 1000, // 1 วัน (หน่วยเป็นมิลลิวินาที)
            path: '/' // ให้ Cookie ส่งไปทุก Route ในโดเมนนี้
        });
        
        logActivity(payload.data.username, 'เข้าสู่ระบบ', 'ระบบสมาชิก', 'เข้าสู่ระบบสำเร็จ');
        // ส่งข้อมูล User กลับไปให้ Frontend (ไม่ต้องส่ง Token แล้ว)
        res.status(200).json({
            message: 'เข้าสู่ระบบสำเร็จ',
            user: payload.data
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดบนเซิร์ฟเวอร์', error: error.message });
    }
};

// ==========================================
// 2. ระบบออกจากระบบ (Logout)
// ==========================================
exports.logout = (req, res) => {
    // ⭐️ สั่งลบ Cookie ชื่อ 'jwt'
    res.clearCookie('jwt', { path: '/' });
    res.status(200).json({ message: 'ออกจากระบบสำเร็จ' });
};