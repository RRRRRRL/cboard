-- Database Update Script
-- Run this after deploying to add missing tables and columns
-- Usage: mysql -h HOST -u USER -pPASSWORD cboard < update_schema.sql

USE `cboard`;

-- ============================================================================
-- RATE LIMITING TABLE (Required for rate limiting middleware)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `rate_limit_logs` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(255) NOT NULL,  -- IP address or user ID
    `endpoint` VARCHAR(255) NOT NULL,  -- API endpoint
    `request_count` INT UNSIGNED DEFAULT 1,
    `window_start` DATETIME NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_identifier_endpoint_window` (`identifier`, `endpoint`, `window_start`),
    INDEX `idx_identifier` (`identifier`),
    INDEX `idx_endpoint` (`endpoint`),
    INDEX `idx_window_start` (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- VERIFY EXISTING TABLES
-- ============================================================================

-- Check if all required tables exist (these should already exist from schema.sql)
-- This script will create them if they don't exist

-- Users table (ensure role column exists)
ALTER TABLE `users` 
    MODIFY COLUMN `role` ENUM('admin','teacher','therapist','parent','student') DEFAULT 'student' 
    IF EXISTS;

-- Action logs table (ensure it exists)
CREATE TABLE IF NOT EXISTS `action_logs` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NULL,
    `profile_id` INT UNSIGNED NULL,
    `board_id` INT UNSIGNED NULL,
    `card_id` INT UNSIGNED NULL,
    `action_type` VARCHAR(50) NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_profile_created` (`profile_id`, `created_at`),
    INDEX `idx_user_created` (`user_id`, `created_at`),
    INDEX `idx_action_type` (`action_type`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OCR history table (ensure correct column names)
CREATE TABLE IF NOT EXISTS `ocr_history` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NULL,
    `profile_id` INT UNSIGNED NULL,
    `source_image_path` VARCHAR(255) NOT NULL,
    `extracted_text` TEXT NULL,
    `jyutping_result` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_user_created` (`user_id`, `created_at`),
    INDEX `idx_profile_id` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jyutping dictionary table (ensure correct column names)
CREATE TABLE IF NOT EXISTS `jyutping_dictionary` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `jyutping_code` VARCHAR(50) NOT NULL,
    `hanzi` VARCHAR(10) NULL,
    `word` VARCHAR(50) NULL,
    `frequency` INT DEFAULT 0,
    `tags` VARCHAR(191) NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_jyutping_code` (`jyutping_code`),
    INDEX `idx_hanzi` (`hanzi`),
    INDEX `idx_word` (`word`),
    INDEX `idx_frequency` (`frequency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Games results table
CREATE TABLE IF NOT EXISTS `games_results` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `profile_id` INT UNSIGNED NULL,
    `game_type` VARCHAR(50) NOT NULL,
    `score` INT DEFAULT 0,
    `level` INT DEFAULT 1,
    `game_data` JSON NULL,
    `completed_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_user_profile` (`user_id`, `profile_id`),
    INDEX `idx_game_type` (`game_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI cache table
CREATE TABLE IF NOT EXISTS `ai_cache` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `input_hash` VARCHAR(64) NOT NULL UNIQUE,
    `cache_key` VARCHAR(100) NOT NULL,
    `cache_data` JSON NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_input_hash` (`input_hash`),
    INDEX `idx_cache_key` (`cache_key`),
    INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Profile transfer tokens table
CREATE TABLE IF NOT EXISTS `profile_transfer_tokens` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `profile_id` INT UNSIGNED NULL,
    `token` VARCHAR(255) NOT NULL UNIQUE,
    `token_type` ENUM('qr','cloud','email') DEFAULT 'qr',
    `expires_at` DATETIME NOT NULL,
    `is_redeemed` TINYINT(1) DEFAULT 0,
    `redeemed_at` DATETIME NULL,
    `redeemed_by_user_id` INT UNSIGNED NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_token` (`token`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_profile_id` (`profile_id`),
    INDEX `idx_token_type` (`token_type`),
    INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check table existence
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    CREATE_TIME
FROM 
    INFORMATION_SCHEMA.TABLES 
WHERE 
    TABLE_SCHEMA = 'cboard' 
    AND TABLE_NAME IN (
        'users', 'profiles', 'cards', 'profile_cards', 'boards',
        'jyutping_dictionary', 'jyutping_learning_log', 'action_logs',
        'profile_transfer_tokens', 'ocr_history', 'games_results',
        'ai_cache', 'rate_limit_logs', 'settings', 'media'
    )
ORDER BY 
    TABLE_NAME;

-- Check rate_limit_logs table structure
DESCRIBE `rate_limit_logs`;

