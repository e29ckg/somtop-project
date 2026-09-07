const express = require('express');
const router = express.Router();
const workingTermController = require('../controllers/workingTermController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

// บังคับว่าต้อง Login (มี Token) จึงจะใช้งานเส้นทางเหล่านี้ได้
router.use(verifyToken);

// ⭐️ Endpoints สำหรับจัดการวาระการทำงาน (Base URL: /api/working-terms)
// อนุญาตให้ User ทั่วไป (หรือระบบ) ดึงข้อมูลไปทำ Dropdown ได้
router.get('/', workingTermController.getAllTerms);

// การเพิ่ม, แก้ไข, ลบ จำกัดสิทธิ์เฉพาะ Admin เท่านั้น
router.post('/', verifyAdmin, workingTermController.createTerm);
router.put('/:id', verifyAdmin, workingTermController.updateTerm);
router.delete('/:id', verifyAdmin, workingTermController.deleteTerm);

module.exports = router;