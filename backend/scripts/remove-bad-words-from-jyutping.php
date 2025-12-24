<?php
/**
 * Remove inappropriate words from jyutping_dictionary table
 * 
 * This script scans the jyutping_dictionary table and removes all records
 * that contain inappropriate words in their hanzi or word fields.
 * 
 * The bad words list matches the frontend filter in src/utils/badWordFilter.js
 * 
 * Usage:
 *   php backend/scripts/remove-bad-words-from-jyutping.php
 * 
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 *   --verbose    Show detailed information about each deleted record
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();

if (!$db) {
    fwrite(STDERR, "ERROR: Database connection failed!\n");
    exit(1);
}

// Parse command line arguments
$dryRun = in_array('--dry-run', $argv);
$verbose = in_array('--verbose', $argv);

echo "==========================================\n";
echo " Remove Bad Words from Jyutping Dictionary\n";
echo "==========================================\n\n";

if ($dryRun) {
    echo "⚠️  DRY RUN MODE - No records will be deleted\n\n";
}

// Bad words list (must match src/utils/badWordFilter.js)
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

echo "Bad words to filter: " . count($badWords) . "\n";
if ($verbose) {
    echo "Words: " . implode(', ', $badWords) . "\n";
}
echo "\n";

// First, count total records
$stmt = $db->query("SELECT COUNT(*) as total FROM jyutping_dictionary");
$totalBefore = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
echo "Total records in database: $totalBefore\n\n";

// Find records containing bad words
echo "Scanning for records containing bad words...\n";

$recordsToDelete = [];
$foundCount = 0;

// Build SQL query to find records with bad words
// We'll check both hanzi and word fields
$conditions = [];
$params = [];

foreach ($badWords as $badWord) {
    $conditions[] = "(hanzi LIKE ? OR word LIKE ?)";
    $params[] = "%{$badWord}%";
    $params[] = "%{$badWord}%";
}

if (empty($conditions)) {
    echo "No bad words to check!\n";
    exit(0);
}

$sql = "SELECT id, jyutping_code, hanzi, word, frequency 
        FROM jyutping_dictionary 
        WHERE " . implode(' OR ', $conditions) . "
        ORDER BY id";

$stmt = $db->prepare($sql);
$stmt->execute($params);
$records = $stmt->fetchAll(PDO::FETCH_ASSOC);

$foundCount = count($records);

if ($foundCount === 0) {
    echo "✓ No records found containing bad words!\n";
    exit(0);
}

echo "Found $foundCount records containing bad words\n\n";

if ($verbose) {
    echo "Records to be deleted:\n";
    echo str_repeat('-', 80) . "\n";
    printf("%-6s %-20s %-15s %-20s %-10s\n", "ID", "Jyutping", "Hanzi", "Word", "Frequency");
    echo str_repeat('-', 80) . "\n";
}

$deletedCount = 0;
$deletedIds = [];

foreach ($records as $record) {
    $id = $record['id'];
    $jyutping = $record['jyutping_code'] ?? '';
    $hanzi = $record['hanzi'] ?? '';
    $word = $record['word'] ?? '';
    $frequency = $record['frequency'] ?? 0;
    
    // Double-check: verify this record actually contains a bad word
    $containsBadWord = false;
    $matchedWords = [];
    
    foreach ($badWords as $badWord) {
        if (mb_strpos($hanzi, $badWord) !== false || mb_strpos($word, $badWord) !== false) {
            $containsBadWord = true;
            $matchedWords[] = $badWord;
        }
    }
    
    if (!$containsBadWord) {
        continue; // Skip if somehow doesn't match
    }
    
    if ($verbose) {
        printf("%-6d %-20s %-15s %-20s %-10d", 
            $id, 
            mb_substr($jyutping, 0, 20), 
            mb_substr($hanzi, 0, 15), 
            mb_substr($word, 0, 20), 
            $frequency
        );
        echo " (matched: " . implode(', ', $matchedWords) . ")\n";
    }
    
    $deletedIds[] = $id;
}

if (empty($deletedIds)) {
    echo "✓ No records need to be deleted (all filtered out)\n";
    exit(0);
}

echo "\nTotal records to delete: " . count($deletedIds) . "\n\n";

if ($dryRun) {
    echo "⚠️  DRY RUN - Would delete " . count($deletedIds) . " records\n";
    echo "   Run without --dry-run to actually delete\n";
} else {
    // Delete records in batches to avoid memory issues
    echo "Deleting records...\n";
    
    $batchSize = 100;
    $batches = array_chunk($deletedIds, $batchSize);
    $totalDeleted = 0;
    
    foreach ($batches as $batch) {
        $placeholders = implode(',', array_fill(0, count($batch), '?'));
        $deleteSql = "DELETE FROM jyutping_dictionary WHERE id IN ($placeholders)";
        $deleteStmt = $db->prepare($deleteSql);
        $deleteStmt->execute($batch);
        $totalDeleted += $deleteStmt->rowCount();
    }
    
    echo "✓ Deleted: $totalDeleted records\n\n";
    
    // Verify
    $stmt = $db->query("SELECT COUNT(*) as total FROM jyutping_dictionary");
    $totalAfter = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    echo "Records before: $totalBefore\n";
    echo "Records after:  $totalAfter\n";
    echo "Records removed: " . ($totalBefore - $totalAfter) . "\n\n";
    
    // Double-check: verify no bad words remain
    echo "Verifying cleanup...\n";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $remaining = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($remaining) > 0) {
        echo "⚠️  Warning: Still found " . count($remaining) . " records with bad words\n";
        if ($verbose) {
            echo "Remaining records:\n";
            foreach ($remaining as $record) {
                echo "  ID {$record['id']}: {$record['hanzi']} / {$record['word']}\n";
            }
        }
    } else {
        echo "✓ Verification passed: No bad words remaining in database\n";
    }
}

echo "\n==========================================\n";
echo " Cleanup complete!\n";
echo "==========================================\n";

