-- Seed Data: Preset Profiles for Communication Mode
-- Sprint 4: Create ≥10 public preset profiles
-- 
-- NOTE: This SQL file is DEPRECATED. 
-- Please use the PHP script instead: backend/scripts/seed-preset-profiles-from-boards.php
-- 
-- The PHP script:
-- 1. Deletes existing preset profiles (user_id = 1)
-- 2. Reads boards from boards.json
-- 3. Creates profiles with cards properly linked
-- 
-- To run: php backend/scripts/seed-preset-profiles-from-boards.php

USE cboard;

-- Create a system user for preset profiles (or use user_id = 0 for system)
-- Note: You may need to create a system user first, or use NULL user_id
-- For now, we'll assume there's a system user with id = 1

-- Preset Profile 1: Basic Communication (system template, NOT public by default)
INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
VALUES (1, 'Basic Communication', 'Basic Communication', 'Essential communication cards for daily needs', '4x6', 'en', 0, 0, NOW(), NOW());

-- Preset Profile 2: Food & Drinks (system template, NOT public by default)
INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
VALUES (1, 'Food & Drinks', 'Food & Drinks', 'Cards for ordering food and drinks', '4x6', 'en', 0, 0, NOW(), NOW());

-- Preset Profile 3: Emotions & Feelings (system template, NOT public by default)
INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
VALUES (1, 'Emotions & Feelings', 'Emotions & Feelings', 'Express emotions and feelings', '3x4', 'en', 0, 0, NOW(), NOW());

-- Preset Profile 4: Activities (system template, NOT public by default)
INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
VALUES (1, 'Activities', 'Activities', 'Common activities and hobbies', '4x6', 'en', 0, 0, NOW(), NOW());

-- Preset Profile 5: School (system template, NOT public by default)
INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
VALUES (1, 'School', 'School', 'School-related communication cards', '4x6', 'en', 0, 0, NOW(), NOW());

-- Preset Profile 6: Home & Family (system template, NOT public by default)
INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
VALUES (1, 'Home & Family', 'Home & Family', 'Family and home activities', '4x6', 'en', 0, 0, NOW(), NOW());

-- Preset Profile 7: Health & Medical (system template, NOT public by default)
INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
VALUES (1, 'Health & Medical', 'Health & Medical', 'Medical and health communication', '3x4', 'en', 0, 0, NOW(), NOW());

-- Preset Profile 8: Shopping (system template, NOT public by default)
INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
VALUES (1, 'Shopping', 'Shopping', 'Shopping and purchasing cards', '4x6', 'en', 0, 0, NOW(), NOW());

-- Preset Profile 9: Transportation (system template, NOT public by default)
INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
VALUES (1, 'Transportation', 'Transportation', 'Transportation and travel cards', '3x4', 'en', 0, 0, NOW(), NOW());

-- Preset Profile 10: Social & Greetings (system template, NOT public by default)
INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
VALUES (1, 'Social & Greetings', 'Social & Greetings', 'Social interactions and greetings', '2x3', 'en', 0, 0, NOW(), NOW());

-- Preset Profile 11: Cantonese Basic (zh-HK) (system template, NOT public by default)
INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
VALUES (1, '粵語基本溝通', 'Cantonese Basic', 'Basic Cantonese communication cards', '4x6', 'zh-HK', 0, 0, NOW(), NOW());

-- Preset Profile 12: Cantonese Food (zh-HK) (system template, NOT public by default)
INSERT INTO profiles (user_id, display_name, name, description, layout_type, language, is_public, is_default, created_at, updated_at)
VALUES (1, '粵語飲食', 'Cantonese Food', 'Cantonese food and drink cards', '4x6', 'zh-HK', 0, 0, NOW(), NOW());

-- Get the profile IDs for reference
SELECT id, display_name, language, layout_type FROM profiles WHERE is_public = 1 ORDER BY id;

