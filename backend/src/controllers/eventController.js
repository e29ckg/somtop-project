const pool = require('../config/db');

// ==========================================
// 1. ดึงข้อมูลปฏิทินกิจกรรมทั้งหมด (ตามศาลของผู้ใช้)
// ==========================================
exports.getAllEvents = async (req, res) => {
    try {
        const courtCode = req.user.court_code; 

        // ⭐️ เพิ่มการ JOIN ตาราง event_types เพื่อดึงชื่อประเภทกิจกรรม (event_type_name) มาแสดงผล
        let query = `
            SELECT 
                e.id, e.event_type_id, et.name AS event_type_name,
                e.title, e.description, e.start_date, e.end_date, 
                e.location, e.status, e.created_by, u.full_name AS creator_name,
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
        
        query += ` ORDER BY e.start_date ASC`;

        const [events] = await pool.query(query, params);
        res.status(200).json({ records: events });
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
// 3. สร้างกิจกรรมใหม่
// ==========================================
exports.createEvent = async (req, res) => {
    const connection = await pool.getConnection(); 
    await connection.beginTransaction();

    try {
        // ⭐️ รับค่า event_type_id เพิ่มเข้ามา
        const { event_type_id, title, description, start_date, end_date, location, status, participants } = req.body;
        const courtCode = req.user.court_code;
        const createdBy = req.user.id; 

        if (!title || !start_date || !end_date || !event_type_id) {
            return res.status(400).json({ message: 'กรุณาระบุข้อมูลจำเป็นให้ครบถ้วน (รวมถึงประเภทกิจกรรม)' });
        }

        // ⭐️ เพิ่ม event_type_id ลงในคำสั่ง INSERT
        const eventQuery = `
            INSERT INTO events (event_type_id, title, description, start_date, end_date, location, court_code, created_by, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [eventResult] = await connection.query(eventQuery, [
            event_type_id, title, description || null, start_date, end_date, location || null, 
            courtCode, createdBy, status || 'รอดำเนินการ'
        ]);
        
        const eventId = eventResult.insertId;

        // เพิ่มรายชื่อผู้เข้าร่วม
        if (participants && Array.isArray(participants) && participants.length > 0) {
            const participantValues = participants.map(somtopId => [eventId, somtopId]);
            const participantQuery = `INSERT INTO event_participants (event_id, somtop_id) VALUES ?`;
            await connection.query(participantQuery, [participantValues]);
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
// 4. แก้ไขข้อมูลกิจกรรม
// ==========================================
exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        // ⭐️ รับค่า event_type_id เพิ่มเข้ามา
        const { event_type_id, title, description, start_date, end_date, location, status } = req.body;

        if (!title || !start_date || !end_date || !event_type_id) {
            return res.status(400).json({ message: 'กรุณาระบุข้อมูลให้ครบถ้วน' });
        }

        // ⭐️ เพิ่ม event_type_id ลงในคำสั่ง UPDATE
        const query = `
            UPDATE events SET 
                event_type_id = ?, title = ?, description = ?, start_date = ?, end_date = ?, location = ?, status = ?
            WHERE id = ?
        `;
        
        await pool.query(query, [
            event_type_id, title, description || null, start_date, end_date, location || null, status || 'รอดำเนินการ', id
        ]);

        res.status(200).json({ message: 'อัปเดตข้อมูลกิจกรรมสำเร็จ' });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ message: 'ไม่สามารถอัปเดตกิจกรรมได้' });
    }
};

// ==========================================
// 5. ลบกิจกรรม
// ==========================================
exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM events WHERE id = ?', [id]);
        res.status(200).json({ message: 'ลบกิจกรรมสำเร็จ' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'ไม่สามารถลบกิจกรรมได้' });
    }
};

// ==========================================
// 6. เพิ่ม/ลด ผู้เข้าร่วม
// ==========================================
exports.manageParticipant = async (req, res) => {
    try {
        const { event_id, somtop_id, action } = req.body; 

        if (!event_id || !somtop_id || !action) return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });

        if (action === 'add') {
            await pool.query('INSERT IGNORE INTO event_participants (event_id, somtop_id) VALUES (?, ?)', [event_id, somtop_id]);
            return res.status(200).json({ message: 'เพิ่มผู้เข้าร่วมสำเร็จ' });
        } else if (action === 'remove') {
            await pool.query('DELETE FROM event_participants WHERE event_id = ? AND somtop_id = ?', [event_id, somtop_id]);
            return res.status(200).json({ message: 'นำผู้เข้าร่วมออกสำเร็จ' });
        }
        
    } catch (error) {
        console.error('Error managing participant:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการจัดการผู้เข้าร่วม' });
    }
};