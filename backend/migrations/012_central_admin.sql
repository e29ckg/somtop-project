-- รันหลัง 008_finance_role.sql; ไม่มีการเปลี่ยนสิทธิ์บัญชีเดิมโดยอัตโนมัติ
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin', 'viewer', 'finance', 'central_admin') DEFAULT 'viewer';

-- เลือกบัญชีผู้ดูแลส่วนกลางตัวแรกอย่างชัดเจนหลังสำรองฐานข้อมูลแล้ว:
-- UPDATE users SET role = 'central_admin', court_code = NULL WHERE id = <user_id> AND role = 'admin';
