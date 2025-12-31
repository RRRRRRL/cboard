<?php
/**
 * Check if PHP zip extension is enabled
 * This script helps diagnose ZipArchive availability issues
 */

echo "Checking PHP zip extension status...\n\n";

if (class_exists('ZipArchive')) {
    echo "✓ ZipArchive class is available\n";

    // Test creating a simple ZIP file
    $testZipPath = sys_get_temp_dir() . '/test_zip_' . uniqid() . '.zip';
    $zip = new ZipArchive();

    if ($zip->open($testZipPath, ZipArchive::CREATE) === TRUE) {
        $zip->addFromString('test.txt', 'This is a test file');
        $zip->close();

        if (file_exists($testZipPath)) {
            echo "✓ ZIP file creation successful\n";
            unlink($testZipPath); // Clean up
            echo "✓ ZIP file cleanup successful\n";
        } else {
            echo "✗ ZIP file was not created\n";
        }
    } else {
        echo "✗ Failed to create ZIP file\n";
    }
} else {
    echo "✗ ZipArchive class is NOT available\n";
    echo "\nTo fix this issue:\n";
    echo "1. Locate your php.ini file (usually in PHP installation directory)\n";
    echo "2. Find the line: ;extension=zip\n";
    echo "3. Remove the semicolon to uncomment: extension=zip\n";
    echo "4. Restart your web server (Apache/IIS)\n";
    echo "5. Run this script again to verify\n";
}

echo "\nPHP Version: " . phpversion() . "\n";
echo "Loaded extensions: " . implode(', ', get_loaded_extensions()) . "\n";
?>
