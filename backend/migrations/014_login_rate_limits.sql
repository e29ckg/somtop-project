CREATE TABLE IF NOT EXISTS login_rate_limits (
    ip_hash BINARY(32) NOT NULL PRIMARY KEY,
    attempt_count INT UNSIGNED NOT NULL,
    reset_at DATETIME(3) NOT NULL,
    INDEX idx_login_rate_limits_reset_at (reset_at)
);
