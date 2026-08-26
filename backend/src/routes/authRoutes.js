// backend/src/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ==========================================
// 1. เข้าสู่ระบบ (Login)
// รับ Username/Password ตรวจสอบ และสร้าง HttpOnly Cookie
// ==========================================
// Endpoint ที่ได้: POST /api/auth/login
router.post('/login', authController.login);

// ==========================================
// 2. ออกจากระบบ (Logout)
// สั่งลบ HttpOnly Cookie ทิ้ง
// ==========================================
// Endpoint ที่ได้: POST /api/auth/logout
router.post('/logout', authController.logout);

module.exports = router;