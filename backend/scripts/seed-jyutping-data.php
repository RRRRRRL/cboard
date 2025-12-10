<?php
/**
 * Script to seed Jyutping dictionary data
 * Run: php backend/scripts/seed-jyutping-data.php
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();

if (!$db) {
    echo "ERROR: Database connection failed!\n";
    exit(1);
}

echo "Seeding jyutping_dictionary table...\n\n";

// Data from seed-jyutping-dictionary.sql
$data = [
    // Common greetings
    ['nei5', '你', '你', 1000, 'daily,greeting'],
    ['hou2', '好', '好', 950, 'daily,greeting'],
    ['m4', '唔', '唔', 900, 'daily'],
    ['goi1', '該', '該', 850, 'daily,polite'],
    ['m4goi1', null, '唔該', 800, 'daily,polite'],
    ['nei5hou2', null, '你好', 750, 'daily,greeting'],
    ['zou2san4', null, '早晨', 700, 'daily,greeting'],
    ['maan5on1', null, '晚安', 650, 'daily,greeting'],
    
    // Common verbs
    ['sik6', '食', '食', 600, 'daily,verb'],
    ['jam2', '飲', '飲', 580, 'daily,verb'],
    ['heoi3', '去', '去', 560, 'daily,verb'],
    ['lai4', '來', '來', 540, 'daily,verb'],
    ['teng1', '聽', '聽', 520, 'daily,verb'],
    ['tai2', '睇', '睇', 500, 'daily,verb'],
    ['waan2', '玩', '玩', 480, 'daily,verb'],
    ['zou6', '做', '做', 460, 'daily,verb'],
    
    // Common nouns
    ['jan4', '人', '人', 440, 'daily,noun'],
    ['sik6mat6', null, '食物', 420, 'daily,noun,food'],
    ['seoi2', '水', '水', 400, 'daily,noun'],
    ['fan2', '飯', '飯', 380, 'daily,noun,food'],
    ['min6', '麵', '麵', 360, 'daily,noun,food'],
    ['caa4', '茶', '茶', 340, 'daily,noun,drink'],
    ['ngo5', '我', '我', 320, 'daily,pronoun'],
    ['keoi5', '佢', '佢', 300, 'daily,pronoun'],
    
    // Numbers
    ['jat1', '一', '一', 280, 'number'],
    ['ji6', '二', '二', 260, 'number'],
    ['saam1', '三', '三', 240, 'number'],
    ['sei3', '四', '四', 220, 'number'],
    ['ng5', '五', '五', 200, 'number'],
    ['luk6', '六', '六', 180, 'number'],
    ['cat1', '七', '七', 160, 'number'],
    ['baat3', '八', '八', 140, 'number'],
    ['gau2', '九', '九', 120, 'number'],
    ['sap6', '十', '十', 100, 'number'],
    
    // Common phrases
    ['m4zi1', null, '唔知', 90, 'daily,phrase'],
    ['m4sai2', null, '唔使', 80, 'daily,phrase'],
    ['m4hou2', null, '唔好', 70, 'daily,phrase'],
    ['hou2laa1', null, '好喇', 60, 'daily,phrase'],
    ['dim2gaa2', null, '點解', 50, 'daily,phrase,question'],
    ['dim2', '點', '點', 40, 'daily,question'],
    
    // School related
    ['hok6', '學', '學', 35, 'school,verb'],
    ['hok6haau6', null, '學校', 30, 'school,noun'],
    ['syut3', '說', '說', 25, 'school,verb'],
    ['taam4', '談', '談', 20, 'school,verb'],
    
    // Family
    ['maa1maa1', null, '媽媽', 15, 'family'],
    ['baa1baa1', null, '爸爸', 14, 'family'],
    ['go1go1', null, '哥哥', 13, 'family'],
    ['ze2ze2', null, '姐姐', 12, 'family'],
    ['dai3dai2', null, '弟弟', 11, 'family'],
    ['mui5mui5', null, '妹妹', 10, 'family']
];

$sql = "INSERT INTO jyutping_dictionary (jyutping_code, hanzi, word, frequency, tags) 
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            frequency = VALUES(frequency),
            tags = VALUES(tags),
            updated_at = NOW()";

$stmt = $db->prepare($sql);
$inserted = 0;
$updated = 0;

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
    }
}

echo "✓ Inserted: $inserted rows\n";
echo "✓ Updated: $updated rows\n\n";

// Verify
$stmt = $db->query("SELECT COUNT(*) as count FROM jyutping_dictionary");
$result = $stmt->fetch(PDO::FETCH_ASSOC);
echo "✓ Total rows in table: {$result['count']}\n\n";

// Test search
echo "Testing search for 'nei5':\n";
$stmt = $db->prepare("SELECT * FROM jyutping_dictionary WHERE jyutping_code = ?");
$stmt->execute(['nei5']);
$matches = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "✓ Found " . count($matches) . " match(es)\n";

echo "\n✓ Seeding complete!\n";

