const fs = require('fs');
const path = require('path');

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

        res.status(200).json({ message: 'อัปโหลดและอัปเดตเทมเพลตสำเร็จ' });
    } catch (error) {
        console.error('Error uploading template:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปโหลดเทมเพลต' });
    }
};