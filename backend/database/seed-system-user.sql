-- Create System User for Preset Profiles
-- Run this before seed-preset-profiles.sql

USE cboard;

-- Create system user (or use existing admin user)
-- Option 1: Use user_id = 1 (assuming first user is admin)
-- Option 2: Create dedicated system user

-- Check if user with id=1 exists, if not create system user
INSERT INTO users (id, email, name, role, is_active, is_verified, created_at, updated_at)
VALUES (1, 'system@cboard.local', 'System', 'admin', 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE id=id;

-- Or create a separate system user
-- INSERT INTO users (email, name, role, is_active, is_verified, created_at, updated_at)
-- VALUES ('system@cboard.local', 'System', 'admin', 1, 1, NOW(), NOW());

-- Verify
SELECT id, email, name, role FROM users WHERE email = 'system@cboard.local' OR id = 1;

