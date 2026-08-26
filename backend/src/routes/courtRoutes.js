const express = require('express');
const router = express.Router();
const courtController = require('../controllers/courtController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

// ดักจับทุก Route ว่าต้อง Login และเป็น Admin เท่านั้น
router.use(verifyToken);
router.use(verifyAdmin);

// Endpoints: /api/courts
router.get('/', courtController.getAllCourts);
router.post('/', courtController.createCourt);
router.put('/', courtController.updateCourt);
router.delete('/:id', courtController.deleteCourt);

module.exports = router;