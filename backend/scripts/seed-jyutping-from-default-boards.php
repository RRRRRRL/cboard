<?php
/**
 * Script to extract labelKeys from default boards and add them to jyutping_dictionary
 * This script reads the default boards JSON files and extracts all labelKeys,
 * then looks up their translations and adds them to the jyutping database.
 *
 * Run from project root:
 *   php backend/scripts/seed-jyutping-from-default-boards.php
 */

// Use the same DB bootstrap as other seed scripts
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

function extractLabelKeysFromBoards($boards) {
    $labelKeys = [];
    
    foreach ($boards as $board) {
        if (isset($board['tiles']) && is_array($board['tiles'])) {
            foreach ($board['tiles'] as $tile) {
                if (isset($tile['labelKey']) && !empty($tile['labelKey'])) {
                    $labelKeys[$tile['labelKey']] = true;
                }
            }
        }
    }
    
    return array_keys($labelKeys);
}

function getTranslationFromKey($labelKey, $translations) {
    // Try direct match
    if (isset($translations[$labelKey])) {
        return $translations[$labelKey];
    }
    
    // Try lowercase
    if (isset($translations[strtolower($labelKey)])) {
        return $translations[strtolower($labelKey)];
    }
    
    return null;
}

function addJyutpingEntry($db, $hanzi, $word, $jyutpingCode, $category = 'default_board') {
    // Check if entry already exists
    $stmt = $db->prepare("
        SELECT id FROM jyutping_dictionary 
        WHERE (hanzi = ? OR word = ?) AND jyutping_code = ?
        LIMIT 1
    ");
    $stmt->execute([$hanzi, $word, $jyutpingCode]);
    $existing = $stmt->fetch();
    
    if ($existing) {
        return false; // Already exists
    }
    
    // Insert new entry
    // Note: jyutping_dictionary schema: jyutping_code, hanzi, word, frequency, tags, created_at, updated_at
    // We map $category into tags and set a default frequency
    $stmt = $db->prepare("
        INSERT INTO jyutping_dictionary (jyutping_code, hanzi, word, frequency, tags, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    ");
    
    try {
        $defaultFrequency = 100; // Reasonable default so these entries can be used in games
        $stmt->execute([$jyutpingCode, $hanzi, $word, $defaultFrequency, $category]);
        return true;
    } catch (PDOException $e) {
        error_log("Failed to insert jyutping entry: " . $e->getMessage());
        return false;
    }
}

// Load default boards
$boardsJsonPath = __DIR__ . '/../../src/api/boards.json';
$picSeePalJsonPath = __DIR__ . '/../../src/api/corePicSeePal.json';
$translationsPath = __DIR__ . '/../../src/translations/zh-TW.json';

if (!file_exists($boardsJsonPath) || !file_exists($picSeePalJsonPath) || !file_exists($translationsPath)) {
    die("Error: Required JSON files not found.\n");
}

$boardsData = json_decode(file_get_contents($boardsJsonPath), true);
$picSeePalData = json_decode(file_get_contents($picSeePalJsonPath), true);
$translations = json_decode(file_get_contents($translationsPath), true);

if (!$boardsData || !$picSeePalData || !$translations) {
    die("Error: Failed to parse JSON files.\n");
}

// Extract all labelKeys
$allBoards = array_merge($boardsData['advanced'] ?? [], $picSeePalData ?? []);
$labelKeys = extractLabelKeysFromBoards($allBoards);

echo "Found " . count($labelKeys) . " unique labelKeys in default boards.\n";

// Connect to database
$db = getDB();
if (!$db) {
    die("Error: Database connection failed.\n");
}

// Common Jyutping mappings for common words
// This is a fallback when we can't find jyutping in the database
$commonJyutping = [
    '是' => 'si6',
    '否' => 'fau2',
    '不' => 'bat1',
    '是' => 'si6',
    '零食' => 'ling4 sik1',
    '食物' => 'sik6 mat6',
    '飲料' => 'jam2 liu6',
    '活動' => 'wut6 dung6',
    '情緒' => 'cing4 seoi5',
    '身體' => 'san1 tai2',
    '衣服' => 'ji1 fuk6',
    '人' => 'jan4',
    '描述' => 'miu4 syut3',
    '廚房' => 'cyu4 fong4',
    '學校' => 'hok6 haau6',
    '動物' => 'dung6 mat6',
    '科技' => 'fo1 gei6',
    '天氣' => 'tin1 hei3',
    '植物' => 'zik6 mat6',
    '運動' => 'wan6 dung6',
    '交通' => 'gaau1 tung1',
    '地方' => 'dei6 fong1',
    '位置' => 'wai6 zi3',
    '玩具' => 'wun6 geoi6',
    '動作' => 'dung6 zok3',
    '問題' => 'man6 tai4',
    '家具' => 'gaa1 geoi6',
    '衛生' => 'wai6 sang1',
    '數字' => 'sou3 zi6',
];

$added = 0;
$skipped = 0;
$notFound = 0;

foreach ($labelKeys as $labelKey) {
    // Get translation
    $translation = getTranslationFromKey($labelKey, $translations);
    
    if (!$translation) {
        echo "  ⚠ No translation found for: $labelKey\n";
        $notFound++;
        continue;
    }
    
    // Check if jyutping already exists in database
    $stmt = $db->prepare("
        SELECT jyutping_code FROM jyutping_dictionary 
        WHERE hanzi = ? OR word = ?
        LIMIT 1
    ");
    $stmt->execute([$translation, $translation]);
    $existing = $stmt->fetch();
    
    if ($existing) {
        echo "  ✓ Already exists: $labelKey -> $translation (jyutping: {$existing['jyutping_code']})\n";
        $skipped++;
        continue;
    }
    
    // Try to find jyutping from common mappings
    $jyutpingCode = $commonJyutping[$translation] ?? null;
    
    if (!$jyutpingCode) {
        echo "  ⚠ No jyutping found for: $labelKey -> $translation\n";
        $notFound++;
        continue;
    }
    
    // Add to database
    if (addJyutpingEntry($db, $translation, $translation, $jyutpingCode, 'default_board')) {
        echo "  ✓ Added: $labelKey -> $translation (jyutping: $jyutpingCode)\n";
        $added++;
    } else {
        echo "  ✗ Failed to add: $labelKey -> $translation\n";
        $skipped++;
    }
}

echo "\n";
echo "Summary:\n";
echo "  Added: $added\n";
echo "  Skipped (already exists): $skipped\n";
echo "  Not found (no translation/jyutping): $notFound\n";
echo "  Total processed: " . count($labelKeys) . "\n";

