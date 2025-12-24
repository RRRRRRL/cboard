<?php
/**
 * Remove duplicate records from jyutping_dictionary table
 * 
 * This script removes duplicates based on jyutping_code, hanzi, and word combination.
 * For duplicates, it keeps the record with the highest frequency.
 * 
 * Usage:
 *   php backend/scripts/remove-duplicate-jyutping.php
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();

if (!$db) {
    fwrite(STDERR, "ERROR: Database connection failed!\n");
    exit(1);
}

echo "==========================================\n";
echo " Removing Duplicate Jyutping Records\n";
echo "==========================================\n\n";

// First, count duplicates
echo "Analyzing duplicates...\n";
$stmt = $db->query("
    SELECT jyutping_code, hanzi, word, COUNT(*) as cnt 
    FROM jyutping_dictionary 
    GROUP BY jyutping_code, hanzi, word 
    HAVING cnt > 1
");
$duplicateGroups = $stmt->fetchAll(PDO::FETCH_ASSOC);
$totalDuplicateGroups = count($duplicateGroups);

if ($totalDuplicateGroups === 0) {
    echo "✓ No duplicates found!\n";
    exit(0);
}

echo "Found $totalDuplicateGroups groups with duplicates\n\n";

// Count total duplicate records
$totalDuplicates = 0;
foreach ($duplicateGroups as $group) {
    $totalDuplicates += ($group['cnt'] - 1); // -1 because we keep one
}

echo "Total duplicate records to remove: $totalDuplicates\n\n";

// Strategy: For each duplicate group, keep the one with highest frequency
// If frequencies are equal, keep the one with the most complete data (non-null hanzi/word)
// If still equal, keep the one with the latest updated_at

echo "Removing duplicates (keeping highest frequency records)...\n\n";

$removed = 0;
$kept = 0;

foreach ($duplicateGroups as $group) {
    $jyutping = $group['jyutping_code'];
    $hanzi = $group['hanzi'] ?? '';
    $word = $group['word'] ?? '';
    
    // Get all duplicate records for this combination
    $stmt = $db->prepare("
        SELECT id, frequency, hanzi, word, updated_at 
        FROM jyutping_dictionary 
        WHERE jyutping_code = ? 
          AND (hanzi = ? OR (hanzi IS NULL AND ? = ''))
          AND (word = ? OR (word IS NULL AND ? = ''))
        ORDER BY frequency DESC, 
                 CASE WHEN hanzi IS NOT NULL AND hanzi != '' THEN 1 ELSE 0 END DESC,
                 CASE WHEN word IS NOT NULL AND word != '' THEN 1 ELSE 0 END DESC,
                 updated_at DESC
    ");
    $stmt->execute([$jyutping, $hanzi, $hanzi, $word, $word]);
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($records) <= 1) {
        continue; // Should not happen, but just in case
    }
    
    // Keep the first one (highest priority)
    $keepId = $records[0]['id'];
    $kept++;
    
    // Delete the rest
    $idsToDelete = array_column(array_slice($records, 1), 'id');
    
    if (!empty($idsToDelete)) {
        $placeholders = implode(',', array_fill(0, count($idsToDelete), '?'));
        $deleteStmt = $db->prepare("DELETE FROM jyutping_dictionary WHERE id IN ($placeholders)");
        $deleteStmt->execute($idsToDelete);
        $removed += $deleteStmt->rowCount();
    }
}

echo "✓ Removed: $removed duplicate records\n";
echo "✓ Kept: $kept records (one per duplicate group)\n\n";

// Verify
$stmt = $db->query("SELECT COUNT(*) as total FROM jyutping_dictionary");
$result = $stmt->fetch(PDO::FETCH_ASSOC);
echo "Total records remaining: {$result['total']}\n\n";

// Check if there are still duplicates
$stmt = $db->query("
    SELECT COUNT(*) as cnt 
    FROM (
        SELECT jyutping_code, hanzi, word 
        FROM jyutping_dictionary 
        GROUP BY jyutping_code, hanzi, word 
        HAVING COUNT(*) > 1
    ) as dup
");
$remaining = $stmt->fetch(PDO::FETCH_ASSOC);

if ($remaining['cnt'] > 0) {
    echo "⚠ Warning: Still found {$remaining['cnt']} duplicate groups\n";
    echo "  This might be due to NULL handling. Run the script again if needed.\n";
} else {
    echo "✓ No duplicates remaining!\n";
}

echo "\n==========================================\n";
echo " Cleanup complete!\n";
echo "==========================================\n";

