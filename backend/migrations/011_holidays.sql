CREATE TABLE IF NOT EXISTS holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    holiday_date DATE NOT NULL,
    court_code VARCHAR(50) DEFAULT NULL,
    status ENUM('ใช้งาน', 'ระงับ') DEFAULT 'ใช้งาน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_holiday_date (holiday_date),
    INDEX idx_holiday_court (court_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
