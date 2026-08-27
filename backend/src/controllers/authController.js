const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/logger'); // ถ้ามีการใช้ logger

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
        }

        // ⭐️ 1. ดึงข้อมูลผู้ใช้ พร้อมฟิลด์ failed_login_attempts และ lockout_until
        const [rows] = await pool.query(
            'SELECT id, username, password_hash, full_name, role, court_code, failed_login_attempts, lockout_until FROM users WHERE username = ? LIMIT 1',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        const user = rows[0];

        // ⭐️ 2. ตรวจสอบว่าบัญชีติดล็อกอยู่หรือไม่
        if (user.lockout_until) {
            const lockoutTime = new Date(user.lockout_until);
            const currentTime = new Date();

            if (currentTime < lockoutTime) {
                return res.status(403).json({ 
                    message: 'บัญชีนี้ถูกระงับชั่วคราวเนื่องจากเข้าสู่ระบบผิดเกิน 5 ครั้ง กรุณาลองใหม่ในอีก 1 ชั่วโมง หรือติดต่อผู้ดูแลระบบ' 
                });
            } else {
                // หากเลยเวลาล็อกไปแล้ว ให้รีเซ็ตค่าเพื่อเปิดโอกาสให้ลองใหม่
                await pool.query('UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?', [user.id]);
                user.failed_login_attempts = 0; 
            }
        }

        // 3. ตรวจสอบรหัสผ่าน
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isPasswordValid) {
            // ⭐️ 4. กรณีรหัสผิด: เพิ่มจำนวนครั้งที่ผิด
            const attempts = user.failed_login_attempts + 1;
            
            if (attempts >= 5) {
                // ถ้าผิดครบ 5 ครั้ง ให้ล็อก 1 ชั่วโมง (DATE_ADD(NOW(), INTERVAL 1 HOUR))
                await pool.query('UPDATE users SET failed_login_attempts = ?, lockout_until = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?', [attempts, user.id]);
                return res.status(403).json({ message: 'คุณกรอกรหัสผ่านผิด 5 ครั้ง บัญชีถูกระงับ 1 ชั่วโมง หรือติดต่อ Admin ให้ปลดล็อก' });
            } else {
                // ถ้ายังไม่ครบ อัปเดตแค่จำนวนครั้ง
                await pool.query('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [attempts, user.id]);
                return res.status(401).json({ message: `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ผิด ${attempts}/5 ครั้ง)` });
            }
        }

        // ⭐️ 5. กรณีล็อกอินสำเร็จ: รีเซ็ตจำนวนครั้งที่ผิดกลับเป็น 0
        pool.query('UPDATE users SET last_login = NOW(), failed_login_attempts = 0, lockout_until = NULL WHERE id = ?', [user.id]).catch(console.error);

        // --- (โค้ดสร้าง Token และ Cookie เหมือนเดิม) ---
        const payload = {
            data: {
                id: user.id, username: user.username, full_name: user.full_name, role: user.role, court_code: user.court_code
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'your_super_secret_jwt_key', { expiresIn: '1d' });

        res.cookie('jwt', token, {
            httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000, path: '/' 
        });

        req.user = payload.data; 
        if (typeof logActivity === 'function') logActivity(req, 'เข้าสู่ระบบ', 'ระบบสมาชิก', 'เข้าสู่ระบบสำเร็จ');

        res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ', user: payload.data });

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