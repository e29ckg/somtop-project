const express = require('express');
const router = express.Router();
const somtopController = require('../controllers/somtopController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// ดักจับทุก Route ต้องผ่านการ Verify Token (ต้องล็อกอิน)
router.use(verifyToken);
// ทั้ง view และ admin อ่านข้อมูลได้ แต่การเพิ่ม แก้ไข และลบต้องเป็น admin

// Endpoint: /api/somtop
router.get('/', somtopController.getAllSomtop);
router.post('/', verifyAdmin, upload.single('photo'), somtopController.createSomtop);
router.put('/', verifyAdmin, upload.single('photo'), somtopController.updateSomtop);
router.delete('/', verifyAdmin, somtopController.deleteSomtop);

router.get('/:id/history', somtopController.getSomtopHistory);
module.exports = router;
