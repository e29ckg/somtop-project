const express = require('express');
const router = express.Router();
const leaveTypeController = require('../controllers/leaveTypeController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

// บังคับ Login ทุกเส้นทางในไฟล์นี้
router.use(verifyToken);

// สำหรับใช้งานทั่วไป (เช่น แสดง Dropdown ตอนยื่นใบลา)
router.get('/', leaveTypeController.getAllActive); 

// สำหรับ Admin
router.get('/admin', verifyAdmin, leaveTypeController.getAllAdmin);
router.post('/admin', verifyAdmin, leaveTypeController.createLeaveType);
router.put('/admin', verifyAdmin, leaveTypeController.updateLeaveType);
router.delete('/admin/:id', verifyAdmin, leaveTypeController.deleteLeaveType);

module.exports = router;