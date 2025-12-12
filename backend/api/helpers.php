<?php
/**
 * API Helper Functions
 */

/**
 * Verify authentication token
 */
function verifyAuth($token) {
    if (!$token) {
        return null;
    }
    
    require_once __DIR__ . '/auth.php';
    
    // Decode JWT token
    $payload = JWT::decode($token);
    if (!$payload || !isset($payload['user_id'])) {
        return null;
    }
    
    // Get user from database
    try {
        $db = getDB();
        if (!$db) {
            return null;
        }
        
        $stmt = $db->prepare("SELECT id, email, name, role, is_active FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$payload['user_id']]);
        $user = $stmt->fetch();
        
        return $user ?: null;
    } catch (Exception $e) {
        error_log("Auth verification error: " . $e->getMessage());
        return null;
    }
}

/**
 * Require authentication
 */
function requireAuth($token) {
    $user = verifyAuth($token);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authentication required']);
        exit;
    }
    return $user;
}

/**
 * Require specific role(s)
 * @param array|string $user User object from requireAuth
 * @param string|array $requiredRoles Required role(s) - can be 'admin', ['admin', 'teacher'], etc.
 * @return bool True if user has required role
 */
function requireRole($user, $requiredRoles) {
    if (!$user || !isset($user['role'])) {
        return false;
    }
    
    $userRole = $user['role'];
    
    if (is_array($requiredRoles)) {
        return in_array($userRole, $requiredRoles);
    }
    
    return $userRole === $requiredRoles;
}

/**
 * Require admin role
 * @param array $user User object from requireAuth
 * @return void Exits with 403 if not admin
 */
function requireAdmin($user) {
    if (!requireRole($user, 'admin')) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Admin access required']);
        exit;
    }
}

/**
 * Check if user is admin
 * @param array $user User object
 * @return bool
 */
function isAdmin($user) {
    return requireRole($user, 'admin');
}

/**
 * Get pagination parameters
 */
function getPaginationParams() {
    return [
        'page' => isset($_GET['page']) ? (int)$_GET['page'] : 1,
        'limit' => isset($_GET['limit']) ? (int)$_GET['limit'] : 10,
        'offset' => isset($_GET['offset']) ? (int)$_GET['offset'] : 0,
        'sort' => $_GET['sort'] ?? '-id',
        'search' => $_GET['search'] ?? ''
    ];
}

/**
 * Format response
 */
function successResponse($data, $status = 200) {
    return ['status' => $status, 'data' => $data];
}

/**
 * Format error response
 */
function errorResponse($message, $status = 400) {
    return ['status' => $status, 'data' => ['success' => false, 'message' => $message]];
}

