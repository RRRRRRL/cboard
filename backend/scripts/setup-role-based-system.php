<?php
/**
 * Role-Based Access Control System Setup Script
 *
 * This script sets up the complete role-based access control system for Cboard AAC.
 * Run this script to create all necessary tables and populate with sample data.
 *
 * Usage: php backend/scripts/setup-role-based-system.php
 */

require_once __DIR__ . '/../database/init.php';
require_once __DIR__ . '/../api/helpers.php';
require_once __DIR__ . '/../api/auth.php';

echo "=== Cboard Role-Based Access Control System Setup ===\n\n";

try {
    $db = getDB();
    if (!$db) {
        throw new Exception('Database connection failed');
    }

    echo "✓ Database connection established\n";

    // ============================================================================
    // CREATE TABLES
    // ============================================================================

    echo "\n--- Creating Tables ---\n";

    // Organizations table
    echo "Creating organizations table... ";
    $db->exec("
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
    ");
    echo "✓ Done\n";

    // Classes table
    echo "Creating classes table... ";
    $db->exec("
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
    ");
    echo "✓ Done\n";

    // User organization roles table
    echo "Creating user_organization_roles table... ";
    $db->exec("
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
    ");
    echo "✓ Done\n";

    // Student-teacher assignments table
    echo "Creating student_teacher_assignments table... ";
    $db->exec("
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
    ");
    echo "✓ Done\n";

    // Parent-child relationships table
    echo "Creating parent_child_relationships table... ";
    $db->exec("
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
    ");
    echo "✓ Done\n";

    // Data sharing permissions table
    echo "Creating data_sharing_permissions table... ";
    $db->exec("
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
    ");
    echo "✓ Done\n";

    // Learning objectives table
    echo "Creating learning_objectives table... ";
    $db->exec("
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
    ");
    echo "✓ Done\n";

    // Notifications table
    echo "Creating notifications table... ";
    $db->exec("
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
    ");
    echo "✓ Done\n";

    // Update action_logs to include organization context
    echo "Updating action_logs table... ";
    try {
        $db->exec("ALTER TABLE `action_logs` ADD COLUMN `organization_id` INT UNSIGNED NULL AFTER `profile_id`");
        $db->exec("ALTER TABLE `action_logs` ADD COLUMN `class_id` INT UNSIGNED NULL AFTER `organization_id`");
        $db->exec("ALTER TABLE `action_logs` ADD FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL");
        $db->exec("ALTER TABLE `action_logs` ADD FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE SET NULL");
        $db->exec("ALTER TABLE `action_logs` ADD INDEX `idx_organization_id` (`organization_id`)");
        $db->exec("ALTER TABLE `action_logs` ADD INDEX `idx_class_id` (`class_id`)");
        echo "✓ Enhanced\n";
    } catch (Exception $e) {
        // Column might already exist
        echo "✓ Already exists\n";
    }

    // ============================================================================
    // INSERT SAMPLE DATA
    // ============================================================================

    echo "\n--- Inserting Sample Data ---\n";

    // Sample organization
    echo "Creating sample organization... ";
    $stmt = $db->prepare("
        INSERT INTO organizations (name, description, subscription_type, max_users)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = name
    ");
    $stmt->execute([
        'Sample Special Education Center',
        'A comprehensive AAC therapy and education center for students with communication needs',
        'premium',
        200
    ]);
    $orgId = $db->lastInsertId();
    echo "✓ Done (ID: {$orgId})\n";

    // Sample classes
    echo "Creating sample classes... ";
    $classes = [
        ['Primary AAC Class', 'Basic communication skills development', 'AAC-PRIM-001'],
        ['Advanced Communication', 'Advanced AAC and language development', 'AAC-ADV-001'],
        ['Speech Therapy Group', 'Individualized speech and language therapy', 'THERAPY-001']
    ];

    foreach ($classes as $classData) {
        $stmt = $db->prepare("
            INSERT INTO classes (organization_id, name, description, class_code, academic_year)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE name = name
        ");
        $stmt->execute([$orgId, $classData[0], $classData[1], $classData[2], '2024-2025']);
    }
    echo "✓ Done\n";

    // Create sample users if they don't exist
    echo "Creating sample users... ";

    // Sample admin user
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute(['admin@cboard.org']);
    if (!$stmt->fetch()) {
        $stmt = $db->prepare("
            INSERT INTO users (email, password_hash, name, role, is_active, is_verified, created_at)
            VALUES (?, ?, ?, 'admin', 1, 1, NOW())
        ");
        $stmt->execute(['admin@cboard.org', password_hash('admin123', PASSWORD_DEFAULT), 'System Administrator']);
        echo "✓ Admin user created\n";
    } else {
        echo "✓ Admin user exists\n";
    }

    // Sample teacher
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute(['teacher@cboard.org']);
    if (!$stmt->fetch()) {
        $stmt = $db->prepare("
            INSERT INTO users (email, password_hash, name, role, is_active, is_verified, created_at)
            VALUES (?, ?, ?, 'teacher', 1, 1, NOW())
        ");
        $stmt->execute(['teacher@cboard.org', password_hash('teacher123', PASSWORD_DEFAULT), 'Ms. Chan']);
        echo "✓ Teacher user created\n";
    } else {
        echo "✓ Teacher user exists\n";
    }

    // Sample parent
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute(['parent@cboard.org']);
    if (!$stmt->fetch()) {
        $stmt = $db->prepare("
            INSERT INTO users (email, password_hash, name, role, is_active, is_verified, created_at)
            VALUES (?, ?, ?, 'parent', 1, 1, NOW())
        ");
        $stmt->execute(['parent@cboard.org', password_hash('parent123', PASSWORD_DEFAULT), 'Parent User']);
        echo "✓ Parent user created\n";
    } else {
        echo "✓ Parent user exists\n";
    }

    // Sample student
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute(['student@cboard.org']);
    if (!$stmt->fetch()) {
        $stmt = $db->prepare("
            INSERT INTO users (email, password_hash, name, role, is_active, is_verified, created_at)
            VALUES (?, ?, ?, 'student', 1, 1, NOW())
        ");
        $stmt->execute(['student@cboard.org', password_hash('student123', PASSWORD_DEFAULT), 'Alex Chen']);
        echo "✓ Student user created\n";
    } else {
        echo "✓ Student user exists\n";
    }

    echo "\n=== Setup Complete! ===\n";
    echo "\nNext steps:\n";
    echo "1. Assign users to organizations using the admin panel\n";
    echo "2. Create teacher-student assignments\n";
    echo "3. Link parents to their children\n";
    echo "4. Test the role-based dashboards\n";
    echo "\nSample login credentials:\n";
    echo "Admin: admin@cboard.org / admin123\n";
    echo "Teacher: teacher@cboard.org / teacher123\n";
    echo "Parent: parent@cboard.org / parent123\n";
    echo "Student: student@cboard.org / student123\n";

} catch (Exception $e) {
    echo "\n❌ Setup failed: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
    exit(1);
}

echo "\n✅ Role-based access control system setup completed successfully!\n";
?>
