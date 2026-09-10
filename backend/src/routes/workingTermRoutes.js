const express = require('express');
const router = express.Router();

// นำเข้า Controller และ Middleware ต่างๆ
const workingTermController = require('../controllers/workingTermController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');
const uploadTerm = require('../middlewares/uploadTermMiddleware');

// บังคับว่าต้อง Login (มี Token) จึงจะเข้าถึงเส้นทางเหล่านี้ได้
router.use(verifyToken);

// ==========================================
// ⭐️ Endpoints สำหรับจัดการวาระการทำงาน (Base URL: /api/working-terms)
// ==========================================

// 1. ดึงข้อมูลวาระทั้งหมด (อนุญาตให้ User ทั่วไปหรือระบบดึงไปทำ Dropdown ได้)[cite: 9]
router.get('/', workingTermController.getAllTerms);

// 2. เพิ่มข้อมูลวาระการทำงานใหม่ (ต้องเป็น Admin + รองรับแนบไฟล์)
// ⭐️ ใช้ uploadTerm.array('term_files', 10) เพื่อรับไฟล์หลายไฟล์
router.post('/', verifyAdmin, uploadTerm.array('term_files', 10), workingTermController.createWorkingTerm);

// 3. แก้ไขข้อมูลวาระการทำงาน (ต้องเป็น Admin + รองรับแนบไฟล์ใหม่เพิ่ม)
router.put('/:id', verifyAdmin, uploadTerm.array('term_files', 10), workingTermController.updateWorkingTerm);

router.delete('/:id/files', verifyAdmin, workingTermController.deleteTermFile);

// 4. ลบข้อมูลวาระการทำงาน (ต้องเป็น Admin + ลบไฟล์ในเครื่องด้วย)
router.delete('/:id', verifyAdmin, workingTermController.deleteWorkingTerm);

module.exports = router;