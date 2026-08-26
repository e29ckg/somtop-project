CREATE DATABASE IF NOT EXISTS somtop_db;
USE somtop_db;

-- ==========================================
-- 1. ตารางผู้ใช้งานระบบ
-- ==========================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    court_code VARCHAR(50) DEFAULT NULL COMMENT 'รหัสหน่วยงาน เช่น pkk',
    role ENUM('admin', 'viewer') DEFAULT 'viewer',
    last_login DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP 
);

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

CREATE TABLE IF NOT EXISTS `somtop` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(50) NOT NULL COMMENT 'คำนำหน้าชื่อ',
  `first_name` varchar(100) NOT NULL COMMENT 'ชื่อ',
  `last_name` varchar(100) NOT NULL COMMENT 'สกุล',
  `id_card` varchar(20) DEFAULT NULL UNIQUE COMMENT 'เลขบัตรประชาชน',
  `court_code` VARCHAR(50) DEFAULT NULL COMMENT 'รหัสหน่วยงาน เช่น pkk',
  `dob` date DEFAULT NULL COMMENT 'วัน/เดือน/ปีเกิด',
  `address` text DEFAULT NULL COMMENT 'ที่อยู่',
  `phone` varchar(50) DEFAULT NULL COMMENT 'เบอร์โทร',
  `status` varchar(50) DEFAULT 'ใช้งาน' COMMENT 'สถานะ',
  `note` text DEFAULT NULL COMMENT 'หมายเหตุ',
  `photo_path` varchar(255) DEFAULT NULL COMMENT 'ฟิลด์เก็บ Path ของรูปภาพ',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_court_code` (`court_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



-- ==========================================
-- 3. ตารางประเภทการลา (leave_types)
-- ==========================================
CREATE TABLE leave_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT 'ชื่อประเภทการลา',
    status ENUM('ใช้งาน', 'ระงับ') DEFAULT 'ใช้งาน' COMMENT 'สถานะให้เลือกใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- เพิ่มข้อมูลประเภทการลาพื้นฐาน (Admin สามารถเพิ่ม/ลบได้ทีหลัง)
INSERT INTO leave_types (name) VALUES 
('ลาป่วย'), 
('ลากิจส่วนตัว'), 
('ลาพักผ่อน'), 
('อื่นๆ');

-- ==========================================
-- 4. ตารางประวัติการยื่นใบลา (leave_requests)
-- ==========================================
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
    
    -- ตั้งค่า Foreign Key เพื่อเชื่อมข้อมูล
    FOREIGN KEY (somtop_id) REFERENCES somtop(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
    
    INDEX `idx_leave_court_code` (`court_code`) 
);

CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL COMMENT 'ID ผู้ใช้งาน (อ้างอิงจากตาราง users)',
    username VARCHAR(50) NOT NULL COMMENT 'ชื่อผู้ใช้งานขณะทำรายการ',
    action VARCHAR(50) NOT NULL COMMENT 'เช่น เพิ่มข้อมูล, แก้ไขข้อมูล, ลบข้อมูล, เข้าสู่ระบบ',
    module VARCHAR(100) NOT NULL COMMENT 'เมนูหรือตารางที่ทำรายการ เช่น สมาชิก, ประวัติการลา',
    details TEXT NULL COMMENT 'รายละเอียดเพิ่มเติม (บันทึกเป็น JSON หรือข้อความ)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE name_titles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE COMMENT 'คำนำหน้าชื่อ',
    status ENUM('ใช้งาน', 'ระงับ') DEFAULT 'ใช้งาน' COMMENT 'สถานะการใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO name_titles (name) VALUES 
('นาย'), 
('นาง'), 
('นางสาว'),
('หม่อมหลวง'),
('หม่อมราชวงศ์'),
('พลเอก'),
('พลโท'),
('พลตรี'),
('พันเอก'),
('พันโท'),
('พันตรี'),
('ร้อยเอก'),
('ร้อยโท'),
('ร้อยตรี'),
('ว่าที่ร้อยตรี');