<?php
/**
 * Seed Jyutping dictionary from a simple CSV file (no Python needed).
 *
 * Usage (from project root):
 *
 *   php backend/scripts/seed-jyutping-from-csv.php
 *
 * Input CSV:
 *   backend/database/jyutping_pycantonese_input.csv
 *
 * Expected columns (with header row):
 *   jyutping_code,hanzi,word,frequency,tags
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();
if (!$db) {
    fwrite(STDERR, "ERROR: Database connection failed.\n");
    exit(1);
}

$csvPath = __DIR__ . '/../database/jyutping_pycantonese_input.csv';

if (!is_readable($csvPath)) {
    fwrite(STDERR, "ERROR: CSV file not found or not readable: {$csvPath}\n");
    exit(1);
}

echo "Seeding jyutping_dictionary from CSV:\n  {$csvPath}\n\n";

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
        echo "Skipping line {$line}: missing jyutping_code\n";
        continue;
    }

    $frequency = 200;
    if ($freqRaw !== '') {
        $frequency = (int)$freqRaw;
        if ($frequency <= 0) {
            $frequency = 200;
        }
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

echo "Done. Inserted/updated {$inserted} rows into jyutping_dictionary.\n";


