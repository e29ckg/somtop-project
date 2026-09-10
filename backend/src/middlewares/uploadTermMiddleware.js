const multer = require('multer');
const path = require('path');
const fs = require('fs');

// กำหนดโฟลเดอร์ปลายทางสำหรับเก็บไฟล์วาระการทำงาน (ถอยหลัง 2 ชั้นเพื่อชี้ไปที่ uploads/terms/)
const uploadDir = path.join(__dirname, '../../uploads/terms/');

// ตรวจสอบและสร้างโฟลเดอร์หากยังไม่มี
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o775 });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 1. แปลง Encoding ให้รองรับชื่อไฟล์ภาษาไทยที่ส่งมาจาก Frontend[cite: 1]
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        
        // 2. แทนที่ช่องว่างด้วยเครื่องหมาย _ เพื่อป้องกันปัญหา URL พังเวลาเรียกใช้งาน[cite: 1]
        const safeName = originalName.replace(/\s+/g, '_');
        
        // 3. ใช้ Timestamp นำหน้า ตามด้วย _ และชื่อไฟล์ดั้งเดิม[cite: 1]
        // ผลลัพธ์จะได้ชื่อไฟล์เช่น: 1718822920633_คำสั่งแต่งตั้ง.pdf[cite: 1]
        const uniqueName = Date.now() + '_' + safeName;
        
        cb(null, uniqueName);
    }
});

// กรองอนุญาตเฉพาะไฟล์ PDF, รูปภาพ, Word, และ Excel[cite: 3]
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf', 
        'image/jpeg', 'image/png', 
        'application/msword', // .doc[cite: 3]
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx[cite: 3]
        'application/vnd.ms-excel', // .xls[cite: 3]
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx[cite: 3]
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('รองรับเฉพาะไฟล์ PDF, ภาพ, Word และ Excel เท่านั้น'), false);
    }
};

module.exports = multer({ storage: storage, fileFilter: fileFilter });