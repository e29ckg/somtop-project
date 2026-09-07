const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.APP_URL || 'http://localhost:8088';
const { logActivity } = require('../utils/logger');

const deletePhysicalFile = (relativePath) => {
    if (relativePath) {
        const fullPath = path.join(__dirname, '../../', relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }
};

// ==========================================
// 1. ดึงข้อมูล พ.สมทบ ทั้งหมด (อัปเดตดึงข้อมูลวาระปัจจุบัน)
// ==========================================
exports.getAllSomtop = async (req, res) => {
    try {
        const courtCode = req.user.court_code; 
        
        let query = `
            SELECT 
                s.id, s.title, s.first_name, s.last_name, s.id_card, s.court_code, 
                s.occupation, 
                DATE_FORMAT(s.dob, '%Y-%m-%d') AS dob,
                DATE_FORMAT(s.join_date, '%Y-%m-%d') AS join_date,
                s.position_id, 
                sp.name AS role_position,
                sp.level AS position_level,
                
                wt.id AS current_term_id,
                wt.generation_name AS current_term_name,
                
                s.address, s.phone, s.status, s.note, s.photo_path, 
                CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name 
            FROM somtop s
            LEFT JOIN somtop_positions sp ON s.position_id = sp.id
            -- ⭐️ JOIN ประวัติวาระ โดยดึงเฉพาะวาระที่ "กำลังดำรงตำแหน่ง"
            LEFT JOIN somtop_term_history sth ON s.id = sth.somtop_id AND sth.status = 'กำลังดำรงตำแหน่ง'
            LEFT JOIN working_terms wt ON sth.term_id = wt.id
        `;
        let params = [];
        
        if (courtCode) {
            query += ' WHERE s.court_code = ?';
            params.push(courtCode);
        }
        
        // จัดเรียงตามระดับอาวุโสของตำแหน่ง และวันที่เข้ารับตำแหน่ง
        query += ` 
            ORDER BY 
                sp.level ASC, 
                s.join_date ASC, 
                s.first_name ASC, 
                s.last_name ASC
        `;
        
        const [rows] = await pool.query(query, params);

        const records = rows.map(row => {
            if (row.photo_path) row.photo_path = `${process.env.APP_URL || 'http://localhost:8088'}/${row.photo_path}`;
            return row;
        });

        res.status(200).json({ records });
    } catch (error) {
        console.error('Error fetching somtop data:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
};

// ==========================================
// 2. เพิ่มข้อมูล พ.สมทบ ใหม่ (พร้อมกำหนดวาระ)
// ==========================================
exports.createSomtop = async (req, res) => {
    // ⭐️ ใช้ Transaction เพราะต้อง Insert ลง 2 ตาราง
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    let photoPath = null;

    try {
        const { title, first_name, last_name, id_card, dob, occupation, join_date, position_id, address, phone, status, note, term_id } = req.body;
        const courtCode = req.user.court_code; 

        if (!title || !first_name || !last_name) {
            if (req.file) deletePhysicalFile(req.file.path);
            return res.status(400).json({ message: 'กรุณากรอกคำนำหน้า ชื่อ และนามสกุลให้ครบถ้วน' });
        }

        if (req.file) {
            photoPath = `uploads/somtop/${req.file.filename}`;
        }

        // 1. บันทึกข้อมูล พ.สมทบ ลงตารางหลัก
        const query = `
            INSERT INTO somtop 
            (title, first_name, last_name, id_card, court_code, dob, occupation, join_date, position_id, address, phone, status, note, photo_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await connection.query(query, [
            title, first_name, last_name, id_card || null, courtCode, 
            dob || null, occupation || null, join_date || null, position_id || null, 
            address || null, phone || null, status || 'ใช้งาน', 
            note || null, photoPath
        ]);

        const newSomtopId = result.insertId;

        // ⭐️ 2. ถ้ามีการเลือกรุ่น (term_id) ให้บันทึกลงตารางประวัติด้วย
        if (term_id) {
            await connection.query(
                `INSERT INTO somtop_term_history (somtop_id, term_id, status) VALUES (?, ?, 'กำลังดำรงตำแหน่ง')`,
                [newSomtopId, term_id]
            );
        }

        // 3. ยืนยันการบันทึกข้อมูลทั้งหมด
        await connection.commit();

        if (typeof logActivity === 'function') {
            logActivity(req, 'เพิ่มข้อมูล', 'จัดการ พ.สมทบ', `เพิ่มผู้พิพากษาสมทบ: ${title}${first_name} ${last_name}`);
        }

        res.status(201).json({ message: 'เพิ่มข้อมูลผู้พิพากษาสมทบสำเร็จ' });
    } catch (error) {
        // ถ้ายกเลิก หรือเกิด Error ให้ Rollback ข้อมูลกลับทั้งหมด
        await connection.rollback();
        if (photoPath) deletePhysicalFile(photoPath); // ลบไฟล์ที่เพิ่งอัปโหลดทิ้งด้วย
        
        console.error('Error creating somtop:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว' });
        }
        res.status(500).json({ message: 'ไม่สามารถเพิ่มข้อมูลได้' });
    } finally {
        connection.release();
    }
};

// ==========================================
// 3. แก้ไขข้อมูล พ.สมทบ (และจัดการต่อวาระ)
// ==========================================
exports.updateSomtop = async (req, res) => {
    // ⭐️ ใช้ Transaction ในการอัปเดตข้อมูลเช่นกัน
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    let newPhotoPath = null;
    let oldPhotoPath = null;

    try {
        const id = req.params.id || req.body.id;
        const { title, first_name, last_name, id_card, dob, occupation, join_date, position_id, address, phone, status, note, term_id } = req.body;

        if (!id) return res.status(400).json({ message: 'ไม่พบ ID ที่ต้องการแก้ไข' });

        // ดึงรูปภาพเดิมมาตรวจสอบ
        const [existing] = await connection.query('SELECT photo_path FROM somtop WHERE id = ?', [id]);
        if (existing.length === 0) {
            if (req.file) deletePhysicalFile(req.file.path);
            return res.status(404).json({ message: 'ไม่พบข้อมูลผู้พิพากษาสมทบ' });
        }

        oldPhotoPath = existing[0].photo_path;
        let finalPhotoPath = oldPhotoPath;

        // ถ้ามีการอัปโหลดรูปใหม่
        if (req.file) {
            newPhotoPath = `uploads/somtop/${req.file.filename}`;
            finalPhotoPath = newPhotoPath;
        }

        // 1. อัปเดตข้อมูลหลัก
        const updateQuery = `
            UPDATE somtop SET 
                title = ?, first_name = ?, last_name = ?, id_card = ?, 
                dob = ?, occupation = ?, join_date = ?, position_id = ?, 
                address = ?, phone = ?, status = ?, note = ?, photo_path = ?
            WHERE id = ?
        `;

        await connection.query(updateQuery, [
            title, first_name, last_name, id_card || null, dob || null, occupation || null, 
            join_date || null, position_id || null, address || null, 
            phone || null, status || 'ใช้งาน', note || null, finalPhotoPath, id
        ]);

        // ⭐️ 2. จัดการประวัติการต่อวาระ (Term History)
        if (term_id) {
            // 2.1 ปรับสถานะวาระอื่นๆ ที่กำลังดำรงตำแหน่งอยู่ (และไม่ใช่รุ่นที่กำลังเลือก) ให้เป็น 'หมดวาระ'
            await connection.query(
                `UPDATE somtop_term_history SET status = 'หมดวาระ' 
                 WHERE somtop_id = ? AND status = 'กำลังดำรงตำแหน่ง' AND term_id != ?`,
                [id, term_id]
            );

            // 2.2 เพิ่มวาระใหม่ หรือถ้ามีประวัติรุ่นนี้อยู่แล้ว ให้อัปเดตสถานะเป็น 'กำลังดำรงตำแหน่ง' (ป้องกัน ER_DUP_ENTRY)
            await connection.query(
                `INSERT INTO somtop_term_history (somtop_id, term_id, status) 
                 VALUES (?, ?, 'กำลังดำรงตำแหน่ง')
                 ON DUPLICATE KEY UPDATE status = 'กำลังดำรงตำแหน่ง'`,
                [id, term_id]
            );
        }

        // ยืนยันการบันทึก
        await connection.commit();

        // เมื่อ Commit สำเร็จ ค่อยลบไฟล์รูปภาพเก่าทิ้ง (ป้องกันไฟล์หายตอน Error)
        if (newPhotoPath && oldPhotoPath) {
            deletePhysicalFile(oldPhotoPath);
        }

        if (typeof logActivity === 'function') {
            logActivity(req, 'อัปเดตข้อมูล', 'จัดการ พ.สมทบ', `อัปเดตข้อมูล ID: ${id}`);
        }

        res.status(200).json({ message: 'อัปเดตข้อมูลสำเร็จ' });
    } catch (error) {
        await connection.rollback(); // ย้อนกลับข้อมูลหากพังกลางคัน
        if (newPhotoPath) deletePhysicalFile(newPhotoPath); // ลบรูปที่เพิ่งอัปโหลดไปทิ้ง

        console.error('Error updating somtop:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'เลขบัตรประชาชนนี้ซ้ำกับบุคคลอื่นในระบบ' });
        }
        res.status(500).json({ message: 'ไม่สามารถอัปเดตข้อมูลได้' });
    } finally {
        connection.release();
    }
};

// ==========================================
// 4. ลบข้อมูล (ฟังก์ชันเดิม ไม่ต้องแก้)
// ==========================================
exports.deleteSomtop = async (req, res) => {
    try {
        const { id } = req.body; // รองรับทั้งจาก req.body และ req.params

        if (!id) return res.status(400).json({ message: `ไม่ได้ระบุ ID ที่ต้องการลบ` });

        const [existing] = await pool.query('SELECT photo_path FROM somtop WHERE id = ?', [id]);
        
        if (existing.length > 0) {
            deletePhysicalFile(existing[0].photo_path);
        }

        await pool.query('DELETE FROM somtop WHERE id = ?', [id]);
        logActivity(req, 'ลบข้อมูล', 'จัดการ พ.สมทบ', `ลบข้อมูล ID: ${id}`);
        res.status(200).json({ message: 'ลบข้อมูลสำเร็จ' });
    } catch (error) {
        console.error('Error deleting somtop:', error);
        res.status(500).json({ message: 'ไม่สามารถลบข้อมูลได้' });
    }
};

// ==========================================
// 4. ดึงประวัติการลา กิจกรรม และวาระการทำงาน (รายบุคคล)
// ==========================================
exports.getSomtopHistory = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. ดึงประวัติการลา
        const queryLeaves = `
            SELECT lr.start_date, lr.end_date, lr.total_days, lr.status, lt.name as leave_type_name 
            FROM leave_requests lr 
            LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id 
            WHERE lr.somtop_id = ? 
            ORDER BY lr.created_at DESC
        `;
        const [leaves] = await pool.query(queryLeaves, [id]);

        // 2. ดึงประวัติกิจกรรม
        const queryEvents = `
            SELECT e.title, e.start_date, e.end_date, ep.status 
            FROM event_participants ep 
            JOIN events e ON ep.event_id = e.id 
            WHERE ep.somtop_id = ? 
            ORDER BY e.start_date DESC
        `;
        const [events] = await pool.query(queryEvents, [id]);

        // ⭐️ 3. เพิ่มการดึงประวัติวาระการทำงาน
        const queryTerms = `
            SELECT 
                sth.id,
                wt.generation_name, 
                wt.start_date, 
                wt.end_date, 
                sth.status, 
                sth.note 
            FROM somtop_term_history sth
            JOIN working_terms wt ON sth.term_id = wt.id
            WHERE sth.somtop_id = ?
            ORDER BY wt.start_date DESC
        `;
        const [terms] = await pool.query(queryTerms, [id]);

        // ส่งข้อมูลทั้ง 3 ส่วนกลับไปให้ Frontend
        res.status(200).json({ leaves, events, terms });
    } catch (error) {
        console.error('Error fetching somtop history:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงประวัติ' });
    }
};