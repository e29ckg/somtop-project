//app.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { verifyToken } = require('./middlewares/authMiddleware');

// 1. นำเข้า Routes ต่างๆ
const authRoutes = require('./routes/authRoutes'); // (เตรียมไว้สำหรับอนาคต)
const userRoutes = require('./routes/userRoutes');
const courtRoutes = require('./routes/courtRoutes');
const somtopRoutes = require('./routes/somtopRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const logRoutes = require('./routes/logRoutes');
const titleRoutes = require('./routes/titleRoutes');
const eventRoutes = require('./routes/eventRoutes');
const eventTypeRoutes = require('./routes/eventTypeRoutes');
const positionRoutes = require('./routes/positionRoutes');
const leaveTypeRoutes = require('./routes/leaveTypeRoutes');
const templateRoutes = require('./routes/templateRoutes');
const settingRoutes = require('./routes/settingRoutes');
const termHistoryRoutes = require('./routes/termHistoryRoutes');
const workingTermRoutes = require('./routes/workingTermRoutes');
const decorationRoutes = require('./routes/decorationRoutes');
const dutyRoutes = require('./routes/dutyRoutes');


const app = express();

// 2. ตั้งค่า Middlewares ระดับแอปพลิเคชัน
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    next();
});
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true // ⭐️ จำเป็นมากสำหรับการรับส่ง HttpOnly Cookie
}));
app.use(cookieParser()); // ให้ Express อ่านค่าจาก Cookie ได้ง่ายๆ
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ไฟล์แนบอาจมีข้อมูลส่วนบุคคล จึงต้องผ่านการยืนยันตัวตนเสมอ
app.use('/uploads', verifyToken, express.static(path.join(__dirname, '../uploads'), {
    dotfiles: 'deny',
    fallthrough: false,
    setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', 'private, no-store');
        if (!/\.(?:jpe?g|png)$/i.test(filePath)) {
            res.setHeader('Content-Disposition', 'attachment');
        }
    }
}));

// 3. ผูก Routes เข้ากับ URL ของระบบ
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/somtop', somtopRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/titles', titleRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/event-types', eventTypeRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/term-history', termHistoryRoutes);
app.use('/api/working-terms', workingTermRoutes);
app.use('/api/decorations', decorationRoutes);
app.use('/api/duties', dutyRoutes);

app.get('/', (req, res) => {res.json({ message: 'Welcome to Somtop API' });});

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT') {
        return res.status(413).json({ message: 'ไฟล์มีขนาดหรือจำนวนเกินกว่าที่ระบบอนุญาต' });
    }
    if (err.status === 404) return res.status(404).json({ message: 'ไม่พบไฟล์' });
    console.error('Request error:', err.message);
    const status = err.name === 'MulterError' ? 400 : (err.status || 500);
    return res.status(status).json({ message: status === 500 ? 'เกิดข้อผิดพลาดบนเซิร์ฟเวอร์' : (err.message || 'คำขอไม่ถูกต้อง') });
});

// 4. ดักจับ Error กรณีเรียก API ที่ไม่มีอยู่จริง (404 Not Found)
app.use((req, res) => {
    res.status(404).json({ message: 'API Endpoint not found' });
});

module.exports = app;
