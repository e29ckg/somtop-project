-- แยกที่อยู่ของผู้พิพากษาสมทบออกเป็นข้อมูลเชิงโครงสร้าง
-- คง address เดิมไว้เพื่อรองรับข้อมูลเก่าและการย้อนกลับ
ALTER TABLE somtop
    ADD COLUMN house_no VARCHAR(50) NULL COMMENT 'บ้านเลขที่' AFTER address,
    ADD COLUMN moo VARCHAR(20) NULL COMMENT 'หมู่ที่' AFTER house_no,
    ADD COLUMN soi VARCHAR(100) NULL COMMENT 'ซอย' AFTER moo,
    ADD COLUMN road VARCHAR(100) NULL COMMENT 'ถนน' AFTER soi,
    ADD COLUMN subdistrict VARCHAR(100) NULL COMMENT 'ตำบล/แขวง' AFTER moo,
    ADD COLUMN district VARCHAR(100) NULL COMMENT 'อำเภอ/เขต' AFTER subdistrict,
    ADD COLUMN province VARCHAR(100) NULL COMMENT 'จังหวัด' AFTER district,
    ADD COLUMN postal_code VARCHAR(10) NULL COMMENT 'รหัสไปรษณีย์' AFTER province;
