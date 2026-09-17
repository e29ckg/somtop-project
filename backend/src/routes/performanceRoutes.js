const express = require('express');
const router = express.Router();
const controller = require('../controllers/performanceController');
const { verifyToken } = require('../middlewares/authMiddleware');
router.use(verifyToken);
router.get('/', controller.getReport);
router.get('/export-word', controller.exportWord);
module.exports = router;
