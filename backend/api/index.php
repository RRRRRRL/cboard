<?php
/**
 * Cboard PHP API - Main Entry Point
 * 
 * This is the main API router that handles all incoming requests
 */

// CORS Configuration
// Get the origin from the request
$origin = $_SERVER['HTTP_ORIGIN'] ?? null;

// If no origin header, try to extract from referer
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

// List of allowed origins (for production, specify exact origins)
// For development, allow common localhost origins
$allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://192.168.62.37',
    'http://192.168.62.37:3000',
    'http://192.168.62.41',
    'http://192.168.62.41:3000',
    'https://aac.uplifor.org',
    'https://www.aac.uplifor.org'
];

// If origin is in allowed list, use it; otherwise use wildcard (but without credentials)
$corsOrigin = '*';
$allowCredentials = false;

if ($origin) {
    if (in_array($origin, $allowedOrigins)) {
        $corsOrigin = $origin;
        $allowCredentials = true;
    } elseif (preg_match('/^https?:\/\/localhost(:\d+)?$/', $origin) || 
              preg_match('/^https?:\/\/127\.0\.0\.1(:\d+)?$/', $origin) ||
              preg_match('/^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/', $origin)) {
        // Allow any localhost, 127.0.0.1, or local network IP for development
        $corsOrigin = $origin;
        $allowCredentials = true;
    }
}

// Set CORS headers
header('Access-Control-Allow-Origin: ' . $corsOrigin);
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
// Allow all common headers that frontend might send
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, request-id, requestOrigin, purchaseVersion, traceparent, tracestate, baggage');
if ($allowCredentials) {
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Max-Age: 86400'); // Cache preflight for 24 hours

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    // Ensure all CORS headers are sent for preflight
    header('Access-Control-Allow-Origin: ' . $corsOrigin);
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, request-id, requestOrigin, purchaseVersion, traceparent, tracestate, baggage');
    if ($allowCredentials) {
        header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Max-Age: 86400');
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

// Load AI helpers (Ollama integration)
require_once __DIR__ . '/helpers/ollama.php';

// Load authentication helpers
require_once __DIR__ . '/auth.php';

// Load rate limiting middleware
require_once __DIR__ . '/middleware/rateLimiter.php';

// Load route handlers
require_once __DIR__ . '/routes/user.php';
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
require_once __DIR__ . '/routes/jyutping-rules.php';
require_once __DIR__ . '/routes/transfer.php';
require_once __DIR__ . '/routes/ai.php';
require_once __DIR__ . '/routes/games.php';
require_once __DIR__ . '/routes/ocr.php';
require_once __DIR__ . '/routes/admin.php';
require_once __DIR__ . '/routes/data-retention.php';

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($path, PHP_URL_PATH) ?? '/';

// Debug logging (can be removed in production)
error_log("API Request: Method=$method, REQUEST_URI=" . ($_SERVER['REQUEST_URI'] ?? 'N/A') . ", Parsed Path=$path");

// Skip uploads requests - these should be handled by router.php
// If we reach here, it means router.php didn't catch it (server not started with router)
if (strpos($path, '/uploads/') !== false || strpos($path, '/api/uploads/') !== false) {
    // Try to serve the file directly as fallback
    $filePath = str_replace('/api/uploads/', '/uploads/', $path);
    $filePath = str_replace('/uploads/', '/uploads/', $filePath);
    $filePath = __DIR__ . '/..' . $filePath;
    
    if (file_exists($filePath)) {
        $mimeType = mime_content_type($filePath);
        if (!$mimeType) {
            $mimeType = 'application/octet-stream';
        }
        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: public, max-age=31536000');
        // Use the same CORS origin logic for file serving
        $fileOrigin = $_SERVER['HTTP_ORIGIN'] ?? '*';
        if (preg_match('/^https?:\/\/localhost(:\d+)?$/', $fileOrigin) || 
            preg_match('/^https?:\/\/127\.0\.0\.1(:\d+)?$/', $fileOrigin) ||
            preg_match('/^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/', $fileOrigin) ||
            in_array($fileOrigin, $allowedOrigins)) {
            header('Access-Control-Allow-Origin: ' . $fileOrigin);
        } else {
            header('Access-Control-Allow-Origin: *');
        }
        readfile($filePath);
        exit;
    } else {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'File not found', 'path' => $path]);
        exit;
    }
}

// Remove /api prefix if present (handle both /api/route and /api/route/)
$path = preg_replace('#^/api/?#', '', $path);
$path = trim($path, '/');
$pathParts = array_filter(explode('/', $path), function($part) { return $part !== ''; }); // Filter empty parts
$pathParts = array_values($pathParts); // Re-index array

// Debug logging
error_log("API Route: PathParts=" . json_encode($pathParts) . ", Method=$method");

// Debug logging
error_log("API Route: PathParts=" . json_encode($pathParts));

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
    
} catch (PDOException $e) {
    error_log("API PDO Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    error_log("PDO Error Code: " . $e->getCode());
    error_log("PDO Error Info: " . json_encode($e->errorInfo ?? []));
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error',
        'error' => getenv('APP_DEBUG') === 'true' ? $e->getMessage() : 'Internal server error'
    ]);
} catch (Exception $e) {
    error_log("API Error: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    error_log("Stack trace: " . $e->getTraceAsString());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Internal server error',
        'error' => getenv('APP_DEBUG') === 'true' ? $e->getMessage() : 'An error occurred'
    ]);
}

/**
 * Route requests to appropriate handlers
 */
function routeRequest($method, $pathParts, $data, $authToken) {
    // Health check
    if (empty($pathParts) || (isset($pathParts[0]) && $pathParts[0] === '')) {
        return ['status' => 200, 'data' => ['message' => 'Cboard API is running', 'version' => '1.0.0']];
    }
    
    if (empty($pathParts) || !isset($pathParts[0])) {
        return ['status' => 404, 'data' => ['success' => false, 'message' => 'Route not found', 'debug' => ['pathParts' => $pathParts]]];
    }
    
    $route = $pathParts[0];
    
    // Debug logging
    error_log("Routing: method=$method, route=$route, pathParts=" . json_encode($pathParts));
    
    // User routes
    if ($route === 'user') {
        return handleUserRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Board routes (legacy - all board routes now handled by profile routes)
    // All board endpoints are now profile-centric for backward compatibility
    if ($route === 'board') {
        // Convert /board/{id} to /profiles/{id}/board for single board access
        if (count($pathParts) === 2 && is_numeric($pathParts[1])) {
            // GET /board/{id} -> GET /profiles/{id}/board
            if ($method === 'GET') {
                $profilePathParts = ['profiles', $pathParts[1], 'board'];
                return handleProfileRoutes($method, $profilePathParts, $data, $authToken);
            }
            // PUT /board/{id} -> PUT /profiles/{id}/board
            if ($method === 'PUT') {
                $profilePathParts = ['profiles', $pathParts[1], 'board'];
                return handleProfileRoutes($method, $profilePathParts, $data, $authToken);
            }
            // DELETE /board/{id} -> DELETE /profiles/{id}
            if ($method === 'DELETE') {
                $profilePathParts = ['profiles', $pathParts[1]];
                return handleProfileRoutes($method, $profilePathParts, $data, $authToken);
            }
        }
        // List endpoints are now profile-centric, redirect to profile handler
        if (count($pathParts) === 1 || 
            (count($pathParts) === 2 && ($pathParts[1] === 'public' || $pathParts[1] === 'my')) ||
            (count($pathParts) >= 3 && $pathParts[1] === 'byemail')) {
            // These are list endpoints, now handled by profile routes
            return handleProfileRoutes($method, $pathParts, $data, $authToken);
        }
        // For any other board routes, redirect to profile handler
        return handleProfileRoutes($method, $pathParts, $data, $authToken);
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
    
    // Jyutping rules routes (Sprint 7 - Admin/Teacher features)
    if ($route === 'jyutping-rules') {
        return handleJyutpingRulesRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Transfer routes (Sprint 8)
    if ($route === 'transfer') {
        return handleTransferRoutes($method, $pathParts, $data, $authToken);
    }
    
    // AI routes (Sprint 9-10)
    if ($route === 'ai') {
        return handleAIRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Games routes (Sprint 11)
    if ($route === 'games') {
        return handleGamesRoutes($method, $pathParts, $data, $authToken);
    }
    
    // OCR routes (Sprint 11)
    if ($route === 'ocr') {
        return handleOCRRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Admin routes
    if ($route === 'admin') {
        return handleAdminRoutes($method, $pathParts, $data, $authToken);
    }
    
    // Data retention routes
    if ($route === 'data-retention') {
        return handleDataRetentionRoutes($method, $pathParts, $data, $authToken);
    }
    
    // 404 - Route not found
    return ['status' => 404, 'data' => ['success' => false, 'message' => 'Route not found']];
}

