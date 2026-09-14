CREATE TABLE duty_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    order_month DATE NOT NULL COMMENT 'เก็บเป็นวันแรกของเดือน',
    court_code VARCHAR(50) NOT NULL,
    note TEXT NULL,
    status ENUM('ใช้งาน', 'ยกเลิก') DEFAULT 'ใช้งาน',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_duty_order (court_code, order_number),
    INDEX idx_duty_order_month (court_code, order_month),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE duty_schedules
    ADD COLUMN order_id INT NULL AFTER id,
    ADD CONSTRAINT fk_duty_schedule_order FOREIGN KEY (order_id) REFERENCES duty_orders(id) ON DELETE CASCADE,
    ADD UNIQUE KEY unique_order_duty_person (order_id, duty_date, somtop_id),
    ADD INDEX idx_duty_order_date (order_id, duty_date);

CREATE TABLE duty_swaps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    schedule_id INT NOT NULL,
    requester_somtop_id INT NOT NULL,
    replacement_somtop_id INT NOT NULL,
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
