# Deploy ผ่าน XAMPP ในเครือข่ายภายใน

Apache ให้บริการหน้าเว็บ Vue และส่ง `/somtop/api/` กับ `/somtop/uploads/` ไปยัง Node.js ที่ฟังเฉพาะ `127.0.0.1` ส่วน MySQL ใช้ของ XAMPP วางโปรเจกต์ **นอก** Apache DocumentRoot เพื่อไม่ให้ `.env`, ซอร์ส backend และไฟล์อัปโหลดถูกเสิร์ฟตรง ๆ

## 1. เตรียมเครื่องเซิร์ฟเวอร์

1. ให้เครื่องมี IP ที่ผู้ใช้เข้าถึงได้ เช่น `10.xx.xx.xx` ติดตั้ง XAMPP ที่ `C:\xampp` และติดตั้ง Node.js `^22.18.0` หรือ `>=24.12.0`, Git, npm และ PM2 (`npm install -g pm2`) ทุกจุดที่ใช้ `10.xx.xx.xx` ในเอกสารเป็นตัวอย่าง ให้แทนด้วย IP ของเซิร์ฟเวอร์จริงก่อนตั้งค่า `.env` หรือทดสอบ URL
2. ตั้ง Apache ให้ฟังพอร์ต 80 ใน `C:\xampp\apache\conf\httpd.conf` (`Listen 80`) เพราะ URL `http://10.xx.xx.xx/somtop` ไม่ระบุพอร์ต หากต้องใช้พอร์ตอื่น ต้องใส่พอร์ตใน `APP_URL` และ `FRONTEND_URL` ด้วย
3. เปิด Apache และ MySQL ผ่าน XAMPP Control Panel; ตั้งทั้งสองให้เริ่มเมื่อ Windows บูต เปิด Windows Firewall ขาเข้าเฉพาะพอร์ต Apache สำหรับ LAN ไม่เปิดพอร์ต Node (`8088`) ให้เครื่องลูกข่าย
4. ถ้า Apache ใช้ `D:\www` ให้ตั้ง `DocumentRoot "D:/www"` ใน `httpd.conf` ก่อน และตรวจว่าโฟลเดอร์นี้มีอยู่จริง โคลน `main` ไปที่ตำแหน่งถาวรนอก DocumentRoot เช่น `C:\apps\somtop-project`:

```powershell
git clone --branch main https://github.com/e29ckg/somtop-project.git C:\apps\somtop-project
cd C:\apps\somtop-project
```

## 2. ฐานข้อมูลและไฟล์เดิม

- **ย้ายระบบที่ใช้งานอยู่:** สำรอง/ส่งออกฐานข้อมูล `somtop_db` จากเครื่องต้นทางด้วย XAMPP phpMyAdmin หรือ `mysqldump`; นำเข้าไฟล์สำรองนั้นบนเครื่องใหม่ จากนั้นคัดลอก `backend\uploads` และไฟล์เทมเพลตที่ผู้ใช้อัปโหลดใน `backend\templates` มาด้วย สำรองข้อมูลบนเครื่องปลายทางก่อนนำเข้าทับ
- **เครื่องปลายทางมีฐานข้อมูลแล้ว:** ตรวจว่ามี `somtop_db` และตารางที่ระบบใช้ ไม่ต้องนำเข้า SQL ทับ และอย่ารัน migration ซ้ำโดยไม่ตรวจ schema
- **เริ่มจากฐานข้อมูลว่าง:** ขอไฟล์ SQL export จากระบบที่ใช้งานได้ก่อน ไฟล์ `somtop_db.sql` ใน repository ยังไม่ใช่สคริปต์สร้างฐานข้อมูลจากศูนย์ที่รันได้ต่อเนื่อง เพราะมี `ALTER TABLE` ก่อนสร้างตาราง และสร้างบางตารางซ้ำ ไฟล์ `backend/migrations` ก็ต้องเลือกตาม schema ต้นทาง ไม่ควรรันทุกไฟล์ทับฐานข้อมูลใหม่

ควรสร้างบัญชี MySQL เฉพาะแอปที่เชื่อมต่อผ่าน `127.0.0.1` ตัวอย่างคำสั่งใน phpMyAdmin แทนรหัสผ่านด้วยค่าจริงที่ไม่ซ้ำ:

```sql
CREATE USER 'somtop_app'@'127.0.0.1' IDENTIFIED BY 'replace-with-long-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON somtop_db.* TO 'somtop_app'@'127.0.0.1';
```

ใช้ชื่อกับรหัสผ่านนั้นใน `.env` หากย้ายข้อมูลทั้งฐาน บัญชีผู้ใช้ระบบจะย้ายมาด้วย; repository ไม่มีบัญชี admin เริ่มต้นสำหรับฐานว่าง

## 3. ตั้งค่า `.env` ที่ root โปรเจกต์

คัดลอก `.env.example` เป็น `.env` แล้วใส่ค่าของเครื่องจริง ตัวอย่างสำหรับ URL ที่ต้องการ:

```dotenv
APP_URL=http://10.xx.xx.xx/somtop
APP_BASE_PATH=/somtop/
FRONTEND_URL=http://10.xx.xx.xx
XAMPP_ROOT=C:/xampp
APACHE_DOCUMENT_ROOT=D:/www
HOST=127.0.0.1
PORT=8088
APP_ENV=production
COOKIE_SECURE=false
COOKIE_PATH=/somtop
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=somtop_app
DB_PASSWORD=replace-with-real-database-password
DB_NAME=somtop_db
JWT_SECRET=replace-with-unique-random-secret-of-at-least-32-characters
```

`APP_BASE_PATH` ต้องตรงกับ path ใน `APP_URL`; `FRONTEND_URL` คือ origin โดยไม่มี `/somtop` ส่วน `APACHE_DOCUMENT_ROOT` ต้องตรงกับ `DocumentRoot` ใน `httpd.conf` หากใช้ HTTPS ให้เปลี่ยน URL ทั้งสองเป็น `https://` และตั้ง `COOKIE_SECURE=true` ค่า `MYSQL_ROOT_PASSWORD` ใน `.env.example` ใช้กับ Docker Compose ไม่ใช่รหัสผ่าน MySQL ของ XAMPP; อย่า commit `.env` หรือคัดลอก secret จากเครื่องทดสอบ

สร้าง `JWT_SECRET` ที่ไม่ซ้ำบนเครื่องเซิร์ฟเวอร์ได้ด้วย `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` แล้วนำผลลัพธ์ไปใส่ `.env`

ถ้าใช้ Google Calendar ให้ย้าย `backend\src\config\google-service-account.json` จากระบบเดิมและตรวจสิทธิ์ Google ของบัญชีนั้น ไฟล์นี้ถูก ignore โดย Git

## 4. Build และติดตั้ง Apache proxy

เปิด PowerShell แบบ Administrator ที่ root โปรเจกต์ แล้วรัน:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy_xampp.ps1 -ConfigureApache
```

สคริปต์ติดตั้ง dependency, build frontend จาก `.env`, คัดลอกไฟล์ไป `D:\www\somtop` ตาม `APACHE_DOCUMENT_ROOT`, สร้าง `.htaccess` และ config proxy ที่ `C:\xampp\apache\conf\extra\somtop.conf` แล้วเพิ่ม `Include` ใน `httpd.conf` โดยสำรองไฟล์เดิมและตรวจด้วย `httpd.exe -t` จากนั้น **restart Apache** ผ่าน XAMPP Control Panel ไม่ต้องแก้ `.htaccess` ด้วยมือ เพราะสคริปต์จะสร้างใหม่ในการ deploy ครั้งถัดไป

## 5. เริ่ม API และตั้งให้รันต่อ

```powershell
cd C:\apps\somtop-project\backend
pm2 start server.js --name somtop-api
pm2 save
pm2 status
```

ให้ PM2 รันด้วย Windows account เดียวกับที่ใช้ `pm2 save` และตั้ง Task Scheduler ให้รัน `pm2.cmd resurrect` หลังเครื่องบูต (`pm2 save` อย่างเดียวไม่ทำให้ PM2 เริ่มเองบน Windows) working directory ของแอปต้องเป็นโฟลเดอร์ `backend`

## 6. ตรวจผล

1. จากเครื่องลูกข่าย เปิด `http://10.xx.xx.xx/somtop/` หน้าเว็บและ CSS/JS ต้องโหลดครบ
2. เปิด `http://10.xx.xx.xx/somtop/dashboard` ตรง ๆ ต้องได้หน้าเว็บ ไม่ใช่ Apache 404
3. ก่อนล็อกอิน ลอง `http://10.xx.xx.xx/somtop/api/auth/me` ต้องได้ HTTP 401 จาก API ไม่ใช่ HTML ของ Vue
4. ล็อกอินด้วยบัญชีจริง แล้วทดสอบรูปและไฟล์แนบผ่าน `/somtop/uploads/`
5. ตรวจ `pm2 status` ว่า `somtop-api` เป็น `online` และดู `C:\xampp\apache\logs\error.log` ถ้า proxy ไม่ทำงาน

ถ้าเครื่องลูกข่ายยังเรียก `http://10.xx.xx.xx:8000/api/...` แสดงว่าโหลด JavaScript build เก่า ให้ดึง `main` ล่าสุด รัน `update_somtop.bat` บนเซิร์ฟเวอร์ และกด `Ctrl+Shift+R` ที่เครื่องลูกข่าย คำขอใหม่ต้องเป็น `http://10.xx.xx.xx/somtop/api/...` ถ้าเป็น URL นี้แล้วได้ 502 ให้ตรวจ `pm2 status` กับ Apache proxy config

ถ้า `/somtop/api/auth/me` ได้ **404 เป็นหน้า HTML ของ Apache** แสดงว่า Apache ยังไม่ส่ง `/somtop/api/` ไป Node ให้ตรวจว่า `C:\xampp\apache\conf\httpd.conf` มี `Include "C:/xampp/apache/conf/extra/somtop.conf"` และในไฟล์ที่ include มี `ProxyPass "/somtop/api/" "http://127.0.0.1:8088/api/"` จากนั้นรัน `C:\xampp\apache\bin\httpd.exe -t` แล้ว restart Apache ใน XAMPP หากใช้ VirtualHost ให้ตรวจด้วย `httpd.exe -S` ว่า config proxy ถูกใช้กับ VirtualHost ของ `10.xx.xx.xx:80` ด้วย บนเซิร์ฟเวอร์ให้ลอง `http://127.0.0.1:8088/api/auth/me` โดยตรงก่อน ซึ่งควรตอบ 401 เป็น JSON หากเชื่อมต่อไม่ได้ ให้ตรวจ `pm2 status` และ `pm2 logs somtop-api`

## อัปเดตในครั้งต่อไป

สำรองฐานข้อมูลและ `backend\uploads` ก่อนอัปเดต จาก root โปรเจกต์รัน `git pull --ff-only origin main` แล้ว `update_somtop.bat` สคริปต์จะ build และ restart PM2; หากเปลี่ยน `APP_URL`, `APP_BASE_PATH` หรือ `PORT` ให้ restart Apache หลังอัปเดตด้วย

สีวันหยุดในหลักฐานการรับเงินอ่านจากตาราง `holidays` เฉพาะรายการสถานะ `ใช้งาน` ที่เป็นวันหยุดทั่วประเทศ (`court_code` เป็น `NULL`) หรือของศาลผู้ใช้ หากฐานข้อมูลเดิมยังไม่มีตารางนี้ ให้สำรองฐานข้อมูลแล้วนำเข้า `backend/migrations/011_holidays.sql` ผ่าน phpMyAdmin หนึ่งครั้ง จากนั้นเพิ่มวันที่ต้องการในตาราง `holidays` การ deploy โค้ดอย่างเดียวไม่ได้เพิ่มวันหยุดให้โดยอัตโนมัติ

สิทธิ์ผู้ดูแลส่วนกลางต้องใช้ `backend/migrations/012_central_admin.sql` ให้ผู้ดูแลฐานข้อมูลรัน migration ก่อนอัปเดตโค้ด จากนั้นตรวจด้วย `node backend/scripts/check_production_update.js admin` และเลื่อนสิทธิ์บัญชี `admin` หลัง API รุ่นใหม่เริ่มทำงานแล้ว ตาม `PRODUCTION_UPDATE_2026-10-07.md` สคริปต์เลื่อนสิทธิ์ไม่ต้องใช้สิทธิ์ ALTER ของฐานข้อมูล

หากต้องอัปเดตเฉพาะหน้าเว็บ ให้รัน `git pull --ff-only origin main` แล้ว `update_somtop_frontend.bat` จาก root โปรเจกต์ สคริปต์จะติดตั้ง dependency ของ frontend, build ด้วยค่าใน `.env` และคัดลอกผลลัพธ์ไปยัง `APACHE_DOCUMENT_ROOT\somtop` โดยไม่ติดตั้ง backend, ไม่แตะ PM2 และไม่แก้ config Apache หลังเสร็จให้ผู้ใช้กด `Ctrl+Shift+R` เพื่อโหลดไฟล์ JavaScript ใหม่

ระหว่างอัปเดต สคริปต์จะหยุด `somtop-api` ก่อน `npm ci` เพื่อให้ Windows ปล่อยไฟล์ native เช่น `bcrypt_lib.node` แล้วเริ่มบริการใหม่หลัง deploy หาก deploy ล้มเหลว สคริปต์จะพยายามเริ่มบริการเดิมกลับ หากยังพบ `EPERM` ให้ตรวจโปรเซส Node อื่นหรือโปรแกรมสแกนไวรัสที่กำลังเปิดไฟล์นั้นก่อนลองใหม่

HTTP ภายใน LAN ส่งรหัสผ่านและข้อมูลส่วนบุคคลแบบไม่เข้ารหัส ควรจำกัดเครือข่ายที่เข้าถึงและใช้ HTTPS เมื่อพร้อม
