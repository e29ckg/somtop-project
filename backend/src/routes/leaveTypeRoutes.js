const express = require('express');
const router = express.Router();
const leaveTypeController = require('../controllers/leaveTypeController');
const { verifyToken, verifyCentralAdmin } = require('../middlewares/authMiddleware');

// บังคับ Login ทุกเส้นทางในไฟล์นี้
router.use(verifyToken);

// สำหรับใช้งานทั่วไป (เช่น แสดง Dropdown ตอนยื่นใบลา)
router.get('/', leaveTypeController.getAllActive); 

// สำหรับ Admin
router.get('/admin', verifyCentralAdmin, leaveTypeController.getAllAdmin);
router.post('/admin', verifyCentralAdmin, leaveTypeController.createLeaveType);
router.put('/admin', verifyCentralAdmin, leaveTypeController.updateLeaveType);
router.delete('/admin/:id', verifyCentralAdmin, leaveTypeController.deleteLeaveType);

module.exports = router;
