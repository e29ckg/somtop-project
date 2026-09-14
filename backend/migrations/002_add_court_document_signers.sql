-- เพิ่มข้อมูลผู้ลงนามของศาลสำหรับนำไปใช้ในเทมเพลตเอกสาร Word
ALTER TABLE courts
    ADD COLUMN chief_judge_name VARCHAR(255) NULL COMMENT 'ชื่อผู้พิพากษาหัวหน้าศาล' AFTER province,
    ADD COLUMN chief_judge_position VARCHAR(255) NULL COMMENT 'ตำแหน่งผู้พิพากษาหัวหน้าศาล' AFTER chief_judge_name,
    ADD COLUMN director_name VARCHAR(255) NULL COMMENT 'ชื่อผู้อำนวยการ' AFTER chief_judge_position,
    ADD COLUMN director_position VARCHAR(255) NULL COMMENT 'ตำแหน่งผู้อำนวยการ' AFTER director_name;
