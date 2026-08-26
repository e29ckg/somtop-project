const mysql = require('mysql2/promise');

// สร้าง Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'somtop_db',
    waitForConnections: true,
    connectionLimit: 10, // รองรับการเชื่อมต่อพร้อมกัน 10 connections
    queueLimit: 0
});

// ทดสอบการเชื่อมต่อเมื่อเริ่มต้นเซิร์ฟเวอร์
pool.getConnection()
    .then(connection => {
        console.log('✅ เชื่อมต่อฐานข้อมูล MySQL สำเร็จ');
        connection.release(); // คืน connection กลับเข้า pool
    })
    .catch(err => {
        console.error('❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้:', err.message);
    });

module.exports = pool;