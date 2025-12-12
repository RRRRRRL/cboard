<?php
/**
 * Communicator Routes Handler
 */

require_once __DIR__ . '/../auth.php';

function handleCommunicatorRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    $pagination = getPaginationParams();
    
    // GET /communicator/my - Get communicators for authenticated user (recommended, token-based)
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'my') {
        $user = requireAuth($authToken);
        
        try {
            // Fetch user's profiles (communicators) from database
            $stmt = $db->prepare("
                SELECT id, display_name as name, description, created_at
                FROM profiles 
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ");
            $limit = $pagination['limit'];
            $offset = ($pagination['page'] - 1) * $limit;
            $stmt->execute([$user['id'], $limit, $offset]);
            $communicators = $stmt->fetchAll();
            
            $stmt = $db->prepare("SELECT COUNT(*) as total FROM profiles WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $total = $stmt->fetch()['total'];
            
            return successResponse([
                'communicators' => $communicators,
                'total' => (int)$total,
                'page' => $pagination['page'],
                'limit' => $pagination['limit']
            ]);
        } catch (Exception $e) {
            error_log("Get user communicators error: " . $e->getMessage());
            return errorResponse('Failed to fetch user communicators', 500);
        }
    }
    
    // GET /communicator/byemail/{email} - Legacy endpoint (deprecated, kept for backward compatibility)
    // NOTE: This endpoint is less secure as it exposes email in URL. Use /communicator/my instead.
    if ($method === 'GET' && count($pathParts) >= 3 && $pathParts[1] === 'byemail') {
        $user = requireAuth($authToken);
        
        // Handle URL-encoded email (email might be split across path parts if @ is not encoded)
        $emailParts = array_slice($pathParts, 2);
        $email = urldecode(implode('/', $emailParts));
        
        // Verify the email matches the authenticated user (case-insensitive comparison)
        if (strtolower($user['email']) !== strtolower($email)) {
            error_log("Email mismatch - user email: {$user['email']}, requested email: $email");
            return errorResponse('Unauthorized: email mismatch', 403);
        }
        
        // Log deprecation warning
        error_log("WARNING: Using deprecated endpoint /communicator/byemail/{email}. Use /communicator/my instead.");
        
        try {
            // Fetch user's profiles (communicators) from database
            $stmt = $db->prepare("
                SELECT id, display_name as name, description, created_at
                FROM profiles 
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ");
            $limit = $pagination['limit'];
            $offset = ($pagination['page'] - 1) * $limit;
            $stmt->execute([$user['id'], $limit, $offset]);
            $communicators = $stmt->fetchAll();
            
            $stmt = $db->prepare("SELECT COUNT(*) as total FROM profiles WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $total = $stmt->fetch()['total'];
            
            return successResponse([
                'communicators' => $communicators,
                'total' => (int)$total,
                'page' => $pagination['page'],
                'limit' => $pagination['limit'],
                'deprecated' => true,
                'message' => 'This endpoint is deprecated. Please use /communicator/my instead.'
            ]);
        } catch (Exception $e) {
            error_log("Get user communicators error: " . $e->getMessage());
            return errorResponse('Failed to fetch user communicators', 500);
        }
    }
    
    // POST /communicator
    if ($method === 'POST' && count($pathParts) === 1) {
        $user = requireAuth($authToken);
        
        // TODO: Create communicator in database
        return successResponse([
            'communicator' => [
                'id' => 'new-communicator-' . time(),
                'name' => $data['name'] ?? 'New Communicator',
                'email' => $user['email'],
                'author' => $user['name']
            ]
        ], 201);
    }
    
    // PUT /communicator/{id}
    if ($method === 'PUT' && count($pathParts) === 2) {
        $user = requireAuth($authToken);
        $communicatorId = $pathParts[1];
        
        // TODO: Update communicator in database
        return successResponse([
            'id' => $communicatorId,
            'name' => $data['name'] ?? 'Updated Communicator'
        ]);
    }
    
    return errorResponse('Communicator route not found', 404);
}

