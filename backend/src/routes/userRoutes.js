const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

// นำ Middleware verifyToken และ verifyAdmin มาดักจับทุกๆ Route ในไฟล์นี้
router.use(verifyToken);
router.use(verifyAdmin);

// Endpoints: /api/users
router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);
router.put('/', userController.updateUser);
router.delete('/', userController.deleteUser);

module.exports = router;