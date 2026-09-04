const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const { insertEventToGoogleCalendar, updateEventInGoogleCalendar, deleteEventFromGoogleCalendar } = require('../utils/googleCalendar');

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
                (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id) AS participant_count
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
            JOIN somtop s ON ep.somtop_id = s.id
            WHERE ep.event_id = ? 
        `;
        
        const [participants] = await pool.query(query, [id]);
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

        // 3. ⭐️ แปลง String เป็น Array และเพิ่มรายชื่อผู้เข้าร่วม
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

        // 4. ส่งข้อมูลขึ้น Google Calendar
        try {
            const googleEventId = await insertEventToGoogleCalendar({
                title, description, location, start_date, end_date
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
        const { event_type_id, title, description, start_date, end_date, location, status, participants } = req.body;

        if (!title || !start_date || !end_date || !event_type_id) {
            return res.status(400).json({ message: 'กรุณาระบุข้อมูลให้ครบถ้วน' });
        }

        // 1. ดึงข้อมูลเดิมมาตรวจสอบหาไฟล์เก่า ⭐️ และดึง google_event_id เพื่อใช้ซิงค์ปฏิทิน[cite: 2]
        const [existing] = await connection.query('SELECT file_paths, google_event_id FROM events WHERE id = ?', [id]);
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
            WHERE id = ?
        `;
        await connection.query(query, [
            event_type_id, title, description || '', start_date, end_date, 
            location || '', status || 'รอดำเนินการ', filePathsDb, id
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

        // 1. ⭐️ ดึงข้อมูลเพื่อตรวจสอบหาไฟล์แนบ และดึง google_event_id
        const [existing] = await pool.query('SELECT file_paths, google_event_id FROM events WHERE id = ?', [id]);
        
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
        await pool.query('DELETE FROM events WHERE id = ?', [id]);
        
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

        const [existing] = await pool.query('SELECT file_paths FROM events WHERE id = ?', [id]);
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

        await pool.query('UPDATE events SET file_paths = ? WHERE id = ?', [
            JSON.stringify(updatedPaths), id
        ]);

        // ส่งเฉพาะชื่อไฟล์หรือ URL ไปให้ Helper ลบไฟล์ตามที่คุณออกแบบไว้
        deletePhysicalFiles(JSON.stringify([file_url]));

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
        const [eventRows] = await pool.query('SELECT * FROM events WHERE id = ?', [event_id]);
        if (eventRows.length === 0) {
            return res.status(404).json({ message: 'ไม่พบข้อมูลกิจกรรมนี้ในระบบ' });
        }
        
        const event = eventRows[0];
        const googleEventId = event.google_event_id;

        // 2. บันทึก/ลบ ข้อมูลในฐานข้อมูลของเรา
        let successMessage = '';
        if (action === 'add') {
            await pool.query('INSERT IGNORE INTO event_participants (event_id, somtop_id) VALUES (?, ?)', [event_id, somtop_id]);
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