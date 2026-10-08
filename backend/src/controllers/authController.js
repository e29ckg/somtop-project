const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/logger'); // ถ้ามีการใช้ logger
const cookieSecure = process.env.COOKIE_SECURE === 'false' ? false : process.env.NODE_ENV === 'production';
const cookiePath = process.env.COOKIE_PATH || '/';

exports.login = async (req, res) => {
    let connection;
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
        }

        // Lock the account until the password check and counter update finish.
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.query(
            'SELECT id, username, password_hash, full_name, role, court_code, failed_login_attempts, lockout_until, auth_version, lockout_until > NOW() AS is_locked FROM users WHERE username = ? LIMIT 1 FOR UPDATE',
            [username]
        );

        if (rows.length === 0) {
            await connection.commit();
            return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        const user = rows[0];

        // ⭐️ 2. ตรวจสอบว่าบัญชีติดล็อกอยู่หรือไม่
        if (user.is_locked) {
            await connection.commit();
            return res.status(403).json({
                message: 'บัญชีนี้ถูกระงับชั่วคราวเนื่องจากเข้าสู่ระบบผิดเกิน 5 ครั้ง กรุณาลองใหม่ในอีก 1 ชั่วโมง หรือติดต่อผู้ดูแลระบบ'
            });
        }
        if (user.lockout_until) {
            await connection.query('UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?', [user.id]);
            user.failed_login_attempts = 0;
        }

        // 3. ตรวจสอบรหัสผ่าน
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isPasswordValid) {
            // The row lock serializes simultaneous attempts for this username.
            const attempts = user.failed_login_attempts + 1;
            
            if (attempts >= 5) {
                await connection.query('UPDATE users SET failed_login_attempts = ?, lockout_until = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?', [attempts, user.id]);
                await connection.commit();
                return res.status(403).json({ message: 'คุณกรอกรหัสผ่านผิด 5 ครั้ง บัญชีถูกระงับ 1 ชั่วโมง หรือติดต่อ Admin ให้ปลดล็อก' });
            } else {
                await connection.query('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [attempts, user.id]);
                await connection.commit();
                return res.status(401).json({ message: `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (ผิด ${attempts}/5 ครั้ง)` });
            }
        }

        await connection.query('UPDATE users SET last_login = NOW(), failed_login_attempts = 0, lockout_until = NULL WHERE id = ?', [user.id]);
        await connection.commit();

        // --- (โค้ดสร้าง Token และ Cookie เหมือนเดิม) ---
        const payload = {
            auth_version: user.auth_version,
            data: {
                id: user.id, username: user.username, 
                full_name: user.full_name, 
                role: user.role, 
                court_code: user.court_code,
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '8h',
            algorithm: 'HS256',
            issuer: 'somtop-api',
            audience: 'somtop-web'
        });

        res.cookie('jwt', token, {
            httpOnly: true,
            secure: cookieSecure,
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000,
            path: cookiePath
        });

        req.user = payload.data; 
        if (typeof logActivity === 'function') logActivity(req, 'เข้าสู่ระบบ', 'ระบบสมาชิก', 'เข้าสู่ระบบสำเร็จ');

        res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ', user: payload.data });

    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (rollbackError) { console.error('Login rollback failed:', rollbackError); }
        }
        console.error('Login Error:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดบนเซิร์ฟเวอร์', error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

// ==========================================
// 2. ระบบออกจากระบบ (Logout)
// ==========================================
exports.logout = async (req, res, next) => {
    try {
        await pool.query('UPDATE users SET auth_version = auth_version + 1 WHERE id = ?', [req.user.id]);
    } catch (error) {
        return next(error);
    }
    // ⭐️ สั่งลบ Cookie ชื่อ 'jwt'
    res.clearCookie('jwt', {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'strict',
        path: cookiePath
    });
    res.status(200).json({ message: 'ออกจากระบบสำเร็จ' });
};

exports.me = (req, res) => {
    res.status(200).json({ user: req.user });
};
