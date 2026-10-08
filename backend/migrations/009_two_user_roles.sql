-- Keep only the admin and view roles.
-- Existing finance and viewer accounts become view accounts.
-- The legacy central_admin account maps to admin.
ALTER TABLE users
    MODIFY COLUMN role ENUM('admin', 'viewer', 'finance', 'central_admin', 'view') DEFAULT 'view';

UPDATE users
SET role = 'view'
WHERE role IN ('viewer', 'finance') OR role IS NULL OR role = '';

UPDATE users
SET role = 'admin'
WHERE role = 'central_admin';

ALTER TABLE users
    MODIFY COLUMN role ENUM('admin', 'view') DEFAULT 'view';
