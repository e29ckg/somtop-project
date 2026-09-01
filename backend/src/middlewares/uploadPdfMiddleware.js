const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/leaves/');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o775 });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 1. แปลง Encoding เพื่อป้องกันปัญหาชื่อไฟล์ภาษาไทยกลายเป็นภาษาต่างดาว
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        
        // 2. แทนที่ช่องว่างด้วยเครื่องหมาย _ เพื่อป้องกันปัญหา URL พัง
        const safeName = originalName.replace(/\s+/g, '_');
        
        // 3. นำ Timestamp (เวลาปัจจุบัน) มาต่อหน้าชื่อไฟล์เดิม ป้องกันผู้ใช้อัปโหลดชื่อไฟล์ซ้ำกัน
        // ผลลัพธ์จะได้ชื่อไฟล์เช่น: 1718822920633_ใบรับรองแพทย์.pdf
        const uniqueName = Date.now() + '_' + safeName;
        
        cb(null, uniqueName);
    }
});

// อนุญาตให้รับ PDF, รูปภาพ, Word, และ Excel
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf', 
        'image/jpeg', 'image/png', 
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('รองรับเฉพาะไฟล์ PDF, ภาพ, Word และ Excel เท่านั้น'), false);
    }
};

module.exports = multer({ storage: storage, fileFilter: fileFilter });