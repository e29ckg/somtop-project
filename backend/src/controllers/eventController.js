const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const { insertEventToGoogleCalendar, updateEventInGoogleCalendar, deleteEventFromGoogleCalendar } = require('../utils/googleCalendar');
const { logActivity } = require('../utils/logger');

const deletePhysicalFiles = (filePathsJson) => {
    if (!filePathsJson) return;
    try {
        const paths = JSON.parse(filePathsJson);
        paths.forEach(fileUrl => {
            const filename = path.basename(fileUrl);
            const filepath = path.join(__dirname, '../../uploads/events/', filename);
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        });
    } catch (error) {
        console.error('Error deleting files:', error);
    }
};

// ==========================================
// 1. ดึงข้อมูลปฏิทินกิจกรรมทั้งหมด (ตามศาลของผู้ใช้)
// ==========================================
exports.getAllEvents = async (req, res) => {
    try {
        const courtCode = req.user.court_code; 

        let query = `
            SELECT 
                e.id, e.event_type_id, et.name AS event_type_name,
                e.title, e.description, 
                DATE_FORMAT(e.start_date, '%Y-%m-%d %H:%i:%s') AS start_date,
                DATE_FORMAT(e.end_date, '%Y-%m-%d %H:%i:%s') AS end_date,
                e.location, e.status, e.created_by, u.full_name AS creator_name,
                e.file_paths,
                (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.status = 'เข้าร่วม') AS participant_count
            FROM events e
            LEFT JOIN users u ON e.created_by = u.id
            LEFT JOIN event_types et ON e.event_type_id = et.id
        `;
        let params = [];
        
        if (courtCode) {
            query += ` WHERE e.court_code = ?`;
            params.push(courtCode);
        }
        
        query += ` ORDER BY e.start_date ASC LIMIT 100`; // จำกัดผลลัพธ์ไม่เกิน 100 รายการ

        const [events] = await pool.query(query, params);

        // ⭐️ แปลงข้อความ JSON ของไฟล์แนบ ให้เป็น Array ก่อนส่งไป Frontend
        const records = events.map(row => {
            if (row.file_paths) {
                try {
                    let parsedPaths = JSON.parse(row.file_paths);
                    // ป้องกันกรณีแปลงค่าได้แต่ไม่ใช่ Array
                    row.file_paths = Array.isArray(parsedPaths) ? parsedPaths : [row.file_paths];
                } catch (e) {
                    // ถ้าระบบเก่าเซฟเป็น String ไฟล์เดียว ก็จับใส่ Array ให้
                    row.file_paths = [row.file_paths];
                }
            } else {
                row.file_paths = []; // ถ้าไม่มีไฟล์เลย ส่ง Array ว่างไปแทน
            }
            return row;
        });

        res.status(200).json({ records });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรม' });
    }
};

// ==========================================
// 2. ดึงรายชื่อผู้เข้าร่วมของกิจกรรมนั้นๆ
// ==========================================
exports.getEventParticipants = async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT ep.id AS participant_record_id, ep.status, s.id AS somtop_id, 
                   CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name
            FROM event_participants ep
            JOIN events e ON ep.event_id = e.id
            JOIN somtop s ON ep.somtop_id = s.id
            LEFT JOIN somtop_positions sp ON s.position_id = sp.id
            WHERE ep.event_id = ? AND (? IS NULL OR e.court_code = ?)
            ORDER BY sp.level ASC, s.join_date ASC, s.first_name ASC, s.last_name ASC
        `;
        
        const [participants] = await pool.query(query, [id, req.user.court_code, req.user.court_code]);
        res.status(200).json({ records: participants });
    } catch (error) {
        console.error('Error fetching participants:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงรายชื่อผู้เข้าร่วม' });
    }
};

// ==========================================
// 3. สร้างกิจกรรมใหม่ (พร้อมส่งขึ้น Google Calendar และบันทึกผู้เข้าร่วม)
// ==========================================
exports.createEvent = async (req, res) => {
    const connection = await pool.getConnection(); 
    await connection.beginTransaction();

    try {
        const { event_type_id, title, description, start_date, end_date, location, status, participants } = req.body;
        const courtCode = req.user.court_code;
        const createdBy = req.user.id; 

        if (!title || !start_date || !end_date || !event_type_id) {
            return res.status(400).json({ message: 'กรุณาระบุข้อมูลจำเป็นให้ครบถ้วน (รวมถึงประเภทกิจกรรม)' });
        }

        // 1. จัดการไฟล์แนบ
        let filePathsArray = [];
        if (req.files && req.files.length > 0) {
            const protocol = req.secure ? 'https' : 'http';
            const host = req.headers.host;
            filePathsArray = req.files.map(file => `${protocol}://${host}/uploads/events/${file.filename}`);
        }
        const filePathsDb = filePathsArray.length > 0 ? JSON.stringify(filePathsArray) : null;

        // 2. บันทึกกิจกรรมลงฐานข้อมูล
        const eventQuery = `
            INSERT INTO events (event_type_id, title, description, start_date, end_date, location, court_code, created_by, status, file_paths) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [eventResult] = await connection.query(eventQuery, [
            event_type_id, title, description || null, start_date, end_date, location || null, 
            courtCode, createdBy, status || 'รอดำเนินการ', filePathsDb
        ]);
        
        const eventId = eventResult.insertId;

        // 3. แปลง String เป็น Array และเพิ่มรายชื่อผู้เข้าร่วม
        if (participants) {
            try {
                const parsedParticipants = JSON.parse(participants);
                if (Array.isArray(parsedParticipants) && parsedParticipants.length > 0) {
                    const participantValues = parsedParticipants.map(somtopId => [eventId, somtopId]);
                    const participantQuery = `INSERT INTO event_participants (event_id, somtop_id) VALUES ?`;
                    await connection.query(participantQuery, [participantValues]);
                }
            } catch (error) {
                console.error('Error parsing participants:', error);
            }
        }

        // ==========================================
        // ⭐️ 4. เตรียมข้อมูลรายชื่อผู้เข้าร่วมก่อนส่งขึ้น Google Calendar
        // ==========================================
        let finalDescription = description || '';
        
        try {
            // ดึงรายชื่อผู้เข้าร่วมที่เพิ่งบันทึกไป โดยเรียงตามระดับอาวุโสและวันที่เข้ารับตำแหน่ง[cite: 3, 5]
            const [participantRows] = await connection.query(`
                SELECT CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name
                FROM event_participants ep
                JOIN somtop s ON ep.somtop_id = s.id
                LEFT JOIN somtop_positions sp ON s.position_id = sp.id
                WHERE ep.event_id = ?
                ORDER BY 
                    sp.level ASC,
                    s.join_date ASC,
                    s.first_name ASC,
                    s.last_name ASC
            `, [eventId]);

            // ถ้าระบุผู้เข้าร่วม ให้นำรายชื่อมาต่อท้ายรายละเอียดเดิม[cite: 3]
            if (participantRows.length > 0) {
                finalDescription += '\n\nรายชื่อผู้เข้าร่วม:\n';
                participantRows.forEach(p => {
                    finalDescription += `- ${p.full_name}\n`;
                });
            }
        } catch (dbError) {
            console.error('Error fetching participants for Google Calendar:', dbError);
        }

        // 5. ส่งข้อมูลขึ้น Google Calendar
        try {
            const googleEventId = await insertEventToGoogleCalendar({
                title, 
                description: finalDescription, // ⭐️ ใช้ finalDescription ที่รวมรายชื่อแล้ว
                location, 
                start_date, 
                end_date
            });
            
            if (googleEventId) {
                await connection.query(
                    'UPDATE events SET google_event_id = ? WHERE id = ?', 
                    [googleEventId, eventId]
                );
            }
        } catch (googleError) {
            console.error('ไม่สามารถส่งข้อมูลขึ้น Google Calendar ได้:', googleError);
        }

        await connection.commit(); 
        logActivity(req, 'เพิ่มข้อมูล', 'จัดการกิจกรรม', `เพิ่มกิจกรรม: ${title}`);
        res.status(201).json({ message: 'สร้างกิจกรรมสำเร็จ' });

    } catch (error) {
        await connection.rollback(); 
        console.error('Error creating event:', error);
        res.status(500).json({ message: 'ไม่สามารถสร้างกิจกรรมได้' });
    } finally {
        connection.release(); 
    }
};

// ==========================================
// 4. แก้ไขข้อมูลกิจกรรม (เพิ่มไฟล์แนบ, อัปเดตผู้เข้าร่วม และซิงค์ Google Calendar)
// ==========================================
exports.updateEvent = async (req, res) => {
    // ใช้ Transaction เพราะมีการทำงานหลายคำสั่งพร้อมกัน
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const { id } = req.params;
        const courtCode = req.user.court_code;
        const scopeSql = courtCode ? ' AND court_code = ?' : '';
        const scopeParams = courtCode ? [id, courtCode] : [id];
        const { event_type_id, title, description, start_date, end_date, location, status, participants } = req.body;

        if (!title || !start_date || !end_date || !event_type_id) {
            return res.status(400).json({ message: 'กรุณาระบุข้อมูลให้ครบถ้วน' });
        }

        // 1. ดึงข้อมูลเดิมมาตรวจสอบหาไฟล์เก่า ⭐️ และดึง google_event_id เพื่อใช้ซิงค์ปฏิทิน[cite: 2]
        const [existing] = await connection.query(`SELECT file_paths, google_event_id FROM events WHERE id = ?${scopeSql}`, scopeParams);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลกิจกรรม' });
        }

        const googleEventId = existing[0].google_event_id; //[cite: 2]

        // 2. แปลงไฟล์เก่าให้เป็น Array
        let currentPaths = [];
        if (existing[0].file_paths) {
            try {
                currentPaths = JSON.parse(existing[0].file_paths);
                if (!Array.isArray(currentPaths)) currentPaths = [existing[0].file_paths];
            } catch (e) {
                currentPaths = [existing[0].file_paths];
            }
        }

        // 3. นำมารวมกับไฟล์ใหม่ (Append)
        if (req.files && req.files.length > 0) {
            const protocol = req.secure ? 'https' : 'http';
            const host = req.headers.host;
            const newPaths = req.files.map(file => `${protocol}://${host}/uploads/events/${file.filename}`);
            currentPaths = currentPaths.concat(newPaths);
        }
        const filePathsDb = currentPaths.length > 0 ? JSON.stringify(currentPaths) : null;

        // 4. อัปเดตข้อมูลกิจกรรมลงฐานข้อมูล
        const query = `
            UPDATE events SET 
                event_type_id = ?, title = ?, description = ?, start_date = ?, 
                end_date = ?, location = ?, status = ?, file_paths = ?
            WHERE id = ?${scopeSql}
        `;
        await connection.query(query, [
            event_type_id, title, description || '', start_date, end_date, 
            location || '', status || 'รอดำเนินการ', filePathsDb, ...scopeParams
        ]);

        // 5. แปลง String เป็น Array และอัปเดตผู้เข้าร่วม
        if (participants) {
            try {
                const parsedParticipants = JSON.parse(participants);
                
                // ลบรายชื่อผู้เข้าร่วมเดิมออกก่อนทั้งหมด
                await connection.query('DELETE FROM event_participants WHERE event_id = ?', [id]);

                // แทรกรายชื่อใหม่เข้าไป
                if (Array.isArray(parsedParticipants) && parsedParticipants.length > 0) {
                    const participantValues = parsedParticipants.map(somtopId => [id, somtopId]);
                    await connection.query(`INSERT INTO event_participants (event_id, somtop_id) VALUES ?`, [participantValues]);
                }
            } catch (error) {
                console.error('Error parsing participants:', error);
            }
        }

        // ==========================================
        // 6. ⭐️ กระบวนการเตรียมและซิงค์ข้อมูลขึ้น Google Calendar
        // ==========================================
        try {
            // ดึงรายชื่อผู้เข้าร่วมอัปเดตล่าสุดจากฐานข้อมูล โดยเรียงตามอาวุโสและวันที่เข้ารับตำแหน่ง[cite: 2]
            const [participantRows] = await connection.query(`
                SELECT CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name
                FROM event_participants ep
                JOIN somtop s ON ep.somtop_id = s.id
                LEFT JOIN somtop_positions sp ON s.position_id = sp.id
                WHERE ep.event_id = ?
                ORDER BY 
                    sp.level ASC,       
                    s.join_date ASC,    
                    s.first_name ASC,   
                    s.last_name ASC     
            `, [id]);

            // นำรายละเอียดเดิม มาต่อท้ายด้วยรายชื่อผู้เข้าร่วมล่าสุด[cite: 2]
            let finalDescription = description || '';
            if (participantRows.length > 0) {
                finalDescription += '\n\nรายชื่อผู้เข้าร่วม:\n';
                participantRows.forEach(p => {
                    finalDescription += `- ${p.full_name}\n`;
                });
            }

            const eventData = { 
                title, 
                description: finalDescription, 
                start_date, 
                end_date, 
                location 
            };

            // ลอจิกจัดการปฏิทินตามสถานะกิจกรรม[cite: 2]
            if (status === 'ยกเลิก') {
                if (googleEventId) {
                    await deleteEventFromGoogleCalendar(googleEventId); //[cite: 2]
                    await connection.query('UPDATE events SET google_event_id = NULL WHERE id = ?', [id]);
                }
            } else {
                if (googleEventId) {
                    await updateEventInGoogleCalendar(googleEventId, eventData); //[cite: 2]
                } else {
                    const newGoogleEventId = await insertEventToGoogleCalendar(eventData); //[cite: 2]
                    if (newGoogleEventId) {
                        await connection.query('UPDATE events SET google_event_id = ? WHERE id = ?', [newGoogleEventId, id]);
                    }
                }
            }
        } catch (googleError) {
            console.error('ไม่สามารถอัปเดต Google Calendar ได้ (แต่บันทึกลงระบบสำเร็จแล้ว):', googleError); //[cite: 2]
            // ไม่ต้อง throw error ปล่อยผ่านเพื่อให้การทำงานของเว็บไม่สะดุด[cite: 2]
        }

        await connection.commit();
        logActivity(req, 'อัปเดตข้อมูล', 'จัดการกิจกรรม', `อัปเดตกิจกรรม ID: ${id}`);
        res.status(200).json({ message: 'อัปเดตข้อมูลกิจกรรมและผู้เข้าร่วมสำเร็จ' });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating event:', error);
        res.status(500).json({ message: 'ไม่สามารถอัปเดตกิจกรรมได้' });
    } finally {
        connection.release();
    }
};

// ==========================================
// 5. ลบกิจกรรม (ลบไฟล์แนบ + ลบจาก Google Calendar)
// ==========================================
exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const courtCode = req.user.court_code;
        const scopeSql = courtCode ? ' AND court_code = ?' : '';
        const scopeParams = courtCode ? [id, courtCode] : [id];

        // 1. ⭐️ ดึงข้อมูลเพื่อตรวจสอบหาไฟล์แนบ และดึง google_event_id
        const [existing] = await pool.query(`SELECT file_paths, google_event_id FROM events WHERE id = ?${scopeSql}`, scopeParams);
        
        if (existing.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลกิจกรรม' });
        }

        const googleEventId = existing[0].google_event_id;

        // 2. ⭐️ ถ้ามี ID ของ Google Calendar ให้สั่งลบทิ้งด้วย
        if (googleEventId) {
            try {
                await deleteEventFromGoogleCalendar(googleEventId);
            } catch (googleError) {
                console.error('ลบ Google Calendar ไม่สำเร็จ (อาจถูกลบไปแล้ว):', googleError);
                // ปล่อยผ่าน (ไม่ Throw Error) เพื่อให้ระบบลบข้อมูลใน Database ต่อไปได้
            }
        }

        // 3. ถ้ามีไฟล์แนบ ให้เรียกใช้ฟังก์ชันลบไฟล์ออกจากเซิร์ฟเวอร์
        if (existing[0].file_paths) {
            deletePhysicalFiles(existing[0].file_paths);
        }

        // 4. ลบข้อมูลกิจกรรมออกจากฐานข้อมูล
        await pool.query(`DELETE FROM events WHERE id = ?${scopeSql}`, scopeParams);
        logActivity(req, 'ลบข้อมูล', 'จัดการกิจกรรม', `ลบกิจกรรม ID: ${id}`);
        res.status(200).json({ message: 'ลบกิจกรรมและไฟล์แนบสำเร็จ' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'ไม่สามารถลบกิจกรรมได้' });
    }
};

// ==========================================
// 6. ลบไฟล์แนบ (ทีละไฟล์)
// ==========================================
exports.deleteSingleFile = async (req, res) => {
    try {
        const { id, file_url } = req.body;

        if (!id || !file_url) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
        }

        const courtCode = req.user.court_code;
        const scopeSql = courtCode ? ' AND court_code = ?' : '';
        const scopeParams = courtCode ? [id, courtCode] : [id];
        const [existing] = await pool.query(`SELECT file_paths FROM events WHERE id = ?${scopeSql}`, scopeParams);
        if (existing.length === 0 || !existing[0].file_paths) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลไฟล์' });
        }

        let pathsArray = JSON.parse(existing[0].file_paths);

        // ⭐️ 1. ดึงเฉพาะชื่อไฟล์เป้าหมายออกมา (เช่น event_1234.pdf)
        const targetFilename = file_url.split('/').pop();

        // ⭐️ 2. กรองข้อมูลโดยเทียบเฉพาะชื่อไฟล์ส่วนท้าย
        const updatedPaths = pathsArray.filter(url => {
            const currentFilename = url.split('/').pop();
            return currentFilename !== targetFilename;
        });

        await pool.query(`UPDATE events SET file_paths = ? WHERE id = ?${scopeSql}`, [
            JSON.stringify(updatedPaths), ...scopeParams
        ]);

        // ส่งเฉพาะชื่อไฟล์หรือ URL ไปให้ Helper ลบไฟล์ตามที่คุณออกแบบไว้
        deletePhysicalFiles(JSON.stringify([file_url]));

        logActivity(req, 'ลบไฟล์', 'จัดการกิจกรรม', `ลบไฟล์แนบจากกิจกรรม ID: ${id}`);
        res.status(200).json({ message: 'ลบไฟล์สำเร็จ' });
    } catch (error) {
        console.error('Error deleting single file:', error);
        res.status(500).json({ message: 'ไม่สามารถลบไฟล์ได้' });
    }
};

// ==========================================
// 6. เพิ่ม/ลด ผู้เข้าร่วม (พร้อมซิงค์ Google Calendar)
// ==========================================
exports.manageParticipant = async (req, res) => {
    try {
        const { event_id, somtop_id, action } = req.body; 

        if (!event_id || !somtop_id || !action) {
            return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
        }

        // 1. ตรวจสอบก่อนว่ามีกิจกรรมนี้อยู่ในระบบหรือไม่
        const [eventRows] = await pool.query(
            'SELECT * FROM events WHERE id = ? AND (? IS NULL OR court_code = ?)',
            [event_id, req.user.court_code, req.user.court_code]
        );
        if (eventRows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลกิจกรรมนี้ในระบบ' });
        }
        
        const event = eventRows[0];
        const googleEventId = event.google_event_id;

        // 2. บันทึก/ลบ ข้อมูลในฐานข้อมูลของเรา
        let successMessage = '';
        if (action === 'add') {
            await pool.query("INSERT IGNORE INTO event_participants (event_id, somtop_id, status) VALUES (?, ?, 'เข้าร่วม')", [event_id, somtop_id]);
            successMessage = 'เพิ่มผู้เข้าร่วมสำเร็จ';
        } else if (action === 'remove') {
            await pool.query('DELETE FROM event_participants WHERE event_id = ? AND somtop_id = ?', [event_id, somtop_id]);
            successMessage = 'นำผู้เข้าร่วมออกสำเร็จ';
        } else {
            return res.status(400).json({ message: 'รูปแบบ action ไม่ถูกต้อง' });
        }

        // ==========================================
        // 3. กระบวนการเตรียมข้อมูลส่งขึ้น Google Calendar
        // ==========================================
        
        // ดึงรายชื่อผู้เข้าร่วมอัปเดตล่าสุดจากฐานข้อมูล โดยเรียงตามอาวุโส
        const [participantRows] = await pool.query(`
            SELECT CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name
            FROM event_participants ep
            JOIN somtop s ON ep.somtop_id = s.id
            LEFT JOIN somtop_positions sp ON s.position_id = sp.id
            WHERE ep.event_id = ?
            ORDER BY 
                sp.level ASC,       -- 1. เรียงตามระดับอาวุโสของตำแหน่ง (เลขน้อยขึ้นก่อน)
                s.join_date ASC,    -- 2. เรียงตามวันที่เข้ารับตำแหน่ง
                s.first_name ASC,   -- 3. เรียงตามตัวอักษรชื่อ
                s.last_name ASC     -- 4. เรียงตามตัวอักษรนามสกุล
        `, [event_id]);

        // นำรายละเอียดเดิม มาต่อท้ายด้วยรายชื่อผู้เข้าร่วมล่าสุด
        let finalDescription = event.description || '';
        if (participantRows.length > 0) {
            finalDescription += '\n\nรายชื่อผู้เข้าร่วม:\n';
            participantRows.forEach(p => {
                finalDescription += `- ${p.full_name}\n`;
            });
        }

        const eventData = { 
            title: event.title, 
            description: finalDescription, 
            start_date: event.start_date, 
            end_date: event.end_date, 
            location: event.location 
        };

        // 4. ซิงค์ข้อมูลขึ้น Google Calendar
        try {
            if (event.status === 'ยกเลิก') {
                if (googleEventId) {
                    await deleteEventFromGoogleCalendar(googleEventId);
                    await pool.query('UPDATE events SET google_event_id = NULL WHERE id = ?', [event_id]);
                }
            } else {
                if (googleEventId) {
                    await updateEventInGoogleCalendar(googleEventId, eventData);
                } else {
                    const newGoogleEventId = await insertEventToGoogleCalendar(eventData);
                    if (newGoogleEventId) {
                        await pool.query('UPDATE events SET google_event_id = ? WHERE id = ?', [newGoogleEventId, event_id]);
                    }
                }
            }
        } catch (googleError) {
            console.error('ไม่สามารถซิงค์การเปลี่ยนแปลงผู้เข้าร่วมขึ้น Google Calendar ได้:', googleError);
        }

        // 5. ส่งผลลัพธ์กลับไปที่หน้าเว็บ
        return res.status(200).json({ message: successMessage });
        
    } catch (error) {
        console.error('Error managing participant:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการจัดการผู้เข้าร่วม' });
    }
};

// === 1. อัปเดตสถานะผู้เข้าร่วม ===
exports.updateParticipantStatus = async (req, res) => {
    try {
        const { event_id, somtop_id, status } = req.body;
        if (!['เข้าร่วม', 'ลา', 'ไม่เข้าร่วม'].includes(status)) {
            return res.status(400).json({ message: 'สถานะผู้เข้าร่วมไม่ถูกต้อง' });
        }
        await pool.query(
            `UPDATE event_participants ep
             JOIN events e ON ep.event_id = e.id
             SET ep.status = ?
             WHERE ep.event_id = ? AND ep.somtop_id = ? AND (? IS NULL OR e.court_code = ?)`,
            [status, event_id, somtop_id, req.user.court_code, req.user.court_code]
        );
        logActivity(req, 'อัปเดตข้อมูล', 'ผู้เข้าร่วมกิจกรรม', `อัปเดตสถานะผู้เข้าร่วม กิจกรรม ID: ${event_id}, พ.สมทบ ID: ${somtop_id}`);
        res.status(200).json({ message: 'อัปเดตสถานะสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' });
    }
};

// === 2. พิมพ์ใบลาการประชุม ===
exports.exportMeetingLeaveToWord = async (req, res) => {
    try {
        const { event_id, somtop_id } = req.params;

        // ดึงข้อมูลกิจกรรมและผู้ลา
        const query = `
            SELECT 
                e.title as event_title, e.start_date, e.end_date, e.location,
                CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name,
                c.court_name, c.chief_judge_name, c.chief_judge_position,
                c.director_name, c.director_position
            FROM event_participants ep
            JOIN events e ON ep.event_id = e.id
            JOIN somtop s ON ep.somtop_id = s.id
            LEFT JOIN courts c ON e.court_code = c.court_code
            WHERE ep.event_id = ? AND ep.somtop_id = ?
              AND (? IS NULL OR e.court_code = ?)
        `;
        const [rows] = await pool.query(query, [event_id, somtop_id, req.user.court_code, req.user.court_code]);

        if (rows.length === 0) return res.status(404).json({ message: 'ไม่พบข้อมูล' });
        
        const data = rows[0];
        
        // ใช้ template ประชุมเมื่อมีไฟล์ หากถูกลบหรือยังไม่อัปโหลดให้ใช้ template ทั่วไปแทน
        const meetingTemplatePath = path.resolve(__dirname, '../../templates/leave_template_meeting.docx');
        const fallbackTemplatePath = path.resolve(__dirname, '../../templates/leave_template.docx');
        const templatePath = fs.existsSync(meetingTemplatePath) ? meetingTemplatePath : fallbackTemplatePath;
        const content = fs.readFileSync(templatePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

        const formatThaiDate = (dateString) => {
            if (!dateString) return '-';
            const d = new Date(dateString);
            const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
        };

        const formatThaiMonthYear = (dateString) => {
            if (!dateString) return '-';
            const d = new Date(dateString);
            const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
            return `${months[d.getMonth()]} ${d.getFullYear() + 543}`;
        };

        const formatTime = (dateString) => {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        };

        const eventMonthYear = formatThaiMonthYear(data.start_date);
        const eventTime = formatTime(data.start_date);

        doc.render({
            full_name: data.full_name,
            leave_type_name: 'ลาประชุม',
            event_title: data.event_title,
            start_date: formatThaiDate(data.start_date),
            end_date: formatThaiDate(data.end_date || data.start_date),
            total_days: 1,
            note: `${data.event_title}${data.location ? ` ณ ${data.location}` : ''}`,
            location: data.location || '-',
            event_location: data.location || '-',
            month_year: eventMonthYear,
            event_month_year: eventMonthYear,
            month: eventMonthYear.split(' ')[0],
            year: eventMonthYear.split(' ')[1],
            event_month: eventMonthYear.split(' ')[0],
            event_year: eventMonthYear.split(' ')[1],
            time: eventTime,
            event_time: eventTime,
            court_name: data.court_name || '-',
            chief_judge_name: data.chief_judge_name || '-',
            chief_judge_position: data.chief_judge_position || '-',
            director_name: data.director_name || '-',
            director_position: data.director_position || '-',
            start_time: eventTime,
            dob: '-',
            join_date: '-',
            current_day: new Date().getDate(),
            current_month: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'][new Date().getMonth()],
            current_year: new Date().getFullYear() + 543
        });

        const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        const outputFilename = `ใบลาประชุม_${data.full_name.replace(/\s+/g, '_')}.docx`;
        
        res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(outputFilename)}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buf);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'สร้างไฟล์ใบลาประชุมไม่สำเร็จ' });
    }
};

// ==========================================
// รายงานสรุปการเข้าร่วมกิจกรรม แยกตามปีและประเภท
// ==========================================
exports.getParticipationReport = async (req, res) => {
    try {
        const courtCode = req.user.court_code;
        const { year, event_type_id: eventTypeId, somtop_id: somtopId } = req.query;

        if (year && !/^\d{4}$/.test(String(year))) {
            return res.status(400).json({ message: 'รูปแบบปีไม่ถูกต้อง' });
        }
        if (eventTypeId && (!/^\d+$/.test(String(eventTypeId)) || Number(eventTypeId) < 1)) {
            return res.status(400).json({ message: 'ประเภทกิจกรรมไม่ถูกต้อง' });
        }
        if (somtopId && (!/^\d+$/.test(String(somtopId)) || Number(somtopId) < 1)) {
            return res.status(400).json({ message: 'รายชื่อบุคคลไม่ถูกต้อง' });
        }

        const filters = ["e.status <> 'ยกเลิก'"];
        const params = [];
        if (courtCode) {
            filters.push('e.court_code = ?');
            params.push(courtCode);
        }
        if (year) {
            filters.push('e.start_date >= ? AND e.start_date < ?');
            params.push(`${year}-04-01`, `${Number(year) + 1}-04-01`);
        }
        if (eventTypeId) {
            filters.push('e.event_type_id = ?');
            params.push(Number(eventTypeId));
        }
        if (somtopId) {
            filters.push('ep.somtop_id = ?');
            params.push(Number(somtopId));
        }

        const whereSql = `WHERE ${filters.join(' AND ')}`;
        const [rows] = await pool.query(`
            SELECT
                COALESCE(et.id, 0) AS event_type_id,
                COALESCE(et.name, 'ไม่ระบุประเภท') AS event_type_name,
                COUNT(DISTINCT e.id) AS event_count,
                COUNT(ep.id) AS participant_count,
                SUM(CASE WHEN ep.status = 'เข้าร่วม' THEN 1 ELSE 0 END) AS attended_count,
                SUM(CASE WHEN ep.status = 'ลาประชุม' THEN 1 ELSE 0 END) AS leave_count,
                SUM(CASE WHEN ep.status = 'ไม่เข้าร่วม' THEN 1 ELSE 0 END) AS absent_count,
                SUM(CASE WHEN ep.status = 'รอตอบรับ' THEN 1 ELSE 0 END) AS pending_count
            FROM events e
            LEFT JOIN event_types et ON e.event_type_id = et.id
            LEFT JOIN event_participants ep ON ep.event_id = e.id
            ${whereSql}
            GROUP BY et.id, et.name
            ORDER BY event_count DESC, event_type_name ASC
        `, params);

        const [yearRows] = await pool.query(`
            SELECT DISTINCT YEAR(DATE_SUB(start_date, INTERVAL 3 MONTH)) AS year
            FROM events
            WHERE status <> 'ยกเลิก' AND (? IS NULL OR court_code = ?)
            ORDER BY year DESC
        `, [courtCode, courtCode]);
        const [typeRows] = await pool.query(`
            SELECT DISTINCT et.id, et.name
            FROM event_types et
            JOIN events e ON e.event_type_id = et.id
            WHERE e.status <> 'ยกเลิก' AND (? IS NULL OR e.court_code = ?)
            ORDER BY et.name ASC
        `, [courtCode, courtCode]);
        const [personRows] = await pool.query(`
            SELECT s.id, CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name
            FROM somtop s
            LEFT JOIN somtop_positions sp ON s.position_id = sp.id
            WHERE (? IS NULL OR s.court_code = ?)
            ORDER BY COALESCE(sp.level, 999999) ASC, s.first_name ASC, s.last_name ASC
        `, [courtCode, courtCode]);

        const [matrixEventRows] = await pool.query(`
            SELECT DISTINCT e.id, e.title,
                DATE_FORMAT(e.start_date, '%Y-%m-%d') AS event_date,
                COALESCE(et.name, 'ไม่ระบุประเภท') AS event_type_name
            FROM events e
            LEFT JOIN event_types et ON e.event_type_id = et.id
            LEFT JOIN event_participants ep ON ep.event_id = e.id
            ${whereSql}
            ORDER BY e.start_date ASC, e.id ASC
        `, params);
        const [matrixParticipantRows] = await pool.query(`
            SELECT ep.event_id, ep.somtop_id, ep.status,
                CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name
            FROM event_participants ep
            JOIN events e ON ep.event_id = e.id
            JOIN somtop s ON ep.somtop_id = s.id
            LEFT JOIN somtop_positions sp ON s.position_id = sp.id
            ${whereSql}
            ORDER BY COALESCE(sp.level, 999999) ASC, s.first_name ASC, s.last_name ASC
        `, params);

        const records = rows.map(row => {
            const participantCount = Number(row.participant_count) || 0;
            const attendedCount = Number(row.attended_count) || 0;
            return {
                ...row,
                event_count: Number(row.event_count) || 0,
                participant_count: participantCount,
                attended_count: attendedCount,
                leave_count: Number(row.leave_count) || 0,
                absent_count: Number(row.absent_count) || 0,
                pending_count: Number(row.pending_count) || 0,
                attendance_rate: participantCount > 0
                    ? Number(((attendedCount / participantCount) * 100).toFixed(1))
                    : 0
            };
        });

        const summary = records.reduce((total, row) => {
            total.event_count += row.event_count;
            total.participant_count += row.participant_count;
            total.attended_count += row.attended_count;
            total.leave_count += row.leave_count;
            total.absent_count += row.absent_count;
            total.pending_count += row.pending_count;
            return total;
        }, { event_count: 0, participant_count: 0, attended_count: 0, leave_count: 0, absent_count: 0, pending_count: 0 });
        summary.attendance_rate = summary.participant_count > 0
            ? Number(((summary.attended_count / summary.participant_count) * 100).toFixed(1))
            : 0;

        const matrixPeople = new Map();
        matrixParticipantRows.forEach(item => {
            if (!matrixPeople.has(item.somtop_id)) {
                matrixPeople.set(item.somtop_id, {
                    somtop_id: item.somtop_id,
                    full_name: item.full_name,
                    statuses: {}
                });
            }
            matrixPeople.get(item.somtop_id).statuses[item.event_id] = item.status;
        });

        res.status(200).json({
            summary,
            records,
            matrix: {
                events: matrixEventRows,
                people: Array.from(matrixPeople.values())
            },
            filters: {
                years: yearRows.map(item => item.year),
                event_types: typeRows,
                people: personRows
            }
        });
    } catch (error) {
        console.error('Error generating participation report:', error);
        res.status(500).json({ message: 'ไม่สามารถสร้างรายงานการเข้าร่วมกิจกรรมได้' });
    }
};

exports.exportParticipationExcel = async (req, res) => {
    try {
        const courtCode = req.user.court_code;
        const { year, event_type_id: eventTypeId, somtop_id: somtopId } = req.query;
        if (year && !/^\d{4}$/.test(String(year))) return res.status(400).json({ message: 'รูปแบบปีไม่ถูกต้อง' });
        if (eventTypeId && (!/^\d+$/.test(String(eventTypeId)) || Number(eventTypeId) < 1)) return res.status(400).json({ message: 'ประเภทกิจกรรมไม่ถูกต้อง' });
        if (somtopId && (!/^\d+$/.test(String(somtopId)) || Number(somtopId) < 1)) return res.status(400).json({ message: 'รายชื่อบุคคลไม่ถูกต้อง' });

        const filters = ["e.status <> 'ยกเลิก'"];
        const params = [];
        if (courtCode) { filters.push('e.court_code = ?'); params.push(courtCode); }
        if (year) {
            filters.push('e.start_date >= ? AND e.start_date < ?');
            params.push(`${year}-04-01`, `${Number(year) + 1}-04-01`);
        }
        if (eventTypeId) { filters.push('e.event_type_id = ?'); params.push(Number(eventTypeId)); }
        if (somtopId) { filters.push('ep.somtop_id = ?'); params.push(Number(somtopId)); }
        const whereSql = `WHERE ${filters.join(' AND ')}`;

        const [events] = await pool.query(`
            SELECT DISTINCT e.id, e.title, DATE_FORMAT(e.start_date, '%Y-%m-%d') AS event_date,
                COALESCE(et.name, 'ไม่ระบุประเภท') AS event_type_name
            FROM events e
            LEFT JOIN event_types et ON e.event_type_id = et.id
            LEFT JOIN event_participants ep ON ep.event_id = e.id
            ${whereSql}
            ORDER BY e.start_date, e.id
        `, params);
        const [participants] = await pool.query(`
            SELECT ep.event_id, ep.somtop_id, ep.status,
                CONCAT(s.title, s.first_name, ' ', s.last_name) AS full_name
            FROM event_participants ep
            JOIN events e ON ep.event_id = e.id
            JOIN somtop s ON ep.somtop_id = s.id
            LEFT JOIN somtop_positions sp ON s.position_id = sp.id
            ${whereSql}
            ORDER BY COALESCE(sp.level, 999999) ASC, s.first_name ASC, s.last_name ASC
        `, params);

        const people = new Map();
        participants.forEach((item) => {
            if (!people.has(item.somtop_id)) people.set(item.somtop_id, { full_name: item.full_name, statuses: {} });
            people.get(item.somtop_id).statuses[item.event_id] = item.status;
        });

        let typeLabel = 'ทุกประเภทกิจกรรม';
        if (eventTypeId) {
            const [[type]] = await pool.query('SELECT name FROM event_types WHERE id = ?', [eventTypeId]);
            typeLabel = type?.name || 'ไม่ระบุประเภท';
        }
        let personLabel = 'ทุกคน';
        if (somtopId) {
            const [[person]] = await pool.query(
                "SELECT CONCAT(title, first_name, ' ', last_name) AS full_name FROM somtop WHERE id = ? AND (? IS NULL OR court_code = ?)",
                [somtopId, courtCode, courtCode]
            );
            personLabel = person?.full_name || 'ไม่พบรายชื่อ';
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'ระบบบริหารข้อมูลผู้พิพากษาสมทบ';
        workbook.created = new Date();
        const sheet = workbook.addWorksheet('รายละเอียดรายบุคคล', {
            views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }],
            properties: { defaultRowHeight: 22 }
        });
        const lastColumn = Math.max(events.length + 2, 3);
        sheet.mergeCells(1, 1, 1, lastColumn);
        sheet.getCell(1, 1).value = 'รายละเอียดการเข้าร่วมกิจกรรมรายบุคคล';
        sheet.getCell(1, 1).font = { name: 'Aptos', size: 16, bold: true, color: { argb: 'FF1F2937' } };
        sheet.getCell(1, 1).alignment = { horizontal: 'left', vertical: 'middle' };
        sheet.getRow(1).height = 28;
        sheet.mergeCells(2, 1, 2, lastColumn);
        sheet.getCell(2, 1).value = `${year ? `รอบปี ${Number(year) + 543} (1 เม.ย. ${Number(year) + 543} - 31 มี.ค. ${Number(year) + 544})` : 'ทุกรอบปี'} | ${typeLabel} | ${personLabel}`;
        sheet.getCell(2, 1).font = { name: 'Aptos', size: 10, italic: true, color: { argb: 'FF64748B' } };
        sheet.mergeCells(3, 1, 3, lastColumn);
        sheet.getCell(3, 1).value = `จัดทำเมื่อ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;
        sheet.getCell(3, 1).font = { name: 'Aptos', size: 9, color: { argb: 'FF64748B' } };

        const formatThaiShortDate = (dateValue) => {
            if (!dateValue) return '-';
            const [yearPart, monthPart, dayPart] = String(dateValue).slice(0, 10).split('-').map(Number);
            const shortMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            if (!yearPart || !monthPart || !dayPart || !shortMonths[monthPart - 1]) return String(dateValue);
            return `${dayPart} ${shortMonths[monthPart - 1]} ${yearPart + 543}`;
        };

        const headerRow = sheet.getRow(5);
        headerRow.values = ['รายชื่อ', ...events.map(event => `${event.title}\n${formatThaiShortDate(event.event_date)}\n${event.event_type_name}`), 'รวมเข้าร่วม'];
        headerRow.height = 58;
        headerRow.eachCell((cell) => {
            cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFD9E2F3' } } };
        });
        sheet.getColumn(1).width = 32;
        events.forEach((_, index) => { sheet.getColumn(index + 2).width = 24; });
        sheet.getColumn(lastColumn).width = 14;

        const statusStyles = {
            'เข้าร่วม': { fill: 'FFDCFCE7', font: 'FF166534' },
            'ลาประชุม': { fill: 'FFFEF3C7', font: 'FF92400E' },
            'ไม่เข้าร่วม': { fill: 'FFFEE2E2', font: 'FF991B1B' },
            'รอตอบรับ': { fill: 'FFE2E8F0', font: 'FF475569' }
        };
        Array.from(people.values()).forEach((person, personIndex) => {
            const attendedTotal = events.reduce((total, event) => total + (person.statuses[event.id] === 'เข้าร่วม' ? 1 : 0), 0);
            const row = sheet.addRow([person.full_name, ...events.map(event => person.statuses[event.id] || '—'), attendedTotal]);
            row.height = 24;
            row.getCell(1).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF1F2937' } };
            row.getCell(1).alignment = { vertical: 'middle' };
            row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: personIndex % 2 ? 'FFF8FAFC' : 'FFFFFFFF' } };
            for (let column = 2; column <= lastColumn; column += 1) {
                const cell = row.getCell(column);
                const style = statusStyles[cell.value];
                cell.font = { name: 'Aptos', size: 10, bold: Boolean(style), color: { argb: style?.font || 'FFCBD5E1' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style?.fill || (personIndex % 2 ? 'FFF8FAFC' : 'FFFFFFFF') } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            row.getCell(lastColumn).font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF166534' } };
            row.getCell(lastColumn).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
            row.eachCell(cell => {
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
            });
        });
        if (!people.size) {
            sheet.mergeCells(6, 1, 6, lastColumn);
            sheet.getCell(6, 1).value = 'ไม่พบรายละเอียดการเข้าร่วมตามเงื่อนไขที่เลือก';
            sheet.getCell(6, 1).alignment = { horizontal: 'center' };
            sheet.getCell(6, 1).font = { name: 'Aptos', size: 10, italic: true, color: { argb: 'FF64748B' } };
        }
        sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: lastColumn } };
        sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `รายงานการเข้าร่วมรายบุคคล_รอบปี_${year ? Number(year) + 543 : 'ทั้งหมด'}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.send(Buffer.from(buffer));
    } catch (error) {
        console.error('Error exporting participation Excel:', error);
        res.status(500).json({ message: 'ไม่สามารถสร้างรายงาน Excel ได้' });
    }
};
