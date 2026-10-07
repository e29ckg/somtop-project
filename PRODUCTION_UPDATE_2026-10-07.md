# เตรียมอัปเดตระบบจริง: วันหยุดพิเศษและผู้ดูแลส่วนกลาง

ใช้กับเซิร์ฟเวอร์ Windows, XAMPP, PM2 และโค้ดจาก `origin/main` ตาม `DEPLOY_XAMPP.md` เอกสารนี้เป็นขั้นตอนสำหรับผู้ดูแลเซิร์ฟเวอร์ ยังไม่ได้รันคำสั่งใดบนเซิร์ฟเวอร์จริง

## ก่อนเริ่ม

1. ตรวจว่า release ที่อนุมัติถูก merge เข้า `origin/main` แล้ว และบันทึก commit ปัจจุบันของเซิร์ฟเวอร์ด้วย `git rev-parse HEAD` เพื่อใช้ย้อนกลับ
2. แจ้งช่วงหยุดใช้งานสั้น ๆ และให้ผู้ใช้ออกจากหน้าที่กำลังแก้ข้อมูล
3. สำรองฐานข้อมูล `somtop_db` แบบ SQL ผ่าน phpMyAdmin หรือ `mysqldump` และทดลองเปิดไฟล์สำรอง ตรวจว่ามีตาราง `users`, `courts`, `duty_orders` และข้อมูลจริง
4. สำรอง `backend\uploads`, `backend\templates`, `.env` และ `backend\src\config\google-service-account.json` (ถ้ามี) ไปยังตำแหน่งสำรองที่ไม่เปิดผ่าน Apache ตรวจว่ากู้ไฟล์ได้
5. จด `court_code` เดิมของบัญชี `admin` จากตาราง `users` ไว้สำหรับการย้อนกลับ โดยไม่เผยแพร่ข้อมูลนี้ใน Git
6. ตรวจ `git status --short` บนเซิร์ฟเวอร์ ต้องไม่มีการแก้ไขโค้ดที่ยังไม่ได้เก็บไว้ และตรวจว่ามีพื้นที่ว่างพอสำหรับ build กับไฟล์สำรอง

## อัปเดตฐานข้อมูล

ใช้บัญชีผู้ดูแลฐานข้อมูลใน phpMyAdmin ไม่ใช้บัญชี `somtop_app` ซึ่งปกติมีเฉพาะ SELECT/INSERT/UPDATE/DELETE:

1. ตรวจว่าตาราง `holidays` มีหรือยัง หากยังไม่มี ให้รัน `backend/migrations/011_holidays.sql` หนึ่งครั้ง
2. ตรวจ `SHOW COLUMNS FROM users LIKE 'role';` หาก enum ยังไม่มี `central_admin` ให้รัน `backend/migrations/012_central_admin.sql` หนึ่งครั้ง
3. ยังไม่เลื่อนบทบาทบัญชี `admin` ในขั้นนี้ เพื่อให้บัญชียังใช้โค้ดเดิมได้จนกว่า API รุ่นใหม่จะพร้อม

หลังดึง release ใหม่จาก Git แล้ว ให้รัน `node backend/scripts/check_production_update.js admin` ที่ root โปรเจกต์ ต้องเห็น `PASS` ก่อนเริ่ม `update_somtop.bat` หากบัญชีบนเซิร์ฟเวอร์ใช้ชื่ออื่น ให้เปลี่ยนชื่อท้ายคำสั่งตามบัญชีที่จะเลื่อนสิทธิ์

## อัปเดตโค้ด

เปิด PowerShell ที่ root ของโปรเจกต์บนเซิร์ฟเวอร์:

```powershell
git fetch origin
git pull --ff-only origin main
node backend/scripts/check_production_update.js admin
.\update_somtop.bat
```

สคริปต์หยุด `somtop-api` ระหว่างเปลี่ยน dependency, build frontend, ติดตั้งไฟล์ใน Apache DocumentRoot, ตรวจ Apache config แล้ว restart PM2 ตรวจ `pm2 status` ว่า `somtop-api` เป็น `online` และตรวจ `C:\xampp\apache\bin\httpd.exe -t` ว่า config ถูกต้อง หากสคริปต์ขอให้ restart Apache ให้ทำผ่าน XAMPP Control Panel

เมื่อ API รุ่นใหม่พร้อมแล้ว รัน:

```powershell
cd backend
node scripts/activate_central_admin.js admin
node scripts/check_production_update.js admin
```

คำสั่งเลื่อนสิทธิ์ทำเฉพาะบัญชี `admin` ที่มีอยู่ ไม่สร้างบัญชีใหม่ ไม่เปลี่ยนรหัสผ่าน และรันซ้ำได้ หลังจากนั้นให้บัญชีนี้ออกจากระบบแล้วเข้าสู่ระบบใหม่

## ตรวจรับหลังอัปเดต

1. เปิด `/somtop/` และ `/somtop/dashboard` จากเครื่องลูกข่าย หน้าเว็บต้องแสดงและไม่เกิด Apache 404
2. ก่อนล็อกอิน เปิด `/somtop/api/auth/me` ต้องตอบ 401 เป็น JSON ไม่ใช่ HTML หรือ 502
3. เข้าระบบด้วย `admin`: ต้องเห็นบทบาทผู้ดูแลส่วนกลาง เลือกศาลได้ และเปิดข้อมูลของศาลที่เลือกได้
4. เปิดเมนูวันหยุดพิเศษ ทดลองอ่านรายการทั่วประเทศและของศาลที่เลือก ตรวจฟอร์ม modal กับช่องวัน เดือน ปี พ.ศ. ไม่จำเป็นต้องสร้างข้อมูลทดสอบในระบบจริง
5. เข้าระบบด้วยผู้ดูแลศาล: ต้องเห็นเฉพาะข้อมูลศาลตนเอง ไม่สามารถจัดการวันหยุดทั่วประเทศหรือเมนูตั้งค่าส่วนกลาง
6. ตรวจรายงานหลักฐานการรับเงิน รูป และไฟล์แนบที่มีอยู่เดิม รวมถึง `pm2 logs somtop-api --lines 100` และ Apache error log ว่าไม่มีข้อผิดพลาดใหม่
7. ตรวจว่า URL API จาก browser เป็น `/somtop/api/` และให้ผู้ใช้กด `Ctrl+Shift+R` หากยังเห็นหน้าเว็บรุ่นเก่า

## หากต้องย้อนกลับ

หยุดการใช้งานชั่วคราว เก็บ log และบันทึกอาการก่อนแก้คืน ใช้ commit ก่อนอัปเดตที่บันทึกไว้เพื่อ deploy โค้ดเดิมด้วย `update_somtop.bat` แล้วคืนบทบาทบัญชี `admin` เป็น `admin` พร้อม `court_code` เดิมที่บันทึกไว้ก่อนอัปเดต เพราะโค้ดเดิมอาจไม่รู้จัก `central_admin` ตาราง `holidays` และ enum ที่เพิ่มไว้สามารถคงอยู่ระหว่างย้อนกลับโค้ดได้ หากต้องคืนข้อมูลฐานข้อมูลหรือไฟล์อัปโหลด ให้ใช้ชุดสำรองที่ตรวจแล้วและทำในช่วงหยุดใช้งาน

ห้ามใช้ `git reset --hard` กับ checkout เซิร์ฟเวอร์ที่มีไฟล์เปลี่ยนอยู่; ตรวจ `git status` และเก็บไฟล์เหล่านั้นก่อนทุกครั้ง
