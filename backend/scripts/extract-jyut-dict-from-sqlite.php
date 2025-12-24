<?php
/**
 * Extract Jyutping data from Jyut Dictionary SQLite database (dict.db)
 * 
 * Jyut Dictionary uses SQLite database. You can find dict.db in:
 * - Windows: AppData folder or installation directory
 * - Mac: Application bundle resources
 * - Linux: Installation directory
 * 
 * Usage:
 *   php backend/scripts/extract-jyut-dict-from-sqlite.php <path_to_dict.db> [output_csv]
 * 
 * Example:
 *   php backend/scripts/extract-jyut-dict-from-sqlite.php "C:\Users\...\dict.db"
 */

if (php_sapi_name() !== 'cli') {
    die("This script must be run from command line\n");
}

$sqliteFile = $argv[1] ?? null;
$outputFile = $argv[2] ?? __DIR__ . '/../database/jyutping_pycantonese_input.csv';

if (!$sqliteFile) {
    echo "Usage: php extract-jyut-dict-from-sqlite.php <path_to_dict.db> [output_csv]\n";
    echo "\n";
    echo "How to find dict.db:\n";
    echo "  1. Download Jyut Dictionary application from: https://jyutdictionary.com\n";
    echo "  2. Install the application\n";
    echo "  3. Find dict.db in:\n";
    echo "     - Windows: %APPDATA%\\jyut-dict\\ or installation folder\n";
    echo "     - Mac: /Applications/jyut-dict.app/Contents/Resources/\n";
    echo "     - Linux: ~/.local/share/jyut-dict/ or installation folder\n";
    echo "\n";
    echo "Example:\n";
    echo "  php extract-jyut-dict-from-sqlite.php \"C:\\Users\\...\\dict.db\"\n";
    exit(1);
}

if (!file_exists($sqliteFile)) {
    fwrite(STDERR, "ERROR: SQLite file not found: $sqliteFile\n");
    exit(1);
}

// Check if SQLite extension is available
if (!extension_loaded('pdo_sqlite')) {
    fwrite(STDERR, "ERROR: PDO SQLite extension is not loaded.\n");
    fwrite(STDERR, "Please enable it in php.ini or install php-sqlite3\n");
    exit(1);
}

echo "Extracting data from: $sqliteFile\n";

try {
    $db = new PDO("sqlite:$sqliteFile");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // First, check what tables exist
    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
    echo "Found tables: " . implode(', ', $tables) . "\n\n";
    
    // Try to find the dictionary table
    // Jyut Dictionary might use different table names, try common ones
    $possibleTables = ['dictionary', 'entries', 'words', 'dict', 'jyutping'];
    $tableName = null;
    
    foreach ($possibleTables as $table) {
        if (in_array($table, $tables)) {
            // Check if table has jyutping column
            $columns = $db->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_ASSOC);
            $columnNames = array_column($columns, 'name');
            
            if (in_array('jyutping', $columnNames) || 
                in_array('jyutping_code', $columnNames) ||
                in_array('romanization', $columnNames)) {
                $tableName = $table;
                echo "Using table: $tableName\n";
                break;
            }
        }
    }
    
    if (!$tableName) {
        // Show all tables and let user choose
        echo "Could not auto-detect dictionary table. Available tables:\n";
        foreach ($tables as $table) {
            $columns = $db->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_ASSOC);
            $columnNames = array_column($columns, 'name');
            echo "  - $table (columns: " . implode(', ', $columnNames) . ")\n";
        }
        echo "\nPlease check the table structure and modify this script accordingly.\n";
        exit(1);
    }
    
    // Get column names
    $columns = $db->query("PRAGMA table_info($tableName)")->fetchAll(PDO::FETCH_ASSOC);
    $columnMap = [];
    foreach ($columns as $col) {
        $colName = strtolower($col['name']);
        if (in_array($colName, ['jyutping', 'jyutping_code', 'romanization', 'jp'])) {
            $columnMap['jyutping'] = $col['name'];
        } elseif (in_array($colName, ['hanzi', 'chinese', 'char', 'character', 'text'])) {
            $columnMap['hanzi'] = $col['name'];
        } elseif (in_array($colName, ['word', 'phrase', 'entry'])) {
            $columnMap['word'] = $col['name'];
        } elseif (in_array($colName, ['frequency', 'freq', 'count', 'rank', 'popularity'])) {
            $columnMap['frequency'] = $col['name'];
        }
    }
    
    echo "Column mapping:\n";
    foreach ($columnMap as $key => $value) {
        echo "  $key -> $value\n";
    }
    echo "\n";
    
    // Build SELECT query
    $selectCols = [];
    $selectCols[] = $columnMap['jyutping'] ?? 'NULL as jyutping_code';
    $selectCols[] = $columnMap['hanzi'] ?? 'NULL as hanzi';
    $selectCols[] = $columnMap['word'] ?? 'NULL as word';
    $selectCols[] = $columnMap['frequency'] ?? '200 as frequency';
    
    $sql = "SELECT " . implode(', ', $selectCols) . " FROM $tableName";
    
    echo "Querying database...\n";
    $stmt = $db->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($rows) . " entries\n";
    
    if (empty($rows)) {
        fwrite(STDERR, "ERROR: No data found in table\n");
        exit(1);
    }
    
    // Write CSV file
    $outputDir = dirname($outputFile);
    if (!is_dir($outputDir)) {
        mkdir($outputDir, 0755, true);
    }
    
    $fp = fopen($outputFile, 'w');
    if (!$fp) {
        fwrite(STDERR, "ERROR: Failed to create output file\n");
        exit(1);
    }
    
    // Write UTF-8 BOM for Excel compatibility
    fwrite($fp, "\xEF\xBB\xBF");
    
    // Write header
    fputcsv($fp, ['jyutping_code', 'hanzi', 'word', 'frequency', 'tags']);
    
    // Write rows
    $written = 0;
    foreach ($rows as $row) {
        $jyutping = trim($row['jyutping_code'] ?? $row['jyutping'] ?? '');
        $hanzi = trim($row['hanzi'] ?? '');
        $word = trim($row['word'] ?? '');
        $frequency = isset($row['frequency']) ? (int)$row['frequency'] : 200;
        
        if (!$jyutping) {
            continue; // Skip entries without jyutping
        }
        
        // Use word if available, otherwise use hanzi
        $wordValue = $word ?: $hanzi;
        
        // Default tags
        $tags = 'daily';
        
        fputcsv($fp, [
            $jyutping,
            $hanzi ?: '',
            $wordValue,
            $frequency,
            $tags
        ]);
        $written++;
    }
    
    fclose($fp);
    
    echo "✓ Extracted $written entries\n";
    echo "✓ Output file: $outputFile\n";
    echo "\n";
    echo "Next step: Import the CSV file using:\n";
    echo "  php backend/scripts/seed-jyutping-from-csv.php\n";
    
} catch (PDOException $e) {
    fwrite(STDERR, "ERROR: " . $e->getMessage() . "\n");
    exit(1);
}

