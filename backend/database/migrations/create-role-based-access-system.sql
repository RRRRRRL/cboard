-- ============================================================================
-- ROLE-BASED ACCESS CONTROL SYSTEM MIGRATION
-- ============================================================================
-- Comprehensive role system for Cboard AAC application
-- Supports: System Admin, Teacher, Student, Parent roles
-- With organizational hierarchy: Organization > Class > Users
-- ============================================================================

USE `cboard`;

-- ============================================================================
-- ORGANIZATIONAL STRUCTURE
-- ============================================================================

-- 1. Organizations table (schools, therapy centers, institutions)
CREATE TABLE IF NOT EXISTS `organizations` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `contact_email` VARCHAR(191) NULL,
    `contact_phone` VARCHAR(50) NULL,
    `address` TEXT NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `max_users` INT DEFAULT 100,  -- License/user limits
    `subscription_type` ENUM('free','basic','premium','enterprise') DEFAULT 'free',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_is_active` (`is_active`),
    INDEX `idx_subscription_type` (`subscription_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Classes table (within organizations)
CREATE TABLE IF NOT EXISTS `classes` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `organization_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(191) NOT NULL,  -- e.g., "Grade 1A", "Speech Therapy Group"
    `description` TEXT NULL,
    `class_code` VARCHAR(20) NULL UNIQUE,  -- For easy joining
    `academic_year` VARCHAR(20) NULL,  -- e.g., "2024-2025"
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

-- ============================================================================
-- ENHANCED USER ROLES
-- ============================================================================

-- 3. User organization memberships (many-to-many with roles)
CREATE TABLE IF NOT EXISTS `user_organization_roles` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `organization_id` INT UNSIGNED NOT NULL,
    `role` ENUM('system_admin','org_admin','teacher','therapist','student','parent') NOT NULL,
    `class_id` INT UNSIGNED NULL,  -- For teachers/students in specific classes
    `is_primary` TINYINT(1) DEFAULT 0,  -- Primary role for this organization
    `permissions` JSON NULL,  -- Additional granular permissions
    `assigned_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `assigned_by` INT UNSIGNED NULL,  -- Who assigned this role
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

-- ============================================================================
-- STUDENT-TEACHER RELATIONSHIPS
-- ============================================================================

-- 4. Student-teacher assignments (formal class assignments)
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

-- ============================================================================
-- FAMILY RELATIONSHIPS
-- ============================================================================

-- 5. Parent-child relationships
CREATE TABLE IF NOT EXISTS `parent_child_relationships` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `parent_user_id` INT UNSIGNED NOT NULL,
    `child_user_id` INT UNSIGNED NOT NULL,
    `relationship_type` ENUM('mother','father','guardian','grandparent','sibling','other') DEFAULT 'guardian',
    `custody_type` ENUM('full','joint','partial','emergency') DEFAULT 'full',
    `can_manage_profile` TINYINT(1) DEFAULT 1,  -- Can parent edit child's profile?
    `can_view_progress` TINYINT(1) DEFAULT 1,   -- Can parent see learning data?
    `can_receive_notifications` TINYINT(1) DEFAULT 1,
    `emergency_contact` TINYINT(1) DEFAULT 0,
    `notes` TEXT NULL,
    `verified_at` DATETIME NULL,  -- When relationship was verified
    `verified_by` INT UNSIGNED NULL,  -- Who verified (teacher/admin)
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

-- ============================================================================
-- DATA SHARING & PRIVACY
-- ============================================================================

-- 6. Data sharing permissions (for sensitive information)
CREATE TABLE IF NOT EXISTS `data_sharing_permissions` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `owner_user_id` INT UNSIGNED NOT NULL,  -- Student whose data this is
    `shared_with_user_id` INT UNSIGNED NOT NULL,  -- Teacher/parent getting access
    `permission_type` ENUM('view_profile','view_progress','view_communications','manage_profile','export_data') NOT NULL,
    `granted_by` INT UNSIGNED NULL,  -- Who granted permission (admin/parent)
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

-- ============================================================================
-- LEARNING OBJECTIVES & PROGRESS TRACKING
-- ============================================================================

-- 7. Learning objectives (set by teachers for students)
CREATE TABLE IF NOT EXISTS `learning_objectives` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `student_user_id` INT UNSIGNED NOT NULL,
    `teacher_user_id` INT UNSIGNED NOT NULL,
    `objective_type` ENUM('communication','academic','social','motor','cognitive') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `target_date` DATE NULL,
    `status` ENUM('active','completed','cancelled','on_hold') DEFAULT 'active',
    `progress_percentage` INT DEFAULT 0,  -- 0-100
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

-- ============================================================================
-- NOTIFICATIONS & COMMUNICATIONS
-- ============================================================================

-- 8. Notifications system
CREATE TABLE IF NOT EXISTS `notifications` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sender_user_id` INT UNSIGNED NULL,  -- NULL for system notifications
    `recipient_user_id` INT UNSIGNED NOT NULL,
    `notification_type` ENUM('progress_update','objective_completed','profile_change','system_alert','parent_teacher_communication') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `related_student_id` INT UNSIGNED NULL,  -- For student-specific notifications
    `is_read` TINYINT(1) DEFAULT 0,
    `priority` ENUM('low','medium','high','urgent') DEFAULT 'medium',
    `action_url` VARCHAR(500) NULL,  -- Link to take action
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
-- ACTIVITY LOGS WITH ROLE CONTEXT
-- ============================================================================

-- Update existing action_logs to include organization context
ALTER TABLE `action_logs`
ADD COLUMN `organization_id` INT UNSIGNED NULL AFTER `profile_id`,
ADD COLUMN `class_id` INT UNSIGNED NULL AFTER `organization_id`,
ADD FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL,
ADD FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL,
ADD INDEX `idx_organization_id` (`organization_id`),
ADD INDEX `idx_class_id` (`class_id`);

-- ============================================================================
-- SAMPLE DATA INSERTION
-- ============================================================================

-- Insert sample organization
INSERT INTO `organizations` (`name`, `description`, `subscription_type`, `max_users`)
VALUES ('Sample Special Education Center', 'Comprehensive AAC therapy and education center', 'premium', 200)
ON DUPLICATE KEY UPDATE `name` = `name`;

-- Insert sample class
INSERT INTO `classes` (`organization_id`, `name`, `description`, `class_code`, `academic_year`)
SELECT o.id, 'Primary AAC Class', 'Basic communication skills development', 'AAC-PRIM-001', '2024-2025'
FROM `organizations` o WHERE o.name = 'Sample Special Education Center'
ON DUPLICATE KEY UPDATE `name` = `name`;

COMMIT;
