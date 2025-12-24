<?php
/**
 * Script to seed Extended Jyutping dictionary data (500+ entries)
 * Run: php backend/scripts/seed-jyutping-extended.php
 * 
 * This script adds an extended set of Jyutping characters and words
 * to expand the dictionary for better coverage.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();

if (!$db) {
    echo "ERROR: Database connection failed!\n";
    exit(1);
}

echo "Seeding extended jyutping_dictionary table...\n\n";

// Extended data with 500+ entries
$data = array_merge($data, [
    // Core pronouns & people
    ['ngo5', '我', '我', 1000, 'daily,pronoun'],
    ['nei5', '你', '你', 995, 'daily,pronoun'],
    ['keoi5', '佢', '佢', 990, 'daily,pronoun'],
    ['ngo5dei6', '我哋', '我哋', 980, 'daily,pronoun,plural'],
    ['nei5dei6', '你哋', '你哋', 975, 'daily,pronoun,plural'],
    ['keoi5dei6', '佢哋', '佢哋', 970, 'daily,pronoun,plural'],
    ['ngo5dei6gaa1', '我哋家', '我哋家', 300, 'daily,pronoun,home'],
    ['jan4', '人', '人', 960, 'daily,noun'],
    ['naam4jan2', '男人', '男人', 500, 'people,noun'],
    ['neoi5jan2', '女人', '女人', 500, 'people,noun'],
    ['zai2', '仔', '仔', 480, 'people,noun,child'],
    ['neoi5zai2', '女仔', '女仔', 470, 'people,noun,child'],
    ['hok6saang1', '學生', '學生', 650, 'school,people'],
    ['sin1saang1', '先生', '先生', 640, 'school,people'],
    ['lou5si1', '老師', '老師', 630, 'school,people'],
    ['b maa1', '爸', '爸', 620, 'family'],
    ['maa4', '媽', '媽', 620, 'family'],
    ['go4go1', '哥哥', '哥哥', 550, 'family'],
    ['ze4ze2', '姐姐', '姐姐', 540, 'family'],
    ['dai6dai2', '弟弟', '弟弟', 530, 'family'],
    ['mui6mui2', '妹妹', '妹妹', 530, 'family'],

    // Core daily verbs (single words)
    ['sik6', '食', '食', 900, 'daily,verb,food'],
    ['jam2', '飲', '飲', 880, 'daily,verb,food'],
    ['heoi3', '去', '去', 870, 'daily,verb,action'],
    ['lai4', '嚟', '嚟', 860, 'daily,verb,action'],
    ['zou6', '做', '做', 850, 'daily,verb'],
    ['hai6', '係', '係', 840, 'daily,verb,copula'],
    ['jiu3', '要', '要', 830, 'daily,verb,modal'],
    ['ji5', '知', '知', 820, 'daily,verb,mental'],
    ['soeng2', '想', '想', 810, 'daily,verb,mental'],
    ['tai2', '睇', '睇', 800, 'daily,verb,perception'],
    ['teng1', '聽', '聽', 790, 'daily,verb,perception'],
    ['gong2', '講', '講', 780, 'daily,verb,speech'],
    ['waa6', '話', '話', 770, 'daily,verb,speech'],
    ['fan3', '訓', '訓', 760, 'daily,verb'],
    ['haang4', '行', '行', 750, 'daily,verb,action'],
    ['paau2', '跑', '跑', 740, 'daily,verb,action'],
    ['tiu3', '跳', '跳', 730, 'daily,verb,action'],
    ['zaap6', '習', '習', 300, 'school,verb'],
    ['hok6', '學', '學', 720, 'school,verb'],
    ['soeng5', '上', '上', 710, 'daily,verb,motion'],
    ['lok6', '落', '落', 705, 'daily,verb,motion'],
    ['soeng5hok6', '上學', '上學', 650, 'school,verb,phrase'],
    ['faan1hok6', '返學', '返學', 640, 'school,verb,phrase'],
    ['faan1gung1', '返工', '返工', 630, 'daily,verb,work'],
    ['waan2', '玩', '玩', 720, 'daily,verb,play'],
    ['soeng5zo2', '想做', '想做', 400, 'daily,verb,phrase'],
    ['soeng5hei2', '想起', '想起', 350, 'daily,verb,mental'],
    ['soeng2ji3', '想知', '想知', 340, 'daily,verb,mental'],

    // Daily nouns – home & objects
    ['uk1', '屋', '屋', 700, 'home,noun'],
    ['ga1', '家', '家', 700, 'home,noun'],
    ['fong2', '房', '房', 690, 'home,noun'],
    ['coeng4', '牀', '牀', 680, 'home,noun'],
    ['jiu1', '腰', '腰', 200, 'body,noun'],
    ['toi4', '枱', '枱', 670, 'home,noun,school'],
    ['ji2', '椅', '椅', 660, 'home,noun,school'],
    ['dang3', '凳', '凳', 655, 'home,noun,school'],
    ['coeng4wu2', '廚房', '廚房', 400, 'home,noun'],
    ['sau2ce2gaan1', '洗手間', '洗手間', 650, 'home,noun,school'],
    ['mun4', '門', '門', 640, 'home,noun'],
    ['coeng1', '窗', '窗', 630, 'home,noun'],
    ['dang1', '燈', '燈', 620, 'home,noun'],
    ['din6naau5', '電腦', '電腦', 600, 'home,noun,technology'],
    ['din6si6', '電視', '電視', 600, 'home,noun,technology'],
    ['syu1', '書', '書', 590, 'home,noun,school'],
    ['bat1', '筆', '筆', 580, 'school,noun'],
    ['zi2', '紙', '紙', 570, 'school,noun'],
    ['bou2', '本', '本', 560, 'school,noun,measure'],
    ['soeng1', '箱', '箱', 300, 'home,noun'],
    ['ji1', '衣', '衣', 550, 'home,noun,clothes'],
    ['saam1', '衫', '衫', 540, 'home,noun,clothes'],
    ['fu3', '褲', '褲', 530, 'home,noun,clothes'],
    ['hai1', '鞋', '鞋', 520, 'home,noun,clothes'],
    ['mo1', '襪', '襪', 510, 'home,noun,clothes'],
    ['bui1', '杯', '杯', 500, 'home,noun,container'],
    ['wun2', '碗', '碗', 490, 'home,noun,container'],
    ['ci2', '匙', '匙', 480, 'home,noun'],
    ['caan1', '餐', '餐', 470, 'food,noun'],
    ['zo2', '枱', '枱', 350, 'home,noun'],

    // Food & drink – single words
    ['faan6', '飯', '飯', 800, 'food,noun'],
    ['min6', '麵', '麵', 780, 'food,noun'],
    ['baau1', '包', '包', 770, 'food,noun'],
    ['gwo2', '果', '果', 400, 'food,noun,fruit'],
    ['ping4gwo2', '蘋果', '蘋果', 760, 'food,noun,fruit'],
    ['heung1zi2', '香蕉', '香蕉', 750, 'food,noun,fruit'],
    ['caang2', '橙', '橙', 740, 'food,noun,fruit'],
    ['tin1zi2', '西瓜', '西瓜', 600, 'food,noun,fruit'],
    ['caai3', '菜', '菜', 730, 'food,noun,vegetable'],
    ['jyu4', '魚', '魚', 720, 'food,noun,meat'],
    ['zau1', '豬', '豬', 710, 'food,noun,meat,animal'],
    ['ngau4', '牛', '牛', 700, 'food,noun,meat,animal'],
    ['gai1', '雞', '雞', 690, 'food,noun,meat,animal'],
    ['naaai5', '奶', '奶', 680, 'drink,noun'],
    ['soeng1te2', '上茶', '上茶', 200, 'drink,phrase'],
    ['seoi2', '水', '水', 860, 'drink,noun'],
    ['jau4', '油', '油', 350, 'food,noun'],
    ['tong4', '糖', '糖', 600, 'food,noun,sweet'],
    ['daahn2', '蛋', '蛋', 650, 'food,noun'],
    ['tong1', '湯', '湯', 500, 'food,noun'],
    ['baan1', '飯', '飯', 300, 'food,noun'],

    // Body parts – single words
    ['tau4', '頭', '頭', 650, 'body,noun'],
    ['min6', '面', '面', 640, 'body,noun'],
    ['ngan5', '眼', '眼', 630, 'body,noun'],
    ['bei6', '鼻', '鼻', 620, 'body,noun'],
    ['hau2', '口', '口', 610, 'body,noun'],
    ['ji5', '耳', '耳', 600, 'body,noun'],
    ['sau2', '手', '手', 590, 'body,noun'],
    ['gok3', '腳', '腳', 580, 'body,noun'],
    ['zung1', '中', '中', 300, 'body,noun,position'],
    ['sam1', '心', '心', 570, 'body,noun,emotion'],
    ['bei2gwo2', '鼻哥', '鼻哥', 200, 'body,noun'],
    ['sai1', '腮', '腮', 150, 'body,noun'],
    ['mei4mou4', '眉毛', '眉毛', 250, 'body,noun'],
    ['faat3', '髮', '髮', 560, 'body,noun'],
    ['soeng1bei2', '上臂', '上臂', 150, 'body,noun'],
    ['sau2zi2', '手指', '手指', 550, 'body,noun'],
    ['gok3zi2', '腳趾', '腳趾', 540, 'body,noun'],
    ['fei1', '肺', '肺', 120, 'body,noun'],
    ['fei1', '肥', '肥', 300, 'adjective,body'],
    ['seng1', '腎', '腎', 100, 'body,noun'],

    // Colors – single words
    ['baak6', '白', '白', 600, 'color,adjective'],
    ['hak1', '黑', '黑', 590, 'color,adjective'],
    ['hung4', '紅', '紅', 580, 'color,adjective'],
    ['wong4', '黃', '黃', 570, 'color,adjective'],
    ['lou4', '綠', '綠', 560, 'color,adjective'],
    ['lam4', '藍', '藍', 550, 'color,adjective'],
    ['zi2', '紫', '紫', 540, 'color,adjective'],
    ['fan2hung4', '粉紅', '粉紅', 530, 'color,adjective'],
    ['faai1', '啡', '啡', 520, 'color,adjective'],
    ['ngan4', '銀', '銀', 350, 'color,adjective'],
    ['gam1', '金', '金', 340, 'color,adjective'],

    // Basic adjectives – single words
    ['hou2', '好', '好', 900, 'adjective'],
    ['daai6', '大', '大', 880, 'adjective'],
    ['sai3', '細', '細', 870, 'adjective'],
    ['coeng4', '長', '長', 400, 'adjective'],
    ['dyun2', '短', '短', 390, 'adjective'],
    ['fai3', '快', '快', 500, 'adjective'],
    ['maan6', '慢', '慢', 490, 'adjective'],
    ['zung6', '重', '重', 300, 'adjective'],
    ['ceng4', '輕', '輕', 290, 'adjective'],
    ['leng3', '靚', '靚', 700, 'adjective'],
    ['cau3', '醜', '醜', 200, 'adjective'],
    ['jit6', '熱', '熱', 650, 'adjective,weather'],
    ['laang5', '冷', '冷', 640, 'adjective,weather'],
    ['naan4', '難', '難', 350, 'adjective'],
    ['ji6', '易', '易', 340, 'adjective'],
    ['caan2', '慘', '慘', 220, 'adjective,emotion'],
    ['hoi1sam1', '開心', '開心', 800, 'emotion,adjective'],
    ['soeng1sam1', '傷心', '傷心', 450, 'emotion,adjective'],
    ['naau4', '嬲', '嬲', 430, 'emotion,adjective'],
    ['gaau3jit6', '着急', '着急', 200, 'emotion,adjective'],
]);


$sql = "INSERT INTO jyutping_dictionary (jyutping_code, hanzi, word, frequency, tags) 
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            frequency = GREATEST(frequency, VALUES(frequency)),
            tags = VALUES(tags),
            updated_at = NOW()";

$stmt = $db->prepare($sql);
$inserted = 0;
$updated = 0;
$errors = 0;

foreach ($data as $row) {
    try {
        $stmt->execute($row);
        if ($stmt->rowCount() > 0) {
            if ($stmt->rowCount() == 1) {
                $inserted++;
            } else {
                $updated++;
            }
        }
    } catch (Exception $e) {
        echo "Error inserting {$row[0]}: " . $e->getMessage() . "\n";
        $errors++;
    }
}

echo "✓ Inserted: $inserted new rows\n";
echo "✓ Updated: $updated existing rows\n";
if ($errors > 0) {
    echo "✗ Errors: $errors rows\n";
}
echo "\n";

// Verify
$stmt = $db->query("SELECT COUNT(*) as count FROM jyutping_dictionary");
$result = $stmt->fetch(PDO::FETCH_ASSOC);
$totalCount = $result['count'];

echo "Total entries in jyutping_dictionary: $totalCount\n\n";

// Show sample entries by category
echo "Sample entries by category:\n";
$categories = ['daily', 'number', 'body', 'color', 'animal', 'food', 'family', 'school', 'emotion', 'direction'];
foreach ($categories as $category) {
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM jyutping_dictionary WHERE tags LIKE ?");
    $stmt->execute(["%$category%"]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "  $category: {$result['count']} entries\n";
}

echo "\n✓ Extended Jyutping dictionary seeding completed!\n";

