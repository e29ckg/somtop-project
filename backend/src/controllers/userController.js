const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { logActivity } = require('../utils/logger');

// ==========================================
// 1. ดึงข้อมูลผู้ใช้งานทั้งหมด (GET)
// ==========================================
exports.getAllUsers = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, username, full_name, role, court_code, last_login, created_at 
             FROM users ORDER BY created_at DESC`
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