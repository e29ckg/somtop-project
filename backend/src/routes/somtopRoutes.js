const express = require('express');
const router = express.Router();
const somtopController = require('../controllers/somtopController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// ดักจับทุก Route ต้องผ่านการ Verify Token (ต้องล็อกอิน)
router.use(verifyToken);
// และต้องเป็น Admin เท่านั้น ถึงจะจัดการ พ.สมทบ ได้ (หากต้องการให้ Viewer ดูได้อย่างเดียว ให้นำออกแล้วไปใส่เฉพาะ Route POST/PUT/DELETE)
// router.use(verifyAdmin);

// Endpoint: /api/somtop
router.get('/', somtopController.getAllSomtop);

router.post('/', upload.single('photo'), somtopController.createSomtop);

router.put('/', upload.single('photo'), somtopController.updateSomtop);

router.delete('/', somtopController.deleteSomtop);

module.exports = router;