// backend/src/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const loginRateLimit = require('../middlewares/loginRateLimit');
const { verifyToken } = require('../middlewares/authMiddleware');
const authHub = require('../services/authHub');

router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.get('/config', (_req, res) => res.json({
    provider: authHub.enabled() ? 'dual' : 'local',
    providers: authHub.enabled() ? ['local', 'auth-hub'] : ['local']
}));
router.get('/sso/login', (req, res, next) => {
    if (!authHub.enabled()) return res.sendStatus(404);
    try { authHub.start(req, res); } catch (error) { next(error); }
});
router.get('/sso/callback', (req, res, next) => {
    if (!authHub.enabled()) return res.sendStatus(404);
    authHub.callback(req, res).catch(next);
});

// ==========================================
// 1. เข้าสู่ระบบ (Login)
// รับ Username/Password ตรวจสอบ และสร้าง HttpOnly Cookie
// ==========================================
// Endpoint ที่ได้: POST /api/auth/login
router.post('/login', loginRateLimit, authController.login);

// ==========================================
// 2. ออกจากระบบ (Logout)
// สั่งลบ HttpOnly Cookie ทิ้ง
// ==========================================
// Endpoint ที่ได้: POST /api/auth/logout
router.post('/logout', (req, res, next) => {
    if (authHub.enabled() && authHub.hasSessionCookie(req)) return authHub.logout(req, res, next);
    verifyToken(req, res, error => error ? next(error) : authController.logout(req, res, next));
});
router.get('/me', verifyToken, authController.me);

module.exports = router;
