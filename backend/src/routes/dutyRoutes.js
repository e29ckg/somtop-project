const express = require('express');
const router = express.Router();
const dutyController = require('../controllers/dutyController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');
const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(verifyToken);
router.get('/calendar', asyncHandler(dutyController.getCalendar));
router.get('/people', asyncHandler(dutyController.getPeople));
router.get('/orders/:id/print-data', asyncHandler(dutyController.getOrderPrintData));
router.post('/orders', verifyAdmin, asyncHandler(dutyController.createOrder));
router.put('/orders/:id', verifyAdmin, asyncHandler(dutyController.updateOrder));
router.delete('/orders/:id', verifyAdmin, asyncHandler(dutyController.deleteOrder));
router.post('/schedules', verifyAdmin, asyncHandler(dutyController.createSchedule));
router.put('/schedules/:id', verifyAdmin, asyncHandler(dutyController.updateSchedule));
router.delete('/schedules/:id', verifyAdmin, asyncHandler(dutyController.deleteSchedule));
router.post('/swaps', verifyAdmin, asyncHandler(dutyController.createSwap));
router.get('/swaps/:id/export-word', asyncHandler(dutyController.exportSwapWord));

module.exports = router;
