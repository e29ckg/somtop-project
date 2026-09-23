-- เพิ่มซอยและถนนให้ข้อมูลที่อยู่แบบแยกช่อง
ALTER TABLE somtop
    ADD COLUMN soi VARCHAR(100) NULL COMMENT 'ซอย' AFTER moo,
    ADD COLUMN road VARCHAR(100) NULL COMMENT 'ถนน' AFTER soi;
