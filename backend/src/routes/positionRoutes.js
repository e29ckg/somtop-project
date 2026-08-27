const express = require('express');
const router = express.Router();
const positionController = require('../controllers/positionController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

// บังคับว่าต้อง Login (มี Token)
router.use(verifyToken);

// Endpoint สำหรับดึงไปแสดงใน Dropdown ทั่วไป
router.get('/', positionController.getAllActive);

// Endpoints สำหรับ Admin จัดการตำแหน่ง
router.get('/admin', verifyAdmin, positionController.getAllAdmin);
router.post('/admin', verifyAdmin, positionController.createPosition);
router.put('/admin', verifyAdmin, positionController.updatePosition);
router.delete('/admin/:id', verifyAdmin, positionController.deletePosition);

module.exports = router;