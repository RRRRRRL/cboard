-- SQL script to delete corrupted profile (ID: 49) and all associated data
-- Run this script in your MySQL/MariaDB client
-- Usage: mysql -u username -p cboard < delete-corrupted-profile.sql

-- Start transaction
START TRANSACTION;

-- Step 1: Delete profile_cards
DELETE FROM profile_cards WHERE profile_id = 49;
SELECT CONCAT('Deleted ', ROW_COUNT(), ' profile_cards entries') AS result;

-- Step 2: Delete action_logs
DELETE FROM action_logs WHERE profile_id = 49;
SELECT CONCAT('Deleted ', ROW_COUNT(), ' action_logs entries') AS result;

-- Step 3: Delete profile_transfer_tokens
DELETE FROM profile_transfer_tokens WHERE profile_id = 49;
SELECT CONCAT('Deleted ', ROW_COUNT(), ' profile_transfer_tokens entries') AS result;

-- Step 4: Delete ocr_history
DELETE FROM ocr_history WHERE profile_id = 49;
SELECT CONCAT('Deleted ', ROW_COUNT(), ' ocr_history entries') AS result;

-- Step 5: Delete games_results
DELETE FROM games_results WHERE profile_id = 49;
SELECT CONCAT('Deleted ', ROW_COUNT(), ' games_results entries') AS result;

-- Step 6: Delete settings
DELETE FROM settings WHERE profile_id = 49;
SELECT CONCAT('Deleted ', ROW_COUNT(), ' settings entries') AS result;

-- Step 7: Delete the profile itself
DELETE FROM profiles WHERE id = 49;
SELECT CONCAT('Deleted ', ROW_COUNT(), ' profile(s)') AS result;

-- Commit transaction
COMMIT;

-- Verify deletion
SELECT 'Profile ID 49 has been deleted successfully' AS status;

