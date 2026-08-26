นี่คือไฟล์สำหรับเก็บข้อมูลการออกแบบ (Design System) และประวัติการปรับปรุงโปรแกรม (Changelog) ของ **"โปรแกรมบริหารจัดการ พ.สมทบ"** ครับ

คุณสามารถคัดลอกข้อความด้านล่างนี้ไปบันทึกเป็นไฟล์ชื่อ `PROJECT_DOCUMENTATION.md` หรือ `README.md` ไว้ในโฟลเดอร์หลักของโปรเจกต์ได้เลยครับ:

---

# 📖 เอกสารโครงการ: โปรแกรมบริหารจัดการ พ.สมทบ (Somtop Project)

เอกสารฉบับนี้รวบรวมข้อกำหนดการออกแบบ (Design System) และประวัติการพัฒนาของระบบ เพื่อใช้เป็นคู่มืออ้างอิงสำหรับนักพัฒนาในการบำรุงรักษาและต่อยอดโปรเจกต์

---

## 🎨 ส่วนที่ 1: ข้อกำหนดการออกแบบ (Design System)

รูปแบบของระบบได้ถูกปรับปรุงจากแนวคิดเดิม (Dark Mode - WattVision) มาสู่ **Light Mode สไตล์ Enterprise Dashboard** เพื่อให้ดูเป็นทางการ สะอาดตา และเหมาะสมกับหน่วยงานราชการ/องค์กร 

### 1. โทนสีหลัก (Color Palette)

* 
**พื้นหลังหน้าเว็บ (Main Background):** สีเทาอ่อน `#F4F6F9` 


* 
**แถบเมนูด้านซ้าย (Sidebar):** สีน้ำเงินอมม่วงเข้ม `#484B6A` 


* 
**ส่วนหัวของ Sidebar (Logo Area):** สี `#3F425E` 


* 
**พื้นผิวการ์ดและแถบด้านบน (Cards & Topbar):** สีขาว `#FFFFFF` 


* 
**สีหลัก/ปุ่มกด (Primary Accent):** สีเขียว Emerald `#10B981` (ใช้สำหรับปุ่มบันทึก/ส่งข้อมูล) 


* **สีสถานะ/ป้ายกำกับ (Badges):**
* ใช้งาน/ปกติ: ตัวอักษร `#065F46`, พื้นหลัง `#D1FAE5` (เขียวอ่อนพาสเทล) 


* ระงับ/ข้อผิดพลาด: ตัวอักษร `#991B1B`, พื้นหลัง `#FEE2E2` (แดงอ่อนพาสเทล) 




* **สีตัวอักษร (Typography Colors):**
* หัวข้อหลัก: `#111827` (สีดำ/เทาเข้ม) 


* ข้อความทั่วไป: `#333333` และ `#374151` 


* คำอธิบายรอง (Subtitle): `#6B7280` 





### 2. ฟอนต์ (Typography)

* 
**ฟอนต์หลัก:** `Google Sans` ควบคู่กับ `Noto Sans Thai` สำหรับภาษาไทย เพื่อความสวยงามและอ่านง่าย 


* 
**ฟอนต์สำรอง:** `sans-serif` 



### 3. รูปแบบคอมโพเนนต์ (Component Stylings)

* 
**การ์ด (Cards):** ขอบมน `12px`, เส้นขอบ `1px solid #E5E7EB`, พร้อมเงาบางๆ `box-shadow: 0 1px 3px rgba(0,0,0,0.05)` 


* 
**ตาราง (Table):** เส้นคั่นแนวนอนสี `#E5E7EB` , เมื่อเอาเมาส์ชี้แถว (Hover) ให้เปลี่ยนพื้นหลังเป็น `#F9FAFB` 


* 
**ป้ายสถานะ (Badges):** รูปแบบวงรี (Pill shape) `border-radius: 20px` 


* 
**ฟอร์ม (Inputs):** พื้นหลัง `#F9FAFB`, เมื่อคลิก (Focus) ขอบจะเปลี่ยนเป็นสีเขียว `#10B981` พร้อม Effect แสงกระจาย 



---

## 🚀 ส่วนที่ 2: ประวัติการปรับปรุงโปรแกรม (Changelog)

### v1.4.0 - UI Overhaul & Localization

* 
**Layout Redesign:** เปลี่ยนโครงสร้างหน้าจอไปใช้ `MainLayout.vue` ครอบ Router เพื่อให้ Sidebar และ Topbar ไม่ต้องโหลดใหม่เมื่อเปลี่ยนหน้า 


* 
**Enterprise Light Mode:** ปรับเปลี่ยนดีไซน์จาก Dark Mode ไปสู่โทนสว่าง (Light Mode) ทั้งโปรเจกต์ 


* 
**Localization:** เปลี่ยนภาษาหลักของระบบ และข้อความต่างๆ บน UI เป็นภาษาไทยทั้งหมด 


* 
**Dashboard Context:** ปรับแก้ข้อมูลจำลองและกราฟในหน้า `DashboardView.vue` จากข้อมูลไฟฟ้าเป็นข้อมูลสถิติ "พ.สมทบ" เพื่อสะท้อนการทำงานจริง 



### v1.3.0 - CRUD & MVC Architecture

* 
**Frontend CRUD:** สร้างหน้า `ManageSomtopView.vue` สำหรับจัดการข้อมูล พ.สมทบ (เพิ่ม, ดู, แก้ไข, ลบ) ในรูปแบบ Modal และตาราง 


* 
**Backend Refactoring:** ปรับสถาปัตยกรรม PHP ไปใช้รูปแบบ MVC (Model-View-Controller) เพื่อความเป็นระเบียบและง่ายต่อการขยายระบบ 


* 
**Axios Integration:** ตั้งค่า Axios แบบ Centralized (มี Request/Response Interceptors) เพื่อจัดการ Token และแนบ Authorization Header อัตโนมัติในทุก Request 


* 
**Error Handling:** เพิ่มระบบตรวจสอบ Error 401 ฝั่ง Frontend เมื่อ Token หมดอายุให้เด้งกลับหน้า Login อัตโนมัติ 



### v1.2.0 - Authentication & Security

* 
**JWT Implementation:** นำเทคโนโลยี JWT (JSON Web Token) มาใช้สำหรับการ Authentication เพื่อให้ระบบเป็น Stateless 


* 
**Middleware:** สร้าง `AuthMiddleware.php` เพื่อดักจับและตรวจสอบความถูกต้องของ Token ก่อนให้เข้าถึงข้อมูล API 


* 
**Environment Variables:** เพิ่มระบบอ่านไฟล์ `.env` สำหรับซ่อน Secret Key, ระยะเวลาหมดอายุ Token, และ URL ของระบบ เพื่อความปลอดภัยสูงสุด 



### v1.1.0 - Backend & Docker Setup

* 
**Docker Compose:** สร้างไฟล์ `docker-compose.yml` เพื่อผูก Service 3 ตัวเข้าด้วยกัน (PHP 8.2 Backend, Node.js 20 Frontend, MySQL 8.0) 


* 
**phpMyAdmin:** เพิ่มเครื่องมือจัดการฐานข้อมูล phpMyAdmin เข้าไปในระบบ Docker เพื่อง่ายต่อการจัดการ MySQL 


* 
**Dockerfile Fixes:** ปรับแต่ง `Dockerfile` ของฝั่ง Backend ให้รองรับคำสั่ง `zip` และ `unzip` สำหรับการติดตั้ง Composer Libraries ได้อย่างสมบูรณ์ 



### v1.0.0 - Initial Project Setup

* 
**Vue.js Bootstrapping:** เริ่มต้นโปรเจกต์ Frontend ด้วย Vue 3 และ Vite 


* 
**Initial Routing:** สร้างระบบ Vue Router สำหรับการเปลี่ยนหน้าพื้นฐาน พร้อมตั้งค่า Route Guard (`beforeEnter`) เพื่อป้องกันคนไม่ล็อกอินแอบเข้าดูข้อมูล 


* 
**Dark Mode Concepts:** สร้างหน้าจอ Login พื้นฐานที่เคยอ้างอิงจากดีไซน์ "WattVision" 



---