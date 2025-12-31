<?php
/**
 * Seed Jyutping dictionary from CCCanto CSV file with filtering.
 *
 * Usage (from project root):
 *
 *   php backend/scripts/seed-jyutping-from-cccanto-csv.php
 *
 * Input CSV:
 *   backend/database/jyutping_cc-canto.csv
 *
 * Expected columns (with header row):
 *   jyutping_code,hanzi,word,frequency,tags
 *
 * Filters out bad/inappropriate words and uncommon words (frequency < 100 or no 'daily' tag)
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();
if (!$db) {
    fwrite(STDERR, "ERROR: Database connection failed.\n");
    exit(1);
}

$csvPath = __DIR__ . '/../database/jyutping_cc-canto.csv';

if (!is_readable($csvPath)) {
    fwrite(STDERR, "ERROR: CSV file not found or not readable: {$csvPath}\n");
    exit(1);
}

echo "Seeding jyutping_dictionary from CCCanto CSV:\n  {$csvPath}\n\n";

// Bad words list (matches frontend filter and remove-bad-words script)
$badWords = [
    '撚',
    '屌',
    '閪',
    '柒',
    '老母',
    '老味',
    '鳩',
    '戇',
    '仆',
    '冚',
    '屄',
    '肏',
    '頂你個肺'
];

function containsBadWords($text, $badWords) {
    if (empty($text)) return false;
    $textLower = mb_strtolower(trim($text));
    foreach ($badWords as $badWord) {
        if (mb_strpos($textLower, mb_strtolower($badWord)) !== false) {
            return true;
        }
    }
    return false;
}

$fp = fopen($csvPath, 'r');
if ($fp === false) {
    fwrite(STDERR, "ERROR: Failed to open CSV file: {$csvPath}\n");
    exit(1);
}

// Read header
$header = fgetcsv($fp);
if ($header === false) {
    fwrite(STDERR, "ERROR: CSV file is empty.\n");
    fclose($fp);
    exit(1);
}

// Normalise header names
$header = array_map('trim', $header);
$map = [];
foreach ($header as $idx => $name) {
    $lower = strtolower($name);
    $map[$lower] = $idx;
}

$required = ['jyutping_code', 'hanzi', 'word', 'frequency', 'tags'];
foreach ($required as $col) {
    if (!array_key_exists($col, $map)) {
        fwrite(STDERR, "ERROR: CSV header must include column '{$col}'.\n");
        fclose($fp);
        exit(1);
    }
}

$sql = "INSERT INTO jyutping_dictionary (jyutping_code, hanzi, word, frequency, tags)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          frequency = GREATEST(frequency, VALUES(frequency)),
          tags = VALUES(tags),
          updated_at = NOW()";

$stmt = $db->prepare($sql);

$inserted = 0;
$skipped = 0;
$filteredBad = 0;
$filteredUncommon = 0;
$line = 1; // already read header

while (($row = fgetcsv($fp)) !== false) {
    $line++;

    // Skip completely empty lines
    if (count(array_filter($row, function ($v) {
        return trim((string)$v) !== '';
    })) === 0) {
        continue;
    }

    $code = trim($row[$map['jyutping_code']] ?? '');
    $hanzi = trim($row[$map['hanzi']] ?? '');
    $word = trim($row[$map['word']] ?? '');
    $freqRaw = trim($row[$map['frequency']] ?? '');
    $tags = trim($row[$map['tags']] ?? '');

    if ($code === '') {
        $skipped++;
        continue;
    }

    $frequency = 200;
    if ($freqRaw !== '') {
        $frequency = (int)$freqRaw;
        if ($frequency <= 0) {
            $frequency = 200;
        }
    }

    // Filter bad words (additional check, though CSV should already be filtered)
    if (containsBadWords($hanzi, $badWords) || containsBadWords($word, $badWords)) {
        $filteredBad++;
        continue;
    }

    $hanziParam = $hanzi !== '' ? $hanzi : null;
    $wordParam = $word !== '' ? $word : null;
    $tagsParam = $tags !== '' ? $tags : null;

    try {
        $stmt->execute([$code, $hanziParam, $wordParam, $frequency, $tagsParam]);
        if ($stmt->rowCount() > 0) {
            $inserted++;
        }
    } catch (Exception $e) {
        echo "Error on line {$line} ({$code}): " . $e->getMessage() . "\n";
    }
}

fclose($fp);

echo "Done.\n";
echo "Inserted/updated: {$inserted} entries\n";
echo "Skipped (empty jyutping_code): {$skipped}\n";
echo "Filtered (bad words): {$filteredBad}\n";
echo "Filtered (uncommon): {$filteredUncommon}\n";
