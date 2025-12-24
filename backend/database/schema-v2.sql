-- Cboard Database Schema - AAC System (Full Version)
-- MySQL 5.7+ / MariaDB 10.2+
-- Profile-centric architecture (no boards table)

-- Create database
CREATE DATABASE IF NOT EXISTS `cboard` 
    DEFAULT CHARACTER SET utf8mb4 
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE `cboard`;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NULL,
    `name` VARCHAR(191) NULL,
    `role` ENUM('admin','teacher','therapist','parent','student') DEFAULT 'student',
    `auth_token` VARCHAR(500) NULL,
    `auth_token_expires` DATETIME NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `is_verified` TINYINT(1) DEFAULT 0,
    `verification_token` VARCHAR(255) NULL,
    `reset_password_token` VARCHAR(255) NULL,
    `reset_password_expires` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `last_login` DATETIME NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_email` (`email`),
    INDEX `idx_auth_token` (`auth_token`(255)),
    INDEX `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Profiles table (per student, per context)
CREATE TABLE IF NOT EXISTS `profiles` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `layout_type` VARCHAR(50) NULL,  -- e.g., '1x1', '1x5', '4x6', 'grid'
    `language` VARCHAR(10) NULL,  -- e.g., 'zh-HK', 'en', 'en-US'
    `is_public` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_is_public` (`is_public`),
    INDEX `idx_language` (`language`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Cards table (symbolic cards: image + text + audio)
CREATE TABLE IF NOT EXISTS `cards` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `label_text` VARCHAR(191) NULL,
    `image_path` VARCHAR(255) NULL,
    `audio_path` VARCHAR(255) NULL,
    `text_color` VARCHAR(20) NULL,
    `background_color` VARCHAR(20) NULL,
    `category` VARCHAR(100) NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_category` (`category`),
    INDEX `idx_title` (`title`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Profile-Cards junction table (many-to-many with layout position)
CREATE TABLE IF NOT EXISTS `profile_cards` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `profile_id` INT UNSIGNED NOT NULL,
    `card_id` INT UNSIGNED NOT NULL,
    `row_index` INT NOT NULL DEFAULT 0,
    `col_index` INT NOT NULL DEFAULT 0,
    `page_index` INT NOT NULL DEFAULT 0,
    `is_visible` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_profile_card_position` (`profile_id`, `card_id`, `page_index`, `row_index`, `col_index`),
    INDEX `idx_profile_id` (`profile_id`),
    INDEX `idx_card_id` (`card_id`),
    INDEX `idx_page_position` (`profile_id`, `page_index`, `row_index`, `col_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- JYUTPING & LANGUAGE SUPPORT
-- ============================================================================

-- 5. Jyutping dictionary table
CREATE TABLE IF NOT EXISTS `jyutping_dictionary` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `jyutping_code` VARCHAR(50) NOT NULL,  -- e.g., 'nei5', 'hou2'
    `hanzi` VARCHAR(10) NULL,  -- Single character
    `word` VARCHAR(50) NULL,  -- Optional multi-character word
    `frequency` INT DEFAULT 0,  -- Usage frequency for ranking
    `tags` VARCHAR(191) NULL,  -- e.g., 'daily,school'
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_jyutping_code` (`jyutping_code`),
    INDEX `idx_hanzi` (`hanzi`),
    INDEX `idx_word` (`word`),
    INDEX `idx_frequency` (`frequency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Jyutping learning log
CREATE TABLE IF NOT EXISTS `jyutping_learning_log` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `profile_id` INT UNSIGNED NULL,
    `jyutping_code` VARCHAR(50) NOT NULL,
    `hanzi_expected` VARCHAR(10) NULL,
    `hanzi_selected` VARCHAR(10) NULL,
    `is_correct` TINYINT(1) DEFAULT 0,
    `attempt_count` INT DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL,
    INDEX `idx_user_profile` (`user_id`, `profile_id`, `created_at`),
    INDEX `idx_jyutping_code` (`jyutping_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- LOGGING & ANALYTICS
-- ============================================================================

-- 7. Action logs (no board_id - profile-centric)
CREATE TABLE IF NOT EXISTS `action_logs` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NULL,
    `profile_id` INT UNSIGNED NULL,
    `card_id` INT UNSIGNED NULL,
    `action_type` VARCHAR(50) NOT NULL,  -- e.g., 'card_click','sentence_play','scan_select'
    `metadata` JSON NULL,  -- Extra info: scanning speed, device, etc.
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE SET NULL,
    INDEX `idx_profile_created` (`profile_id`, `created_at`),
    INDEX `idx_user_created` (`user_id`, `created_at`),
    INDEX `idx_action_type` (`action_type`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PROFILE TRANSFER
-- ============================================================================

-- 8. Profile transfer tokens
CREATE TABLE IF NOT EXISTS `profile_transfer_tokens` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `profile_id` INT UNSIGNED NOT NULL,
    `token` VARCHAR(100) NOT NULL UNIQUE,
    `expires_at` DATETIME NOT NULL,
    `used_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_token` (`token`),
    INDEX `idx_expires_at` (`expires_at`),
    INDEX `idx_profile_id` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- OCR & TRANSLATION
-- ============================================================================

-- 9. OCR history
CREATE TABLE IF NOT EXISTS `ocr_history` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NULL,
    `profile_id` INT UNSIGNED NULL,
    `source_image_path` VARCHAR(255) NOT NULL,
    `extracted_text` TEXT NULL,
    `jyutping_result` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL,
    INDEX `idx_user_created` (`user_id`, `created_at`),
    INDEX `idx_profile_id` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- OPTIONAL TABLES
-- ============================================================================

-- 10. Games results
CREATE TABLE IF NOT EXISTS `games_results` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `profile_id` INT UNSIGNED NULL,
    `game_type` VARCHAR(50) NOT NULL,  -- e.g., 'jyutping_spelling', 'picture_word_match'
    `score` INT DEFAULT 0,
    `level` INT DEFAULT 1,
    `game_data` JSON NULL,  -- Game-specific data
    `completed_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL,
    INDEX `idx_user_profile` (`user_id`, `profile_id`),
    INDEX `idx_game_type` (`game_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Settings table
CREATE TABLE IF NOT EXISTS `settings` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NULL UNIQUE,  -- Per-user settings
    `profile_id` INT UNSIGNED NULL,  -- Per-profile settings (optional)
    `settings_data` JSON NULL,  -- Flexible settings storage
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_profile_id` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI cache (optional)
CREATE TABLE IF NOT EXISTS `ai_cache` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `input_hash` VARCHAR(64) NOT NULL UNIQUE,  -- SHA256 hash of input
    `cache_key` VARCHAR(100) NOT NULL,  -- e.g., 'predictive_typing', 'card_suggestion'
    `cache_data` JSON NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_input_hash` (`input_hash`),
    INDEX `idx_cache_key` (`cache_key`),
    INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

