<?php
/**
 * User Routes Handler
 * Sprint 2: Implemented with real database operations
 */

require_once __DIR__ . '/../auth.php';

function handleUserRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    
    if ($db === null) {
        error_log("Database connection failed in handleUserRoutes");
        return errorResponse('Database connection failed. Please check server configuration.', 500);
    }
    
    // POST /user (registration)
    if ($method === 'POST' && count($pathParts) === 1) {
        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';
        $name = trim($data['name'] ?? '');
        
        // Validation
        if (empty($email) || empty($password)) {
            return errorResponse('Email and password are required', 400);
        }
        
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return errorResponse('Invalid email format', 400);
        }
        
        if (strlen($password) < 6) {
            return errorResponse('Password must be at least 6 characters', 400);
        }
        
        try {
            // Check if user already exists
            $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                return errorResponse('User with this email already exists', 409);
            }
            
            // Create user
            $passwordHash = Password::hash($password);
            $stmt = $db->prepare("
                INSERT INTO users (email, password_hash, name, role, is_active, is_verified, created_at)
                VALUES (?, ?, ?, 'student', 1, 0, NOW())
            ");
            $stmt->execute([$email, $passwordHash, $name ?: $email]);
            $userId = $db->lastInsertId();
            
            // Generate JWT token
            $token = JWT::encode(['user_id' => $userId, 'email' => $email]);
            
            // Update auth token in database
            $stmt = $db->prepare("UPDATE users SET auth_token = ?, auth_token_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?");
            $stmt->execute([$token, $userId]);
            
            return successResponse([
                'success' => true,
                'user' => [
                    'id' => (string)$userId, // Convert to string - frontend expects string for userId
                    'email' => $email,
                    'name' => $name ?: $email,
                    'authToken' => $token,
                    'isFirstLogin' => true
                ]
            ], 201);
            
        } catch (Exception $e) {
            error_log("User registration error: " . $e->getMessage());
            return errorResponse('Registration failed', 500);
        }
    }
    
    // POST /user/login
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'login') {
        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';
        
        if (empty($email) || empty($password)) {
            return errorResponse('Email and password are required', 400);
        }
        
        try {
            // Find user
            $stmt = $db->prepare("SELECT id, email, password_hash, name, role, is_active FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            
            if (!$user) {
                return errorResponse('Invalid email or password', 401);
            }
            
            if (!$user['is_active']) {
                return errorResponse('Account is inactive', 403);
            }
            
            // Verify password
            if (!Password::verify($password, $user['password_hash'])) {
                return errorResponse('Invalid email or password', 401);
            }
            
            // Generate JWT token
            $token = JWT::encode(['user_id' => $user['id'], 'email' => $user['email']]);
            
            // Update auth token and last login
            $stmt = $db->prepare("
                UPDATE users 
                SET auth_token = ?, 
                    auth_token_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR),
                    last_login = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$token, $user['id']]);
            
            // Get user's profiles (communicators)
            $stmt = $db->prepare("
                SELECT id, display_name as name, description, root_board_id, is_default, is_public, created_at
                FROM profiles 
                WHERE user_id = ?
                ORDER BY is_default DESC, created_at DESC
            ");
            $stmt->execute([$user['id']]);
            $profiles = $stmt->fetchAll();
            
            // Get user's boards
            $stmt = $db->prepare("
                SELECT id, board_id, name, description, is_public, last_edited
                FROM boards 
                WHERE user_id = ?
                ORDER BY last_edited DESC
                LIMIT 50
            ");
            $stmt->execute([$user['id']]);
            $boards = $stmt->fetchAll();
            
            // Ensure boards have 'id' field (use board_id as id for frontend compatibility)
            foreach ($boards as &$board) {
                $board['id'] = $board['board_id'];
            }
            unset($board);
            
            error_log("User login - Found " . count($boards) . " boards for user {$user['id']}");
            
            // Get user settings
            $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $settingsRow = $stmt->fetch();
            $settings = $settingsRow ? json_decode($settingsRow['settings_data'], true) : [];
            
            // Return response in format expected by frontend
            // Frontend expects: {id (as string), email, name, authToken, communicators, boards, settings, isFirstLogin}
            return successResponse([
                'id' => (string)$user['id'], // Convert to string - frontend expects string for userId
                'email' => $user['email'],
                'name' => $user['name'] ?: $user['email'],
                'authToken' => $token,
                'communicators' => $profiles,
                'boards' => $boards,
                'settings' => $settings ?: (object)[], // Ensure settings is always an object
                'isFirstLogin' => false
            ]);
            
        } catch (Exception $e) {
            error_log("User login error: " . $e->getMessage());
            return errorResponse('Login failed', 500);
        }
    }
    
    // POST /user/forgot
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'forgot') {
        $email = trim($data['email'] ?? '');
        
        if (empty($email)) {
            return errorResponse('Email is required', 400);
        }
        
        try {
            $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch();
            
            if ($user) {
                // Generate reset token
                $resetToken = bin2hex(random_bytes(32));
                $stmt = $db->prepare("
                    UPDATE users 
                    SET reset_password_token = ?, 
                        reset_password_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR)
                    WHERE id = ?
                ");
                $stmt->execute([$resetToken, $user['id']]);
                
                // TODO: Send email with reset link
                // For now, just return success
            }
            
            // Always return success (don't reveal if email exists)
            return successResponse(['success' => true, 'message' => 'Password reset email sent']);
            
        } catch (Exception $e) {
            error_log("Password reset error: " . $e->getMessage());
            return errorResponse('Password reset failed', 500);
        }
    }
    
    // POST /user/store-password
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'store-password') {
        $userid = $data['userid'] ?? '';
        $token = $data['token'] ?? '';
        $password = $data['password'] ?? '';
        
        if (empty($userid) || empty($token) || empty($password)) {
            return errorResponse('User ID, token, and password are required', 400);
        }
        
        try {
            $stmt = $db->prepare("
                SELECT id FROM users 
                WHERE id = ? AND reset_password_token = ? AND reset_password_expires > NOW()
            ");
            $stmt->execute([$userid, $token]);
            $user = $stmt->fetch();
            
            if (!$user) {
                return errorResponse('Invalid or expired reset token', 400);
            }
            
            $passwordHash = Password::hash($password);
            $stmt = $db->prepare("
                UPDATE users 
                SET password_hash = ?, 
                    reset_password_token = NULL, 
                    reset_password_expires = NULL
                WHERE id = ?
            ");
            $stmt->execute([$passwordHash, $userid]);
            
            return successResponse(['success' => true, 'message' => 'Password updated successfully']);
            
        } catch (Exception $e) {
            error_log("Password store error: " . $e->getMessage());
            return errorResponse('Password update failed', 500);
        }
    }
    
    // GET /user/{userId}
    if ($method === 'GET' && count($pathParts) === 2) {
        $user = requireAuth($authToken);
        $userId = $pathParts[1];
        
        // Only allow users to get their own data (or admin)
        if ($user['id'] != $userId && $user['role'] !== 'admin') {
            return errorResponse('Unauthorized', 403);
        }
        
        try {
            $stmt = $db->prepare("
                SELECT id, email, name, role, created_at, last_login
                FROM users 
                WHERE id = ?
            ");
            $stmt->execute([$userId]);
            $userData = $stmt->fetch();
            
            if (!$userData) {
                return errorResponse('User not found', 404);
            }
            
            // Get profiles and boards
            $stmt = $db->prepare("SELECT id, display_name as name, description FROM profiles WHERE user_id = ?");
            $stmt->execute([$userId]);
            $profiles = $stmt->fetchAll();
            
            $stmt = $db->prepare("SELECT id, board_id, name FROM boards WHERE user_id = ? LIMIT 50");
            $stmt->execute([$userId]);
            $boards = $stmt->fetchAll();
            
            return successResponse([
                'id' => (int)$userData['id'],
                'email' => $userData['email'],
                'name' => $userData['name'],
                'communicators' => $profiles,
                'boards' => $boards
            ]);
            
        } catch (Exception $e) {
            error_log("Get user error: " . $e->getMessage());
            return errorResponse('Failed to fetch user', 500);
        }
    }
    
    // PUT /user/{userId}
    if ($method === 'PUT' && count($pathParts) === 2) {
        $user = requireAuth($authToken);
        $userId = $pathParts[1];
        
        // Only allow users to update their own data (or admin)
        if ($user['id'] != $userId && $user['role'] !== 'admin') {
            return errorResponse('Unauthorized', 403);
        }
        
        try {
            $updates = [];
            $params = [];
            
            if (isset($data['name'])) {
                $updates[] = "name = ?";
                $params[] = trim($data['name']);
            }
            
            if (isset($data['email'])) {
                if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                    return errorResponse('Invalid email format', 400);
                }
                $updates[] = "email = ?";
                $params[] = trim($data['email']);
            }
            
            // Handle location field (store as JSON in a settings field or return it in response)
            // For now, we'll just accept it and return it in the response
            $location = isset($data['location']) ? $data['location'] : null;
            
            // If no database fields to update, just return success with location
            if (empty($updates)) {
                return successResponse([
                    'success' => true, 
                    'message' => 'User updated successfully',
                    'location' => $location
                ]);
            }
            
            $updates[] = "updated_at = NOW()";
            $params[] = $userId;
            
            $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            
            return successResponse([
                'success' => true, 
                'message' => 'User updated successfully',
                'location' => $location
            ]);
            
        } catch (Exception $e) {
            error_log("Update user error: " . $e->getMessage());
            return errorResponse('Failed to update user', 500);
        }
    }
    
    return errorResponse('User route not found', 404);
}
