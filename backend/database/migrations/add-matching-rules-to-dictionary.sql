-- Migration: Add Matching Rules Fields to jyutping_dictionary
-- Created: 2025-12-29
-- Purpose: Store matching rules directly in jyutping_dictionary table instead of separate table

-- Add matching rule columns to jyutping_dictionary table
ALTER TABLE `jyutping_dictionary`
ADD COLUMN IF NOT EXISTS `frequency_threshold` INT DEFAULT 50 COMMENT 'Minimum frequency threshold for matching',
ADD COLUMN IF NOT EXISTS `allow_exact_match` TINYINT(1) DEFAULT 1 COMMENT 'Allow exact matching strategy',
ADD COLUMN IF NOT EXISTS `allow_substring_match` TINYINT(1) DEFAULT 1 COMMENT 'Allow substring matching strategy',
ADD COLUMN IF NOT EXISTS `allow_single_char_match` TINYINT(1) DEFAULT 1 COMMENT 'Allow single character matching strategy',
ADD COLUMN IF NOT EXISTS `require_ai_correction` TINYINT(1) DEFAULT 0 COMMENT 'Require AI correction for low confidence matches',
ADD COLUMN IF NOT EXISTS `ai_confidence_threshold` DECIMAL(3,2) DEFAULT 0.50 COMMENT 'AI correction threshold (0.0-1.0)',
ADD COLUMN IF NOT EXISTS `merge_n_ng_finals` TINYINT(1) DEFAULT 0 COMMENT 'Treat -n and -ng finals as equivalent (e.g., san matches sang)',
ADD COLUMN IF NOT EXISTS `allow_coda_simplification` TINYINT(1) DEFAULT 0 COMMENT 'Allow coda simplification (-t and -k interchangeable)',
ADD COLUMN IF NOT EXISTS `ignore_tones` TINYINT(1) DEFAULT 0 COMMENT 'Ignore tones completely (for beginners)',
ADD COLUMN IF NOT EXISTS `allow_fuzzy_tones` TINYINT(1) DEFAULT 0 COMMENT 'Allow fuzzy tone matching',
ADD COLUMN IF NOT EXISTS `fuzzy_tone_pairs` VARCHAR(100) NULL COMMENT 'Fuzzy tone pairs (e.g., "2,5|3,6")',
ADD COLUMN IF NOT EXISTS `allow_ng_zero_confusion` TINYINT(1) DEFAULT 0 COMMENT 'Allow ng-zero initial confusion (ng- and zero initial match)',
ADD COLUMN IF NOT EXISTS `allow_n_l_confusion` TINYINT(1) DEFAULT 0 COMMENT 'Allow n/l confusion (l matches n syllables and vice versa)',
ADD COLUMN IF NOT EXISTS `enabled` TINYINT(1) DEFAULT 1 COMMENT 'Whether matching rules are enabled for this entry';

-- Add indexes for matching rule fields (for performance when filtering)
ALTER TABLE `jyutping_dictionary`
ADD INDEX IF NOT EXISTS `idx_frequency_threshold` (`frequency_threshold`),
ADD INDEX IF NOT EXISTS `idx_allow_exact_match` (`allow_exact_match`),
ADD INDEX IF NOT EXISTS `idx_allow_substring_match` (`allow_substring_match`),
ADD INDEX IF NOT EXISTS `idx_allow_single_char_match` (`allow_single_char_match`),
ADD INDEX IF NOT EXISTS `idx_require_ai_correction` (`require_ai_correction`),
ADD INDEX IF NOT EXISTS `idx_merge_n_ng_finals` (`merge_n_ng_finals`),
ADD INDEX IF NOT EXISTS `idx_allow_coda_simplification` (`allow_coda_simplification`),
ADD INDEX IF NOT EXISTS `idx_ignore_tones` (`ignore_tones`),
ADD INDEX IF NOT EXISTS `idx_allow_fuzzy_tones` (`allow_fuzzy_tones`),
ADD INDEX IF NOT EXISTS `idx_allow_ng_zero_confusion` (`allow_ng_zero_confusion`),
ADD INDEX IF NOT EXISTS `idx_allow_n_l_confusion` (`allow_n_l_confusion`),
ADD INDEX IF NOT EXISTS `idx_enabled` (`enabled`);
