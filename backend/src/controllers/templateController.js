const fs = require('fs');
const path = require('path');
const { logActivity } = require('../utils/logger');

const ALLOWED_TEMPLATE_TYPES = new Set([
    'leave_template_sick',
    'leave_template_personal',
    'leave_template_vacation',
    'leave_template_abroad',
    'leave_template_meeting',
    'leave_template',
    'duty_swap_template',
    'duty_order_template'
    , 'performance_evaluation_template'
]);

const isAllowedTemplateType = (templateType) => (
    typeof templateType === 'string' && ALLOWED_TEMPLATE_TYPES.has(templateType)
);

const removeUploadedFile = (file) => {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
};

exports.uploadTemplate = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'กรุณาเลือกไฟล์เทมเพลต' });
        }

        const templateType = req.body.template_type; // เช่น 'leave_template'
        if (!isAllowedTemplateType(templateType)) {
            removeUploadedFile(req.file);
            return res.status(400).json({ message: 'ประเภทแบบฟอร์มไม่ถูกต้อง' });
        }

        // กำหนดที่อยู่ไฟล์จริงที่ต้องการเซฟทับ (เช่น backend/templates/leave_template.docx)
        const finalPath = path.join(__dirname, '../../templates/', templateType + '.docx');

        // ย้ายและเปลี่ยนชื่อไฟล์ชั่วคราว ไปทับไฟล์เทมเพลตเดิม
        fs.renameSync(req.file.path, finalPath);

        logActivity(req, 'อัปโหลดไฟล์', 'จัดการเทมเพลต', `อัปเดตเทมเพลต: ${templateType}`);
        res.status(200).json({ message: 'อัปโหลดและอัปเดตเทมเพลตสำเร็จ' });
    } catch (error) {
        removeUploadedFile(req.file);
        console.error('Error uploading template:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปโหลดเทมเพลต' });
    }
};

// ==========================================
// ดาวน์โหลดไฟล์เทมเพลตเดิมไปแก้ไข
// ==========================================
exports.downloadTemplate = (req, res) => {
    try {
        const templateType = req.query.type; // รับค่าประเภท เช่น 'leave_template_sick'
        
        if (!isAllowedTemplateType(templateType)) {
            return res.status(400).json({ message: 'ประเภทแบบฟอร์มไม่ถูกต้อง' });
        }

        const fileName = templateType + '.docx';
        const filePath = path.join(__dirname, '../../templates/', fileName);

        // เช็กว่ามีไฟล์นี้ในโฟลเดอร์หรือไม่
        if (fs.existsSync(filePath)) {
            res.download(filePath, fileName); // บังคับดาวน์โหลดไฟล์
        } else {
            res.status(404).json({ message: 'ไม่พบไฟล์แบบฟอร์มนี้ในระบบ' });
        }
    } catch (error) {
        console.error('Error downloading template:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดาวน์โหลดเทมเพลต' });
    }
};
