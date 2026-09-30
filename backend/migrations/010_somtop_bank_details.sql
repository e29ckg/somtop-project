ALTER TABLE somtop
    ADD COLUMN bank_account_number VARCHAR(30) NULL COMMENT 'เลขบัญชีธนาคาร' AFTER phone,
    ADD COLUMN bank_branch VARCHAR(255) NULL COMMENT 'สาขาธนาคาร' AFTER bank_account_number;
