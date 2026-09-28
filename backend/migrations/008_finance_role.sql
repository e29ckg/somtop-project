ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'viewer', 'finance') DEFAULT 'viewer';
