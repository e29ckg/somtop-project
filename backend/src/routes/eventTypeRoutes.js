const express = require('express');
const router = express.Router();
const eventTypeController = require('../controllers/eventTypeController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

// บังคับว่าต้อง Login (มี Token) ถึงจะดึงข้อมูลนี้ได้
router.use(verifyToken);

// บังคับว่าต้องเป็น Admin ถึงจะสามารถเข้าถึง Endpoint นี้ได้
router.use('/admin', verifyAdmin);

// Endpoint ที่จะได้คือ: GET /api/event-types
router.get('/', eventTypeController.getAllEventTypes);

// Admin endpoints
router.get('/admin', eventTypeController.getAllAdmin);
router.post('/admin', eventTypeController.createEventType);
router.put('/admin', eventTypeController.updateEventType);
router.delete('/admin/:id', eventTypeController.deleteEventType);

module.exports = router;