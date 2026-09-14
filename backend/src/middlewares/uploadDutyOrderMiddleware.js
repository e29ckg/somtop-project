const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(__dirname, '../../uploads/duty-orders');
fs.mkdirSync(uploadDir, { recursive: true, mode: 0o775 });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.pdf`)
});

const fileFilter = (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf'
        && path.extname(file.originalname).toLowerCase() === '.pdf';
    cb(isPdf ? null : new Error('รองรับเฉพาะไฟล์ PDF เท่านั้น'), isPdf);
};

module.exports = multer({
    storage,
    fileFilter,
    limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 5 }
});
