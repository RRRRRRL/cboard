-- Create cboard_user without needing root password
-- This script can be run if you have access to MySQL without root password
-- Or if you can use sudo mysql

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS `cboard` 
    DEFAULT CHARACTER SET utf8mb4 
    DEFAULT COLLATE utf8mb4_unicode_ci;

-- Try to create user (will fail if you don't have privileges, but that's okay)
-- We'll handle this differently

