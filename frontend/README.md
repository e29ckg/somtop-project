# Frontend ของ Somtop

อัปเดต: 21 ตุลาคม 2569 (2026-10-21)

ใช้ Vue 3, Vite, Vue Router และ Axios ซอร์สอยู่ใน frontend/src โหมด production เครื่องนี้เปิดผ่าน http://localhost/somtop/ โดย Apache พอร์ต 80 ดูขั้นตอนนำขึ้นเว็บใน [DEVELOPMENT.md](../DEVELOPMENT.md)

## พัฒนา

ใช้ Node.js ^22.18.0 หรือ >=24.12.0 จาก root โปรเจกต์:

~~~powershell
npm run install:all
npm run dev
~~~

ตั้ง .env สำหรับพัฒนาให้มี APP_ENV=development, APP_URL=http://localhost:5173, FRONTEND_URL=http://localhost:5173, COOKIE_PATH=/ และ COOKIE_SECURE=false รวมถึงฐานข้อมูลสำหรับพัฒนา

Vite อ่าน .env ที่ root เปิดหน้าเว็บพอร์ต 5173 และ proxy /api กับ /uploads ไป 127.0.0.1 ตาม PORT ใน .env ถ้าทดสอบ SSO ต้องลงทะเบียน client/callback ของพัฒนาแยกจาก production ตาม [AUTH_HUB.md](../AUTH_HUB.md)

## Session และ routing

- services/api.js เรียก API ด้วย cookie และ base path ตาม import.meta.env.BASE_URL
- router/index.js ตรวจ /auth/me เพื่อยืนยันบัญชีก่อนเข้า route ที่ต้อง login และตรวจ role สำหรับเมนู admin
- views/LoginView.vue อ่าน providers จาก /auth/config แสดงแบบฟอร์มบัญชี Somtop พร้อมปุ่ม SSO เมื่อเปิด Hub ให้ผู้ใช้เลือกได้ทั้งสองวิธี
- services/session.js เก็บข้อมูลแสดงผลผู้ใช้ใน localStorage ไม่เก็บ Hub token หรือ JWT และไม่ใช้ localStorage ยืนยันสิทธิ์กับ server
- main.js ตรวจ session เมื่อกลับมา focus และทุก 60 วินาทีที่มองเห็นหน้าเว็บ

## Build และจัดรูปแบบ

~~~powershell
npm --prefix frontend run build
npm --prefix frontend run format
~~~

โหมด production ใช้ APP_BASE_PATH จาก .env หรือ /somtop/ เป็นค่าเริ่มต้น ผลลัพธ์อยู่ใน frontend/dist สคริปต์ deploy คัดลอกไป APACHE_DOCUMENT_ROOT ตาม base path อย่าแก้ไฟล์ build แทนซอร์ส

หน้า **การอัพเดท** นำ CHANGELOG.md เข้า bundle ตอน build ถ้าแก้รายการแล้วต้อง build/publish frontend ใหม่จึงจะเห็นบนเว็บ ดู [DESIGN.md](../DESIGN.md) และ [PAGE_TEMPLATE.md](../PAGE_TEMPLATE.md) ก่อนเพิ่มหน้าจอ
