-- Create cboard_user and grant permissions
-- Run this as MySQL root user: mysql -u root -p < create-user.sql

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS `cboard` 
    DEFAULT CHARACTER SET utf8mb4 
    DEFAULT COLLATE utf8mb4_unicode_ci;

-- Create user if it doesn't exist (using stronger password to meet policy)
CREATE USER IF NOT EXISTS 'cboard_user'@'localhost' IDENTIFIED BY 'Cboard123!@#';

-- Grant all privileges on cboard database
GRANT ALL PRIVILEGES ON cboard.* TO 'cboard_user'@'localhost';

-- Also grant for 127.0.0.1 (sometimes needed)
CREATE USER IF NOT EXISTS 'cboard_user'@'127.0.0.1' IDENTIFIED BY 'Cboard123!@#';
GRANT ALL PRIVILEGES ON cboard.* TO 'cboard_user'@'127.0.0.1';

-- Flush privileges to apply changes
FLUSH PRIVILEGES;

-- Verify user was created
SELECT User, Host FROM mysql.user WHERE User = 'cboard_user';

