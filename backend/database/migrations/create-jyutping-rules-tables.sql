-- Migration: Create Jyutping Matching Rules and Exception Rules Tables
-- Created: 2025-12-24
-- Purpose: Allow admin/teachers to configure custom Jyutping matching logic for individual students

-- Table: jyutping_matching_rules
-- Stores per-student matching rule configurations
CREATE TABLE IF NOT EXISTS `jyutping_matching_rules` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED COMMENT 'Student user ID',
  `profile_id` INT UNSIGNED COMMENT 'Optional: specific profile for this student',
  `frequency_threshold` INT(11) DEFAULT 50 COMMENT 'Minimum frequency threshold (default: 50)',
  `allow_exact_match` TINYINT(1) DEFAULT 1 COMMENT 'Allow exact matching strategy',
  `allow_substring_match` TINYINT(1) DEFAULT 1 COMMENT 'Allow substring matching strategy',
  `allow_single_char_match` TINYINT(1) DEFAULT 1 COMMENT 'Allow single character matching strategy',
  `require_ai_correction` TINYINT(1) DEFAULT 0 COMMENT 'Require AI correction for low confidence matches',
  `ai_confidence_threshold` DECIMAL(3,2) DEFAULT 0.50 COMMENT 'AI correction threshold (0.0-1.0)',
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

-- Table: jyutping_exception_rules
-- Stores configurable exception rules that can be enabled/disabled per student
CREATE TABLE IF NOT EXISTS `jyutping_exception_rules` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `rule_key` VARCHAR(100) NOT NULL COMMENT 'Unique rule identifier (e.g., "allow_tone_variants", "strict_hanzi_match")',
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

-- Table: jyutping_student_exception_rules
-- Junction table: which exception rules are enabled/disabled for which students
CREATE TABLE IF NOT EXISTS `jyutping_student_exception_rules` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) UNSIGNED COMMENT 'Student user ID',
  `profile_id` INT(11) UNSIGNED COMMENT 'Optional: specific profile for this student',
  `rule_id` INT(11) NOT NULL COMMENT 'Exception rule ID',
  `enabled` TINYINT(1) DEFAULT 1 COMMENT 'Whether this rule is enabled for this student',
  `created_by` INT(11) UNSIGNED COMMENT 'User ID who configured this rule',
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

-- Insert default exception rules
INSERT INTO `jyutping_exception_rules` (`rule_key`, `rule_name`, `rule_description`, `rule_category`, `default_enabled`, `is_system_rule`) VALUES
('allow_tone_variants', 'Allow Tone Variants', 'Allow matching Jyutping with different tones (e.g., "nei1" matches "nei5")', 'matching', 1, 1),
('strict_hanzi_match', 'Strict Hanzi Matching', 'Require exact Hanzi match, no character variants', 'matching', 0, 1),
('allow_low_frequency', 'Allow Low Frequency Words', 'Include words with frequency below threshold in suggestions', 'matching', 0, 1),
('require_full_word_match', 'Require Full Word Match', 'Only match complete words, not substrings', 'matching', 0, 1),
('enable_ai_correction', 'Enable AI Correction', 'Use AI to correct Jyutping when confidence is low', 'correction', 1, 1),
('allow_character_variants', 'Allow Character Variants', 'Allow simplified/traditional character variants', 'matching', 1, 1),
('strict_jyutping_format', 'Strict Jyutping Format', 'Require exact Jyutping format match', 'validation', 0, 1)
ON DUPLICATE KEY UPDATE `rule_name` = VALUES(`rule_name`), `rule_description` = VALUES(`rule_description`);

