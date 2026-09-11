const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { logActivity } = require('../utils/logger');

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
             ORDER BY created_at DESC`
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
        const { username, password, full_name, role, court_code } = req.body;

        if (!username || !password || !full_name) {
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
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
            [username, password_hash, full_name, role || 'viewer', court_code || null]
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
        const { id, full_name, role, court_code, password } = req.body;

        if (!id || !full_name) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
        }

        let query = 'UPDATE users SET full_name = ?, role = ?, court_code = ?';
        let params = [full_name, role || 'viewer', court_code || null];

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