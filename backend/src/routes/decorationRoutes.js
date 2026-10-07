const express = require('express');
const router = express.Router();
const decorationController = require('../controllers/decorationController');
const { verifyToken, verifyAdmin, verifyCentralAdmin } = require('../middlewares/authMiddleware');

// สมมติว่ามี upload middleware ที่ตั้งค่าให้เก็บไฟล์ลงโฟลเดอร์ decorations
const { uploadDecoration } = require('../middlewares/uploadMiddleware'); 

router.use(verifyToken);

// Endpoints สำหรับ Master Data (Dropdown)
router.get('/master', decorationController.getMasterDecorations);

// Endpoints สำหรับผู้ดูแลระบบจัดการ Master Data
router.get('/admin', verifyCentralAdmin, decorationController.getAllAdmin);
router.post('/admin', verifyCentralAdmin, decorationController.createMasterDecoration);
router.put('/admin', verifyCentralAdmin, decorationController.updateMasterDecoration);
router.delete('/admin', verifyCentralAdmin, decorationController.deleteMasterDecoration);

// Endpoints สำหรับประวัติรายบุคคล
router.get('/:somtop_id', decorationController.getSomtopDecorations);
router.post('/', verifyAdmin, uploadDecoration.single('file'), decorationController.addDecoration);
router.put('/:id', verifyAdmin, uploadDecoration.single('file'), decorationController.updateDecoration);
router.delete('/:id', verifyAdmin, decorationController.deleteDecoration);

module.exports = router;
