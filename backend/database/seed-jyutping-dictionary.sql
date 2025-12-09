-- Seed Jyutping Dictionary with Common Words
-- Sprint 7: Jyutping Keyboard
-- This file contains sample Jyutping data for testing

USE `cboard`;

-- Clear existing data (optional - comment out if you want to keep existing data)
-- TRUNCATE TABLE `jyutping_dictionary`;

-- Insert common Jyutping entries
-- Format: jyutping_code, hanzi, word, frequency, tags

INSERT INTO `jyutping_dictionary` (`jyutping_code`, `hanzi`, `word`, `frequency`, `tags`) VALUES
-- Common greetings
('nei5', '你', '你', 1000, 'daily,greeting'),
('hou2', '好', '好', 950, 'daily,greeting'),
('m4', '唔', '唔', 900, 'daily'),
('goi1', '該', '該', 850, 'daily,polite'),
('m4goi1', NULL, '唔該', 800, 'daily,polite'),
('nei5hou2', NULL, '你好', 750, 'daily,greeting'),
('zou2san4', NULL, '早晨', 700, 'daily,greeting'),
('maan5on1', NULL, '晚安', 650, 'daily,greeting'),

-- Common verbs
('sik6', '食', '食', 600, 'daily,verb'),
('jam2', '飲', '飲', 580, 'daily,verb'),
('heoi3', '去', '去', 560, 'daily,verb'),
('lai4', '來', '來', 540, 'daily,verb'),
('teng1', '聽', '聽', 520, 'daily,verb'),
('tai2', '睇', '睇', 500, 'daily,verb'),
('waan2', '玩', '玩', 480, 'daily,verb'),
('zou6', '做', '做', 460, 'daily,verb'),

-- Common nouns
('jan4', '人', '人', 440, 'daily,noun'),
('sik6mat6', NULL, '食物', 420, 'daily,noun,food'),
('seoi2', '水', '水', 400, 'daily,noun'),
('fan2', '飯', '飯', 380, 'daily,noun,food'),
('min6', '麵', '麵', 360, 'daily,noun,food'),
('caa4', '茶', '茶', 340, 'daily,noun,drink'),
('ngo5', '我', '我', 320, 'daily,pronoun'),
('keoi5', '佢', '佢', 300, 'daily,pronoun'),

-- Numbers
('jat1', '一', '一', 280, 'number'),
('ji6', '二', '二', 260, 'number'),
('saam1', '三', '三', 240, 'number'),
('sei3', '四', '四', 220, 'number'),
('ng5', '五', '五', 200, 'number'),
('luk6', '六', '六', 180, 'number'),
('cat1', '七', '七', 160, 'number'),
('baat3', '八', '八', 140, 'number'),
('gau2', '九', '九', 120, 'number'),
('sap6', '十', '十', 100, 'number'),

-- Common phrases
('m4zi1', NULL, '唔知', 90, 'daily,phrase'),
('m4sai2', NULL, '唔使', 80, 'daily,phrase'),
('m4hou2', NULL, '唔好', 70, 'daily,phrase'),
('hou2laa1', NULL, '好喇', 60, 'daily,phrase'),
('dim2gaa2', NULL, '點解', 50, 'daily,phrase,question'),
('dim2', '點', '點', 40, 'daily,question'),

-- School related
('hok6', '學', '學', 35, 'school,verb'),
('hok6haau6', NULL, '學校', 30, 'school,noun'),
('syut3', '說', '說', 25, 'school,verb'),
('taam4', '談', '談', 20, 'school,verb'),

-- Family
('maa1maa1', NULL, '媽媽', 15, 'family'),
('baa1baa1', NULL, '爸爸', 14, 'family'),
('go1go1', NULL, '哥哥', 13, 'family'),
('ze2ze2', NULL, '姐姐', 12, 'family'),
('dai3dai2', NULL, '弟弟', 11, 'family'),
('mui5mui5', NULL, '妹妹', 10, 'family')

ON DUPLICATE KEY UPDATE 
    `frequency` = VALUES(`frequency`),
    `tags` = VALUES(`tags`),
    `updated_at` = NOW();

-- Show inserted count
SELECT COUNT(*) as total_entries FROM `jyutping_dictionary`;

