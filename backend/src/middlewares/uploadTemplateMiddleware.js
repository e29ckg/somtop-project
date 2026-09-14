const multer = require('multer');
const path = require('path');
const fs = require('fs');

// โฟลเดอร์เก็บเทมเพลต ถอยหลัง 2 ชั้นไปที่ backend/templates/
const uploadDir = path.join(__dirname, '../../templates/');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // ตั้งชื่อไฟล์ชั่วคราวก่อน เดี๋ยวเราจะไปเปลี่ยนชื่อทับไฟล์จริงใน Controller
        const tempName = 'temp_' + Date.now() + '.docx';
        cb(null, tempName); 
    }
});

// กรองเฉพาะไฟล์ Word
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.docx' || ext === '.doc') {
        cb(null, true);
    } else {
        cb(new Error('รองรับเฉพาะไฟล์ Word (.docx, .doc) เท่านั้น'), false);
    }
};

module.exports = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 }
});
