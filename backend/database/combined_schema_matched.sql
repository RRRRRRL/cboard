-- Combined schema for Cboard
-- Merges backend/database/schema.sql and role-based-access-system migration
-- Ready to run against a test/staging `cboard` database. Review before applying to production.

CREATE DATABASE IF NOT EXISTS `cboard` 
    DEFAULT CHARACTER SET utf8mb4 
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE `cboard`;

-- ============================================================================
-- CORE TABLES (from schema.sql)
-- ============================================================================

-- Users table
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

-- Profiles
CREATE TABLE IF NOT EXISTS `profiles` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `layout_type` VARCHAR(50) NULL,
    `language` VARCHAR(10) NULL,
    `root_board_id` VARCHAR(255) NULL,
    `is_default` TINYINT(1) DEFAULT 0,
    `is_public` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_is_public` (`is_public`),
    INDEX `idx_language` (`language`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Boards
CREATE TABLE IF NOT EXISTS `boards` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NULL,
    `profile_id` INT UNSIGNED NULL,
    `board_id` VARCHAR(255) NOT NULL UNIQUE,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `board_data` JSON NULL,
    `is_public` TINYINT(1) DEFAULT 0,
    `is_fixed` TINYINT(1) DEFAULT 0,
    `last_edited` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL,
    INDEX `idx_board_id` (`board_id`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_profile_id` (`profile_id`),
    INDEX `idx_is_public` (`is_public`),
    INDEX `idx_last_edited` (`last_edited`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cards
CREATE TABLE IF NOT EXISTS `cards` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `label_text` VARCHAR(191) NULL,
    `image_path` VARCHAR(255) NULL,
    `audio_path` VARCHAR(255) NULL,
    `sound_url` VARCHAR(500) NULL,
    `image_url` VARCHAR(500) NULL,
    `text_color` VARCHAR(20) NULL,
    `background_color` VARCHAR(20) NULL,
    `category` VARCHAR(100) NULL,
    `card_data` JSON NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_category` (`category`),
    INDEX `idx_title` (`title`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Profile_Cards
CREATE TABLE IF NOT EXISTS `profile_cards` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `profile_id` INT UNSIGNED NOT NULL,
    `card_id` INT UNSIGNED NOT NULL,
    `row_index` INT NOT NULL DEFAULT 0,
    `col_index` INT NOT NULL DEFAULT 0,
    `page_index` INT NOT NULL DEFAULT 0,
    `is_visible` TINYINT(1) DEFAULT 1,
    `position` INT UNSIGNED DEFAULT 0,
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

-- Jyutping dictionary
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

-- Jyutping learning log
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

-- Jyutping matching & exception rules
CREATE TABLE IF NOT EXISTS `jyutping_matching_rules` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED COMMENT 'Student user ID',
    `profile_id` INT UNSIGNED COMMENT 'Optional: specific profile for this student',
    `frequency_threshold` INT DEFAULT 50 COMMENT 'Minimum frequency threshold (default: 50)',
    `allow_exact_match` TINYINT(1) DEFAULT 1 COMMENT 'Allow exact matching strategy',
    `allow_substring_match` TINYINT(1) DEFAULT 1 COMMENT 'Allow substring matching strategy',
    `allow_single_char_match` TINYINT(1) DEFAULT 1 COMMENT 'Allow single character matching strategy',
    `require_ai_correction` TINYINT(1) DEFAULT 0 COMMENT 'Require AI correction for low confidence matches',
    `ai_confidence_threshold` DECIMAL(3,2) DEFAULT 0.50 COMMENT 'AI correction threshold (0.0-1.0)',
    `merge_n_ng_finals` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Treat -n and -ng as equivalent',
    `allow_coda_simplification` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Accept -t input for -k and vice versa',
    `ignore_tones` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Ignore tones completely for beginners',
    `allow_fuzzy_tones` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Allow fuzzy tones (e.g., 2↔5, 3↔6)',
    `fuzzy_tone_pairs` VARCHAR(255) DEFAULT NULL COMMENT 'Comma-separated tone pairs (e.g., "2,5|3,6")',
    `allow_ng_zero_confusion` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Let zero initial and ng- match each other',
    `allow_n_l_confusion` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Allow l to match n syllables and vice versa',
    `enabled` TINYINT(1) DEFAULT 1 COMMENT 'Whether this rule set is active',
    `created_by` INT UNSIGNED COMMENT 'User ID who created this rule',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_user_profile` (`user_id`, `profile_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_profile_id` (`profile_id`),
    KEY `idx_enabled` (`enabled`),
    CONSTRAINT `fk_matching_rules_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_matching_rules_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_matching_rules_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Per-student Jyutping matching rule configurations';

CREATE TABLE IF NOT EXISTS `jyutping_exception_rules` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `rule_key` VARCHAR(100) NOT NULL COMMENT 'Unique rule identifier',
    `rule_name` VARCHAR(255) NOT NULL COMMENT 'Human-readable rule name',
    `rule_description` TEXT COMMENT 'Description of what this rule does',
    `rule_category` VARCHAR(50) DEFAULT 'matching' COMMENT 'Category: matching, validation, correction, etc.',
    `default_enabled` TINYINT(1) DEFAULT 1 COMMENT 'Default state for new students',
    `is_system_rule` TINYINT(1) DEFAULT 0 COMMENT 'System rule (cannot be deleted)',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_rule_key` (`rule_key`),
    KEY `idx_category` (`rule_category`),
    KEY `idx_default_enabled` (`default_enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configurable exception rules for Jyutping matching';

CREATE TABLE IF NOT EXISTS `jyutping_student_exception_rules` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED COMMENT 'Student user ID',
    `profile_id` INT UNSIGNED COMMENT 'Optional: specific profile for this student',
    `rule_id` INT NOT NULL COMMENT 'Exception rule ID',
    `enabled` TINYINT(1) DEFAULT 1 COMMENT 'Whether this rule is enabled for this student',
    `created_by` INT UNSIGNED COMMENT 'User ID who configured this rule',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_student_rule` (`user_id`, `profile_id`, `rule_id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_profile_id` (`profile_id`),
    KEY `idx_rule_id` (`rule_id`),
    KEY `idx_enabled` (`enabled`),
    CONSTRAINT `fk_student_exception_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_student_exception_profile` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_student_exception_rule` FOREIGN KEY (`rule_id`) REFERENCES `jyutping_exception_rules` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_student_exception_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Student-specific exception rule configurations';

INSERT INTO `jyutping_exception_rules` (`rule_key`, `rule_name`, `rule_description`, `rule_category`, `default_enabled`, `is_system_rule`) VALUES
('allow_tone_variants', 'Allow Tone Variants', 'Allow matching Jyutping with different tones (e.g., "nei1" matches "nei5")', 'matching', 1, 1),
('strict_hanzi_match', 'Strict Hanzi Matching', 'Require exact Hanzi match, no character variants', 'matching', 0, 1),
('allow_low_frequency', 'Allow Low Frequency Words', 'Include words with frequency below threshold in suggestions', 'matching', 0, 1),
('require_full_word_match', 'Require Full Word Match', 'Only match complete words, not substrings', 'matching', 0, 1),
('enable_ai_correction', 'Enable AI Correction', 'Use AI to correct Jyutping when confidence is low', 'correction', 1, 1),
('allow_character_variants', 'Allow Character Variants', 'Allow simplified/traditional character variants', 'matching', 1, 1),
('strict_jyutping_format', 'Strict Jyutping Format', 'Require exact Jyutping format match', 'validation', 0, 1)
ON DUPLICATE KEY UPDATE `rule_name` = VALUES(`rule_name`), `rule_description` = VALUES(`rule_description`);

-- OCR history
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

-- Settings
CREATE TABLE IF NOT EXISTS `settings` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NULL UNIQUE,
    `profile_id` INT UNSIGNED NULL,
    `settings_data` JSON NULL,
    `messaging_preferences` JSON NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_profile_id` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Media
CREATE TABLE IF NOT EXISTS `media` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NULL,
    `filename` VARCHAR(255) NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_type` VARCHAR(50) NULL,
    `file_size` INT UNSIGNED NULL,
    `mime_type` VARCHAR(100) NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_filename` (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Games results
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
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL,
    INDEX `idx_user_profile` (`user_id`, `profile_id`),
    INDEX `idx_game_type` (`game_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI cache
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

-- Legacy card_logs
CREATE TABLE IF NOT EXISTS `card_logs` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NULL,
    `board_id` INT UNSIGNED NULL,
    `card_id` VARCHAR(255) NULL,
    `action` VARCHAR(50) NOT NULL,
    `log_data` JSON NULL,
    `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE SET NULL,
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ROLE-BASED ACCESS: organizations, classes, roles, relationships (from migration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `organizations` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `contact_email` VARCHAR(191) NULL,
    `contact_phone` VARCHAR(50) NULL,
    `address` TEXT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `max_users` INT DEFAULT 100,
    `subscription_type` ENUM('free','basic','premium','enterprise') DEFAULT 'free',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_is_active` (`is_active`),
    INDEX `idx_subscription_type` (`subscription_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `classes` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `class_code` VARCHAR(20) NULL UNIQUE,
    `academic_year` VARCHAR(20) NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `max_students` INT DEFAULT 30,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
    INDEX `idx_organization_id` (`organization_id`),
    INDEX `idx_class_code` (`class_code`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_organization_roles` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `organization_id` INT UNSIGNED NOT NULL,
    `role` ENUM('system_admin','org_admin','teacher','therapist','student','parent') NOT NULL,
    `class_id` INT UNSIGNED NULL,
    `is_primary` TINYINT(1) DEFAULT 0,
    `permissions` JSON NULL,
    `assigned_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `assigned_by` INT UNSIGNED NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    UNIQUE KEY `unique_user_org_role` (`user_id`, `organization_id`, `role`),
    INDEX `idx_user_id` (`user_id`),
    INDEX `idx_organization_id` (`organization_id`),
    INDEX `idx_class_id` (`class_id`),
    INDEX `idx_role` (`role`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `student_teacher_assignments` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `student_user_id` INT UNSIGNED NOT NULL,
    `teacher_user_id` INT UNSIGNED NOT NULL,
    `organization_id` INT UNSIGNED NOT NULL,
    `class_id` INT UNSIGNED NULL,
    `assignment_type` ENUM('class_teacher','subject_specialist','therapist','aide') DEFAULT 'class_teacher',
    `is_primary_teacher` TINYINT(1) DEFAULT 0,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `notes` TEXT NULL,
    `assigned_by` INT UNSIGNED NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`teacher_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    UNIQUE KEY `unique_student_teacher_class` (`student_user_id`, `teacher_user_id`, `class_id`),
    INDEX `idx_student_user_id` (`student_user_id`),
    INDEX `idx_teacher_user_id` (`teacher_user_id`),
    INDEX `idx_organization_id` (`organization_id`),
    INDEX `idx_class_id` (`class_id`),
    INDEX `idx_assignment_type` (`assignment_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `parent_child_relationships` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `parent_user_id` INT UNSIGNED NOT NULL,
    `child_user_id` INT UNSIGNED NOT NULL,
    `relationship_type` ENUM('mother','father','guardian','grandparent','sibling','other') DEFAULT 'guardian',
    `custody_type` ENUM('full','joint','partial','emergency') DEFAULT 'full',
    `can_manage_profile` TINYINT(1) DEFAULT 1,
    `can_view_progress` TINYINT(1) DEFAULT 1,
    `can_receive_notifications` TINYINT(1) DEFAULT 1,
    `emergency_contact` TINYINT(1) DEFAULT 0,
    `notes` TEXT NULL,
    `verified_at` DATETIME NULL,
    `verified_by` INT UNSIGNED NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`parent_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`child_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    UNIQUE KEY `unique_parent_child` (`parent_user_id`, `child_user_id`),
    INDEX `idx_parent_user_id` (`parent_user_id`),
    INDEX `idx_child_user_id` (`child_user_id`),
    INDEX `idx_relationship_type` (`relationship_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `data_sharing_permissions` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `owner_user_id` INT UNSIGNED NOT NULL,
    `shared_with_user_id` INT UNSIGNED NOT NULL,
    `permission_type` ENUM('view_profile','view_progress','view_communications','manage_profile','export_data') NOT NULL,
    `granted_by` INT UNSIGNED NULL,
    `expires_at` DATETIME NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`shared_with_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    UNIQUE KEY `unique_owner_shared_permission` (`owner_user_id`, `shared_with_user_id`, `permission_type`),
    INDEX `idx_owner_user_id` (`owner_user_id`),
    INDEX `idx_shared_with_user_id` (`shared_with_user_id`),
    INDEX `idx_permission_type` (`permission_type`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `learning_objectives` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `student_user_id` INT UNSIGNED NOT NULL,
    `teacher_user_id` INT UNSIGNED NOT NULL,
    `objective_type` ENUM('communication','academic','social','motor','cognitive') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `target_date` DATE NULL,
    `status` ENUM('active','completed','cancelled','on_hold') DEFAULT 'active',
    `progress_percentage` INT DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`teacher_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_student_user_id` (`student_user_id`),
    INDEX `idx_teacher_user_id` (`teacher_user_id`),
    INDEX `idx_objective_type` (`objective_type`),
    INDEX `idx_status` (`status`),
    INDEX `idx_target_date` (`target_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sender_user_id` INT UNSIGNED NULL,
    `recipient_user_id` INT UNSIGNED NOT NULL,
    `notification_type` ENUM('progress_update','objective_completed','profile_change','system_alert','parent_teacher_communication') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `related_student_id` INT UNSIGNED NULL,
    `is_read` TINYINT(1) DEFAULT 0,
    `priority` ENUM('low','medium','high','urgent') DEFAULT 'medium',
    `action_url` VARCHAR(500) NULL,
    `expires_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`related_student_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_recipient_user_id` (`recipient_user_id`),
    INDEX `idx_related_student_id` (`related_student_id`),
    INDEX `idx_notification_type` (`notification_type`),
    INDEX `idx_is_read` (`is_read`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- MESSAGING & PARENT/TEACHER COMMUNICATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS `messages` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sender_user_id` INT UNSIGNED NOT NULL,
    `recipient_user_id` INT UNSIGNED NOT NULL,
    `student_user_id` INT UNSIGNED NULL,
    `subject` VARCHAR(255) NOT NULL,
    `message_body` TEXT NOT NULL,
    `message_type` ENUM('parent_teacher','teacher_parent','admin_parent','admin_teacher') DEFAULT 'parent_teacher',
    `priority` ENUM('low','normal','high','urgent') DEFAULT 'normal',
    `is_read` TINYINT(1) DEFAULT 0,
    `parent_message_id` INT UNSIGNED NULL,
    `organization_id` INT UNSIGNED NULL,
    `class_id` INT UNSIGNED NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`parent_message_id`) REFERENCES `messages`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL,
    INDEX `idx_sender_user_id` (`sender_user_id`),
    INDEX `idx_recipient_user_id` (`recipient_user_id`),
    INDEX `idx_student_user_id` (`student_user_id`),
    INDEX `idx_parent_message_id` (`parent_message_id`),
    INDEX `idx_organization_id` (`organization_id`),
    INDEX `idx_class_id` (`class_id`),
    INDEX `idx_is_read` (`is_read`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_conversation` (`sender_user_id`, `recipient_user_id`, `student_user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `message_attachments` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `message_id` INT UNSIGNED NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_size` INT UNSIGNED NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE,
    INDEX `idx_message_id` (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `child_settings` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `child_user_id` INT UNSIGNED NOT NULL,
    `parent_user_id` INT UNSIGNED NOT NULL,
    `settings_data` JSON NOT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`child_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`parent_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_child_parent_settings` (`child_user_id`, `parent_user_id`),
    INDEX `idx_child_user_id` (`child_user_id`),
    INDEX `idx_parent_user_id` (`parent_user_id`),
    INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `progress_reports` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `student_user_id` INT UNSIGNED NOT NULL,
    `teacher_user_id` INT UNSIGNED NULL,
    `parent_user_id` INT UNSIGNED NULL,
    `report_type` ENUM('weekly','monthly','quarterly','annual','custom') DEFAULT 'monthly',
    `report_period_start` DATE NOT NULL,
    `report_period_end` DATE NOT NULL,
    `report_data` JSON NOT NULL,
    `is_downloaded` TINYINT(1) DEFAULT 0,
    `generated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `viewed_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`teacher_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`parent_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    INDEX `idx_student_user_id` (`student_user_id`),
    INDEX `idx_teacher_user_id` (`teacher_user_id`),
    INDEX `idx_parent_user_id` (`parent_user_id`),
    INDEX `idx_report_type` (`report_type`),
    INDEX `idx_report_period` (`report_period_start`, `report_period_end`),
    INDEX `idx_generated_at` (`generated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- ACTION LOGS (modified to include organization_id & class_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `action_logs` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NULL,
    `profile_id` INT UNSIGNED NULL,
    `board_id` INT UNSIGNED NULL,
    `card_id` INT UNSIGNED NULL,
    `action_type` VARCHAR(50) NOT NULL,
    `metadata` JSON NULL,
    `organization_id` INT UNSIGNED NULL,
    `class_id` INT UNSIGNED NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL,
    INDEX `idx_profile_created` (`profile_id`, `created_at`),
    INDEX `idx_user_created` (`user_id`, `created_at`),
    INDEX `idx_action_type` (`action_type`),
    INDEX `idx_created_at` (`created_at`),
    INDEX `idx_organization_id` (`organization_id`),
    INDEX `idx_class_id` (`class_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data retention policy (single-row configuration)
CREATE TABLE IF NOT EXISTS `data_retention_policy` (
    `id` INT UNSIGNED NOT NULL DEFAULT 1,
    `action_logs_retention_days` INT UNSIGNED NULL COMMENT 'Number of days to retain action_logs. NULL means never delete.',
    `learning_logs_retention_days` INT UNSIGNED NULL COMMENT 'Number of days to retain jyutping_learning_log. NULL means never delete.',
    `ocr_history_retention_days` INT UNSIGNED NULL COMMENT 'Number of days to retain ocr_history. NULL means never delete.',
    `last_cleanup_at` DATETIME NULL COMMENT 'Timestamp of last automatic cleanup',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `chk_single_row` CHECK (`id` = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `data_retention_policy` (
    `id`,
    `action_logs_retention_days`,
    `learning_logs_retention_days`,
    `ocr_history_retention_days`,
    `last_cleanup_at`
) VALUES (
    1,
    30,
    30,
    30,
    NULL
) ON DUPLICATE KEY UPDATE
    `action_logs_retention_days` = 30,
    `learning_logs_retention_days` = 30,
    `ocr_history_retention_days` = 30;

-- API rate limiting logs
CREATE TABLE IF NOT EXISTS `rate_limit_logs` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(255) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_identifier_created` (`identifier`, `created_at`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PROFILE TRANSFER & RELATED (from schema.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `profile_transfer_tokens` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `profile_id` INT UNSIGNED NOT NULL,
    `user_id` INT UNSIGNED NULL,
    `token` VARCHAR(100) NOT NULL UNIQUE,
    `transfer_type` ENUM('qr', 'cloud', 'email') NOT NULL,
    `transfer_data` JSON NULL,
    `expires_at` DATETIME NOT NULL,
    `used_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    UNIQUE KEY `unique_token` (`token`),
    INDEX `idx_expires_at` (`expires_at`),
    INDEX `idx_profile_id` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transfer_codes` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `transfer_code` VARCHAR(50) NOT NULL UNIQUE,
    `transfer_type` ENUM('qr', 'cloud', 'email') NOT NULL,
    `transfer_data` JSON NULL,
    `expires_at` DATETIME NOT NULL,
    `is_used` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_transfer_code` (`transfer_code`),
    INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;
