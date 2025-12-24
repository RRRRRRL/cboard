<?php
/**
 * Convert Jyut Dictionary data to Cboard CSV format
 * 
 * This script helps convert data from Jyut Dictionary or other sources
 * to the CSV format required by Cboard.
 * 
 * Usage:
 *   php backend/scripts/convert-jyut-dict-to-csv.php [input_file] [output_file]
 * 
 * Input formats supported:
 *   - JSON (from Jyut Dictionary)
 *   - TSV/TAB-delimited
 *   - Custom format (modify script as needed)
 */

require_once __DIR__ . '/../config/database.php';

$inputFile = $argv[1] ?? null;
$outputFile = $argv[2] ?? __DIR__ . '/../database/jyutping_pycantonese_input.csv';

if (!$inputFile || !file_exists($inputFile)) {
    echo "Usage: php convert-jyut-dict-to-csv.php <input_file> [output_file]\n";
    echo "\n";
    echo "Example:\n";
    echo "  php convert-jyut-dict-to-csv.php jyut-dict-data.json jyutping_pycantonese_input.csv\n";
    exit(1);
}

echo "Converting $inputFile to CSV format...\n";

$inputExtension = strtolower(pathinfo($inputFile, PATHINFO_EXTENSION));
$rows = [];

// Read input file based on format
if ($inputExtension === 'json') {
    $data = json_decode(file_get_contents($inputFile), true);
    if (!$data) {
        fwrite(STDERR, "ERROR: Failed to parse JSON file\n");
        exit(1);
    }
    
    // Convert JSON to rows
    // Adjust this based on actual JSON structure from Jyut Dictionary
    foreach ($data as $entry) {
        $jyutping = $entry['jyutping'] ?? $entry['jyutping_code'] ?? '';
        $hanzi = $entry['hanzi'] ?? $entry['char'] ?? $entry['character'] ?? '';
        $word = $entry['word'] ?? $entry['text'] ?? '';
        $frequency = $entry['frequency'] ?? $entry['freq'] ?? 200;
        $tags = $entry['tags'] ?? $entry['category'] ?? 'daily';
        
        if ($jyutping) {
            $rows[] = [
                'jyutping_code' => $jyutping,
                'hanzi' => $hanzi,
                'word' => $word ?: $hanzi,
                'frequency' => (int)$frequency,
                'tags' => is_array($tags) ? implode(',', $tags) : $tags
            ];
        }
    }
} elseif ($inputExtension === 'tsv' || $inputExtension === 'txt') {
    // Read TSV/TAB-delimited file
    $fp = fopen($inputFile, 'r');
    if (!$fp) {
        fwrite(STDERR, "ERROR: Failed to open file\n");
        exit(1);
    }
    
    // Try to detect delimiter
    $firstLine = fgets($fp);
    rewind($fp);
    $delimiter = strpos($firstLine, "\t") !== false ? "\t" : ",";
    
    $header = fgetcsv($fp, 0, $delimiter);
    if (!$header) {
        fwrite(STDERR, "ERROR: Failed to read header\n");
        exit(1);
    }
    
    // Map common column names
    $columnMap = [];
    foreach ($header as $idx => $col) {
        $colLower = strtolower(trim($col));
        if (in_array($colLower, ['jyutping', 'jyutping_code', 'jp', 'romanization'])) {
            $columnMap['jyutping'] = $idx;
        } elseif (in_array($colLower, ['hanzi', 'char', 'character', 'chinese'])) {
            $columnMap['hanzi'] = $idx;
        } elseif (in_array($colLower, ['word', 'text', 'phrase'])) {
            $columnMap['word'] = $idx;
        } elseif (in_array($colLower, ['frequency', 'freq', 'count', 'rank'])) {
            $columnMap['frequency'] = $idx;
        } elseif (in_array($colLower, ['tags', 'tag', 'category', 'cat'])) {
            $columnMap['tags'] = $idx;
        }
    }
    
    while (($row = fgetcsv($fp, 0, $delimiter)) !== false) {
        $jyutping = isset($columnMap['jyutping']) ? trim($row[$columnMap['jyutping']] ?? '') : '';
        $hanzi = isset($columnMap['hanzi']) ? trim($row[$columnMap['hanzi']] ?? '') : '';
        $word = isset($columnMap['word']) ? trim($row[$columnMap['word']] ?? '') : '';
        $frequency = isset($columnMap['frequency']) ? (int)trim($row[$columnMap['frequency']] ?? 200) : 200;
        $tags = isset($columnMap['tags']) ? trim($row[$columnMap['tags']] ?? '') : 'daily';
        
        if ($jyutping) {
            $rows[] = [
                'jyutping_code' => $jyutping,
                'hanzi' => $hanzi,
                'word' => $word ?: $hanzi,
                'frequency' => $frequency,
                'tags' => $tags
            ];
        }
    }
    fclose($fp);
} else {
    fwrite(STDERR, "ERROR: Unsupported file format. Supported: JSON, TSV, TXT\n");
    exit(1);
}

if (empty($rows)) {
    fwrite(STDERR, "ERROR: No data extracted from input file\n");
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

// Write header
fputcsv($fp, ['jyutping_code', 'hanzi', 'word', 'frequency', 'tags']);

// Write rows
foreach ($rows as $row) {
    fputcsv($fp, [
        $row['jyutping_code'],
        $row['hanzi'],
        $row['word'],
        $row['frequency'],
        $row['tags']
    ]);
}

fclose($fp);

echo "✓ Converted " . count($rows) . " entries\n";
echo "✓ Output file: $outputFile\n";
echo "\n";
echo "Next step: Import the CSV file using:\n";
echo "  php backend/scripts/seed-jyutping-from-csv.php\n";

