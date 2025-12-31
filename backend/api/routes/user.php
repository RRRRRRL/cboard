<?php
/**
 * User Routes Handler
 * Sprint 2: Implemented with real database operations
 */

require_once __DIR__ . '/../auth.php';

function handleUserRoutes($method, $pathParts, $data, $authToken) {
    try {
        $db = getDB();
    } catch (Exception $e) {
        error_log("Database connection error in handleUserRoutes: " . $e->getMessage());
        error_log("Error trace: " . $e->getTraceAsString());
        return errorResponse('Database connection failed. Please check server configuration.', 500);
    }
    
    if ($db === null) {
        error_log("Database connection returned null in handleUserRoutes");
        return errorResponse('Database connection failed. Please check server configuration.', 500);
    }
    
    // POST /user (registration)
    if ($method === 'POST' && count($pathParts) === 1) {
        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';
        $name = trim($data['name'] ?? '');
        $role = $data['role'] ?? 'student'; // Get role from signup form, default to student

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

        // Validate role
        $validRoles = ['student', 'teacher', 'parent'];
        if (!in_array($role, $validRoles)) {
            return errorResponse('Invalid role selected', 400);
        }
        
        try {
            // Check if user already exists
            $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                return errorResponse('User with this email already exists', 409);
            }
            
            // Verify required classes exist
            if (!class_exists('Password')) {
                error_log("Password class not found - auth.php may not be loaded");
                return errorResponse('Server configuration error: Password class not available', 500);
            }
            
            // Create user
            $passwordHash = Password::hash($password);
            if (!$passwordHash) {
                error_log("Password hashing failed for email: $email");
                return errorResponse('Server error: Failed to hash password', 500);
            }
            
            $stmt = $db->prepare("
                INSERT INTO users (email, password_hash, name, role, is_active, is_verified, created_at)
                VALUES (?, ?, ?, ?, 1, 0, NOW())
            ");
            $stmt->execute([$email, $passwordHash, $name ?: $email, $role]);
            $userId = $db->lastInsertId();
            
            if (!$userId) {
                error_log("Failed to get last insert ID after user creation");
                return errorResponse('Server error: Failed to create user', 500);
            }
            
            // Verify JWT class exists
            if (!class_exists('JWT')) {
                error_log("JWT class not found - auth.php may not be loaded");
                return errorResponse('Server configuration error: JWT class not available', 500);
            }
            
            // Generate JWT token
            $token = JWT::encode(['user_id' => $userId, 'email' => $email]);
            if (!$token) {
                error_log("JWT token generation failed for user ID: $userId");
                return errorResponse('Server error: Failed to generate token', 500);
            }
            
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
            
        } catch (PDOException $e) {
            error_log("User registration PDO error: " . $e->getMessage());
            error_log("PDO error code: " . $e->getCode());
            error_log("PDO error info: " . json_encode($e->errorInfo ?? []));
            return errorResponse('Registration failed: Database error', 500);
        } catch (Exception $e) {
            error_log("User registration error: " . $e->getMessage());
            error_log("Error trace: " . $e->getTraceAsString());
            return errorResponse('Registration failed: ' . $e->getMessage(), 500);
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
            // Find user (include created_at for date restrictions in log viewer)
            $stmt = $db->prepare("SELECT id, email, password_hash, name, role, is_active, created_at FROM users WHERE email = ?");
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
            
            // Get user's profiles (communicators) - profiles are now the main entity
            $stmt = $db->prepare("
                SELECT id, display_name as name, description, layout_type, language, is_public, created_at
                FROM profiles 
                WHERE user_id = ?
                ORDER BY created_at DESC
            ");
            $stmt->execute([$user['id']]);
            $profiles = $stmt->fetchAll();
            
            // If user has no profiles, create one from default Cboard
            if (count($profiles) === 0) {
                error_log("User login - No profiles found for user {$user['id']}, creating default Cboard profile");
                
                try {
                    // Load default Cboard from boards.json
                    $boardsJsonPath = __DIR__ . '/../../src/api/boards.json';
                    if (file_exists($boardsJsonPath)) {
                        $boardsData = json_decode(file_get_contents($boardsJsonPath), true);
                        if ($boardsData && isset($boardsData['advanced']) && is_array($boardsData['advanced']) && count($boardsData['advanced']) > 0) {
                            $rootBoard = $boardsData['advanced'][0];
                            $rootBoardName = $rootBoard['name'] ?? 'Cboard Classic Home';
                            $rootBoardLayoutRows = $rootBoard['grid']['rows'] ?? 4;
                            $rootBoardLayoutCols = $rootBoard['grid']['columns'] ?? 6;
                            $layoutType = "{$rootBoardLayoutRows}x{$rootBoardLayoutCols}";
                            $language = $rootBoard['language'] ?? 'en';
                            $description = $rootBoard['description'] ?? 'Default Cboard profile';
                            
                            // Create profile
                            $stmt = $db->prepare("
                                INSERT INTO profiles (user_id, display_name, description, layout_type, language, is_public, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())
                            ");
                            $stmt->execute([
                                $user['id'],
                                $rootBoardName,
                                $description,
                                $layoutType,
                                $language
                            ]);
                            $newProfileId = $db->lastInsertId();
                            
                            // Create cards and profile_cards from root board tiles
                            $tiles = $rootBoard['tiles'] ?? [];
                            $maxCols = $rootBoardLayoutCols;
                            $index = 0;
                            
                            foreach ($tiles as $tile) {
                                if (!is_array($tile)) {
                                    continue;
                                }
                                
                                // Extract tile data
                                $loadBoard = isset($tile['loadBoard']) && $tile['loadBoard'] !== '' ? $tile['loadBoard'] : null;
                                $labelKey = $tile['labelKey'] ?? null;
                                $label = $tile['label'] ?? null;
                                $title = $label ?: $labelKey ?: 'Untitled';
                                $labelText = $label ?: $labelKey ?: 'Untitled';
                                
                                // For folder tiles, store loadBoard in label_text as JSON
                                if ($loadBoard !== null) {
                                    $labelText = json_encode(['loadBoard' => $loadBoard]);
                                }
                                
                                $image = $tile['image'] ?? null;
                                $audio = $tile['sound'] ?? null;
                                $textColor = $tile['textColor'] ?? $tile['text_color'] ?? null;
                                $backgroundColor = $tile['backgroundColor'] ?? $tile['background_color'] ?? null;
                                
                                // Calculate position
                                $rowIndex = intdiv($index, $maxCols);
                                $colIndex = $index % $maxCols;
                                $pageIndex = 0;
                                
                                // Create card
                                $stmt = $db->prepare("
                                    INSERT INTO cards (title, label_text, image_path, audio_path, text_color, background_color, category, created_at, updated_at)
                                    VALUES (?, ?, ?, ?, ?, ?, 'general', NOW(), NOW())
                                ");
                                $stmt->execute([
                                    $title,
                                    $labelText,
                                    $image,
                                    $audio,
                                    $textColor,
                                    $backgroundColor
                                ]);
                                $cardId = $db->lastInsertId();
                                
                                // Link card to profile
                                $stmt = $db->prepare("
                                    INSERT INTO profile_cards (profile_id, card_id, row_index, col_index, page_index, is_visible, created_at, updated_at)
                                    VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
                                ");
                                $stmt->execute([
                                    $newProfileId,
                                    $cardId,
                                    $rowIndex,
                                    $colIndex,
                                    $pageIndex
                                ]);
                                
                                $index++;
                            }
                            
                            // Reload profiles
                            $stmt = $db->prepare("
                                SELECT id, display_name as name, description, layout_type, language, is_public, created_at
                                FROM profiles 
                                WHERE user_id = ?
                                ORDER BY created_at DESC
                            ");
                            $stmt->execute([$user['id']]);
                            $profiles = $stmt->fetchAll();
                            
                            error_log("User login - Created default Cboard profile (ID: {$newProfileId}) for user {$user['id']}");
                        } else {
                            error_log("User login - Invalid boards.json format, cannot create default profile");
                        }
                    } else {
                        error_log("User login - boards.json not found, cannot create default profile");
                    }
                } catch (Exception $e) {
                    error_log("User login - Error creating default profile: " . $e->getMessage());
                    // Continue with empty profiles - user can create manually
                }
            }
            
            // For backward compatibility, also return profiles as "boards" (profiles = boards)
            $boards = [];
            foreach ($profiles as $profile) {
                $boards[] = [
                    'id' => $profile['id'],
                    'board_id' => $profile['id'], // Use profile id as board_id
                    'name' => $profile['name'],
                    'description' => $profile['description'] ?? '',
                    'is_public' => (bool)($profile['is_public'] ?? false)
                ];
            }
            
            error_log("User login - Found " . count($profiles) . " profiles for user {$user['id']}");
            
            // Get user settings
            $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $settingsRow = $stmt->fetch();
            $settings = $settingsRow ? json_decode($settingsRow['settings_data'], true) : [];
            
            // Return response in format expected by frontend
            // Frontend expects: {id (as string), email, name, role, authToken, communicators, boards, settings, isFirstLogin, createdAt}
            return successResponse([
                'id' => (string)$user['id'], // Convert to string - frontend expects string for userId
                'email' => $user['email'],
                'name' => $user['name'] ?: $user['email'],
                'role' => $user['role'] ?? 'student', // Include role for admin panel access
                'authToken' => $token,
                'createdAt' => $user['created_at'], // Include user creation date for log viewer date restrictions
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
            
            // Get profiles (profiles = boards in the new architecture)
            $stmt = $db->prepare("SELECT id, display_name as name, description, layout_type, language, is_public FROM profiles WHERE user_id = ?");
            $stmt->execute([$userId]);
            $profiles = $stmt->fetchAll();
            
            // For backward compatibility, also return profiles as "boards"
            $boards = [];
            foreach ($profiles as $profile) {
                $boards[] = [
                    'id' => $profile['id'],
                    'board_id' => $profile['id'], // Use profile id as board_id
                    'name' => $profile['name'],
                    'description' => $profile['description'] ?? ''
                ];
            }
            
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
