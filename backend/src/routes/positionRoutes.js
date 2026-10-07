const express = require('express');
const router = express.Router();
const positionController = require('../controllers/positionController');
const { verifyToken, verifyCentralAdmin } = require('../middlewares/authMiddleware');

// บังคับว่าต้อง Login (มี Token)
router.use(verifyToken);

// Endpoint สำหรับดึงไปแสดงใน Dropdown ทั่วไป
router.get('/', positionController.getAllActive);

// Endpoints สำหรับ Admin จัดการตำแหน่ง
router.get('/admin', verifyCentralAdmin, positionController.getAllAdmin);
router.post('/admin', verifyCentralAdmin, positionController.createPosition);
router.put('/admin', verifyCentralAdmin, positionController.updatePosition);
router.delete('/admin/:id', verifyCentralAdmin, positionController.deletePosition);

module.exports = router;
