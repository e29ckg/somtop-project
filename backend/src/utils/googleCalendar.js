const { google } = require('googleapis');
const path = require('path');

// ชี้ไปที่ไฟล์ JSON ที่โหลดมาจาก Google Cloud
const KEYFILEPATH = path.join(__dirname, '../config/google-service-account.json');

// ระบุ Scope ให้จัดการ Calendar ได้
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});

const calendar = google.calendar({ version: 'v3', auth });
// ระบุ ID ปฏิทินของคุณ (ถ้าเป็นปฏิทินหลักของบัญชีที่แชร์ ใช้ 'primary' หรือใช้อีเมลปฏิทิน)
const CALENDAR_ID = 'อีเมลปฏิทินศาล@group.calendar.google.com'; 

// ... โค้ดเตรียม auth และ calendar ...

// ⭐️ ปรับให้รับค่า calendarId พารามิเตอร์ที่ 2
// ==========================================
// ฟังก์ชันสำหรับ สร้าง กิจกรรมบน Google Calendar
// ==========================================
exports.insertEventToGoogleCalendar = async (eventData, customCalendarId = null) => {
    try {
        let targetCalendarId = customCalendarId;

        if (!targetCalendarId) {
             const pool = require('../config/db');
             const [rows] = await pool.query('SELECT calendar_id, is_sync_enabled FROM calendar_settings WHERE id = 1');
             if (rows.length === 0 || rows[0].is_sync_enabled === 0 || !rows[0].calendar_id) return null; 
             targetCalendarId = rows[0].calendar_id;
        }

        // ⭐️ 1. แปลงข้อมูลวันที่เป็น Date Object ของ JavaScript
        let startDate = new Date(eventData.start_date);
        let endDate = new Date(eventData.end_date || eventData.start_date);

        // ⭐️ 2. Safety Check: ถ้าวันสิ้นสุด "น้อยกว่าหรือเท่ากับ" วันเริ่มต้น
        // ให้ทำการบวกเวลาสิ้นสุดเพิ่มไป 1 ชั่วโมง (ป้องกัน Error Time range is empty)
        if (endDate <= startDate) {
            endDate = new Date(startDate.getTime() + (60 * 60 * 1000)); 
        }

        const response = await calendar.events.insert({
            calendarId: targetCalendarId,
            resource: {
                summary: eventData.title,
                description: eventData.description,
                location: eventData.location,
                start: {
                    dateTime: startDate.toISOString(), // ใช้ startDate ที่ตรวจสอบแล้ว
                    timeZone: 'Asia/Bangkok',
                },
                end: {
                    dateTime: endDate.toISOString(),   // ใช้ endDate ที่ตรวจสอบแล้ว
                    timeZone: 'Asia/Bangkok',
                },
            },
        });
        return response.data.id;
    } catch (error) {
        console.error('Google Calendar Error:', error);
        throw error;
    }
};

// ==========================================
// ฟังก์ชันสำหรับ อัปเดต กิจกรรมบน Google Calendar
// ==========================================
exports.updateEventInGoogleCalendar = async (googleEventId, eventData, customCalendarId = null) => {
    try {
        let targetCalendarId = customCalendarId;

        // ดึง Calendar ID จากฐานข้อมูลหากไม่ได้ระบุมา
        if (!targetCalendarId) {
             const pool = require('../config/db');
             const [rows] = await pool.query('SELECT calendar_id, is_sync_enabled FROM calendar_settings WHERE id = 1');
             
             if (rows.length === 0 || rows[0].is_sync_enabled === 0 || !rows[0].calendar_id) {
                 return null; 
             }
             targetCalendarId = rows[0].calendar_id;
        }

        // เรียก API ของ Google เพื่อ Update ข้อมูลตาม ID
        const response = await calendar.events.update({
            calendarId: targetCalendarId,
            eventId: googleEventId,
            resource: {
                summary: eventData.title,
                description: eventData.description,
                location: eventData.location,
                start: {
                    dateTime: new Date(eventData.start_date).toISOString(),
                    timeZone: 'Asia/Bangkok',
                },
                end: {
                    dateTime: new Date(eventData.end_date).toISOString(),
                    timeZone: 'Asia/Bangkok',
                },
            },
        });
        return response.data;
    } catch (error) {
        console.error('Update Google Calendar Error:', error);
        throw error;
    }
};

// ==========================================
// ฟังก์ชันสำหรับ ลบ กิจกรรมบน Google Calendar
// ==========================================
exports.deleteEventFromGoogleCalendar = async (googleEventId, customCalendarId = null) => {
    try {
        let targetCalendarId = customCalendarId;

        // ดึง Calendar ID จากฐานข้อมูลหากไม่ได้ระบุมา
        if (!targetCalendarId) {
             const pool = require('../config/db');
             const [rows] = await pool.query('SELECT calendar_id, is_sync_enabled FROM calendar_settings WHERE id = 1');
             
             if (rows.length === 0 || rows[0].is_sync_enabled === 0 || !rows[0].calendar_id) {
                 return null; 
             }
             targetCalendarId = rows[0].calendar_id;
        }

        // เรียก API ของ Google เพื่อ Delete ข้อมูลตาม ID
        await calendar.events.delete({
            calendarId: targetCalendarId,
            eventId: googleEventId,
        });
        
        return true;
    } catch (error) {
        console.error('Delete Google Calendar Error:', error);
        throw error;
    }
};