const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const uploadTemplate = require('../middlewares/uploadTemplateMiddleware');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

router.use(verifyToken);
// รอรับไฟล์ 1 ไฟล์ ชื่อฟิลด์ 'template_file'
router.post('/upload', verifyAdmin, uploadTemplate.single('template_file'), templateController.uploadTemplate);
router.get('/download', verifyAdmin, templateController.downloadTemplate);
module.exports = router;