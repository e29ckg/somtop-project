ALTER TABLE courts
    ADD COLUMN finance_officer_name VARCHAR(255) NULL COMMENT 'ชื่อเจ้าหน้าที่การเงิน' AFTER director_position,
    ADD COLUMN finance_officer_position VARCHAR(255) NULL COMMENT 'ตำแหน่งเจ้าหน้าที่การเงิน' AFTER finance_officer_name;
