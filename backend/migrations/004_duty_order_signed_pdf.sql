-- ไฟล์คำสั่งเวรฉบับลงนามแล้ว
ALTER TABLE duty_orders
    ADD COLUMN signed_order_file_path VARCHAR(500) NULL
    COMMENT 'ที่อยู่ไฟล์ PDF คำสั่งที่ลงนามแล้ว' AFTER note;
