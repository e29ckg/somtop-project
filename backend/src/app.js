//app.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

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

const app = express();
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

// 2. ตั้งค่า Middlewares ระดับแอปพลิเคชัน
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true // ⭐️ จำเป็นมากสำหรับการรับส่ง HttpOnly Cookie
}));
app.use(express.json()); // ให้ Express อ่านข้อมูล JSON จาก Body ได้
app.use(cookieParser()); // ให้ Express อ่านค่าจาก Cookie ได้ง่ายๆ

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

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


app.use('/', (req, res) => {res.json({ message: 'Welcome to Somtop API' });});

// 4. ดักจับ Error กรณีเรียก API ที่ไม่มีอยู่จริง (404 Not Found)
app.use((req, res) => {
    res.status(404).json({ message: 'API Endpoint not found' });
});

module.exports = app;