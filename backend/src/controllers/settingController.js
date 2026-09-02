const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const { insertEventToGoogleCalendar } = require('../utils/googleCalendar');

// ==========================================
// 1. ดึงข้อมูลการตั้งค่าปฏิทิน
// ==========================================
exports.getCalendarSettings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM calendar_settings WHERE id = 1');
        res.status(200).json({ record: rows[0] || { calendar_id: '', is_sync_enabled: 1 } });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงการตั้งค่า' });
    }
};

// ==========================================
// 2. บันทึก/อัปเดตการตั้งค่าปฏิทิน
// ==========================================
exports.saveCalendarSettings = async (req, res) => {
    const { calendar_id, is_sync_enabled } = req.body;
    try {
        await pool.query(
            'UPDATE calendar_settings SET calendar_id = ?, is_sync_enabled = ? WHERE id = 1',
            [calendar_id || '', is_sync_enabled ? 1 : 0]
        );
        res.status(200).json({ message: 'บันทึกการตั้งค่าสำเร็จ' });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า' });
    }
};

// ==========================================
// 3. ทดสอบการเชื่อมต่อกับ Google Calendar
// ==========================================
exports.testCalendarConnection = async (req, res) => {
    const { calendar_id } = req.body;
    
    if (!calendar_id) {
        return res.status(400).json({ message: 'กรุณาระบุ Calendar ID ก่อนทดสอบ' });
    }

    try {
        // สร้างข้อมูลกิจกรรมจำลอง 
        // ใช้วันที่พรุ่งนี้ เพื่อไม่ให้ปนกับงานวันนี้
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0); // เริ่ม 10:00
        
        const endTomorrow = new Date(tomorrow);
        endTomorrow.setHours(11, 0, 0); // จบ 11:00

        const testEvent = {
            title: '🟢 ทดสอบระบบ: การเชื่อมต่อ Google Calendar',
            description: 'ข้อความนี้ถูกสร้างขึ้นเพื่อทดสอบการเชื่อมต่อ API จากโปรแกรมบริหารจัดการ พ.สมทบ',
            location: 'ระบบทดสอบ',
            start_date: tomorrow.toISOString(),
            end_date: endTomorrow.toISOString()
        };

        // ส่งข้อมูลทดสอบไปที่ Helper
        // (ต้องส่ง calendar_id จากหน้าเว็บเข้าไปด้วย เพื่อทดสอบว่า ID นี้ถูกต้อง)
        await insertEventToGoogleCalendar(testEvent, calendar_id);

        res.status(200).json({ message: 'ทดสอบการเชื่อมต่อสำเร็จ!' });
    } catch (error) {
        console.error('Test Connection Error:', error);
        res.status(500).json({ 
            message: 'ทดสอบล้มเหลว ตรวจสอบความถูกต้องของ Calendar ID หรือ สิทธิ์ Share Service Account' 
        });
    }
};



// ==========================================
// 4. บันทึกไฟล์ Service Account JSON จาก Textarea
// ==========================================
exports.saveServiceAccountJson = async (req, res) => {
    try {
        const { service_account_text } = req.body;
        
        if (!service_account_text) {
            return res.status(400).json({ message: 'กรุณาวางเนื้อหาไฟล์ JSON ก่อนบันทึก' });
        }

        // 1. ตรวจสอบว่าเป็นรูปแบบ JSON ที่ถูกต้องของ Google หรือไม่
        let parsedJson;
        try {
            parsedJson = JSON.parse(service_account_text);
            if (!parsedJson.private_key || !parsedJson.client_email) {
                return res.status(400).json({ message: 'รูปแบบ JSON ไม่ถูกต้อง (ไม่พบ private_key หรือ client_email)' });
            }
        } catch (parseError) {
            return res.status(400).json({ message: 'โครงสร้างข้อความไม่ใช่ JSON ที่ถูกต้อง กรุณาตรวจสอบการคัดลอก' });
        }

        // 2. ระบุเส้นทางที่จะบันทึกไฟล์ (โฟลเดอร์ config ซึ่งไม่มีการเปิด express.static)
        const targetDir = path.join(__dirname, '../config');
        const targetFile = path.join(targetDir, 'google-service-account.json');

        // สร้างโฟลเดอร์ config หากยังไม่มี
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true, mode: 0o770 });
        }

        // 3. เขียนไฟล์ทับลงไป (จัดรูปแบบสวยงามด้วยการแทรกบรรทัดใหม่)
        fs.writeFileSync(targetFile, JSON.stringify(parsedJson, null, 2), 'utf8');

        res.status(200).json({ message: 'สร้าง/อัปเดตไฟล์ Service Account สำเร็จ' });
    } catch (error) {
        console.error('Error saving service account JSON:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างไฟล์' });
    }
};