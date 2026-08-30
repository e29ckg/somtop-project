const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

// บังคับว่าต้อง Login ถึงจะดูและจัดการปฏิทินได้
router.use(verifyToken);

// ==========================================
// Endpoints สำหรับกิจกรรม: /api/events
// ==========================================
router.get('/', eventController.getAllEvents);                         // ดึงกิจกรรมทั้งหมด
router.get('/:id/participants', eventController.getEventParticipants); // ดึงรายชื่อคนเข้าร่วมกิจกรรมนั้นๆ

// (ออปชัน) ถ้าอยากให้แค่ Admin สร้างกิจกรรมได้ ให้เปิดบรรทัดนี้:
// router.use(verifyAdmin); 

const uploadEvent = require('../middlewares/uploadEventMiddleware');

// เปลี่ยนการรับข้อมูลให้รองรับ form-data
router.post('/', uploadEvent.array('event_files', 10), eventController.createEvent);
router.put('/:id', uploadEvent.array('event_files', 10), eventController.updateEvent);

// router.post('/', eventController.createEvent);                         // สร้างกิจกรรม
// router.put('/:id', eventController.updateEvent);                       // แก้ไขกิจกรรม
router.delete('/:id', eventController.deleteEvent);                    // ลบกิจกรรม

// ==========================================
// Endpoints สำหรับจัดการคนเข้าร่วมหลังสร้างกิจกรรมไปแล้ว
// ==========================================
router.post('/participants', eventController.manageParticipant);       // เพิ่มหรือเตะคนออกจากกิจกรรม

module.exports = router;