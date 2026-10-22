# BACKEND.md - สรุปโครงสร้างระบบ Backend (Somtop Project)

เอกสารสำหรับนักพัฒนา ปรับปรุง 21 ตุลาคม 2569 (2026-10-21) ดูขั้นตอนแก้ซอร์สใน [DEVELOPMENT.md](DEVELOPMENT.md) และการตั้ง SSO ใน [AUTH_HUB.md](AUTH_HUB.md)

## 1. เทคโนโลยีหลัก (Tech Stack)

* **ภาษาโปรแกรมและเซิร์ฟเวอร์**: ใช้งาน Node.js ร่วมกับเฟรมเวิร์ก Express.js เป็นเว็บเซิร์ฟเวอร์หลัก พร้อมใช้งานไลบรารี `mysql2` สำหรับเชื่อมต่อฐานข้อมูลแบบ Connection Pool
* **ฐานข้อมูล**: MySQL/MariaDB ผ่าน `mysql2` connection pool
* **สภาพแวดล้อมเครื่องนี้**: XAMPP/Apache และ PM2 ชื่อ `somtop-api` จาก `C:\project\somtop-project\backend` ฟัง `127.0.0.1:8088` Apache พอร์ต 80 ส่ง `/somtop/api/` ไป `/api/` และ `/somtop/uploads/` ไป `/uploads/` ไม่ได้ใช้ Docker ใน deployment นี้

## 2. สถาปัตยกรรมระบบ (Architecture)

* **โครงสร้างแบ่งเลเยอร์ (Layered Architecture)**: แยกสัดส่วนการทำงานชัดเจนแบบ Route-Controller-Service เพื่อรองรับโปรเจกต์ขนาดใหญ่
* **การตั้งค่าเซิร์ฟเวอร์ (App/Server)**: 
  * `backend/src/app.js`: Middleware, CORS พร้อม credentials, security headers, routes, health check และ error handler
  * `backend/server.js`: โหลด `.env` ที่ root ตามด้วย `backend/.env` เป็นค่าทดแทน ตั้ง NODE_ENV จาก APP_ENV ตรวจ JWT_SECRET และเริ่ม server ตัวแปรที่ process/PM2 มีอยู่ก่อนจะไม่ถูก dotenv เขียนทับโดยอัตโนมัติ
  * `backend/src/services/authHub.js`: SSO client, state/PKCE, session, ตรวจสิทธิ์ และ logout กลาง
* **เครื่องมือช่วยเหลือ (Utils)**: รวมฟังก์ชันกลางที่ใช้บ่อย เช่น ระบบ `logger.js` สำหรับบันทึกประวัติการทำงานอัตโนมัติ

## 3. ความปลอดภัย (Security & Authentication)

* **Auth-Hub SSO**: เปิดเมื่อ AUTH_HUB_URL ไม่ว่าง ใช้ authorization code + PKCE S256 ไม่แชร์รหัสผ่านหรือ JWT signing secret ของ Hub สร้าง state/verifier อายุ 5 นาที เก็บ Hub appSession ใน memory และให้ browser รับ cookie `somtop_sso` แบบ HttpOnly/SameSite=Strict อายุสูงสุด 8 ชั่วโมง Cookie สำหรับ state เป็น SameSite=Lax เพื่อรับ callback ข้ามไซต์
* **ตรวจสิทธิ์ทุก request**: เรียก Hub `/api/sso/userinfo` ตรวจ systemCode/role จับคู่ Hub user ID กับ local username ด้วย AUTH_HUB_USER_MAP แล้วอ่านบัญชี Somtop ล่าสุดและ auth_version ถ้า Hub ติดต่อไม่ได้ตอบ 503 ถ้าสิทธิ์ถูกถอนหรือ session ถูกยกเลิกจะเข้า API ไม่ได้
* **Role**: admin ต้องได้ admin จากทั้งสองระบบ Hub role view/user ใช้สิทธิ์ view; role อื่นไม่รองรับ ผู้ใช้ view ต้องมี court_code ใช้หนึ่ง process/instance เพราะ session อยู่ใน memory การ restart ต้องเริ่ม SSO ใหม่
* **Local login**: เปิดใช้งานทั้งเมื่อมีและไม่มี AUTH_HUB_URL ใช้ bcrypt ตรวจรหัสผ่านใน transaction/row lock มีการล็อกเมื่อผิดครบ 5 ครั้งและจำกัดคำขอตาม IP ออก JWT อายุ 8 ชั่วโมงใน cookie `jwt` แบบ HttpOnly/SameSite=Strict ตรวจ HS256, issuer somtop-api, audience somtop-web พร้อมอ่านบัญชีจริงและ auth_version ทุกครั้ง
* **เลือกวิธีตาม session**: ถ้ามี SSO cookie และเปิด Hub จะตรวจผ่าน Hub เท่านั้น ไม่ fallback ไป JWT เมื่อ SSO ไม่ผ่าน ถ้าไม่มี SSO cookie จะตรวจ JWT ของ Somtop ส่ง auth_provider เป็น local หรือ auth-hub ใน req.user การ login สำเร็จจะล้าง cookie ของอีกวิธี
* **Logout**: โหมด SSO ตรวจ Origin เทียบ APP_URL แล้วเรียก `/api/sso/end-session` เพื่อออกจากทุกแอปใน session กลางเดียวกัน โหมด local เพิ่ม auth_version และล้าง cookie
* **การปกปิดข้อมูลสำคัญ**: อ่านค่า Secret Key, การเชื่อมต่อฐานข้อมูล, และโดเมนผ่านตัวแปรจากไฟล์ `.env` ทั้งหมด
* **การเข้ารหัส**: ใช้ไลบรารี `bcrypt` สำหรับเข้ารหัสผ่านในฐานข้อมูล 
* **ขอบเขตศาล**: สร้าง req.user จากบัญชีปัจจุบันในฐานข้อมูล ใช้ court_code และสิทธิ์ตรวจข้อมูลใน controller ไฟล์ `/uploads` ต้องผ่าน verifyToken และ authorizeUpload ก่อนเข้าถึง

### Endpoint สำหรับ session

เส้นทางด้านล่างเป็น API ภายใน Backend Browser บนเครื่องนี้เติม `/somtop` ด้านหน้า

| Method | Endpoint | การทำงาน |
| --- | --- | --- |
| GET | `/api/health` | ตรวจฐานข้อมูล ไม่ต้อง login |
| GET | `/api/auth/config` | คืน provider dual/local และ providers ที่เลือกได้ |
| GET | `/api/auth/sso/login` | เริ่ม SSO; 404 เมื่อใช้ local mode |
| GET | `/api/auth/sso/callback` | ตรวจ state แลก code และ redirect กลับเว็บ |
| POST | `/api/auth/login` | ตรวจบัญชี Somtop ได้แม้เปิด Hub |
| GET | `/api/auth/me` | ตรวจ session และคืนบัญชีปัจจุบัน |
| POST | `/api/auth/logout` | Logout ตามโหมด; SSO ต้องมี Origin ตรง APP_URL |

Frontend ส่ง cookie ด้วย withCredentials ไม่ส่ง Hub token จาก browser และไม่เก็บ token ใน localStorage ข้อมูลผู้ใช้ใน localStorage ใช้แสดงผลและต้องยืนยันกับ server ก่อนใช้สิทธิ์

## 4. โครงสร้างฐานข้อมูล (Database Schema)

* **`users`**: ตารางเก็บข้อมูลเข้าสู่ระบบของผู้ดูแลและเจ้าหน้าที่ (เก็บรหัสผ่านที่ถูก Hash และบทบาทสิทธิ์การใช้งาน)
* **`somtop`**: ตารางหลักเก็บข้อมูลรายชื่อ, ข้อมูลส่วนตัว, และ Path ไฟล์รูปโปรไฟล์ของผู้พิพากษาสมทบ
* **`leave_types`**: ตารางอ้างอิงประเภทการลาพื้นฐาน เช่น ลาป่วย, ลากิจส่วนตัว, ลาพักผ่อน
* **`leave_requests`**: ตารางบันทึกประวัติใบลาและการอนุมัติ ซึ่งเชื่อมโยงข้อมูล (Foreign Key) ไปยังตาราง `somtop` และ `leave_types`
* **`activity_logs`**: ตารางบันทึกประวัติการใช้งานทั้งหมดในระบบ (เพิ่ม/ลด/แก้ไข) เพื่อการตรวจสอบย้อนหลัง
