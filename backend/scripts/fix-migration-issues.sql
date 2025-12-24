-- Manual SQL script to fix migration issues
-- Run this after migrate-boards-to-profiles-v2.php if you encounter errors

-- Step 1: Remove foreign key constraints that reference boards table
-- This must be done before dropping the boards table

-- Remove action_logs foreign key to boards
ALTER TABLE action_logs DROP FOREIGN KEY IF EXISTS action_logs_ibfk_3;

-- Remove card_logs foreign key to boards (if exists)
-- First, find the constraint name:
-- SELECT CONSTRAINT_NAME 
-- FROM information_schema.KEY_COLUMN_USAGE 
-- WHERE TABLE_SCHEMA = DATABASE() 
-- AND TABLE_NAME = 'card_logs' 
-- AND REFERENCED_TABLE_NAME = 'boards';
-- Then drop it (replace CONSTRAINT_NAME with actual name):
-- ALTER TABLE card_logs DROP FOREIGN KEY <CONSTRAINT_NAME>;

-- Step 2: Remove board_id column from action_logs (if it exists)
-- Check if column exists first, then remove it
ALTER TABLE action_logs DROP COLUMN board_id;

-- Step 3: Drop boards table (after removing foreign keys)
DROP TABLE IF EXISTS boards;

-- Step 4: Remove columns from profiles table
-- Check if columns exist first, then remove them

-- Remove root_board_id
ALTER TABLE profiles DROP COLUMN root_board_id;

-- Remove name column
ALTER TABLE profiles DROP COLUMN name;

-- Remove is_default column
ALTER TABLE profiles DROP COLUMN is_default;

