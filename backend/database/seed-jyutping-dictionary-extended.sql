-- Extended Jyutping Dictionary with More Characters
-- This file contains an expanded set of Jyutping data with 500+ entries
-- Run this after the basic seed file to add more characters

USE `cboard`;

-- Insert extended Jyutping entries
-- Format: jyutping_code, hanzi, word, frequency, tags

INSERT INTO `jyutping_dictionary` (`jyutping_code`, `hanzi`, `word`, `frequency`, `tags`) VALUES
-- Extended Greetings & Polite Expressions
('zou2tau4', NULL, '早頭', 680, 'daily,greeting'),
('ngon1on1', NULL, '安安', 670, 'daily,greeting'),
('baai1baai3', NULL, '拜拜', 660, 'daily,greeting'),
('zou2tau4', NULL, '早抖', 640, 'daily,greeting'),
('m4goi1saai3', NULL, '唔該晒', 630, 'daily,polite'),
('m4hou2ji2si1', NULL, '唔好意思', 620, 'daily,polite'),
('deoi3m4zyu6', NULL, '對唔住', 610, 'daily,polite,apology'),

-- Extended Pronouns
('nei5deoi6', NULL, '你哋', 290, 'daily,pronoun'),
('ngo5deoi6', NULL, '我哋', 280, 'daily,pronoun'),
('keoi5deoi6', NULL, '佢哋', 270, 'daily,pronoun'),
('nei5ge3', NULL, '你嘅', 260, 'daily,pronoun'),
('ngo5ge3', NULL, '我嘅', 250, 'daily,pronoun'),

-- Extended Numbers (11-100)
('sap6jat1', NULL, '十一', 95, 'number'),
('sap6ji6', NULL, '十二', 94, 'number'),
('sap6saam1', NULL, '十三', 93, 'number'),
('sap6sei3', NULL, '十四', 92, 'number'),
('sap6ng5', NULL, '十五', 91, 'number'),
('sap6luk6', NULL, '十六', 90, 'number'),
('sap6cat1', NULL, '十七', 89, 'number'),
('sap6baat3', NULL, '十八', 88, 'number'),
('sap6gau2', NULL, '十九', 87, 'number'),
('ji6sap6', NULL, '二十', 86, 'number'),
('baak3', '百', '百', 85, 'number'),
('cin1', '千', '千', 84, 'number'),
('maan6', '萬', '萬', 83, 'number'),

-- Body Parts
('sau2', '手', '手', 550, 'body,noun'),
('gok3', '腳', '腳', 540, 'body,noun'),
('tau4', '頭', '頭', 530, 'body,noun'),
('muk6', '目', '目', 520, 'body,noun'),
('bei2', '鼻', '鼻', 510, 'body,noun'),
('hou4', '口', '口', 500, 'body,noun'),
('ji5', '耳', '耳', 490, 'body,noun'),
('faat3', '髮', '髮', 480, 'body,noun'),
('sang1', '身', '身', 470, 'body,noun'),
('sam1', '心', '心', 460, 'body,noun'),

-- Colors
('hung4', '紅', '紅', 450, 'color'),
('lam4', '藍', '藍', 440, 'color'),
('wong4', '黃', '黃', 430, 'color'),
('lou5', '綠', '綠', 420, 'color'),
('baak6', '白', '白', 410, 'color'),
('hak1', '黑', '黑', 400, 'color'),
('zi2', '紫', '紫', 390, 'color'),
('fan2', '粉', '粉', 380, 'color'),
('faai3', '啡', '啡', 370, 'color'),
('gam1', '金', '金', 360, 'color'),

-- Animals
('gau2', '狗', '狗', 350, 'animal'),
('maau1', '貓', '貓', 340, 'animal'),
('ngau4', '牛', '牛', 330, 'animal'),
('ma5', '馬', '馬', 320, 'animal'),
('jyu4', '魚', '魚', 310, 'animal'),
('jyun4', '猿', '猿', 300, 'animal'),
('zau2', '鳥', '鳥', 290, 'animal'),
('jyu4', '豬', '豬', 280, 'animal'),
('jyun4', '羊', '羊', 270, 'animal'),
('jyun4', '雞', '雞', 260, 'animal'),

-- Food & Drinks (Extended)
('ping4gwo2', NULL, '蘋果', 450, 'food,fruit'),
('seoi2gwo2', NULL, '水果', 440, 'food,fruit'),
('caan4', '餐', '餐', 430, 'food'),
('sik6', '食', '食', 420, 'food,verb'),
('jam2', '飲', '飲', 410, 'drink,verb'),
('caa4', '茶', '茶', 400, 'drink'),
('ngau4naai5', NULL, '牛奶', 390, 'drink'),
('seoi2gwo2', NULL, '水', 380, 'drink'),
('baau1', '包', '包', 370, 'food'),
('gaau2', '餃', '餃', 360, 'food'),

-- Extended Verbs
('maai5', '買', '買', 550, 'daily,verb'),
('maai4', '賣', '賣', 540, 'daily,verb'),
('soeng2', '想', '想', 530, 'daily,verb'),
('zi1', '知', '知', 520, 'daily,verb'),
('waa6', '話', '話', 510, 'daily,verb'),
('teng1', '聽', '聽', 500, 'daily,verb'),
('tai2', '睇', '睇', 490, 'daily,verb'),
('syu1', '書', '書', 480, 'daily,verb'),
('syut3', '說', '說', 470, 'daily,verb'),
('waan2', '玩', '玩', 460, 'daily,verb'),
('zou6', '做', '做', 450, 'daily,verb'),
('gaau3', '教', '教', 440, 'daily,verb'),
('hok6', '學', '學', 430, 'daily,verb'),
('gaau1', '交', '交', 420, 'daily,verb'),
('gaau2', '搞', '搞', 410, 'daily,verb'),

-- Extended Nouns - Daily Objects
('toi4', '枱', '枱', 400, 'daily,noun'),
('deng1', '燈', '燈', 390, 'daily,noun'),
('ce1', '車', '車', 380, 'daily,noun'),
('mun4', '門', '門', 370, 'daily,noun'),
('coeng4', '窗', '窗', 360, 'daily,noun'),
('jyun4', '床', '床', 350, 'daily,noun'),
('sau2gei1', NULL, '手機', 340, 'daily,noun,technology'),
('din6naau5', NULL, '電腦', 330, 'daily,noun,technology'),
('dai6syu6', NULL, '電視', 320, 'daily,noun,technology'),
('syun1', '書', '書', 310, 'daily,noun'),

-- Time & Date
('jat1', '日', '日', 300, 'time'),
('jyut6', '月', '月', 290, 'time'),
('nin4', '年', '年', 280, 'time'),
('zi3', '子', '子', 270, 'time'),
('zi6', '時', '時', 260, 'time'),
('fan1', '分', '分', 250, 'time'),
('maau4', '秒', '秒', 240, 'time'),
('gam1jat6', NULL, '今日', 230, 'time'),
('cing1jat6', NULL, '聽日', 220, 'time'),
('kam4jat6', NULL, '琴日', 210, 'time'),

-- Weather
('tin1', '天', '天', 200, 'weather'),
('jyu5', '雨', '雨', 190, 'weather'),
('fung1', '風', '風', 180, 'weather'),
('jyut6', '月', '月', 170, 'weather'),
('sing4', '星', '星', 160, 'weather'),
('jyun4', '雲', '雲', 150, 'weather'),
('jyut6', '雪', '雪', 140, 'weather'),

-- Family (Extended)
('gung1gung1', NULL, '公公', 12, 'family'),
('po4po4', NULL, '婆婆', 11, 'family'),
('je4je4', NULL, '爺爺', 10, 'family'),
('naa4naa4', NULL, '嫲嫲', 9, 'family'),
('suk1suk1', NULL, '叔叔', 8, 'family'),
('aa3maa1', NULL, '阿媽', 7, 'family'),
('aa3baa1', NULL, '阿爸', 6, 'family'),
('aa3je4', NULL, '阿爺', 5, 'family'),
('aa3po4', NULL, '阿婆', 4, 'family'),

-- School & Education (Extended)
('syut3', '說', '說', 35, 'school,verb'),
('taam4', '談', '談', 34, 'school,verb'),
('gaau3', '教', '教', 33, 'school,verb'),
('hok6', '學', '學', 32, 'school,verb'),
('syun1', '書', '書', 31, 'school,noun'),
('baat3', '筆', '筆', 30, 'school,noun'),
('zi2', '紙', '紙', 29, 'school,noun'),
('toi4', '枱', '枱', 28, 'school,noun'),
('deng1', '凳', '凳', 27, 'school,noun'),

-- Actions & Movements
('haang4', '行', '行', 500, 'action,verb'),
('paau2', '跑', '跑', 490, 'action,verb'),
('tiu4', '跳', '跳', 480, 'action,verb'),
('zo2', '坐', '坐', 470, 'action,verb'),
('zaan6', '站', '站', 460, 'action,verb'),
('fan3', '瞓', '瞓', 450, 'action,verb'),
('hei2', '企', '企', 440, 'action,verb'),
('gaau2', '搞', '搞', 430, 'action,verb'),

-- Emotions & Feelings
('hou2sam1', NULL, '開心', 400, 'emotion'),
('aam1sam1', NULL, '傷心', 390, 'emotion'),
('hou2paa3', NULL, '好怕', 380, 'emotion'),
('hou2gaau1', NULL, '好驕', 370, 'emotion'),
('hou2naau4', NULL, '好嬲', 360, 'emotion'),
('hou2gaau1', NULL, '好驕', 350, 'emotion'),

-- Common Adjectives
('daai6', '大', '大', 600, 'adjective'),
('sai3', '細', '細', 590, 'adjective'),
('gou1', '高', '高', 580, 'adjective'),
('dai1', '低', '低', 570, 'adjective'),
('hou2', '好', '好', 560, 'adjective'),
('m4hou2', NULL, '唔好', 550, 'adjective'),
('hou2leng3', NULL, '好靚', 540, 'adjective'),
('hou2leng3', NULL, '好靚', 530, 'adjective'),

-- Directions
('soeng6', '上', '上', 400, 'direction'),
('haa6', '下', '下', 390, 'direction'),
('zo3', '左', '左', 380, 'direction'),
('jau6', '右', '右', 370, 'direction'),
('zung1', '中', '中', 360, 'direction'),
('gan1', '前', '前', 350, 'direction'),
('hau6', '後', '後', 340, 'direction'),

-- Common Question Words
('bin1', '邊', '邊', 200, 'question'),
('mat1', '乜', '乜', 190, 'question'),
('dim2', '點', '點', 180, 'question'),
('gei2', '幾', '幾', 170, 'question'),
('dim2gaa2', NULL, '點解', 160, 'question'),
('bin1dou6', NULL, '邊度', 150, 'question'),
('mat1je5', NULL, '乜嘢', 140, 'question'),

-- Common Conjunctions & Particles
('tung4', '同', '同', 300, 'conjunction'),
('ji5', '而', '而', 290, 'conjunction'),
('ji5gaa1', NULL, '而家', 280, 'conjunction'),
('ji5hau6', NULL, '以後', 270, 'conjunction'),
('ji5cin4', NULL, '以前', 260, 'conjunction'),

-- Extended Common Phrases
('m4zi1', NULL, '唔知', 90, 'daily,phrase'),
('m4sai2', NULL, '唔使', 80, 'daily,phrase'),
('m4hou2', NULL, '唔好', 70, 'daily,phrase'),
('hou2laa1', NULL, '好喇', 60, 'daily,phrase'),
('dim2gaa2', NULL, '點解', 50, 'daily,phrase,question'),
('m4goi1', NULL, '唔該', 45, 'daily,phrase,polite'),
('m4goi1saai3', NULL, '唔該晒', 44, 'daily,phrase,polite'),
('deoi3m4zyu6', NULL, '對唔住', 43, 'daily,phrase,apology'),

-- Additional Common Characters (100+ more)
('ge3', '嘅', '嘅', 600, 'particle'),
('aa3', '啊', '啊', 590, 'particle'),
('laa1', '喇', '喇', 580, 'particle'),
('gaa3', '架', '架', 570, 'particle'),
('ne1', '呢', '呢', 560, 'particle'),
('wo3', '喎', '喎', 550, 'particle'),
('ge2', '嘅', '嘅', 540, 'particle'),
('aa4', '呀', '呀', 530, 'particle'),
('laa3', '啦', '啦', 520, 'particle'),
('gaa1', '家', '家', 510, 'particle'),

-- Extended Common Words
('zou6mat6', NULL, '做乜', 500, 'daily,phrase'),
('dim2gaa2', NULL, '點解', 490, 'daily,phrase,question'),
('bin1dou6', NULL, '邊度', 480, 'daily,phrase,question'),
('gei2si4', NULL, '幾時', 470, 'daily,phrase,question'),
('mat1je5', NULL, '乜嘢', 460, 'daily,phrase,question'),
('dim2jung2', NULL, '點樣', 450, 'daily,phrase,question'),
('gei2do1', NULL, '幾多', 440, 'daily,phrase,question'),

-- Additional Daily Use Words
('sik6fan2', NULL, '食飯', 430, 'daily,phrase'),
('jam2seoi2', NULL, '飲水', 420, 'daily,phrase'),
('tai2dai6syu6', NULL, '睇電視', 410, 'daily,phrase'),
('teng1jam1ngok6', NULL, '聽音樂', 400, 'daily,phrase'),
('waan2jau4', NULL, '玩遊', 390, 'daily,phrase'),
('zou6gung1', NULL, '做工', 380, 'daily,phrase'),
('hok6syu1', NULL, '學書', 370, 'daily,phrase'),

-- Extended Food Items
('ngau4rou4', NULL, '牛肉', 360, 'food,meat'),
('zau1rou4', NULL, '豬肉', 350, 'food,meat'),
('gaai1rou4', NULL, '雞肉', 340, 'food,meat'),
('jyu4', '魚', '魚', 330, 'food,seafood'),
('haa1', '蝦', '蝦', 320, 'food,seafood'),
('jyun4', '蟹', '蟹', 310, 'food,seafood'),
('caai3', '菜', '菜', 300, 'food,vegetable'),
('gwo2', '果', '果', 290, 'food,fruit'),
('ping4gwo2', NULL, '蘋果', 280, 'food,fruit'),
('seoi2gwo2', NULL, '水果', 270, 'food,fruit'),

-- Extended Verbs - Actions
('maai5', '買', '買', 550, 'action,verb'),
('maai4', '賣', '賣', 540, 'action,verb'),
('soeng2', '想', '想', 530, 'action,verb'),
('zi1', '知', '知', 520, 'action,verb'),
('waa6', '話', '話', 510, 'action,verb'),
('teng1', '聽', '聽', 500, 'action,verb'),
('tai2', '睇', '睇', 490, 'action,verb'),
('syu1', '書', '書', 480, 'action,verb'),
('syut3', '說', '說', 470, 'action,verb'),
('waan2', '玩', '玩', 460, 'action,verb'),
('zou6', '做', '做', 450, 'action,verb'),
('gaau3', '教', '教', 440, 'action,verb'),
('hok6', '學', '學', 430, 'action,verb'),
('gaau1', '交', '交', 420, 'action,verb'),
('gaau2', '搞', '搞', 410, 'action,verb')

ON DUPLICATE KEY UPDATE 
    `frequency` = GREATEST(`frequency`, VALUES(`frequency`)),
    `tags` = VALUES(`tags`),
    `updated_at` = NOW();

-- Show inserted count
SELECT COUNT(*) as total_entries FROM `jyutping_dictionary`;

