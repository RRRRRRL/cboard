<?php
/**
 * Verify that there are no duplicate records in jyutping_dictionary
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();

if (!$db) {
    fwrite(STDERR, "ERROR: Database connection failed!\n");
    exit(1);
}

echo "Verifying no duplicates...\n\n";

// Check for duplicates
$stmt = $db->query("
    SELECT jyutping_code, hanzi, word, COUNT(*) as cnt 
    FROM jyutping_dictionary 
    GROUP BY jyutping_code, hanzi, word 
    HAVING cnt > 1
    ORDER BY cnt DESC
    LIMIT 10
");
$duplicates = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($duplicates)) {
    echo "✓ No duplicates found!\n\n";
} else {
    echo "⚠ Found " . count($duplicates) . " duplicate groups:\n";
    foreach ($duplicates as $dup) {
        echo "  - {$dup['jyutping_code']} | {$dup['hanzi']} | {$dup['word']} | Count: {$dup['cnt']}\n";
    }
    echo "\n";
}

// Get total counts
$stmt = $db->query("SELECT COUNT(*) as total FROM jyutping_dictionary");
$total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

echo "Total records: $total\n";

