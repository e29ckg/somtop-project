require('dotenv').config(); // โหลดตัวแปรจากไฟล์ .env (ทำแค่ที่นี่ที่เดียวจบ)
const app = require('./src/app');

// ดึง Port จาก .env ถ้าไม่มีให้ใช้ 8000 เป็นค่าเริ่มต้น
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`🚀 Server is running on ${process.env.HOST || 'http://localhost'}:${PORT}`);
    console.log(`🔌 Accept request from: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});