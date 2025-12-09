<?php
/**
 * Check GD Extension Installation
 */

echo "Checking GD Extension...\n\n";

if (function_exists('imagecreatetruecolor')) {
    echo "✅ GD extension is installed\n\n";
    
    echo "Available functions:\n";
    $functions = [
        'imagecreatetruecolor',
        'imagecolorallocate',
        'imagefill',
        'imagestring',
        'imagepng',
        'imagejpeg',
        'imagegif',
        'getimagesize'
    ];
    
    foreach ($functions as $func) {
        if (function_exists($func)) {
            echo "  ✅ $func\n";
        } else {
            echo "  ❌ $func (missing)\n";
        }
    }
    
    echo "\nGD Info:\n";
    $info = gd_info();
    foreach ($info as $key => $value) {
        echo "  $key: " . ($value ? 'Yes' : 'No') . "\n";
    }
    
} else {
    echo "❌ GD extension is NOT installed\n\n";
    echo "To install on Ubuntu/Debian:\n";
    echo "  sudo apt-get update\n";
    echo "  sudo apt-get install php-gd\n";
    echo "  sudo systemctl restart apache2  # or php-fpm\n";
    echo "\nOr for PHP CLI:\n";
    echo "  sudo apt-get install php8.3-gd  # adjust version\n";
}

