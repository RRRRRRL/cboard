<?php
/**
 * Clear jyutping_dictionary table
 * 
 * This script removes all records from the jyutping_dictionary table.
 * Use this before re-importing data with updated filtering logic.
 * 
 * Usage:
 *   php backend/scripts/clear-jyutping-dictionary.php
 * 
 * Options:
 *   --confirm    Skip confirmation prompt (for automated scripts)
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();

if (!$db) {
    fwrite(STDERR, "ERROR: Database connection failed!\n");
    exit(1);
}

// Check for --confirm flag
$confirm = in_array('--confirm', $argv);

if (!$confirm) {
    // Get current count
    $stmt = $db->query("SELECT COUNT(*) as count FROM jyutping_dictionary");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $currentCount = $result['count'];
    
    echo "==========================================\n";
    echo " Clear Jyutping Dictionary Table\n";
    echo "==========================================\n\n";
    echo "Current records in jyutping_dictionary: $currentCount\n\n";
    echo "⚠️  WARNING: This will delete ALL records from jyutping_dictionary!\n";
    echo "This action cannot be undone.\n\n";
    echo "Type 'yes' to confirm, or anything else to cancel: ";
    
    $handle = fopen("php://stdin", "r");
    $line = trim(fgets($handle));
    fclose($handle);
    
    if (strtolower($line) !== 'yes') {
        echo "\n❌ Operation cancelled.\n";
        exit(0);
    }
}

echo "\nClearing jyutping_dictionary table...\n";

try {
    // Use TRUNCATE for faster deletion (resets AUTO_INCREMENT)
    $db->exec("TRUNCATE TABLE jyutping_dictionary");
    
    // Verify
    $stmt = $db->query("SELECT COUNT(*) as count FROM jyutping_dictionary");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $remainingCount = $result['count'];
    
    if ($remainingCount == 0) {
        echo "✓ Successfully cleared jyutping_dictionary table\n";
        echo "✓ Records remaining: 0\n\n";
        echo "Next steps:\n";
        echo "1. Convert CC-CANTO file to CSV:\n";
        echo "   php backend/scripts/convert-cc-canto-to-csv.php backend/database/cccanto-webdist.txt\n";
        echo "2. Import CSV to database:\n";
        echo "   php backend/scripts/seed-jyutping-from-csv.php\n";
    } else {
        echo "⚠️  Warning: Table not fully cleared. Remaining records: $remainingCount\n";
        exit(1);
    }
} catch (Exception $e) {
    fwrite(STDERR, "ERROR: Failed to clear table: " . $e->getMessage() . "\n");
    exit(1);
}

echo "\n==========================================\n";
echo " Clear complete!\n";
echo "==========================================\n";

