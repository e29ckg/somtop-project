# Deploy ผ่าน XAMPP ในเครือข่ายภายใน

XAMPP/Apache ให้บริการไฟล์ Vue และ proxy `/api/` กับ `/uploads/` ไปยัง Node.js บนเครื่องเดียวกัน MySQL ใช้ของ XAMPP โดยตรง โปรเจกต์ควรอยู่ **นอก** `htdocs` เพื่อป้องกันไฟล์ `.env` และไฟล์อัปโหลด

## ตั้งค่าที่ต้องเปลี่ยนในแต่ละเครื่อง

คัดลอก `.env.example` เป็น `.env` ที่ root โปรเจกต์ แล้วแก้ค่าในไฟล์นี้เท่านั้น:

- `APP_URL` คือ URL ที่ผู้ใช้เปิด เช่น เครื่องทดสอบ `http://localhost:8099/somtop` หรือเครื่องจริง `http://10.37.64.1/somtop`
- `APP_BASE_PATH` คือ path ของเว็บ เช่น `/somtop/` ต้องตรงกับ path ใน `APP_URL`
- `FRONTEND_URL` คือ origin ของ `APP_URL` โดยไม่มี `/somtop` เช่น `http://10.37.64.1`
- `XAMPP_ROOT` คือ path ติดตั้ง XAMPP เช่น `C:/xampp`
- `HOST=127.0.0.1` และ `PORT=8088` กำหนด API ที่ Apache จะส่งต่อภายในเครื่อง
- `DB_*` และ `JWT_SECRET` ตั้งค่าฐานข้อมูลและ secret จริง ห้าม commit `.env`
- `COOKIE_SECURE=false` สำหรับ HTTP ภายใน; เมื่อใช้ HTTPS ให้เป็น `true`

ระบบอ่าน `.env` ที่ root ทั้งตอน build หน้าเว็บและตอนเริ่ม API สคริปต์ deploy จะสร้าง `.htaccess` กับ Apache proxy config จากค่าเหล่านี้เอง ไม่ต้องแก้ IP/path/port ในซอร์สโค้ด

## ติดตั้งและ deploy

เปิด Apache และ MySQL ใน XAMPP ติดตั้ง Node.js ที่รองรับ Vite (`^22.18.0` หรือ `>=24.12.0`) จากนั้นรัน PowerShell แบบ Administrator จาก root โปรเจกต์:

```powershell
.\deploy_xampp.ps1 -ConfigureApache
```

สคริปต์จะติดตั้ง dependency, build หน้าเว็บ, คัดลอกไปยัง `htdocs`, สร้าง proxy config ใน `C:\xampp\apache\conf\extra\somtop.conf` และเพิ่ม `Include` ใน `httpd.conf` พร้อมสำรองไฟล์เดิมและตรวจ Apache syntax หลังรันให้ restart Apache ผ่าน XAMPP Control Panel การรันซ้ำจะไม่เพิ่ม `Include` ซ้ำ

เริ่ม Node API จากโฟลเดอร์ `backend`:

```powershell
cd backend
node server.js
```

สำหรับใช้งานจริงให้รัน API ต่อเนื่องด้วย PM2 หรือ Windows service โดยให้ working directory เป็น `backend` และตั้งให้เริ่มหลัง reboot สคริปต์ `update_somtop.bat` จะ build/deploy และ restart PM2 ถ้ามี PM2 อยู่

หากฐานข้อมูลยังไม่มี ให้นำเข้า `somtop_db.sql` ก่อน แล้วตรวจ migration ใน `backend/migrations` ตามลำดับ สำรองฐานข้อมูลเดิมก่อนปรับ schema เครื่องที่มี `somtop_db` อยู่แล้วไม่ควรนำเข้า SQL ทับ

## ตรวจผล

1. เปิด URL ใน `APP_URL` จากเครื่องลูกข่าย หน้าเว็บและ CSS/JS ต้องโหลดครบ
2. เปิด `${APP_URL}/dashboard` โดยตรง ต้องได้หน้าเว็บ ไม่ใช่ Apache 404
3. เข้าสู่ระบบและเปิดรูป/ไฟล์แนบ เพื่อตรวจ proxy API และ cookie
4. พอร์ต Node (`PORT`) ควรฟังแค่ `127.0.0.1`; เปิดให้เครื่องลูกข่ายเข้าถึงเฉพาะพอร์ต Apache

HTTP ภายใน LAN ส่งรหัสผ่านและข้อมูลส่วนบุคคลแบบไม่เข้ารหัส ควรจำกัดเครือข่ายที่เข้าถึงและใช้ HTTPS เมื่อพร้อม
