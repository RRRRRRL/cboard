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

// CORS Configuration - Handle preflight requests first
$origin = $_SERVER['HTTP_ORIGIN'] ?? null;
if (!$origin && isset($_SERVER['HTTP_REFERER'])) {
    $referer = $_SERVER['HTTP_REFERER'];
    $parsed = parse_url($referer);
    if ($parsed && isset($parsed['scheme']) && isset($parsed['host'])) {
        $origin = $parsed['scheme'] . '://' . $parsed['host'];
        if (isset($parsed['port'])) {
            $origin .= ':' . $parsed['port'];
        }
    }
}

$allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://192.168.62.37',
    'http://192.168.62.37:3000',
    'https://aac.uplifor.org',
    'https://www.aac.uplifor.org'
];

$corsOrigin = '*';
if ($origin) {
    if (in_array($origin, $allowedOrigins) ||
        preg_match('/^https?:\/\/localhost(:\d+)?$/', $origin) || 
        preg_match('/^https?:\/\/127\.0\.0\.1(:\d+)?$/', $origin) ||
        preg_match('/^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/', $origin)) {
        $corsOrigin = $origin;
    }
}

// Set CORS headers for all requests
header('Access-Control-Allow-Origin: ' . $corsOrigin);
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, request-id, requestOrigin, purchaseVersion, traceparent, tracestate, baggage');
if ($corsOrigin !== '*') {
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Max-Age: 86400');

// Handle preflight OPTIONS requests immediately
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    // Ensure all CORS headers are sent
    header('Access-Control-Allow-Origin: ' . $corsOrigin);
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, request-id, requestOrigin, purchaseVersion, traceparent, tracestate, baggage');
    if ($corsOrigin !== '*') {
        header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Max-Age: 86400');
    echo json_encode(['success' => true, 'message' => 'CORS preflight']);
    exit;
}

// Get request path
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$requestPath = parse_url($requestUri, PHP_URL_PATH) ?? '/';

// Remove query string for path matching
$requestPathClean = strtok($requestPath, '?');

// Serve uploads directly (handle both /uploads/ and /api/uploads/)
if (strpos($requestPathClean, '/uploads/') === 0 || strpos($requestPathClean, '/api/uploads/') === 0) {
    // Remove /api prefix if present
    $normalizedPath = str_replace('/api/uploads/', '/uploads/', $requestPathClean);
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
        // Use the same CORS origin logic
        header('Access-Control-Allow-Origin: ' . $corsOrigin);
        
        // Output file
        readfile($filePath);
        exit;
    } else {
        // File not found - log for debugging
        error_log("Router: File not found - Request: $requestPathClean, FilePath: $filePath, RealPath: " . ($realPath ?: 'null') . ", RealBase: " . ($realBase ?: 'null'));
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'File not found', 'path' => $requestPathClean]);
        exit;
    }
}

// Route all API requests to api/index.php
if (strpos($requestPathClean, '/api') === 0) {
    if (file_exists(__DIR__ . '/api/index.php')) {
        // Set environment for API
        $_SERVER['SCRIPT_NAME'] = '/api/index.php';
        require __DIR__ . '/api/index.php';
        exit;
    } else {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'API not found']);
        exit;
    }
}

// If we reach here, it's a static file request - let PHP server handle it
return false;

