<?php
/**
 * Cboard PHP API - Main Entry Point
 * 
 * This is the main API router that handles all incoming requests
 */

// Set CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
// Allow all common headers that frontend might send
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, request-id, requestOrigin, purchaseVersion, traceparent, tracestate, baggage');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400'); // Cache preflight for 24 hours

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    exit;
}

// Set content type for actual requests
header('Content-Type: application/json; charset=utf-8');

// Error handling
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Load configuration and database
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../database/init.php';
require_once __DIR__ . '/helpers.php';

// Load authentication helpers
require_once __DIR__ . '/auth.php';

// Load rate limiting middleware
require_once __DIR__ . '/middleware/rateLimiter.php';

// Load route handlers
require_once __DIR__ . '/routes/user.php';
require_once __DIR__ . '/routes/board.php';
require_once __DIR__ . '/routes/communicator.php';
require_once __DIR__ . '/routes/settings.php';
require_once __DIR__ . '/routes/media.php';
require_once __DIR__ . '/routes/other.php';
require_once __DIR__ . '/routes/profile.php';
require_once __DIR__ . '/routes/card.php';
require_once __DIR__ . '/routes/profile-card.php';
require_once __DIR__ . '/routes/action-log.php';
require_once __DIR__ . '/routes/tts.php';
require_once __DIR__ . '/routes/scanning.php';
require_once __DIR__ . '/routes/devices.php';
require_once __DIR__ . '/routes/jyutping.php';

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Skip uploads requests - these should be handled by router.php
// If we reach here, it means router.php didn't catch it (server not started with router)
if (strpos($path, '/uploads/') === 0 || strpos($path, '/api/uploads/') === 0) {
    // Try to serve the file directly as fallback
    $filePath = str_replace('/api/uploads/', '/uploads/', $path);
    $filePath = __DIR__ . '/..' . $filePath;
    
    if (file_exists($filePath)) {
        $mimeType = mime_content_type($filePath);
        if (!$mimeType) {
            $mimeType = 'application/octet-stream';
        }
        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: public, max-age=31536000');
        header('Access-Control-Allow-Origin: *');
        readfile($filePath);
        exit;
    } else {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'File not found', 'path' => $path]);
        exit;
    }
}

$path = str_replace('/api', '', $path); // Remove /api prefix if present
$path = trim($path, '/');
$pathParts = array_filter(explode('/', $path)); // Filter empty parts
$pathParts = array_values($pathParts); // Re-index array

// Apply rate limiting (skip for OPTIONS requests)
if ($method !== 'OPTIONS') {
    $endpoint = '/' . implode('/', $pathParts);
    if (!applyRateLimit($endpoint)) {
        exit; // Rate limit exceeded, response already sent
    }
}

// Get request body
$input = file_get_contents('php://input');
$data = json_decode($input, true) ?? [];

// Get headers
$headers = getallheaders();
$authToken = $headers['Authorization'] ?? $headers['authorization'] ?? null;
if ($authToken) {
    $authToken = str_replace('Bearer ', '', $authToken);
}

// Route handling
try {
    $response = routeRequest($method, $pathParts, $data, $authToken);
    
    http_response_code($response['status'] ?? 200);
    echo json_encode($response['data'] ?? $response);
    
} catch (Exception $e) {
    error_log("API Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Internal server error',
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}

/**
 * Route requests to appropriate handlers
 */
function routeRequest($method, $pathParts, $data, $authToken) {
    // Health check
    if (empty($pathParts) || $pathParts[0] === '') {
        return ['status' => 200, 'data' => ['message' => 'Cboard API is running', 'version' => '1.0.0']];
    }
    
    $route = $pathParts[0];
    
    // User routes
    if ($route === 'user') {
        return handleUserRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Board routes
    if ($route === 'board') {
        return handleBoardRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Communicator routes
    if ($route === 'communicator') {
        return handleCommunicatorRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Settings routes
    if ($route === 'settings') {
        return handleSettingsRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Media routes
    if ($route === 'media') {
        return handleMediaRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Location routes
    if ($route === 'location') {
        return handleLocationRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Subscriber routes (for future use)
    if ($route === 'subscriber') {
        return handleSubscriberRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Subscription routes
    if ($route === 'subscription') {
        return handleSubscriptionRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Analytics routes
    if ($route === 'analytics') {
        return handleAnalyticsRoutes($method, $pathParts, $data, $authToken);
    }
    
    // GPT/AI routes
    if ($route === 'gpt') {
        return handleGPTRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Language routes
    if ($route === 'languages') {
        return handleLanguageRoutes($method, $pathParts, $data, $authToken);
    }
    
    // OAuth login routes
    if ($route === 'login') {
        return handleLoginRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Account routes
    if ($route === 'account') {
        return handleAccountRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Profile routes (Sprint 2)
    if ($route === 'profiles') {
        return handleProfileRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Card routes (Sprint 3)
    if ($route === 'cards') {
        return handleCardRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Profile-card routes (Sprint 3)
    if ($route === 'profile-cards') {
        return handleProfileCardRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Action log routes (Sprint 4)
    if ($route === 'action-logs') {
        return handleActionLogRoutes($method, $pathParts, $data, $authToken);
    }
    
    // TTS routes (Sprint 4)
    if ($route === 'tts') {
        return handleTTSRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Scanning routes (Sprint 5)
    if ($route === 'scanning') {
        return handleScanningRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Devices routes (Sprint 6)
    if ($route === 'devices') {
        return handleDevicesRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Jyutping routes (Sprint 7)
    if ($route === 'jyutping') {
        return handleJyutpingRoutes($method, $pathParts, $data, $authToken);
    }
    
    // 404 - Route not found
    return ['status' => 404, 'data' => ['success' => false, 'message' => 'Route not found']];
}

