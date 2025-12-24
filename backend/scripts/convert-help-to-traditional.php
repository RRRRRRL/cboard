#!/usr/bin/env php
<?php
/**
 * Convert help/zh-TW.md from Simplified to Traditional Chinese using OpenCC API
 * 
 * Usage: php convert-help-to-traditional.php [input-file] [output-file]
 */

require_once __DIR__ . '/../config/env-loader.php';
require_once __DIR__ . '/../api/helpers/opencc.php';

$inputFile = $argv[1] ?? __DIR__ . '/../../src/translations/help/zh-TW.md';
$outputFile = $argv[2] ?? $inputFile;

// Check if file exists
if (!file_exists($inputFile)) {
    echo "Error: File not found: $inputFile\n";
    exit(1);
}

echo "Reading file: $inputFile\n";
$content = file_get_contents($inputFile);

if ($content === false) {
    echo "Error: Failed to read file: $inputFile\n";
    exit(1);
}

echo "Converting Simplified Chinese to Traditional Chinese...\n";
echo "File size: " . strlen($content) . " bytes\n";

// Convert using OpenCC API
// Split into chunks if file is too large (OpenCC API may have size limits)
$chunkSize = 10000; // Process 10KB at a time
$chunks = str_split($content, $chunkSize);
$convertedChunks = [];

foreach ($chunks as $index => $chunk) {
    echo "Processing chunk " . ($index + 1) . "/" . count($chunks) . "...\n";
    
    $result = convertToTraditionalChinese($chunk, 's2twp');
    
    if (!$result['success']) {
        echo "Warning: Conversion failed for chunk " . ($index + 1) . ": " . ($result['error'] ?? 'Unknown error') . "\n";
        echo "Using original text for this chunk.\n";
        $convertedChunks[] = $chunk; // Use original on error
    } else {
        $convertedChunks[] = $result['text'];
    }
    
    // Small delay to avoid overwhelming the API
    usleep(100000); // 0.1 second
}

$convertedContent = implode('', $convertedChunks);

// Write converted content
echo "Writing converted content to: $outputFile\n";
$written = file_put_contents($outputFile, $convertedContent);

if ($written === false) {
    echo "Error: Failed to write file: $outputFile\n";
    exit(1);
}

echo "✓ Conversion completed successfully!\n";
echo "✓ File saved: $outputFile\n";
echo "Original size: " . strlen($content) . " bytes\n";
echo "Converted size: " . strlen($convertedContent) . " bytes\n";

