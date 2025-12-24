-- Migration: Add Phonological Matching Rules to jyutping_matching_rules
-- Created: 2025-01-XX
-- Purpose: Add adaptive matching rules for individual students' speech and phonological levels

-- Add new columns to jyutping_matching_rules table
ALTER TABLE `jyutping_matching_rules`
ADD COLUMN IF NOT EXISTS `merge_n_ng_finals` TINYINT(1) DEFAULT 0 COMMENT 'Treat -n and -ng as equivalent (e.g., san matches sang)',
ADD COLUMN IF NOT EXISTS `allow_coda_simplification` TINYINT(1) DEFAULT 0 COMMENT 'Accept -t input for -k and vice versa',
ADD COLUMN IF NOT EXISTS `ignore_tones` TINYINT(1) DEFAULT 0 COMMENT 'Ignore tones completely for beginners',
ADD COLUMN IF NOT EXISTS `allow_fuzzy_tones` TINYINT(1) DEFAULT 0 COMMENT 'Allow fuzzy tones (e.g., 2↔5, 3↔6)',
ADD COLUMN IF NOT EXISTS `fuzzy_tone_pairs` VARCHAR(255) DEFAULT NULL COMMENT 'Comma-separated tone pairs (e.g., "2,5|3,6")',
ADD COLUMN IF NOT EXISTS `allow_ng_zero_confusion` TINYINT(1) DEFAULT 0 COMMENT 'Let zero initial and ng- match each other',
ADD COLUMN IF NOT EXISTS `allow_n_l_confusion` TINYINT(1) DEFAULT 0 COMMENT 'Allow l to match n syllables and vice versa';

-- Update existing records to have default values
UPDATE `jyutping_matching_rules` SET
    `merge_n_ng_finals` = 0,
    `allow_coda_simplification` = 0,
    `ignore_tones` = 0,
    `allow_fuzzy_tones` = 0,
    `fuzzy_tone_pairs` = NULL,
    `allow_ng_zero_confusion` = 0,
    `allow_n_l_confusion` = 0
WHERE `merge_n_ng_finals` IS NULL;

