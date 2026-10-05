const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') }); // รองรับไฟล์เดิมใน backend
if (process.env.APP_ENV) process.env.NODE_ENV = process.env.APP_ENV;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET is required and must contain at least 32 characters');
}
const app = require('./src/app');

// ตั้ง HOST=127.0.0.1 เมื่อให้ Apache เป็นทางเข้า API จากเครือข่าย
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST;

app.listen(PORT, HOST, () => {
    console.log(`🚀 Server is running on ${HOST || 'all interfaces'}:${PORT}`);
    console.log(`🔌 Accept request from: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});
