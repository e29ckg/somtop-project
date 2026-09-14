-- จัดเตรียมคณะปฏิบัติหน้าที่ คณะละ 2 คน
CREATE TABLE duty_teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    court_code VARCHAR(50) NOT NULL,
    team_name VARCHAR(100) NOT NULL,
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

ALTER TABLE duty_schedules
    ADD COLUMN team_id INT NULL AFTER order_id,
    ADD CONSTRAINT fk_duty_schedule_team
        FOREIGN KEY (team_id) REFERENCES duty_teams(id) ON DELETE SET NULL,
    ADD INDEX idx_duty_schedule_team (team_id);
