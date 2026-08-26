const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { verifyToken } = require('../middlewares/authMiddleware');
const uploadPdf = require('../middlewares/uploadPdfMiddleware');

// ทุก Route ต้องผ่านการเช็ก Token
router.use(verifyToken);

router.get('/', leaveController.getAllLeaves);

// อัปโหลดไฟล์จาก Field ที่ชื่อ 'leave_file' ตามที่ Frontend เคยส่งมา
router.post('/', uploadPdf.single('leave_file'), leaveController.createLeave);

// หาก Frontend ส่ง _method=PUT มาใน FormData เราสามารถใช้ .post() รับแทนได้ หรือใช้ .put() เลยถ้า Frontend รองรับ
router.put('/', uploadPdf.single('leave_file'), leaveController.updateLeave);

// ใน Node.js เราสามารถใช้ POST รับการอัปเดตหาก Frontend ยึดการส่งผ่าน _method=PUT 
// router.post('/update', uploadPdf.single('leave_file'), leaveController.updateLeave);

router.delete('/:id', leaveController.deleteLeave);

module.exports = router;