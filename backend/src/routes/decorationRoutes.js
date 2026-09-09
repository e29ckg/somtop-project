const express = require('express');
const router = express.Router();
const decorationController = require('../controllers/decorationController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

// สมมติว่ามี upload middleware ที่ตั้งค่าให้เก็บไฟล์ลงโฟลเดอร์ decorations
const { uploadDecoration } = require('../middlewares/uploadMiddleware'); 

router.use(verifyToken);

// Endpoints สำหรับ Master Data (Dropdown)
router.get('/master', decorationController.getMasterDecorations);

// Endpoints สำหรับผู้ดูแลระบบจัดการ Master Data
router.get('/admin', verifyAdmin, decorationController.getAllAdmin);
router.post('/admin', verifyAdmin, decorationController.createMasterDecoration);
router.put('/admin', verifyAdmin, decorationController.updateMasterDecoration);
router.delete('/admin', verifyAdmin, decorationController.deleteMasterDecoration);

// Endpoints สำหรับประวัติรายบุคคล
router.get('/:somtop_id', decorationController.getSomtopDecorations);
router.post('/', uploadDecoration.single('file'), decorationController.addDecoration);
router.put('/:id', uploadDecoration.single('file'), decorationController.updateDecoration);
router.delete('/:id', decorationController.deleteDecoration);

module.exports = router;