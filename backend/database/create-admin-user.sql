-- Create Admin User Account
-- This script creates a default admin account for Cboard
-- 
-- Usage:
--   mysql -u root -p cboard < create-admin-user.sql
--   Or run this in your MySQL client
--
-- Default Admin Credentials:
--   Email: admin@aac.uplifor.org
--   Password: Admin123! (CHANGE THIS AFTER FIRST LOGIN)
--
-- IMPORTANT: Change the password immediately after first login!

USE cboard;

-- Create admin user (or update if exists)
-- Password: Admin123! (hashed with bcrypt)
-- You can generate a new hash using PHP: password_hash('YourPassword', PASSWORD_BCRYPT)
INSERT INTO users (email, password_hash, name, role, is_active, is_verified, created_at, updated_at)
VALUES (
    'admin@aac.uplifor.org',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Password: Admin123!
    'Administrator',
    'admin',
    1,
    1,
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    password_hash = VALUES(password_hash),
    name = VALUES(name),
    role = 'admin',
    is_active = 1,
    is_verified = 1,
    updated_at = NOW();

-- Verify admin user was created
SELECT 
    id,
    email,
    name,
    role,
    is_active,
    is_verified,
    created_at
FROM users 
WHERE email = 'admin@aac.uplifor.org' AND role = 'admin';

-- Show all admin users
SELECT 
    id,
    email,
    name,
    role,
    is_active,
    created_at
FROM users 
WHERE role = 'admin'
ORDER BY created_at DESC;

