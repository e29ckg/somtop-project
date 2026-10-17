ALTER TABLE somtop
    ADD COLUMN is_meeting_coordinator TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'ผ่านการอบรมและจดแจ้งเป็นผู้ประสานการประชุมฯ' AFTER bank_branch;
