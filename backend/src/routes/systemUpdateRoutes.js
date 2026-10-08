const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');
const controller = require('../controllers/systemUpdateController');

router.use(verifyToken, verifyAdmin);
router.get('/', controller.getStatus);
router.post('/', controller.startUpdate);

module.exports = router;
