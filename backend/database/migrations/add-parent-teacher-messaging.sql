-- ============================================================================
-- PARENT-TEACHER MESSAGING SYSTEM MIGRATION
-- ============================================================================
-- Enables communication between parents and teachers regarding students
-- Supports threaded conversations and notifications
-- ============================================================================

USE `cboard`;

-- ============================================================================
-- MESSAGING TABLES
-- ============================================================================

-- 1. Messages table (main message storage)
CREATE TABLE IF NOT EXISTS `messages` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sender_user_id` INT UNSIGNED NOT NULL,
    `recipient_user_id` INT UNSIGNED NOT NULL,
    `student_user_id` INT UNSIGNED NULL,  -- Student this message is about (for context)
    `subject` VARCHAR(255) NOT NULL,
    `message_body` TEXT NOT NULL,
    `message_type` ENUM('parent_teacher','teacher_parent','admin_parent','admin_teacher') DEFAULT 'parent_teacher',
    `priority` ENUM('low','normal','high','urgent') DEFAULT 'normal',
    `is_read` TINYINT(1) DEFAULT 0,
    `parent_message_id` INT UNSIGNED NULL,  -- For threading/replies
    `organization_id` INT UNSIGNED NULL,  -- Organization context
    `class_id` INT UNSIGNED NULL,  -- Class context
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

-- 2. Message attachments (for future file attachments)
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

-- ============================================================================
-- CHILD SETTINGS TABLES
-- ============================================================================

-- 3. Child-specific settings (managed by parents)
CREATE TABLE IF NOT EXISTS `child_settings` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `child_user_id` INT UNSIGNED NOT NULL,
    `parent_user_id` INT UNSIGNED NOT NULL,  -- Parent who set these settings
    `settings_data` JSON NOT NULL,  -- Flexible settings storage
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

-- ============================================================================
-- PROGRESS REPORTING TABLES
-- ============================================================================

-- 4. Progress reports (generated reports for parents)
CREATE TABLE IF NOT EXISTS `progress_reports` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `student_user_id` INT UNSIGNED NOT NULL,
    `teacher_user_id` INT UNSIGNED NULL,  -- Teacher who generated report
    `parent_user_id` INT UNSIGNED NULL,  -- Parent who requested/viewed report
    `report_type` ENUM('weekly','monthly','quarterly','annual','custom') DEFAULT 'monthly',
    `report_period_start` DATE NOT NULL,
    `report_period_end` DATE NOT NULL,
    `report_data` JSON NOT NULL,  -- Structured report data
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
-- UPDATE EXISTING TABLES
-- ============================================================================

-- Add messaging preferences to user settings (if not exists)
ALTER TABLE `settings`
ADD COLUMN `messaging_preferences` JSON NULL AFTER `settings_data`;

COMMIT;
