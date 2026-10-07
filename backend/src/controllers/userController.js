const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { logActivity } = require('../utils/logger');
const isCentral = req => req.user.role === 'central_admin';
const normalizedCourt = value => String(value || '').trim().toLowerCase() || null;
const validRoles = ['viewer', 'finance', 'admin', 'central_admin'];
const canManage = (req, target) => isCentral(req) ||
    (req.user.court_code && target.court_code === req.user.court_code && target.role !== 'central_admin');
const validAssignment = (req, role, courtCode) => validRoles.includes(role) &&
    (role === 'central_admin' ? isCentral(req) && !courtCode : Boolean(courtCode)) &&
    (isCentral(req) || (role !== 'central_admin' && courtCode === req.user.court_code));

// ==========================================
// 1. ดึงข้อมูลผู้ใช้งานทั้งหมด (GET)
// ==========================================
exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT 
                id, 
                username, 
                full_name, 
                role, 
                court_code, 
                DATE_FORMAT(last_login, '%Y-%m-%d %H:%i:%s') AS last_login, 
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, 
                failed_login_attempts, 
                DATE_FORMAT(lockout_until, '%Y-%m-%d %H:%i:%s') AS lockout_until 
             FROM users
             ${isCentral(req) ? '' : 'WHERE court_code = ?'}
             ORDER BY created_at DESC`,
            isCentral(req) ? [] : [req.user.court_code]
        );
        res.status(200).json({ records: rows });
    } catch (error) {
        console.error('Error in getAllUsers:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
};

// ==========================================
// 2. เพิ่มผู้ใช้งานใหม่ (POST)
// ==========================================
exports.createUser = async (req, res) => {
    try {
        const { username, password, full_name } = req.body;
        const role = req.body.role || 'viewer';
        const courtCode = normalizedCourt(req.body.court_code);

        if (!username || !password || !full_name) {
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }
        if (!validAssignment(req, role, courtCode)) {
            return res.status(403).json({ message: 'ไม่มีสิทธิ์กำหนดบทบาทหรือศาลนี้' });
        }
        if (courtCode) {
            const [courts] = await pool.query('SELECT id FROM courts WHERE court_code = ? LIMIT 1', [courtCode]);
            if (!courts.length) return res.status(400).json({ message: 'ไม่พบศาลที่เลือก' });
        }

        // เช็กชื่อผู้ใช้ซ้ำ
        const [existing] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'ชื่อผู้ใช้นี้มีในระบบแล้ว กรุณาใช้ชื่ออื่น' });
        }

        // เข้ารหัสผ่าน
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // บันทึกลงฐานข้อมูล
        await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role, court_code) 
             VALUES (?, ?, ?, ?, ?)`,
            [username, password_hash, full_name, role, courtCode]
        );
        logActivity(req, 'เพิ่มข้อมูล', 'จัดการผู้ใช้งาน', `เพิ่มผู้ใช้งาน: ${username}`);
        res.status(201).json({ message: 'เพิ่มผู้ใช้งานสำเร็จ' });
    } catch (error) {
        console.error('Error in createUser:', error);
        res.status(500).json({ message: 'ไม่สามารถเพิ่มผู้ใช้งานได้' });
    }
};

// ==========================================
// 3. แก้ไขข้อมูลผู้ใช้งาน (PUT)
// ==========================================
exports.updateUser = async (req, res) => {
    try {
        const { id, full_name, password } = req.body;
        const role = req.body.role || 'viewer';
        const courtCode = normalizedCourt(req.body.court_code);

        if (!id || !full_name) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
        }
        const [targets] = await pool.query('SELECT id, role, court_code FROM users WHERE id = ? LIMIT 1', [id]);
        if (!targets.length) return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้งาน' });
        if (!canManage(req, targets[0]) || !validAssignment(req, role, courtCode)) {
            return res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไขผู้ใช้งานหรือศาลนี้' });
        }
        if (Number(id) === Number(req.user.id) && role !== targets[0].role) {
            return res.status(400).json({ message: 'ไม่สามารถเปลี่ยนบทบาทของตนเองได้' });
        }
        if (targets[0].role === 'central_admin' && role !== 'central_admin') {
            const [count] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role = 'central_admin'");
            if (count[0].total <= 1) return res.status(400).json({ message: 'ต้องมีผู้ดูแลส่วนกลางอย่างน้อยหนึ่งบัญชี' });
        }
        if (courtCode) {
            const [courts] = await pool.query('SELECT id FROM courts WHERE court_code = ? LIMIT 1', [courtCode]);
            if (!courts.length) return res.status(400).json({ message: 'ไม่พบศาลที่เลือก' });
        }

        let query = 'UPDATE users SET full_name = ?, role = ?, court_code = ?';
        let params = [full_name, role, courtCode];

        // ถ้ามีการส่งรหัสผ่านใหม่มาด้วย ให้เข้ารหัสและอัปเดต
        if (password) {
            const saltRounds = 10;
            const password_hash = await bcrypt.hash(password, saltRounds);
            query += ', password_hash = ?';
            params.push(password_hash);
        }

        query += ' WHERE id = ?';
        params.push(id);

        const [result] = await pool.query(query, params);

        if (result.affectedRows > 0) {
            logActivity(req, 'อัปเดตข้อมูล', 'จัดการผู้ใช้งาน', `อัปเดตผู้ใช้งาน ID: ${id}`);
            res.status(200).json({ message: 'อัปเดตข้อมูลสำเร็จ' });
        } else {
            res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้งาน' });
        }
    } catch (error) {
        console.error('Error in updateUser:', error);
        res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลได้' });
    }
};

// ==========================================
// 4. ลบผู้ใช้งาน (DELETE)
// ==========================================
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ message: 'ไม่ได้ระบุ ID ที่ต้องการลบ' });
        }
        const [targets] = await pool.query('SELECT id, role, court_code FROM users WHERE id = ? LIMIT 1', [id]);
        if (!targets.length) return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้งาน' });
        if (!canManage(req, targets[0])) return res.status(403).json({ message: 'ไม่มีสิทธิ์ลบบัญชีนี้' });
        if (Number(id) === Number(req.user.id)) return res.status(400).json({ message: 'ไม่สามารถลบบัญชีตนเองได้' });
        if (targets[0].role === 'central_admin') {
            const [count] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role = 'central_admin'");
            if (count[0].total <= 1) return res.status(400).json({ message: 'ต้องมีผู้ดูแลส่วนกลางอย่างน้อยหนึ่งบัญชี' });
        }

        const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);

        if (result.affectedRows > 0) {
            logActivity(req, 'ลบข้อมูล', 'จัดการผู้ใช้งาน', `ลบผู้ใช้งาน ID: ${id}`);
            res.status(200).json({ message: 'ลบข้อมูลสำเร็จ' });
        } else {
            res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้งาน' });
        }
    } catch (error) {
        console.error('Error in deleteUser:', error);
        res.status(500).json({ message: 'ไม่สามารถลบข้อมูลได้' });
    }
};

// ==========================================
// 5. ปลดล็อกบัญชีผู้ใช้งาน (Admin Only)
// ==========================================
exports.unlockUser = async (req, res) => {
    try {
        const { id } = req.body; // หรือรับจาก req.params ขึ้นอยู่กับการออกแบบ Route

        if (!id) return res.status(400).json({ message: 'ไม่ได้ระบุ ID ผู้ใช้งาน' });
        const [targets] = await pool.query('SELECT id, role, court_code FROM users WHERE id = ? LIMIT 1', [id]);
        if (!targets.length) return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
        if (!canManage(req, targets[0])) return res.status(403).json({ message: 'ไม่มีสิทธิ์ปลดล็อกบัญชีนี้' });

        const [result] = await pool.query(
            'UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?', 
            [id]
        );

        if (result.affectedRows > 0) {
            logActivity(req, 'ปลดล็อกบัญชี', 'จัดการผู้ใช้งาน', `ปลดล็อกผู้ใช้งาน ID: ${id}`);
            res.status(200).json({ message: 'ปลดล็อกบัญชีสำเร็จ' });
        } else {
            res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
        }
    } catch (error) {
        console.error('Error unlocking user:', error);
        res.status(500).json({ message: 'ไม่สามารถปลดล็อกบัญชีได้' });
    }
};

// ==========================================
// 5. อัปเดตโปรไฟล์ส่วนตัวและรหัสผ่าน (PUT /api/users/profile)
// ==========================================
exports.updateProfile = async (req, res) => {
    try {
        const { id, full_name, old_password, new_password } = req.body;

        // 1. ตรวจสอบความครบถ้วนของข้อมูลพื้นฐาน
        if (!id || !full_name) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน (ต้องการ ID และ ชื่อ-สกุล)' });
        }

        // 2. ป้องกันการแอบแก้ไขโปรไฟล์ของคนอื่น (ตรวจสอบกับ Token)
        if (req.user.id !== id) {
            return res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไขข้อมูลโปรไฟล์ของผู้อื่น' });
        }

        // 3. กรณีที่มีการขอเปลี่ยนรหัสผ่านด้วย
        if (old_password || new_password) {
            if (!old_password || !new_password) {
                return res.status(400).json({ message: 'กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่ให้ครบถ้วน' });
            }

            // ดึงรหัสผ่านเดิม (Hash) จากฐานข้อมูลมาเปรียบเทียบ
            const [users] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [id]);
            if (users.length === 0) {
                return res.status(404).json({ message: 'ไม่พบข้อมูลผู้ใช้งานในระบบ' });
            }

            // ใช้ bcrypt ตรวจสอบรหัสผ่านเดิม
            const isValidPassword = await bcrypt.compare(old_password, users[0].password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ message: 'รหัสผ่านเดิมไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
            }

            // ถ้ารหัสผ่านเดิมถูก ให้เข้ารหัสรหัสผ่านใหม่
            const hashedNewPassword = await bcrypt.hash(new_password, 10);

            // อัปเดตทั้งชื่อและรหัสผ่านใหม่
            await pool.query(
                'UPDATE users SET full_name = ?, password_hash = ? WHERE id = ?',
                [full_name, hashedNewPassword, id]
            );

        } else {
            // 4. กรณีเปลี่ยนแค่ชื่อ-สกุล (ไม่เปลี่ยนรหัสผ่าน)
            await pool.query(
                'UPDATE users SET full_name = ? WHERE id = ?',
                [full_name, id]
            );
        }

        res.status(200).json({ message: 'อัปเดตข้อมูลโปรไฟล์เรียบร้อยแล้ว' });

    } catch (error) {
        console.error('Error in updateProfile:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลโปรไฟล์' });
    }
};
