<?php
/**
 * PHP Built-in Server Router
 * 
 * This router script handles:
 * 1. Serving uploaded files from /uploads/
 * 2. Routing API requests to api/index.php
 * 
 * Usage: php -S localhost:8000 router.php
 */

$requestUri = $_SERVER['REQUEST_URI'];
$requestPath = parse_url($requestUri, PHP_URL_PATH);

// Remove query string
$requestPath = strtok($requestPath, '?');

// Serve uploads directly (handle both /uploads/ and /api/uploads/)
if (strpos($requestPath, '/uploads/') === 0 || strpos($requestPath, '/api/uploads/') === 0) {
    // Remove /api prefix if present
    $normalizedPath = str_replace('/api/uploads/', '/uploads/', $requestPath);
    if (strpos($normalizedPath, '/uploads/') !== 0) {
        $normalizedPath = '/uploads/' . ltrim($normalizedPath, '/');
    }
    
    // Ensure we have the leading slash for file path
    $filePath = __DIR__ . $normalizedPath;
    
    // Security: prevent directory traversal
    $realPath = realpath($filePath);
    $realBase = realpath(__DIR__ . '/uploads');
    
    // Debug logging (can be removed in production)
    if (!$realBase) {
        error_log("Router: uploads base directory not found: " . __DIR__ . '/uploads');
    }
    
    if ($realPath && $realBase && strpos($realPath, $realBase) === 0 && file_exists($filePath)) {
        // Get MIME type
        $mimeType = mime_content_type($filePath);
        if (!$mimeType) {
            $mimeType = 'application/octet-stream';
        }
        
        // Set headers
        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: public, max-age=31536000');
        header('Access-Control-Allow-Origin: *');
        
        // Output file
        readfile($filePath);
        exit;
    } else {
        // File not found - log for debugging
        error_log("Router: File not found - Request: $requestPath, FilePath: $filePath, RealPath: " . ($realPath ?: 'null') . ", RealBase: " . ($realBase ?: 'null'));
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'File not found', 'path' => $requestPath]);
        exit;
    }
}

// Route all other requests to API
if (file_exists(__DIR__ . '/api/index.php')) {
    require __DIR__ . '/api/index.php';
} else {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'API not found']);
}

