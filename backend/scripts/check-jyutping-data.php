<?php
/**
 * Script to check if Jyutping dictionary has data
 * Run: php backend/scripts/check-jyutping-data.php
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

$db = getDB();

if (!$db) {
    echo "ERROR: Database connection failed!\n";
    exit(1);
}

echo "Checking jyutping_dictionary table...\n\n";

// Check if table exists
try {
    $stmt = $db->query("SHOW TABLES LIKE 'jyutping_dictionary'");
    $tableExists = $stmt->rowCount() > 0;
    
    if (!$tableExists) {
        echo "ERROR: Table 'jyutping_dictionary' does not exist!\n";
        echo "Please run the schema.sql file first.\n";
        exit(1);
    }
    
    echo "✓ Table 'jyutping_dictionary' exists\n";
    
    // Check row count
    $stmt = $db->query("SELECT COUNT(*) as count FROM jyutping_dictionary");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $count = $result['count'];
    
    echo "✓ Table has $count rows\n\n";
    
    if ($count == 0) {
        echo "WARNING: Table is empty! No data found.\n";
        echo "Please run the seed-jyutping-dictionary.sql file to populate data.\n\n";
    } else {
        // Show sample data
        echo "Sample data (first 5 rows):\n";
        $stmt = $db->query("SELECT jyutping_code, hanzi, word, frequency FROM jyutping_dictionary ORDER BY frequency DESC LIMIT 5");
        $samples = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($samples as $row) {
            echo "  - {$row['jyutping_code']}: {$row['hanzi']} ({$row['word']}) [freq: {$row['frequency']}]\n";
        }
        
        // Test search for "nei5"
        echo "\nTesting search for 'nei5':\n";
        $stmt = $db->prepare("SELECT * FROM jyutping_dictionary WHERE jyutping_code = ?");
        $stmt->execute(['nei5']);
        $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (count($matches) > 0) {
            echo "✓ Found " . count($matches) . " exact match(es)\n";
            foreach ($matches as $match) {
                echo "  - {$match['jyutping_code']}: {$match['hanzi']}\n";
            }
        } else {
            echo "✗ No exact match found for 'nei5'\n";
        }
        
        // Test partial search for "nei"
        echo "\nTesting partial search for 'nei':\n";
        $stmt = $db->prepare("SELECT * FROM jyutping_dictionary WHERE jyutping_code LIKE ? LIMIT 5");
        $stmt->execute(['nei%']);
        $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (count($matches) > 0) {
            echo "✓ Found " . count($matches) . " partial match(es)\n";
            foreach ($matches as $match) {
                echo "  - {$match['jyutping_code']}: {$match['hanzi']}\n";
            }
        } else {
            echo "✗ No partial match found for 'nei'\n";
        }
    }
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n✓ Check complete!\n";

