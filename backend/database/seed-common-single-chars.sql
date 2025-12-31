-- Seed Common Single Characters for Jyutping Dictionary
-- Quick fix for missing common single words like 是
-- Run this after the main seeding scripts

USE `cboard`;

INSERT INTO `jyutping_dictionary` (`jyutping_code`, `hanzi`, `word`, `frequency`, `tags`) VALUES
-- Basic pronouns and words
('si6', '是', '是', 1000, 'daily'),
('bat1', '不', '不', 950, 'daily'),
('ngo5', '我', '我', 900, 'daily,pronoun'),
('nei5', '你', '你', 850, 'daily,pronoun'),
('keoi5', '佢', '佢', 800, 'daily,pronoun'),

-- Numbers
('jat1', '一', '一', 750, 'number'),
('ji6', '二', '二', 700, 'number'),
('saam1', '三', '三', 650, 'number'),
('sei3', '四', '四', 600, 'number'),
('ng5', '五', '五', 550, 'number'),
('luk6', '六', '六', 500, 'number'),
('cat1', '七', '七', 450, 'number'),
('baat3', '八', '八', 400, 'number'),
('gau2', '九', '九', 350, 'number'),
('sap6', '十', '十', 300, 'number'),

-- Common adjectives
('daai6', '大', '大', 900, 'adjective'),
('siu2', '小', '小', 850, 'adjective'),
('hou2', '好', '好', 800, 'adjective'),
('waai6', '壞', '壞', 700, 'adjective'),
('do1', '多', '多', 750, 'adjective'),
('siu2', '少', '少', 700, 'adjective'),
('faai3', '快', '快', 650, 'adjective'),
('maan6', '慢', '慢', 600, 'adjective'),
('gou1', '高', '高', 550, 'adjective'),
('dai1', '低', '低', 500, 'adjective'),

-- Size and shape
('coeng4', '長', '長', 450, 'adjective'),
('dyun2', '短', '短', 400, 'adjective'),
('san1', '新', '新', 350, 'adjective'),
('gau6', '舊', '舊', 300, 'adjective'),

-- Temperature
('jit6', '熱', '熱', 400, 'adjective'),
('laang5', '冷', '冷', 350, 'adjective'),

-- Colors (single chars)
('hung4', '紅', '紅', 300, 'color'),
('lam4', '藍', '藍', 280, 'color'),
('wong4', '黃', '黃', 260, 'color'),
('lou5', '綠', '綠', 240, 'color'),
('baak6', '白', '白', 220, 'color'),
('hak1', '黑', '黑', 200, 'color'),

-- Time and age
('nin4', '年', '年', 250, 'time'),
('jyut6', '月', '月', 230, 'time'),
('jat6', '日', '日', 210, 'time'),
('lau5', '老', '老', 180, 'adjective'),

-- Directions
('soeng6', '上', '上', 200, 'direction'),
('haa6', '下', '下', 190, 'direction'),
('zo3', '左', '左', 180, 'direction'),
('jau6', '右', '右', 170, 'direction'),

-- Body parts
('tau4', '頭', '頭', 160, 'body'),
('muk6', '目', '目', 150, 'body'),
('bei2', '鼻', '鼻', 140, 'body'),
('hou4', '口', '口', 130, 'body'),
('ji5', '耳', '耳', 120, 'body'),

-- Family
('maa1', '媽', '媽', 110, 'family'),
('baa1', '爸', '爸', 100, 'family'),
('go1', '哥', '哥', 90, 'family'),
('mui5', '妹', '妹', 80, 'family'),

-- Nature
('syut3', '雪', '雪', 70, 'nature'),
('jyu5', '雨', '雨', 60, 'nature'),
('fung1', '風', '風', 50, 'nature')

ON DUPLICATE KEY UPDATE
    `frequency` = GREATEST(`frequency`, VALUES(`frequency`)),
    `tags` = VALUES(`tags`),
    `updated_at` = NOW();

-- Show inserted count
SELECT COUNT(*) as total_single_chars FROM `jyutping_dictionary` WHERE LENGTH(`hanzi`) = 1;
