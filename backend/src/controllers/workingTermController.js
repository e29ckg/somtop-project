const pool = require('../config/db');
const { logActivity } = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// ==========================================
// 🛠️ ฟังก์ชันช่วยเหลือ: ลบไฟล์จริงออกจากเซิร์ฟเวอร์
// ==========================================
const deletePhysicalFiles = (filePathsData) => {
    if (!filePathsData) return;
    try {
        let paths = [];
        try {
            paths = JSON.parse(filePathsData);
            if (!Array.isArray(paths)) paths = [paths];
        } catch (e) {
            paths = [filePathsData]; // รองรับกรณีเป็น String ไฟล์เดียว
        }

        paths.forEach(fileUrl => {
            if (fileUrl) {
                // ดึงเฉพาะชื่อไฟล์ออกมาจาก URL เพื่อลบ[cite: 1]
                const filename = path.basename(fileUrl);
                const filepath = path.join(__dirname, '../../uploads/terms/', filename);
                if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
            }
        });
    } catch (error) {
        console.error('Error deleting files:', error);
    }
};

// ==========================================
// ดึงข้อมูลวาระการทำงานของศาลปัจจุบัน
// ==========================================
exports.getAllTerms = async (req, res) => {
    try {
        const courtCode = req.user.court_code;
        if (!courtCode) {
            return res.status(400).json({ message: 'ไม่พบรหัสศาลของผู้ใช้งาน' });
        }

        const [rows] = await pool.query(
            `SELECT id, generation_name,
                    DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
                    DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
                    status, note, file_paths
             FROM working_terms
             WHERE court_code = ?
             ORDER BY start_date DESC, id DESC`,
            [courtCode]
        );

        res.status(200).json({ records: rows });
    } catch (error) {
        console.error('Error fetching working terms:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลวาระการทำงาน' });
    }
};

// ==========================================
// 1. เพิ่มข้อมูลวาระการทำงาน (Create)
// ==========================================
exports.createWorkingTerm = async (req, res) => {
    try {
        const { generation_name, start_date, end_date, status, note } = req.body;
        const courtCode = req.user.court_code; // ดึงรหัสศาลจาก Token อัตโนมัติ[cite: 9]

        if (!generation_name || !start_date || !end_date || !courtCode) {
            return res.status(400).json({ message: 'กรุณาระบุข้อมูลจำเป็นให้ครบถ้วน' });
        }

        // ⭐️ จัดการไฟล์แนบหลายไฟล์ แปลงเป็น JSON Array[cite: 1]
        let filePathsArray = [];
        if (req.files && req.files.length > 0) {
            const protocol = req.secure ? 'https' : 'http';
            const host = req.headers.host;
            filePathsArray = req.files.map(file => `${protocol}://${host}/uploads/terms/${file.filename}`);
        }
        const filePathsDb = filePathsArray.length > 0 ? JSON.stringify(filePathsArray) : null;

        const query = `
            INSERT INTO working_terms 
            (generation_name, court_code, start_date, end_date, status, note, file_paths) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await pool.query(query, [
            generation_name, courtCode, start_date, end_date,
            status || 'กำลังดำรงตำแหน่ง', note || null, filePathsDb
        ]);

        logActivity(req, 'เพิ่มข้อมูล', 'จัดการวาระการทำงาน', `เพิ่มวาระ: ${generation_name}`);
        res.status(201).json({ message: 'บันทึกข้อมูลวาระการทำงานและไฟล์แนบสำเร็จ' });
    } catch (error) {
        console.error('Error in createWorkingTerm:', error);
        res.status(500).json({ message: 'ไม่สามารถบันทึกข้อมูลได้' });
    }
};

// ==========================================
// 2. แก้ไขข้อมูลวาระการทำงาน (Update & Append Files)
// ==========================================
exports.updateWorkingTerm = async (req, res) => {
    try {
        const { id } = req.params;
        const { generation_name, start_date, end_date, status, note } = req.body;
        const courtCode = req.user.court_code;

        if (!id || !generation_name || !start_date || !end_date || !courtCode) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
        }

        // ดึงข้อมูลเดิมมาตรวจสอบหาไฟล์เก่า
        const [existing] = await pool.query(
            'SELECT file_paths FROM working_terms WHERE id = ? AND court_code = ?',
            [id, courtCode]
        );
        if (existing.length === 0) return res.status(404).json({ message: 'ไม่พบข้อมูลวาระการทำงาน' });
        
        // แปลงไฟล์เก่าให้เป็น Array[cite: 3]
        let currentPaths = [];
        if (existing[0].file_paths) {
            try {
                currentPaths = JSON.parse(existing[0].file_paths);
                if (!Array.isArray(currentPaths)) currentPaths = [existing[0].file_paths];
            } catch (e) {
                currentPaths = [existing[0].file_paths];
            }
        }

        // ⭐️ ถ้ามีการอัปโหลดไฟล์ใหม่ ให้นำมารวมกับไฟล์เก่า (Append)[cite: 3]
        if (req.files && req.files.length > 0) {
            const protocol = req.secure ? 'https' : 'http';
            const host = req.headers.host;
            const newPaths = req.files.map(file => `${protocol}://${host}/uploads/terms/${file.filename}`);
            currentPaths = currentPaths.concat(newPaths);
        }

        const filePathsDb = currentPaths.length > 0 ? JSON.stringify(currentPaths) : null;

        const query = `
            UPDATE working_terms SET 
                generation_name = ?, start_date = ?, end_date = ?, 
                status = ?, note = ?, file_paths = ?
            WHERE id = ? AND court_code = ?
        `;

        await pool.query(query, [
            generation_name, start_date, end_date,
            status || 'กำลังดำรงตำแหน่ง', note || null, filePathsDb, id, courtCode
        ]);

        logActivity(req, 'อัปเดตข้อมูล', 'จัดการวาระการทำงาน', `อัปเดตวาระ ID: ${id}`);
        res.status(200).json({ message: 'อัปเดตข้อมูลวาระการทำงานและเพิ่มไฟล์สำเร็จ' });
    } catch (error) {
        console.error('Error in updateWorkingTerm:', error);
        res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลได้' });
    }
};

// ==========================================
// ลบไฟล์แนบรายไฟล์จากวาระการทำงาน
// ==========================================
exports.deleteTermFile = async (req, res) => {
    try {
        const { id } = req.params;
        const { file_url } = req.body;
        const courtCode = req.user.court_code;

        if (!id || !file_url || !courtCode) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
        }

        const [existing] = await pool.query(
            'SELECT file_paths FROM working_terms WHERE id = ? AND court_code = ?',
            [id, courtCode]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลวาระการทำงาน' });
        }

        const currentPaths = parseFilePaths(existing[0].file_paths);
        const targetFilename = path.basename(new URL(file_url).pathname);
        const updatedPaths = currentPaths.filter(filePath => {
            return path.basename(new URL(filePath).pathname) !== targetFilename;
        });

        if (updatedPaths.length === currentPaths.length) {
            return res.status(404).json({ message: 'ไม่พบไฟล์แนบนี้ในรายการ' });
        }

        await pool.query(
            'UPDATE working_terms SET file_paths = ? WHERE id = ? AND court_code = ?',
            [updatedPaths.length > 0 ? JSON.stringify(updatedPaths) : null, id, courtCode]
        );

        deletePhysicalFiles(JSON.stringify([file_url]));
        logActivity(req, 'ลบไฟล์', 'จัดการวาระการทำงาน', `ลบไฟล์แนบจากวาระ ID: ${id}`);
        res.status(200).json({ message: 'ลบไฟล์แนบสำเร็จ', file_paths: updatedPaths });
    } catch (error) {
        console.error('Error deleting working-term file:', error);
        res.status(400).json({ message: 'ไม่สามารถลบไฟล์แนบได้' });
    }
};

// ==========================================
// 3. ลบวาระการทำงาน (Delete)
// ==========================================
exports.deleteWorkingTerm = async (req, res) => {
    try {
        const { id } = req.params;
        const courtCode = req.user.court_code;

        if (!id || !courtCode) return res.status(400).json({ message: 'ไม่ได้ระบุข้อมูลที่ต้องการลบ' });

        const [existing] = await pool.query(
            'SELECT file_paths FROM working_terms WHERE id = ? AND court_code = ?',
            [id, courtCode]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลวาระการทำงาน' });
        }
        
        // ⭐️ ลบไฟล์แนบทั้งหมดก่อนลบข้อมูลในฐานข้อมูล[cite: 1]
        if (existing.length > 0 && existing[0].file_paths) {
            deletePhysicalFiles(existing[0].file_paths);
        }

        await pool.query('DELETE FROM working_terms WHERE id = ? AND court_code = ?', [id, courtCode]);
        logActivity(req, 'ลบข้อมูล', 'จัดการวาระการทำงาน', `ลบวาระ ID: ${id}`);
        res.status(200).json({ message: 'ลบข้อมูลและไฟล์แนบสำเร็จ' });
    } catch (error) {
        console.error('Error in deleteWorkingTerm:', error);
        res.status(500).json({ message: 'ไม่สามารถลบข้อมูลได้' });
    }
};

const parseFilePaths = (filePathsData) => {
    if (!filePathsData) return [];
    try {
        const parsed = JSON.parse(filePathsData);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
        return [filePathsData];
    }
};