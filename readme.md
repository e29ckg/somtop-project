# ⚖️ โปรแกรมบริหารจัดการ พ.สมทบ (Somtop Management System)

ระบบสารสนเทศสำหรับบริหารจัดการข้อมูลผู้พิพากษาสมทบ วาระการทำงาน การลา กิจกรรม เวรปฏิบัติหน้าที่ และเอกสารที่เกี่ยวข้อง

ปรับปรุงคู่มือ: 21 ตุลาคม 2569 (2026-10-21)

## ใช้งานบนเครื่องนี้

เปิด **http://localhost/somtop/** ผ่าน Apache พอร์ต **80** เลือกกรอกชื่อผู้ใช้/รหัสผ่านบัญชี Somtop หรือกด **เข้าสู่ระบบด้วย Auth-Hub** Portal กลางอยู่ที่ **http://localhost/auth/portal** เครื่องนี้เชื่อมบัญชี Hub `admin-local` (ID `1`) กับบัญชี Somtop `admin` และให้ role ระบบ `somtop` เป็น `admin` ใน Hub

| หน้าที่ | โฟลเดอร์บนเครื่องนี้ |
| --- | --- |
| แก้โค้ดในแชตนี้ | `C:\Users\PKKJC-IT-519\.codex\worktrees\f40b\somtop-project` |
| โปรแกรมที่ deploy และ Backend | `C:\project\somtop-project` |
| หน้าเว็บที่ Apache ให้บริการ | `C:\xampp\htdocs\somtop` |
| Auth-Hub | `C:\project\Auth-Hub` |

Worktree อาจเปลี่ยนตามงาน การแก้โค้ดหรือ push GitHub ยังไม่เปลี่ยนเว็บจริงจนกว่าจะ deploy ไม่แก้ซอร์ส Vue ใน `htdocs\somtop` เพราะ build ครั้งต่อไปจะเขียนทับ

คู่มือที่เกี่ยวข้อง: [การใช้งานและภาพรวม](PROJECT_DOCUMENTATION.md), [แก้โค้ดและ deploy](DEVELOPMENT.md), [Auth-Hub SSO](AUTH_HUB.md), [XAMPP/PM2](DEPLOY_XAMPP.md), [Backend](BACKEND.md), [Frontend](frontend/README.md), [Design System](DESIGN.md) และ [ประวัติการเปลี่ยนแปลง](CHANGELOG.md)

`localhost` หมายถึงเครื่องที่เปิด browser หากเข้าจากเครื่องอื่นต้องตั้ง hostname/HTTPS และ callback ให้ตรงกัน พอร์ต `8088` เป็น API ภายในเครื่อง ไม่ใช่พอร์ตที่ผู้ใช้เข้าเว็บ

## 🛠️ เทคโนโลยีที่ใช้งาน (Tech Stack)

*   **Frontend:** Vue.js 3 (Vite), Vue Router
*   **Backend:** Node.js, Express.js
*   **Database:** MySQL (เชื่อมต่อผ่าน `mysql2` Connection Pool)
*   **Authentication:** เลือกได้ทั้งบัญชี Somtop (JWT/HttpOnly cookie) และ Auth-Hub SSO (authorization code + PKCE S256) เมื่อกำหนด AUTH_HUB_URL หากไม่กำหนดจะแสดงเฉพาะบัญชี Somtop

## ✨ ฟีเจอร์หลัก (Key Features)

*   **ระบบยืนยันตัวตน:** ทั้งสองวิธีใช้ข้อมูลบัญชีและศาลจาก Somtop ถ้าเลือก Auth-Hub จะตรวจ session กับ Hub ทุก protected API และรองรับ logout กลาง รหัสผ่านบัญชี Somtop จัดการใน Somtop ส่วนรหัสผ่าน/MFA ของ Hub จัดการที่ Hub
*   **แดชบอร์ดสถิติ:** แสดงภาพรวมจำนวน พ.สมทบ, สถานะการปฏิบัติหน้าที่, และการแจ้งเตือนล่าสุด
*   **จัดการข้อมูล พ.สมทบ:** เพิ่ม ลบ แก้ไข ข้อมูลส่วนตัว พร้อมระบบอัปโหลดรูปโปรไฟล์ (กรองข้อมูลตามศาลที่สังกัดอัตโนมัติ)
*   **ระบบประวัติการลา:** บันทึกการลางาน (ลาป่วย, ลากิจ, ฯลฯ) พร้อมแนบไฟล์เอกสาร
*   **จัดการข้อมูลหน่วยงานศาล (Admin):** เพิ่ม ลบ แก้ไข ข้อมูลศาลต่างๆ ในระบบ พร้อมระบบค้นหาแบบ Dropdown

## 📁 โครงสร้างโปรเจกต์ (Project Structure)
```text
somtop-project/
├── frontend/               # หน้าเว็บ Vue.js (รันบนพอร์ต 5173 หรือ Apache)
├── backend/                # API Node.js (รันบนพอร์ต 8088 ผ่าน PM2)
│   ├── src/
│   │   ├── controllers/    # จัดการลอจิกและฐานข้อมูล
│   │   ├── middlewares/    # ตรวจสอบสิทธิ์ (Auth) และจัดการไฟล์ (Multer)
│   │   └── routes/         # เส้นทาง API (Endpoints)
│   ├── uploads/            # แหล่งเก็บรูปภาพและใบลา
│   └── server.js           # จุดสตาร์ท Backend
└── .gitignore              # ไฟล์ยกเว้นการอัปโหลดขึ้น Git

```

## 🚀 การติดตั้งและใช้งาน (สำหรับการพัฒนา - Development)

1. ติดตั้ง Node.js และเปิดใช้งาน MySQL (ผ่าน XAMPP หรือ Docker)


2. โคลนโปรเจกต์ และติดตั้งแพ็กเกจทั้งสองฝั่ง:
```bash
npm run install:all

```


3. คัดลอกไฟล์ `.env.example` เป็น `.env` เฉพาะเมื่อยังไม่มีไฟล์เดิม ตั้งฐานข้อมูลสำหรับพัฒนา ใช้ `APP_ENV=development`, `APP_URL=http://localhost:5173`, `FRONTEND_URL=http://localhost:5173`, `COOKIE_PATH=/` และ `COOKIE_SECURE=false` ใช้ Node.js `^22.18.0` หรือ `>=24.12.0` ตาม Frontend หากทดสอบ SSO ผ่าน Vite ต้องลงทะเบียน client/callback แยกจากระบบจริงตาม [AUTH_HUB.md](AUTH_HUB.md)


4. รันระบบทั้งหมดพร้อมกัน (ผ่าน Concurrently):
```bash
npm run dev

```



## ☁️ การนำขึ้นใช้งานจริง (Deployment - Windows Server)

สำหรับการติดตั้งภายในด้วย XAMPP/Apache, MySQL และ Node.js/PM2 ให้ทำตาม [คู่มือติดตั้ง XAMPP](DEPLOY_XAMPP.md) โดยตั้ง URL, path, พอร์ต และตำแหน่ง XAMPP ของแต่ละเครื่องใน `.env` ที่ root โปรเจกต์



### 🗄️ โครงสร้างตารางฐานข้อมูลหลัก (Database Schema)

ระบบใช้ฐานข้อมูล MySQL โดยออกแบบให้รองรับการแยกข้อมูลตามศาล (Multi-tenant) และมีการเก็บประวัติการใช้งานอย่างครบถ้วน:

* **`users`**: เก็บบัญชี Somtop, role `admin`/`view`, รหัสศาล (`court_code`) และ `auth_version` บัญชี Auth-Hub อยู่คนละฐานข้อมูลและจับคู่ด้วย `AUTH_HUB_USER_MAP`.


* **`somtop`**: เก็บประวัติ พ.สมทบ โดยแยกฟิลด์คำนำหน้า ชื่อ และสกุล (`title`, `first_name`, `last_name`) เก็บเลขบัตรประชาชนแบบ UNIQUE และมีฟิลด์ `photo_path` สำหรับเก็บที่อยู่ไฟล์รูปภาพ.


* **`leave_requests`**: เก็บประวัติการลา รองรับการลาแบบครึ่งวันด้วยทศนิยม (`total_days` เป็น DECIMAL) และเก็บไฟล์แนบใบลาผ่าน `file_path` โดยเชื่อมโยงกับตาราง พ.สมทบ และตารางประเภทการลา (`leave_types`).


* **`courts`**: เก็บข้อมูลศาลส่วนกลาง เช่น รหัสศาล ชื่อศาล ที่อยู่ และจังหวัด.


* **`activity_logs`**: เก็บประวัติการใช้งานระบบ (Audit Log) ว่าใครทำการเพิ่ม ลบ หรือแก้ไขข้อมูลส่วนใดบ้าง.



---

### 🌐 วิธีการใช้งาน API Endpoints

API ภายใน Backend ใช้ Base URL `/api` ส่วน browser เรียก `/somtop/api` ผ่าน Apache Middleware `verifyToken` เลือกตรวจ session กับ Auth-Hub หรือ local JWT ตาม configuration แล้วอ่านบัญชีปัจจุบันจากฐานข้อมูล ไม่ใช้ข้อมูล localStorage เป็นหลักฐานยืนยันสิทธิ์ ดู endpoint ของ login ใน [BACKEND.md](BACKEND.md)

* **`GET /api/somtop`**: ดึงข้อมูลตามสิทธิ์และขอบเขตศาลที่ Backend ตรวจจากบัญชีปัจจุบัน (`req.user`) ไม่เชื่อค่าศาลที่ Frontend อ้างเอง.


* **`POST /api/somtop`**: ใช้เพิ่มข้อมูลใหม่ รองรับการอัปโหลดไฟล์รูปภาพผ่าน `multipart/form-data` ด้วยไลบรารี Multer. หากเกิด Error (เช่น เลขบัตรประชาชนซ้ำ) ระบบจะลบไฟล์ขยะที่เพิ่งอัปโหลดทิ้งทันที.


* **`PUT /api/somtop`**: ใช้แก้ไขข้อมูล หากมีการแนบรูปภาพใหม่เข้ามา ระบบจะอัปโหลดรูปใหม่และสั่งลบไฟล์รูปเก่าออกจากเซิร์ฟเวอร์ให้โดยอัตโนมัติ.


* **`DELETE /api/leaves/:id`**: ใช้ลบข้อมูลประวัติการลา (ระบุ ID ผ่าน URL) พร้อมกับลบไฟล์ PDF ใบลาออกจากระบบ.


