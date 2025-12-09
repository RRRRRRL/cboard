-- Requirements Validation Queries
-- Run these queries to verify the schema supports all requirements

USE cboard;

-- ============================================================================
-- 1. GENERAL SYSTEM REQUIREMENTS
-- ============================================================================

-- Multi-profile support: Verify users can have multiple profiles
SELECT 
    'Multi-profile support' AS requirement,
    COUNT(DISTINCT user_id) AS users_with_profiles,
    COUNT(*) AS total_profiles
FROM profiles;

-- ============================================================================
-- 2. EDITING MODE FEATURES
-- ============================================================================

-- Layout templates: Verify layout_type field exists
SELECT 
    'Layout templates' AS requirement,
    COUNT(DISTINCT layout_type) AS available_layouts,
    GROUP_CONCAT(DISTINCT layout_type) AS layout_types
FROM profiles
WHERE layout_type IS NOT NULL;

-- Card editing: Verify all card styling fields exist
SELECT 
    'Card editing fields' AS requirement,
    COUNT(*) AS total_cards,
    COUNT(title) AS cards_with_title,
    COUNT(text_color) AS cards_with_text_color,
    COUNT(background_color) AS cards_with_background_color
FROM cards;

-- Profile-card positioning: Verify layout positioning fields
SELECT 
    'Layout positioning' AS requirement,
    COUNT(*) AS total_profile_cards,
    COUNT(DISTINCT profile_id) AS profiles_with_cards,
    MIN(row_index) AS min_row,
    MAX(row_index) AS max_row,
    MIN(col_index) AS min_col,
    MAX(col_index) AS max_col,
    MIN(page_index) AS min_page,
    MAX(page_index) AS max_page
FROM profile_cards;

-- ============================================================================
-- 3. COMMUNICATION MODE FEATURES
-- ============================================================================

-- Preset profiles: Verify public profiles exist
SELECT 
    'Preset profiles' AS requirement,
    COUNT(*) AS public_profiles
FROM profiles
WHERE is_public = 1;

-- ============================================================================
-- 4. ACCESSIBILITY SUPPORT
-- ============================================================================

-- Settings storage: Verify settings table supports JSON
SELECT 
    'Settings storage' AS requirement,
    COUNT(*) AS users_with_settings,
    COUNT(CASE WHEN JSON_VALID(settings_data) THEN 1 END) AS valid_json_settings
FROM settings
WHERE settings_data IS NOT NULL;

-- ============================================================================
-- 5. PROFILE TRANSFER SYSTEM
-- ============================================================================

-- Transfer tokens: Verify all transfer types supported
SELECT 
    'Profile transfer' AS requirement,
    transfer_type,
    COUNT(*) AS token_count,
    COUNT(CASE WHEN expires_at > NOW() AND used_at IS NULL THEN 1 END) AS active_tokens
FROM profile_transfer_tokens
GROUP BY transfer_type;

-- ============================================================================
-- 6. JYUTPING KEYBOARD REQUIREMENTS
-- ============================================================================

-- Jyutping dictionary: Verify dictionary structure
SELECT 
    'Jyutping dictionary' AS requirement,
    COUNT(*) AS total_entries,
    COUNT(DISTINCT jyutping_code) AS unique_codes,
    COUNT(DISTINCT hanzi) AS unique_characters,
    COUNT(DISTINCT word) AS unique_words,
    AVG(frequency) AS avg_frequency
FROM jyutping_dictionary;

-- Jyutping learning log: Verify learning tracking
SELECT 
    'Jyutping learning' AS requirement,
    COUNT(*) AS total_attempts,
    COUNT(DISTINCT user_id) AS users_learning,
    COUNT(DISTINCT jyutping_code) AS codes_practiced,
    SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_attempts,
    SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) AS incorrect_attempts
FROM jyutping_learning_log;

-- ============================================================================
-- 7. LEARNING GAME REQUIREMENTS
-- ============================================================================

-- Games results: Verify game tracking
SELECT 
    'Learning games' AS requirement,
    game_type,
    COUNT(*) AS games_played,
    COUNT(DISTINCT user_id) AS unique_players,
    AVG(score) AS avg_score,
    MAX(score) AS max_score
FROM games_results
GROUP BY game_type;

-- ============================================================================
-- 8. OCR TRANSLATOR REQUIREMENTS
-- ============================================================================

-- OCR history: Verify OCR tracking
SELECT 
    'OCR translator' AS requirement,
    COUNT(*) AS total_ocr_requests,
    COUNT(DISTINCT user_id) AS users_using_ocr,
    COUNT(CASE WHEN jyutping_result IS NOT NULL THEN 1 END) AS successful_conversions
FROM ocr_history;

-- ============================================================================
-- 9. DATA LOGGING REQUIREMENTS
-- ============================================================================

-- Action logs: Verify logging structure
SELECT 
    'Data logging' AS requirement,
    action_type,
    COUNT(*) AS log_count,
    COUNT(DISTINCT user_id) AS unique_users,
    COUNT(DISTINCT profile_id) AS unique_profiles,
    MIN(created_at) AS earliest_log,
    MAX(created_at) AS latest_log
FROM action_logs
GROUP BY action_type;

-- Log retention: Check log age distribution
SELECT 
    'Log retention' AS requirement,
    CASE 
        WHEN created_at > DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 'Last 24 hours'
        WHEN created_at > DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 'Last 7 days'
        WHEN created_at > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'Last 30 days'
        WHEN created_at > DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 'Last 90 days'
        ELSE 'Older than 90 days'
    END AS age_group,
    COUNT(*) AS log_count
FROM action_logs
GROUP BY age_group;

-- ============================================================================
-- 10. USER ACCOUNT SYSTEM
-- ============================================================================

-- User accounts: Verify user structure
SELECT 
    'User accounts' AS requirement,
    role,
    COUNT(*) AS user_count,
    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_users,
    SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) AS verified_users
FROM users
GROUP BY role;

-- ============================================================================
-- 11. AI FUNCTIONALITY
-- ============================================================================

-- AI cache: Verify caching structure
SELECT 
    'AI caching' AS requirement,
    cache_key,
    COUNT(*) AS cache_entries,
    COUNT(CASE WHEN expires_at > NOW() THEN 1 END) AS active_cache,
    MIN(created_at) AS oldest_entry,
    MAX(created_at) AS newest_entry
FROM ai_cache
GROUP BY cache_key;

-- ============================================================================
-- SCHEMA COMPLETENESS CHECK
-- ============================================================================

-- Verify all required tables exist
SELECT 
    'Schema completeness' AS check_type,
    TABLE_NAME AS table_name,
    TABLE_ROWS AS row_count,
    CASE 
        WHEN TABLE_NAME IN (
            'users', 'profiles', 'boards', 'cards', 'profile_cards',
            'jyutping_dictionary', 'jyutping_learning_log',
            'action_logs', 'profile_transfer_tokens', 'ocr_history',
            'settings', 'media', 'games_results', 'ai_cache'
        ) THEN 'Required table exists'
        ELSE 'Optional table'
    END AS status
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'cboard'
ORDER BY TABLE_NAME;

-- Verify all required indexes exist
SELECT 
    'Index completeness' AS check_type,
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'cboard'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- ============================================================================
-- DATA INTEGRITY CHECKS
-- ============================================================================

-- Check for orphaned records
SELECT 
    'Data integrity - Orphaned profiles' AS check_type,
    COUNT(*) AS orphaned_count
FROM profiles p
LEFT JOIN users u ON p.user_id = u.id
WHERE u.id IS NULL;

SELECT 
    'Data integrity - Orphaned profile_cards' AS check_type,
    COUNT(*) AS orphaned_count
FROM profile_cards pc
LEFT JOIN profiles p ON pc.profile_id = p.id
LEFT JOIN cards c ON pc.card_id = c.id
WHERE p.id IS NULL OR c.id IS NULL;

-- Check for missing required fields
SELECT 
    'Data integrity - Missing required fields' AS check_type,
    'users' AS table_name,
    COUNT(*) AS records_missing_email
FROM users
WHERE email IS NULL OR email = '';

SELECT 
    'Data integrity - Missing required fields' AS check_type,
    'profiles' AS table_name,
    COUNT(*) AS records_missing_display_name
FROM profiles
WHERE display_name IS NULL OR display_name = '';

SELECT 
    'Data integrity - Missing required fields' AS check_type,
    'cards' AS table_name,
    COUNT(*) AS records_missing_title
FROM cards
WHERE title IS NULL OR title = '';

