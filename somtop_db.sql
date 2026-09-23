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
    chief_judge_name VARCHAR(255) NULL COMMENT 'ชื่อผู้พิพากษาหัวหน้าศาล',
    chief_judge_position VARCHAR(255) NULL COMMENT 'ตำแหน่งผู้พิพากษาหัวหน้าศาล',
    director_name VARCHAR(255) NULL COMMENT 'ชื่อผู้อำนวยการ',
    director_position VARCHAR(255) NULL COMMENT 'ตำแหน่งผู้อำนวยการ',
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
  house_no varchar(50) DEFAULT NULL COMMENT 'บ้านเลขที่',
  moo varchar(20) DEFAULT NULL COMMENT 'หมู่ที่',
  soi varchar(100) DEFAULT NULL COMMENT 'ซอย',
  road varchar(100) DEFAULT NULL COMMENT 'ถนน',
  subdistrict varchar(100) DEFAULT NULL COMMENT 'ตำบล/แขวง',
  district varchar(100) DEFAULT NULL COMMENT 'อำเภอ/เขต',
  province varchar(100) DEFAULT NULL COMMENT 'จังหวัด',
  postal_code varchar(10) DEFAULT NULL COMMENT 'รหัสไปรษณีย์',
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

CREATE TABLE working_terms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    generation_name VARCHAR(100) NOT NULL COMMENT 'รุ่นที่ (เช่น รุ่นที่ 1, วาระปี 2567-2570)',
    start_date DATE NOT NULL COMMENT 'ตั้งแต่วันที่เริ่มต้น',
    end_date DATE NOT NULL COMMENT 'วันหมดวาระ',
    
    -- ⭐️ ฟิลด์ที่แนะนำเพิ่มเติมเพื่อให้ระบบสมบูรณ์
    court_code VARCHAR(50) NOT NULL COMMENT 'รหัสศาล (เพื่อให้แยกข้อมูลวาระของแต่ละศาลได้)',
    status ENUM('กำลังดำรงตำแหน่ง', 'หมดวาระ', 'ยกเลิก') DEFAULT 'กำลังดำรงตำแหน่ง' COMMENT 'สถานะของวาระ',
    note TEXT NULL COMMENT 'หมายเหตุเพิ่มเติม',
    
    -- มาตรฐานการเก็บเวลาของระบบ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_term_court_code (court_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE somtop 
ADD COLUMN term_id INT NULL COMMENT 'อ้างอิงวาระการทำงาน (รุ่นที่)' AFTER position_id,
ADD CONSTRAINT fk_somtop_term FOREIGN KEY (term_id) REFERENCES working_terms(id) ON DELETE SET NULL;

CREATE TABLE somtop_term_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    somtop_id INT(11) NOT NULL COMMENT 'อ้างอิง ID ของ พ.สมทบ',
    term_id INT NOT NULL COMMENT 'อ้างอิง ID ของวาระการทำงาน (ตาราง working_terms)',
    
    -- สถานะแยกเฉพาะวาระนั้นๆ เผื่อกรณีลาออกก่อนหมดวาระ
    status ENUM('กำลังดำรงตำแหน่ง', 'หมดวาระ', 'พ้นจากตำแหน่ง') DEFAULT 'กำลังดำรงตำแหน่ง' COMMENT 'สถานะในวาระนี้',
    note TEXT NULL COMMENT 'หมายเหตุเพิ่มเติม (เช่น ลาออกก่อนกำหนด, ต่อวาระ)',
    
    -- มาตรฐานการเก็บเวลาของระบบ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- ตั้งค่า Foreign Key เพื่อเชื่อมข้อมูลและลบอัตโนมัติหากมีการลบข้อมูลหลัก
    FOREIGN KEY (somtop_id) REFERENCES somtop(id) ON DELETE CASCADE,
    FOREIGN KEY (term_id) REFERENCES working_terms(id) ON DELETE CASCADE,
    
    -- ป้องกันการเผลอเพิ่มประวัติรุ่นเดียวกันซ้ำให้กับคนเดิม
    UNIQUE KEY unique_somtop_term (somtop_id, term_id)
);

ALTER TABLE event_participants 
MODIFY COLUMN status ENUM('รอตอบรับ', 'เข้าร่วม', 'ไม่เข้าร่วม', 'ลาประชุม') DEFAULT 'เข้าร่วม' COMMENT 'สถานะการเข้าร่วม';

-------------------

-- ==========================================
-- 1. ตารางประเภทเวรปฏิบัติหน้าที่ (duty_types)
-- ==========================================
CREATE TABLE duty_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT 'ชื่อประเภทเวร เช่น เวร, เวรต่อเนื่อง',
    status ENUM('ใช้งาน', 'ระงับ') DEFAULT 'ใช้งาน' COMMENT 'สถานะให้เลือกใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- เพิ่มข้อมูลประเภทเวรเริ่มต้นตามที่คุณต้องการ
INSERT INTO duty_types (name) VALUES 
('เวร'), 
('เวรต่อเนื่อง');

-- ==========================================
-- 2. ตารางคำสั่งเวรประจำเดือน (duty_orders)
-- ==========================================
CREATE TABLE duty_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(100) NOT NULL COMMENT 'เลขที่คำสั่ง',
    title VARCHAR(255) NOT NULL COMMENT 'ชื่อหรือหัวข้อคำสั่ง',
    order_month DATE NOT NULL COMMENT 'เดือนของคำสั่ง โดยเก็บเป็นวันแรกของเดือน',
    court_code VARCHAR(50) NOT NULL COMMENT 'รหัสศาลเจ้าของคำสั่ง',
    note TEXT NULL,
    signed_order_file_path VARCHAR(500) NULL COMMENT 'ที่อยู่ไฟล์ PDF คำสั่งที่ลงนามแล้ว',
    status ENUM('ใช้งาน', 'ยกเลิก') DEFAULT 'ใช้งาน',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_duty_order (court_code, order_number),
    INDEX idx_duty_order_month (court_code, order_month),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- 3. ตารางคณะปฏิบัติหน้าที่ คณะละ 2 คน
-- ==========================================
CREATE TABLE duty_teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    court_code VARCHAR(50) NOT NULL COMMENT 'รหัสศาล',
    team_name VARCHAR(100) NOT NULL COMMENT 'ชื่อหรือหมายเลขคณะ',
    member_one_somtop_id INT NOT NULL,
    member_two_somtop_id INT NOT NULL,
    status ENUM('ใช้งาน', 'ระงับ') DEFAULT 'ใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_duty_team_name (court_code, team_name),
    FOREIGN KEY (member_one_somtop_id) REFERENCES somtop(id) ON DELETE RESTRICT,
    FOREIGN KEY (member_two_somtop_id) REFERENCES somtop(id) ON DELETE RESTRICT,
    INDEX idx_duty_team_court_status (court_code, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- 4. ตารางผู้ปฏิบัติหน้าที่รายวัน (duty_schedules)
-- ==========================================
CREATE TABLE duty_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL COMMENT 'คำสั่งเวรประจำเดือน',
    team_id INT NULL COMMENT 'คณะที่ใช้จัดเวร โดยเปลี่ยนเวรเป็นรายบุคคล',
    somtop_id INT NOT NULL COMMENT 'ผู้ปฏิบัติหน้าที่',
    duty_type_id INT NOT NULL COMMENT 'ประเภทเวร',
    court_code VARCHAR(50) NOT NULL COMMENT 'รหัสศาล',
    duty_date DATE NOT NULL COMMENT 'วันที่ปฏิบัติหน้าที่',
    note TEXT NULL,
    status ENUM('รอปฏิบัติหน้าที่', 'ปฏิบัติหน้าที่เสร็จสิ้น', 'ขอเปลี่ยนเวร', 'ยกเลิก') DEFAULT 'รอปฏิบัติหน้าที่',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES duty_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES duty_teams(id) ON DELETE SET NULL,
    FOREIGN KEY (somtop_id) REFERENCES somtop(id) ON DELETE CASCADE,
    FOREIGN KEY (duty_type_id) REFERENCES duty_types(id) ON DELETE RESTRICT,
    UNIQUE KEY unique_order_duty_person (order_id, duty_date, somtop_id),
    INDEX idx_duty_court_date (court_code, duty_date),
    INDEX idx_duty_schedule_team (team_id),
    INDEX idx_duty_order_date (order_id, duty_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- 4. ตารางประวัติการเปลี่ยนเวร (duty_swaps)
-- ==========================================
CREATE TABLE duty_swaps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    schedule_id INT NOT NULL,
    requester_somtop_id INT NOT NULL COMMENT 'ผู้ขอเปลี่ยนเวร',
    replacement_somtop_id INT NOT NULL COMMENT 'ผู้ปฏิบัติหน้าที่แทน',
    reason TEXT NOT NULL,
    request_date DATE NOT NULL,
    court_code VARCHAR(50) NOT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (schedule_id) REFERENCES duty_schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_somtop_id) REFERENCES somtop(id) ON DELETE RESTRICT,
    FOREIGN KEY (replacement_somtop_id) REFERENCES somtop(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_duty_swap_schedule (schedule_id),
    INDEX idx_duty_swap_court_date (court_code, request_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT 'ชื่อวันหยุด เช่น วันขึ้นปีใหม่, วันสงกรานต์',
    holiday_date DATE NOT NULL COMMENT 'วันที่หยุดราชการ/วันหยุดพิเศษ',
    
    -- ใช้ DEFAULT NULL เพื่อให้แยกว่าเป็นวันหยุดทั่วประเทศ หรือหยุดเฉพาะศาล
    court_code VARCHAR(50) DEFAULT NULL COMMENT 'รหัสศาล (ถ้าเป็น NULL คือหยุดทั่วประเทศ, ถ้าระบุรหัสคือหยุดเฉพาะที่)',
    
    status ENUM('ใช้งาน', 'ระงับ') DEFAULT 'ใช้งาน' COMMENT 'สถานะให้เปิด/ปิดการใช้งานวันหยุดนี้',
    
    -- มาตรฐานการเก็บเวลาของระบบ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- เพิ่ม Index เพื่อให้ระบบตรวจสอบหาวันหยุดได้รวดเร็วขึ้นตอนจัดเวร
    INDEX idx_holiday_date (holiday_date),
    INDEX idx_holiday_court (court_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ตัวอย่างการเพิ่มข้อมูลวันหยุดทั่วประเทศ (court_code ปล่อยว่าง)
INSERT INTO holidays (name, holiday_date, court_code) VALUES 
('วันขึ้นปีใหม่', '2027-01-01', NULL),
('วันมาฆบูชา', '2027-02-20', NULL);

-- ตัวอย่างการเพิ่มข้อมูลวันหยุดประจำจังหวัด (ใส่ court_code ของศาลนั้นๆ)
INSERT INTO holidays (name, holiday_date, court_code) VALUES 
('วันหยุดพิเศษประจำจังหวัด (งานกาชาด)', '2027-03-15', 'pkkjc');


-- ==========================================
-- 1. ตารางข้อมูลชั้นตราเครื่องราชอิสริยาภรณ์ (Master Data)
-- ==========================================
CREATE TABLE master_decorations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT 'ชื่อเต็มชั้นตรา',
    short_name VARCHAR(50) NULL COMMENT 'ชื่อย่อ (เช่น ท.ช., ป.ม.)',
    sort_order INT NOT NULL DEFAULT 99 COMMENT 'ลำดับเกียรติยศ (เลขน้อย = สูงสุด เพื่อใช้เรียงลำดับเวลาแสดงผล)',
    status ENUM('ใช้งาน', 'ระงับ') DEFAULT 'ใช้งาน' COMMENT 'สถานะการแสดงผลใน Dropdown',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- เพิ่มข้อมูลเริ่มต้น (ตัวอย่าง 10 ชั้นตราพื้นฐานที่มักจะได้รับตามลำดับ)
INSERT INTO master_decorations (name, short_name, sort_order) VALUES
('ประถมาภรณ์ช้างเผือก', 'ป.ช.', 1),
('ประถมาภรณ์มงกุฎไทย', 'ป.ม.', 2),
('ทวีติยาภรณ์ช้างเผือก', 'ท.ช.', 3),
('ทวีติยาภรณ์มงกุฎไทย', 'ท.ม.', 4),
('ตริตาภรณ์ช้างเผือก', 'ต.ช.', 5),
('ตริตาภรณ์มงกุฎไทย', 'ต.ม.', 6),
('จัตุรถาภรณ์ช้างเผือก', 'จ.ช.', 7),
('จัตุรถาภรณ์มงกุฎไทย', 'จ.ม.', 8),
('เบญจมาภรณ์ช้างเผือก', 'บ.ช.', 9),
('เบญจมาภรณ์มงกุฎไทย', 'บ.ม.', 10);

-- ==========================================
-- 2. ตารางประวัติการได้รับเครื่องราชฯ ของ พ.สมทบ (Transaction)
-- ==========================================
CREATE TABLE somtop_decorations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    somtop_id INT(11) NOT NULL COMMENT 'อ้างอิง ID ของ พ.สมทบ',
    decoration_id INT NOT NULL COMMENT 'อ้างอิง ID ของชั้นตรา',
    
    received_date DATE NOT NULL COMMENT 'วันที่ได้รับพระราชทาน',
    gazette_ref VARCHAR(255) NULL COMMENT 'อ้างอิงราชกิจจานุเบกษา (เช่น เล่ม/ตอน/หน้า)',
    file_path VARCHAR(255) NULL COMMENT 'เก็บ path ไฟล์ประกาศนียบัตร (PDF/Image)',
    note TEXT NULL COMMENT 'หมายเหตุเพิ่มเติม',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- ตั้งค่า Foreign Key (ถ้าลบ พ.สมทบ ประวัติเครื่องราชฯ ก็จะถูกลบตามไปด้วยอัตโนมัติ)
    FOREIGN KEY (somtop_id) REFERENCES somtop(id) ON DELETE CASCADE,
    FOREIGN KEY (decoration_id) REFERENCES master_decorations(id) ON DELETE RESTRICT,
    
    -- ป้องกันการเพิ่มประวัติชั้นตราเดียวกันซ้ำให้กับบุคคลเดิม
    UNIQUE KEY unique_somtop_decoration (somtop_id, decoration_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


---------------------------------------------------
ALTER TABLE working_terms ADD file_paths TEXT NULL COMMENT 'เก็บ path ไฟล์แนบแบบ Array JSON เช่น ["order1.pdf", "announce.jpg"]';
