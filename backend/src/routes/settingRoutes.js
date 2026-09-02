const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

// บังคับว่าต้อง Login และต้องเป็น Admin เท่านั้น ถึงจะตั้งค่าได้
router.use(verifyToken);
router.use(verifyAdmin);

// Endpoint ย่อยสำหรับ Calendar
router.get('/calendar', settingController.getCalendarSettings);
router.post('/calendar', settingController.saveCalendarSettings);
router.post('/calendar/test', settingController.testCalendarConnection);

router.post('/calendar/service-account', settingController.saveServiceAccountJson);

module.exports = router;