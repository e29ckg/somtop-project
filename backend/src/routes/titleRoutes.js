const express = require('express');
const router = express.Router();
const titleController = require('../controllers/titleController');
const { verifyToken, verifyCentralAdmin } = require('../middlewares/authMiddleware');

router.use(verifyToken); // บังคับ Login ทุกเส้น

// ⭐️ สำหรับหน้าจอเพิ่ม พ.สมทบ (ดึงเฉพาะที่ใช้งาน)
router.get('/', titleController.getAllTitles);

// ⭐️ สำหรับหน้าจอ Admin 
// (ถ้าจะให้รัดกุม สามารถเขียน Middleware เช็ก Role Admin มาครอบเส้นเหล่านี้ได้ครับ)
router.get('/admin', verifyCentralAdmin, titleController.getAllAdmin);
router.post('/admin', verifyCentralAdmin, titleController.createTitle);
router.put('/admin', verifyCentralAdmin, titleController.updateTitle);
router.delete('/admin', verifyCentralAdmin, titleController.deleteTitle);

module.exports = router;
