const express = require('express');
const router = express.Router();
const termHistoryController = require('../controllers/termHistoryController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// สำหรับ Admin ในการจัดการประวัติ
router.post('/', verifyAdmin, termHistoryController.addTermHistory);
router.delete('/:id', verifyAdmin, termHistoryController.deleteTermHistory);

// ดึงประวัติแยกตามรายบุคคล
router.get('/somtop/:somtop_id', termHistoryController.getHistoryBySomtop);

module.exports = router;