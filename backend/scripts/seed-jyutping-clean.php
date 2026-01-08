<?php
/**
 * Seed Jyutping dictionary from multiple CSV sources with de-duplication.
 * 
 * This version uses raw fgetcsv() without any encoding manipulation
 * The database connection is configured for UTF-8, so it should handle correctly.
 */

// Set internal encoding to UTF-8
mb_internal_encoding('UTF-8');
ini_set('default_charset', 'utf-8');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();
if (!$db) {
    fwrite(STDERR, "ERROR: Database connection failed.\n");
    exit(1);
}

// Ensure connection is using UTF-8
$db->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

// Parse CLI options
$longopts = [
    'csv::',       // may appear multiple times
    'truncate',
];
$opts = getopt('', $longopts);

// Collect CSV inputs
$csvs = [];
if (isset($opts['csv'])) {
    if (is_array($opts['csv'])) {
        $csvs = $opts['csv'];
    } else {
        $csvs = [$opts['csv']];
    }
}

if (count($csvs) === 0) {
    $csvs = [
        __DIR__ . '/../database/jyutping_cc-canto.csv',
        __DIR__ . '/../database/jyutping_pycantonese_input.csv',
        __DIR__ . '/../database/jyutping_pycantonese_input_from_boards.csv',
    ];
}

// Validate CSV files
$validCsvs = [];
foreach ($csvs as $p) {
    $abs = $p;
    if (!file_exists($p) && !file_exists(__DIR__ . '/../database/' . basename($p))) {
        $abs = __DIR__ . '/../database/' . basename($p);
    } else {
        $abs = $p;
    }
    if (!is_readable($abs)) {
        fwrite(STDERR, "WARN: CSV not found or unreadable: {$abs}\n");
        continue;
    }
    $validCsvs[] = $abs;
}

if (count($validCsvs) === 0) {
    fwrite(STDERR, "ERROR: No readable CSV files provided.\n");
    exit(1);
}

echo "Will import from CSV sources (deduped):\n";
foreach ($validCsvs as $v) {
    echo "  - {$v}\n";
}

echo "\nBuilding in-memory deduplicated dataset...\n";

$records = []; // key => [code, hanzi, word, frequency, tags]
$totalRows = 0;

function normalise_header($header) {
    return array_map(function ($h) { return strtolower(trim($h)); }, $header);
}

function make_key($code, $hanzi, $word) {
    $c = strtolower(trim((string)$code));
    $h = trim((string)$hanzi);
    $w = trim((string)$word);
    return $c . "|" . $h . "|" . $w;
}

function parse_tags($tags) {
    if ($tags === null || $tags === '') return [];
    $parts = preg_split('/[,;\s]+/', $tags, -1, PREG_SPLIT_NO_EMPTY);
    $out = [];
    foreach ($parts as $p) {
        $t = trim($p);
        if ($t !== '') $out[$t] = true;
    }
    return array_keys($out);
}

foreach ($validCsvs as $csvPath) {
    $fp = fopen($csvPath, 'r');
    if ($fp === false) {
        fwrite(STDERR, "WARN: Failed to open CSV: {$csvPath}\n");
        continue;
    }

    $header = fgetcsv($fp);
    if ($header === false) {
        fclose($fp);
        continue;
    }
    $header = normalise_header($header);
    $map = [];
    foreach ($header as $i => $name) { $map[$name] = $i; }
    $required = ['jyutping_code','hanzi','word','frequency','tags'];
    foreach ($required as $col) {
        if (!array_key_exists($col, $map)) {
            fclose($fp);
            fwrite(STDERR, "WARN: Missing required column '{$col}' in {$csvPath}; skipping.\n");
            continue 2;
        }
    }

    while (($row = fgetcsv($fp)) !== false) {
        $totalRows++;
        if (count($row) === 0) continue;
        $code = trim($row[$map['jyutping_code']] ?? '');
        if ($code === '') continue;
        $hanzi = trim($row[$map['hanzi']] ?? '');
        $word = trim($row[$map['word']] ?? '');
        $freqRaw = trim($row[$map['frequency']] ?? '');
        $tagsRaw = trim($row[$map['tags']] ?? '');

        $frequency = 200;
        if ($freqRaw !== '') {
            $frequency = (int)$freqRaw;
            if ($frequency <= 0) $frequency = 200;
        }

        $key = make_key($code, $hanzi, $word);
        $tagsSet = parse_tags($tagsRaw);

        // Truncate hanzi to 10 chars max (VARCHAR(10) constraint)
        if ($hanzi !== '' && strlen($hanzi) > 10) {
            $hanzi = substr($hanzi, 0, 10);
        }

        if (!isset($records[$key])) {
            $records[$key] = [
                'code' => $code,
                'hanzi' => $hanzi !== '' ? $hanzi : null,
                'word' => $word !== '' ? $word : null,
                'frequency' => $frequency,
                'tags' => $tagsSet,
            ];
        } else {
            // Merge: take max frequency and union of tags
            if ($frequency > $records[$key]['frequency']) {
                $records[$key]['frequency'] = $frequency;
            }
            $existingTags = array_flip($records[$key]['tags']);
            foreach ($tagsSet as $t) { $existingTags[$t] = true; }
            $records[$key]['tags'] = array_keys($existingTags);
        }
    }

    fclose($fp);
}

echo "Read {$totalRows} CSV rows. Unique entries after merge: " . count($records) . "\n";

if (isset($opts['truncate'])) {
    echo "Truncating jyutping_dictionary...\n";
    $db->exec('DELETE FROM jyutping_dictionary');
}

// Prepare statements
$selectStmt = $db->prepare(
    'SELECT id, frequency, tags FROM jyutping_dictionary WHERE jyutping_code = ? AND ((hanzi IS NULL AND ? IS NULL) OR hanzi = ?) AND ((word IS NULL AND ? IS NULL) OR word = ?)' 
);
$insertStmt = $db->prepare(
    'INSERT INTO jyutping_dictionary (jyutping_code, hanzi, word, frequency, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())'
);
$updateStmt = $db->prepare(
    'UPDATE jyutping_dictionary SET frequency = GREATEST(frequency, ?), tags = ?, updated_at = NOW() WHERE id = ?'
);

$db->beginTransaction();
$inserted = 0; $updated = 0; $skipped = 0;

foreach ($records as $rec) {
    $code = $rec['code'];
    $hanzi = $rec['hanzi'];
    $word = $rec['word'];
    $freq = $rec['frequency'];
    $tags = count($rec['tags']) ? implode(',', $rec['tags']) : null;

    $selectStmt->execute([$code, $hanzi, $hanzi, $word, $word]);
    $row = $selectStmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        $newTags = $tags;
        if ($row['tags'] !== null && $tags !== null) {
            // Merge db tags with new tags
            $dbTags = parse_tags($row['tags']);
            $newTagsSet = array_flip($dbTags);
            foreach (parse_tags($tags) as $t) { $newTagsSet[$t] = true; }
            $newTags = implode(',', array_keys($newTagsSet));
        } elseif ($row['tags'] !== null) {
            $newTags = $row['tags'];
        }
        $updateStmt->execute([$freq, $newTags, $row['id']]);
        $updated += $updateStmt->rowCount() > 0 ? 1 : 0;
    } else {
        $insertStmt->execute([$code, $hanzi, $word, $freq, $tags]);
        $inserted += $insertStmt->rowCount() > 0 ? 1 : 0;
    }
}

$db->commit();

echo "Done. Inserted: {$inserted}, Updated: {$updated}, Skipped: {$skipped}.\n";
