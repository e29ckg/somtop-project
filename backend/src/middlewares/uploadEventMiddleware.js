const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/events/');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o775 });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'event_' + uniqueSuffix + ext); 
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf', 
        'image/jpeg', 'image/png', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'application/vnd.ms-excel', 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('รองรับเฉพาะไฟล์ PDF, ภาพ, Word และ Excel เท่านั้น'), false);
    }
};

module.exports = multer({ storage: storage, fileFilter: fileFilter });