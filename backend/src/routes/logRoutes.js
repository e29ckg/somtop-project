const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

// บังคับว่าต้อง Login และเป็น Admin เท่านั้นถึงจะดู Log ได้
router.use(verifyToken);
router.use(verifyAdmin);

router.get('/', logController.getAllLogs);

module.exports = router;