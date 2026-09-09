const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const { logActivity } = require('../utils/logger');

// ฟังก์ชันช่วยเหลือสำหรับลบไฟล์ออกจากเซิร์ฟเวอร์
const deletePhysicalFile = (relativePath) => {
    if (relativePath) {
        const fullPath = path.join(__dirname, '../..', relativePath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
};

const toFileUrl = (filePath) => {
    if (!filePath || /^https?:\/\//i.test(filePath)) return filePath;
    return `${process.env.APP_URL || 'http://localhost:8088'}/${filePath}`;
};

// ==========================================
// 1. ดึงข้อมูล Master Data สำหรับทำ Dropdown
// ==========================================
exports.getMasterDecorations = async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, name, short_name FROM master_decorations WHERE status = 'ใช้งาน' ORDER BY sort_order ASC"
        );
        res.status(200).json({ records: rows });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลชั้นตรา' });
    }
};

// ==========================================
// 2. ดึงประวัติเครื่องราชฯ ของ พ.สมทบ แต่ละราย
// ==========================================
exports.getSomtopDecorations = async (req, res) => {
    try {
        const { somtop_id } = req.params;
        const query = `
            SELECT sd.*, md.name AS decoration_name, md.short_name 
            FROM somtop_decorations sd
            JOIN master_decorations md ON sd.decoration_id = md.id
            WHERE sd.somtop_id = ?
            ORDER BY sd.received_date DESC
        `;
        const [rows] = await pool.query(query, [somtop_id]);
        res.status(200).json({
            records: rows.map(row => ({ ...row, file_path: toFileUrl(row.file_path) }))
        });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงประวัติเครื่องราชฯ' });
    }
};

// ==========================================
// 3. เพิ่มประวัติเครื่องราชฯ (พร้อมอัปโหลดไฟล์)
// ==========================================
exports.addDecoration = async (req, res) => {
    let filePath = null;
    try {
        const { somtop_id, decoration_id, received_date, gazette_ref, note } = req.body;
        
        if (!somtop_id || !decoration_id || !received_date) {
            if (req.file) deletePhysicalFile(`uploads/decorations/${req.file.filename}`);
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน' });
        }

        if (req.file) filePath = `uploads/decorations/${req.file.filename}`;

        const query = `
            INSERT INTO somtop_decorations 
            (somtop_id, decoration_id, received_date, gazette_ref, file_path, note) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        await pool.query(query, [
            somtop_id, decoration_id, received_date, gazette_ref || null, filePath, note || null
        ]);

        logActivity(req, 'เพิ่มข้อมูล', 'ประวัติเครื่องราชฯ', `เพิ่มประวัติเครื่องราชฯ ให้ พ.สมทบ ID: ${somtop_id}`);
        res.status(201).json({ message: 'เพิ่มประวัติเครื่องราชฯ สำเร็จ' });
    } catch (error) {
        if (filePath) deletePhysicalFile(filePath); // ลบไฟล์ทิ้งถ้า DB บันทึกไม่สำเร็จ
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'พ.สมทบ ท่านนี้มีประวัติเครื่องราชฯ ชั้นตรานี้ในระบบแล้ว' });
        }
        res.status(500).json({ message: 'ไม่สามารถบันทึกข้อมูลได้' });
    }
};

// ==========================================
// 4. แก้ไขประวัติเครื่องราชฯ (พร้อมเปลี่ยนไฟล์แนบได้)
// ==========================================
exports.updateDecoration = async (req, res) => {
    let newFilePath = null;
    try {
        const { id } = req.params;
        const { decoration_id, received_date, gazette_ref, note } = req.body;

        if (!id || !decoration_id || !received_date) {
            if (req.file) deletePhysicalFile(`uploads/decorations/${req.file.filename}`);
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน' });
        }

        const [existing] = await pool.query(
            'SELECT file_path FROM somtop_decorations WHERE id = ?',
            [id]
        );
        if (existing.length === 0) {
            if (req.file) deletePhysicalFile(`uploads/decorations/${req.file.filename}`);
            return res.status(404).json({ message: 'ไม่พบประวัติเครื่องราชฯ' });
        }

        newFilePath = req.file
            ? `uploads/decorations/${req.file.filename}`
            : existing[0].file_path;

        await pool.query(
            `UPDATE somtop_decorations
             SET decoration_id = ?, received_date = ?, gazette_ref = ?, file_path = ?, note = ?
             WHERE id = ?`,
            [decoration_id, received_date, gazette_ref || null, newFilePath, note || null, id]
        );

        if (req.file && existing[0].file_path) {
            deletePhysicalFile(existing[0].file_path);
        }

        logActivity(req, 'อัปเดตข้อมูล', 'ประวัติเครื่องราชฯ', `อัปเดตประวัติเครื่องราชฯ ID: ${id}`);
        res.status(200).json({ message: 'แก้ไขประวัติเครื่องราชฯ สำเร็จ' });
    } catch (error) {
        if (newFilePath && req.file) deletePhysicalFile(newFilePath);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'พ.สมทบ ท่านนี้มีประวัติเครื่องราชฯ ชั้นตรานี้ในระบบแล้ว' });
        }
        res.status(500).json({ message: 'ไม่สามารถแก้ไขข้อมูลได้' });
    }
};

// ==========================================
// 5. ลบประวัติ (และลบไฟล์แนบ)
// ==========================================
exports.deleteDecoration = async (req, res) => {
    try {
        const { id } = req.params;
        
        // ค้นหาไฟล์ที่ต้องลบก่อน
        const [existing] = await pool.query('SELECT file_path FROM somtop_decorations WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'ไม่พบประวัติเครื่องราชฯ' });
        }

        await pool.query('DELETE FROM somtop_decorations WHERE id = ?', [id]);
        if (existing[0].file_path) {
            deletePhysicalFile(existing[0].file_path);
        }
        logActivity(req, 'ลบข้อมูล', 'ประวัติเครื่องราชฯ', `ลบประวัติเครื่องราชฯ ID: ${id}`);
        res.status(200).json({ message: 'ลบข้อมูลสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'ไม่สามารถลบข้อมูลได้' });
    }
};

// ==========================================
// ส่วนของ Admin สำหรับจัดการ Master Data ชั้นตรา
// ==========================================
exports.getAllAdmin = async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM master_decorations ORDER BY sort_order ASC, id ASC");
        res.status(200).json({ records: rows });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลชั้นตรา' });
    }
};

exports.createMasterDecoration = async (req, res) => {
    try {
        const { name, short_name, sort_order, status } = req.body;
        await pool.query(
            "INSERT INTO master_decorations (name, short_name, sort_order, status) VALUES (?, ?, ?, ?)", 
            [name, short_name || null, sort_order || 99, status || 'ใช้งาน']
        );
        logActivity(req, 'เพิ่มข้อมูล', 'จัดการชั้นตรา', `เพิ่มชั้นตรา: ${name}`);
        res.status(201).json({ message: 'เพิ่มชั้นตราสำเร็จ' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'ชื่อชั้นตรานี้มีในระบบแล้ว' });
        res.status(500).json({ message: 'ไม่สามารถบันทึกได้' });
    }
};

exports.updateMasterDecoration = async (req, res) => {
    try {
        const { id, name, short_name, sort_order, status } = req.body;
        await pool.query(
            "UPDATE master_decorations SET name = ?, short_name = ?, sort_order = ?, status = ? WHERE id = ?", 
            [name, short_name || null, sort_order || 99, status, id]
        );
        logActivity(req, 'อัปเดตข้อมูล', 'จัดการชั้นตรา', `อัปเดตชั้นตรา ID: ${id}`);
        res.status(200).json({ message: 'อัปเดตข้อมูลสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'ไม่สามารถอัปเดตได้' });
    }
};

exports.deleteMasterDecoration = async (req, res) => {
    try {
        const { id } = req.body; // รับ ID จาก req.body (ตรงตามที่ Frontend ส่งมา)
        await pool.query("DELETE FROM master_decorations WHERE id = ?", [id]);
        logActivity(req, 'ลบข้อมูล', 'จัดการชั้นตรา', `ลบชั้นตรา ID: ${id}`);
        res.status(200).json({ message: 'ลบข้อมูลสำเร็จ' });
    } catch (error) {
        // ดักจับ Error กรณีถูกนำไปใช้ในประวัติ somtop_decorations แล้ว (Foreign Key Restrict)
        res.status(400).json({ message: 'ไม่สามารถลบได้ เนื่องจากชั้นตรานี้ถูกใช้ในประวัติของ พ.สมทบ แล้ว' });
    }
};