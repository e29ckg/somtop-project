const fs = require('fs');
const path = require('path');
const { logActivity } = require('../utils/logger');

exports.uploadTemplate = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'กรุณาเลือกไฟล์เทมเพลต' });
        }

        const templateType = req.body.template_type; // เช่น 'leave_template'
        if (!templateType) {
            fs.unlinkSync(req.file.path); // ลบไฟล์ชั่วคราวทิ้งถ้าไม่มีประเภท
            return res.status(400).json({ message: 'กรุณาระบุประเภทแบบฟอร์ม' });
        }

        // กำหนดที่อยู่ไฟล์จริงที่ต้องการเซฟทับ (เช่น backend/templates/leave_template.docx)
        const finalPath = path.join(__dirname, '../../templates/', templateType + '.docx');

        // ย้ายและเปลี่ยนชื่อไฟล์ชั่วคราว ไปทับไฟล์เทมเพลตเดิม
        fs.renameSync(req.file.path, finalPath);

        logActivity(req, 'อัปโหลดไฟล์', 'จัดการเทมเพลต', `อัปเดตเทมเพลต: ${templateType}`);
        res.status(200).json({ message: 'อัปโหลดและอัปเดตเทมเพลตสำเร็จ' });
    } catch (error) {
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
        
        if (!templateType) {
            return res.status(400).json({ message: 'กรุณาระบุประเภทแบบฟอร์ม' });
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