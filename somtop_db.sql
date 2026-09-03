CREATE DATABASE IF NOT EXISTS somtop_db;
USE somtop_db;

-- ==========================================
-- หมวดที่ 1: ข้อมูลพื้นฐานระบบ (Master Data)
-- ==========================================

-- 1.1 ตารางหน่วยงานศาล
CREATE TABLE courts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    court_code VARCHAR(50) NOT NULL UNIQUE COMMENT 'รหัสหน่วยงาน (เช่น pkk)',
    court_name VARCHAR(255) NOT NULL COMMENT 'ชื่อหน่วยงาน',
    address TEXT COMMENT 'ที่อยู่',
    phone VARCHAR(50) COMMENT 'เบอร์โทร',
    email VARCHAR(100) COMMENT 'อีเมล',
    province VARCHAR(100) NULL COMMENT 'จังหวัด',
    status ENUM('ใช้งาน', 'ระงับ') DEFAULT 'ใช้งาน' COMMENT 'สถานะการใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 1.2 ตารางคำนำหน้าชื่อ
CREATE TABLE name_titles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE COMMENT 'คำนำหน้าชื่อ',
    status ENUM('ใช้งาน', 'ระงับ') DEFAULT 'ใช้งาน' COMMENT 'สถานะการใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT INTO name_titles (name) VALUES 
('นาย'), ('นาง'), ('นางสาว'), ('หม่อมหลวง'), ('หม่อมราชวงศ์'),
('พลเอก'), ('พลโท'), ('พลตรี'), ('พันเอก'), ('พันโท'), ('พันตรี'),
('ร้อยเอก'), ('ร้อยโท'), ('ร้อยตรี'), ('ว่าที่ร้อยตรี');

-- 1.3 ตารางตำแหน่ง พ.สมทบ (รองรับการจัดเรียงอาวุโส)
CREATE TABLE somtop_positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT 'ชื่อตำแหน่ง',
    level INT NOT NULL DEFAULT 99 COMMENT 'ระดับความสำคัญ (เลขน้อย = อาวุโสมาก)',
    status ENUM('ใช้งาน', 'ระงับ') DEFAULT 'ใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT INTO somtop_positions (name, level) VALUES
('ประธานผู้พิพากษาสมทบ', 1), ('รองประธาน', 2), ('เลขา', 3), ('สมทบ', 4);

-- 1.4 ตารางประเภทการลา
CREATE TABLE leave_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT 'ชื่อประเภทการลา',
    status ENUM('ใช้งาน', 'ระงับ') DEFAULT 'ใช้งาน' COMMENT 'สถานะให้เลือกใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT INTO leave_types (name) VALUES 
('ลาป่วย'), ('ลากิจส่วนตัว'), ('ลาพักผ่อน'), ('อื่นๆ');

-- 1.5 ตารางประเภทกิจกรรม
CREATE TABLE event_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT 'ชื่อประเภทกิจกรรม',
    status ENUM('ใช้งาน', 'ระงับ') DEFAULT 'ใช้งาน' COMMENT 'สถานะการให้เลือกใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT INTO event_types (name) VALUES 
('การประชุม'), ('งานพิธี'), ('กิจกรรมของหน่วยงาน'), ('อื่นๆ');

ALTER TABLE leave_requests MODIFY file_path TEXT COMMENT 'เก็บ path ไฟล์แนบแบบ Array JSON เช่น ["file1.pdf", "file2.jpg"]';
ALTER TABLE events ADD file_paths TEXT NULL COMMENT 'เก็บ path ไฟล์แนบแบบ Array JSON เช่น ["file1.pdf", "file2.jpg"]';

-- ==========================================
-- หมวดที่ 2: ข้อมูลผู้ใช้งานและพนักงาน (Core Entities)
-- ==========================================

-- 2.1 ตารางผู้ใช้งานระบบ
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    court_code VARCHAR(50) DEFAULT NULL COMMENT 'รหัสหน่วยงาน เช่น pkk',
    role ENUM('admin', 'viewer') DEFAULT 'viewer',
    last_login DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    failed_login_attempts INT DEFAULT 0 COMMENT 'จำนวนครั้งที่ล็อกอินผิด',
    lockout_until DATETIME NULL COMMENT 'เวลาที่จะปลดล็อกอัตโนมัติ'
);

-- 2.2 ตารางรายชื่อผู้พิพากษาสมทบ
CREATE TABLE IF NOT EXISTS somtop (
  id int(11) NOT NULL AUTO_INCREMENT,
  title varchar(50) NOT NULL COMMENT 'คำนำหน้าชื่อ',
  first_name varchar(100) NOT NULL COMMENT 'ชื่อ',
  last_name varchar(100) NOT NULL COMMENT 'สกุล',
  id_card varchar(20) DEFAULT NULL UNIQUE COMMENT 'เลขบัตรประชาชน',
  court_code VARCHAR(50) DEFAULT NULL COMMENT 'รหัสศาลที่สังกัด',
  dob date DEFAULT NULL COMMENT 'วัน/เดือน/ปีเกิด',
  join_date date DEFAULT NULL COMMENT 'วันที่เข้ารับตำแหน่ง',
  position_id int(11) DEFAULT NULL COMMENT 'อ้างอิงตาราง somtop_positions',
  address text DEFAULT NULL COMMENT 'ที่อยู่',
  phone varchar(50) DEFAULT NULL COMMENT 'เบอร์โทร',
  status varchar(50) DEFAULT 'ใช้งาน' COMMENT 'สถานะ',
  note text DEFAULT NULL COMMENT 'หมายเหตุ',
  photo_path varchar(255) DEFAULT NULL COMMENT 'ฟิลด์เก็บ Path ของรูปภาพ',
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  INDEX idx_court_code (court_code),
  CONSTRAINT fk_somtop_position FOREIGN KEY (position_id) REFERENCES somtop_positions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ==========================================
-- หมวดที่ 3: ระบบบันทึกการทำรายการ (Transactions & Logs)
-- ==========================================

-- 3.1 ตารางประวัติการยื่นใบลา
CREATE TABLE leave_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    somtop_id INT(11) NOT NULL COMMENT 'เชื่อมกับตาราง somtop',
    leave_type_id INT NOT NULL COMMENT 'เชื่อมกับตาราง leave_types',
    court_code VARCHAR(50) DEFAULT NULL COMMENT 'รหัสหน่วยงาน เช่น pkk', 
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(4,1) NOT NULL COMMENT 'จำนวนวันลา (ใช้ทศนิยมรองรับการลาครึ่งวันได้)',
    note TEXT COMMENT 'เหตุผล/หมายเหตุ',
    file_path VARCHAR(255) NULL COMMENT 'เก็บ path ไฟล์แนบใบลา (PDF)',
    status ENUM('รอตรวจสอบ', 'อนุมัติแล้ว', 'ไม่อนุมัติ') DEFAULT 'รอตรวจสอบ',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (somtop_id) REFERENCES somtop(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
    INDEX `idx_leave_court_code` (`court_code`) 
);

-- 3.2 ตารางกิจกรรม (Events)
CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type_id INT NULL COMMENT 'อ้างอิงตาราง event_types',
    title VARCHAR(255) NOT NULL COMMENT 'หัวข้อกิจกรรม/ชื่องาน',
    description TEXT COMMENT 'รายละเอียดกิจกรรม',
    start_date DATETIME NOT NULL COMMENT 'วัน-เวลา เริ่มต้น',
    end_date DATETIME NOT NULL COMMENT 'วัน-เวลา สิ้นสุด',
    location VARCHAR(255) COMMENT 'สถานที่จัดกิจกรรม',
    court_code VARCHAR(50) NOT NULL COMMENT 'รหัสศาล (จำกัดการมองเห็นตามศาล)',
    created_by INT NULL COMMENT 'ID ผู้สร้างกิจกรรม (อ้างอิงตาราง users)',
    status ENUM('รอดำเนินการ', 'กำลังดำเนินการ', 'เสร็จสิ้น', 'ยกเลิก') DEFAULT 'รอดำเนินการ' COMMENT 'สถานะกิจกรรม',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_event_court_code (court_code)
);

-- 3.3 ตารางผู้เข้าร่วมกิจกรรม
CREATE TABLE event_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL COMMENT 'อ้างอิง ID ของกิจกรรม',
    somtop_id INT NOT NULL COMMENT 'อ้างอิง ID ของ พ.สมทบ ที่เข้าร่วม',
    status ENUM('รอตอบรับ', 'ยืนยันเข้าร่วม', 'ไม่เข้าร่วม') DEFAULT 'รอตอบรับ' COMMENT 'สถานะการเข้าร่วม',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (somtop_id) REFERENCES somtop(id) ON DELETE CASCADE,
    UNIQUE KEY unique_participant (event_id, somtop_id) 
);

-- 3.4 ตารางเก็บประวัติการใช้งาน (Audit Logs)
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL COMMENT 'ID ผู้ใช้งาน (อ้างอิงจากตาราง users)',
    username VARCHAR(50) NOT NULL COMMENT 'ชื่อผู้ใช้งานขณะทำรายการ',
    action VARCHAR(50) NOT NULL COMMENT 'เช่น เพิ่มข้อมูล, แก้ไขข้อมูล, ลบข้อมูล, เข้าสู่ระบบ',
    module VARCHAR(100) NOT NULL COMMENT 'เมนูหรือตารางที่ทำรายการ',
    details TEXT NULL COMMENT 'รายละเอียดเพิ่มเติม (บันทึกเป็น JSON หรือข้อความ)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- เพิ่มคอลัมน์ google_event_id ในตาราง events เพื่อเก็บ ID ของกิจกรรมจาก Google Calendar
ALTER TABLE events
ADD COLUMN google_event_id VARCHAR(255) NULL COMMENT 'เก็บ ID ของกิจกรรมจาก Google Calendar' AFTER status;

CREATE TABLE IF NOT EXISTS calendar_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    calendar_id VARCHAR(255) NULL COMMENT 'อีเมล หรือ ID ของปฏิทิน',
    is_sync_enabled BOOLEAN DEFAULT TRUE COMMENT 'สถานะเปิด/ปิดการส่งข้อมูล 1=เปิด, 0=ปิด',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- เพิ่มข้อมูลแถวแรกไว้เป็นค่าเริ่มต้น (Default)
INSERT INTO calendar_settings (id, calendar_id, is_sync_enabled) 
VALUES (1, '', 1) 
ON DUPLICATE KEY UPDATE id=1;

ALTER TABLE `somtop`
ADD COLUMN `occupation` varchar(150) DEFAULT NULL COMMENT 'อาชีพ' AFTER `dob`;

ALTER TABLE events 
ADD UNIQUE KEY unique_event (title, start_date, court_code);