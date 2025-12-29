-- Migration: Add Unique Constraint to jyutping_dictionary
-- Created: 2025-12-29
-- Purpose: Prevent duplicate entries in jyutping_dictionary table

-- Add unique constraint to prevent duplicate jyutping_code + hanzi + word combinations
-- This ensures data integrity for dictionary entries
ALTER TABLE `jyutping_dictionary`
ADD CONSTRAINT `unique_jyutping_hanzi_word`
UNIQUE KEY (`jyutping_code`, `hanzi`, `word`);
