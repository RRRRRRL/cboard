<?php
/**
 * Scanning Engine Routes Handler
 * Sprint 5: Accessibility - Scanning Engine
 * Handles scanning operations, state, and navigation
 */

require_once __DIR__ . '/../auth.php';

function handleScanningRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }
    
    // Debug: Log route matching (remove in production)
    error_log("Scanning route - Method: $method, PathParts: " . json_encode($pathParts) . ", Count: " . count($pathParts) . ", pathParts[1]: " . ($pathParts[1] ?? 'NOT SET'));
    
    // Ensure pathParts is an array and has at least 2 elements
    if (!is_array($pathParts) || count($pathParts) < 2) {
        error_log("Scanning route - Invalid pathParts: " . json_encode($pathParts));
        return errorResponse('Invalid scanning route path', 400);
    }
    
    // GET /scanning/state (get current scanning state)
    if ($method === 'GET' && isset($pathParts[1]) && $pathParts[1] === 'state') {
        $user = verifyAuth($authToken); // Optional auth for scanning state
        
        try {
            if ($user) {
                // Get user's scanning settings
                $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
                $stmt->execute([$user['id']]);
                $settingsRow = $stmt->fetch();
                
                if ($settingsRow && $settingsRow['settings_data']) {
                    $allSettings = json_decode($settingsRow['settings_data'], true);
                    $scanning = $allSettings['accessibility']['scanning'] ?? [
                        'enabled' => false,
                        'mode' => 'single',
                        'speed' => 2.0,
                        'loop' => 'finite',
                        'loop_count' => 3
                    ];
                } else {
                    $scanning = [
                        'enabled' => false,
                        'mode' => 'single',
                        'speed' => 2.0,
                        'loop' => 'finite',
                        'loop_count' => 3
                    ];
                }
            } else {
                // Return default for anonymous users
                $scanning = [
                    'enabled' => false,
                    'mode' => 'single',
                    'speed' => 2.0,
                    'loop' => 'finite',
                    'loop_count' => 3
                ];
            }
            
            return successResponse([
                'scanning' => $scanning,
                'available_modes' => ['single', 'row', 'column', 'operation'],
                'speed_range' => ['min' => 0.5, 'max' => 10.0, 'increment' => 0.5],
                'loop_options' => ['finite', 'infinite']
            ]);
            
        } catch (Exception $e) {
            error_log("Get scanning state error: " . $e->getMessage());
            return errorResponse('Failed to fetch scanning state', 500);
        }
    }
    
    // POST /scanning/start (start scanning session)
    // GET /scanning/start (get current scanning status)
    if (isset($pathParts[1]) && $pathParts[1] === 'start') {
        if ($method === 'POST') {
            $user = verifyAuth($authToken); // Optional
        
        $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : null;
        $boardId = isset($data['board_id']) ? (int)$data['board_id'] : null;
        $mode = $data['mode'] ?? 'single';
        $speed = isset($data['speed']) ? (float)$data['speed'] : 2.0;
        
        // Validate mode
        $validModes = ['single', 'row', 'column', 'operation'];
        if (!in_array($mode, $validModes)) {
            return errorResponse('Invalid scanning mode', 400);
        }
        
        // Validate speed
        $speed = max(0.5, min(10.0, round($speed * 2) / 2));
        
        try {
            // Log scanning start (profile_id and board_id can be null if they don't exist)
            $userId = $user ? $user['id'] : null;
            $metadata = json_encode([
                'scanning_mode' => $mode,
                'scanning_speed' => $speed,
                'profile_id' => $profileId,
                'board_id' => $boardId
            ]);
            
            // Verify profile_id exists if provided
            if ($profileId) {
                $checkStmt = $db->prepare("SELECT id FROM profiles WHERE id = ?");
                $checkStmt->execute([$profileId]);
                if (!$checkStmt->fetch()) {
                    $profileId = null; // Set to null if doesn't exist
                }
            }
            
            // Verify board_id exists if provided
            if ($boardId) {
                $checkStmt = $db->prepare("SELECT id FROM boards WHERE id = ?");
                $checkStmt->execute([$boardId]);
                if (!$checkStmt->fetch()) {
                    $boardId = null; // Set to null if doesn't exist
                }
            }
            
            // Insert action log (foreign keys can be null)
            $stmt = $db->prepare("
                INSERT INTO action_logs (user_id, profile_id, board_id, card_id, action_type, metadata, created_at)
                VALUES (?, ?, ?, ?, 'scan_start', ?, NOW())
            ");
            $stmt->execute([$userId, $profileId, $boardId, null, $metadata]);
            
            return successResponse([
                'success' => true,
                'message' => 'Scanning started',
                'mode' => $mode,
                'speed' => $speed
            ]);
            
        } catch (Exception $e) {
            error_log("Start scanning error: " . $e->getMessage());
            return errorResponse('Failed to start scanning: ' . $e->getMessage(), 500);
        }
        } elseif ($method === 'GET') {
            // GET /scanning/start - Return current scanning status
            $user = verifyAuth($authToken); // Optional
            
            try {
                if ($user) {
                    $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
                    $stmt->execute([$user['id']]);
                    $settingsRow = $stmt->fetch();
                    
                    if ($settingsRow && $settingsRow['settings_data']) {
                        $allSettings = json_decode($settingsRow['settings_data'], true);
                        $scanning = $allSettings['accessibility']['scanning'] ?? [
                            'enabled' => false,
                            'mode' => 'single',
                            'speed' => 2.0,
                            'loop' => 'finite',
                            'loop_count' => 3
                        ];
                    } else {
                        $scanning = [
                            'enabled' => false,
                            'mode' => 'single',
                            'speed' => 2.0,
                            'loop' => 'finite',
                            'loop_count' => 3
                        ];
                    }
                } else {
                    $scanning = [
                        'enabled' => false,
                        'mode' => 'single',
                        'speed' => 2.0,
                        'loop' => 'finite',
                        'loop_count' => 3
                    ];
                }
                
                return successResponse([
                    'scanning' => $scanning,
                    'message' => 'Use POST to start scanning session'
                ]);
                
            } catch (Exception $e) {
                error_log("Get scanning start status error: " . $e->getMessage());
                return errorResponse('Failed to get scanning status', 500);
            }
        } else {
            return errorResponse('Method not allowed. Use POST to start scanning or GET to check status.', 405);
        }
    }
    
    // POST /scanning/stop (stop scanning session)
    if ($method === 'POST' && isset($pathParts[1]) && $pathParts[1] === 'stop') {
        $user = verifyAuth($authToken); // Optional
        
        $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : null;
        
        try {
            // Log scanning stop
            $userId = $user ? $user['id'] : null;
            
            // Verify profile_id exists if provided
            if ($profileId) {
                $checkStmt = $db->prepare("SELECT id FROM profiles WHERE id = ?");
                $checkStmt->execute([$profileId]);
                if (!$checkStmt->fetch()) {
                    $profileId = null; // Set to null if doesn't exist
                }
            }
            
            $metadata = json_encode([
                'profile_id' => $profileId
            ]);
            
            $stmt = $db->prepare("
                INSERT INTO action_logs (user_id, profile_id, board_id, card_id, action_type, metadata, created_at)
                VALUES (?, ?, ?, ?, 'scan_stop', ?, NOW())
            ");
            $stmt->execute([$userId, $profileId, null, null, $metadata]);
            
            return successResponse([
                'success' => true,
                'message' => 'Scanning stopped'
            ]);
            
        } catch (Exception $e) {
            error_log("Stop scanning error: " . $e->getMessage());
            return errorResponse('Failed to stop scanning', 500);
        }
    }
    
    // POST /scanning/select (select item during scanning)
    if ($method === 'POST' && isset($pathParts[1]) && $pathParts[1] === 'select') {
        $user = verifyAuth($authToken); // Optional
        
        $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : null;
        $boardId = isset($data['board_id']) ? (int)$data['board_id'] : null;
        $cardId = isset($data['card_id']) ? (int)$data['card_id'] : null;
        $rowIndex = isset($data['row_index']) ? (int)$data['row_index'] : null;
        $colIndex = isset($data['col_index']) ? (int)$data['col_index'] : null;
        $pageIndex = isset($data['page_index']) ? (int)$data['page_index'] : null;
        
        try {
            // Log selection
            $userId = $user ? $user['id'] : null;
            
            // Verify profile_id exists if provided
            if ($profileId) {
                $checkStmt = $db->prepare("SELECT id FROM profiles WHERE id = ?");
                $checkStmt->execute([$profileId]);
                if (!$checkStmt->fetch()) {
                    $profileId = null;
                }
            }
            
            // Verify board_id exists if provided
            if ($boardId) {
                $checkStmt = $db->prepare("SELECT id FROM boards WHERE id = ?");
                $checkStmt->execute([$boardId]);
                if (!$checkStmt->fetch()) {
                    $boardId = null;
                }
            }
            
            $metadata = json_encode([
                'row_index' => $rowIndex,
                'col_index' => $colIndex,
                'page_index' => $pageIndex,
                'profile_id' => $profileId,
                'board_id' => $boardId
            ]);
            
            $stmt = $db->prepare("
                INSERT INTO action_logs (user_id, profile_id, board_id, card_id, action_type, metadata, created_at)
                VALUES (?, ?, ?, ?, 'scan_select', ?, NOW())
            ");
            $stmt->execute([$userId, $profileId, $boardId, $cardId, $metadata]);
            
            return successResponse([
                'success' => true,
                'message' => 'Item selected',
                'card_id' => $cardId,
                'position' => [
                    'row' => $rowIndex,
                    'col' => $colIndex,
                    'page' => $pageIndex
                ]
            ]);
            
        } catch (Exception $e) {
            error_log("Scanning select error: " . $e->getMessage());
            return errorResponse('Failed to log selection', 500);
        }
    }
    
    // GET /scanning/navigation (get navigation options for scanning)
    if ($method === 'GET' && isset($pathParts[1]) && $pathParts[1] === 'navigation') {
        $profileId = isset($_GET['profile_id']) ? (int)$_GET['profile_id'] : null;
        $pageIndex = isset($_GET['page_index']) ? (int)$_GET['page_index'] : null; // Optional: filter by page
        $mode = $_GET['mode'] ?? 'single';
        
        try {
            // Get cards for the profile (board_id doesn't exist in profile_cards table)
            if ($profileId) {
                $sql = "
                    SELECT pc.id, pc.card_id, pc.row_index, pc.col_index, pc.page_index,
                           c.id as card_id_full, c.title, c.image_url, c.audio_path
                    FROM profile_cards pc
                    JOIN cards c ON pc.card_id = c.id
                    WHERE pc.profile_id = ? AND pc.is_visible = 1";
                $params = [$profileId];
                
                // Optionally filter by page_index if provided
                if ($pageIndex !== null) {
                    $sql .= " AND pc.page_index = ?";
                    $params[] = $pageIndex;
                }
                
                $sql .= " ORDER BY pc.page_index, pc.row_index, pc.col_index";
                
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
                $cards = $stmt->fetchAll();
                
                // Organize by page, row, column based on mode
                $navigation = [];
                if ($mode === 'single') {
                    // Flat list of all cards
                    foreach ($cards as $card) {
                        $navigation[] = [
                            'card_id' => $card['card_id'],
                            'title' => $card['title'],
                            'image_url' => $card['image_url'],
                            'position' => [
                                'row' => (int)$card['row_index'],
                                'col' => (int)$card['col_index'],
                                'page' => (int)$card['page_index']
                            ]
                        ];
                    }
                } elseif ($mode === 'row') {
                    // Group by rows
                    $rows = [];
                    foreach ($cards as $card) {
                        $page = (int)$card['page_index'];
                        $row = (int)$card['row_index'];
                        if (!isset($rows[$page])) {
                            $rows[$page] = [];
                        }
                        if (!isset($rows[$page][$row])) {
                            $rows[$page][$row] = [];
                        }
                        $rows[$page][$row][] = [
                            'card_id' => $card['card_id'],
                            'title' => $card['title'],
                            'col' => (int)$card['col_index']
                        ];
                    }
                    $navigation = $rows;
                } elseif ($mode === 'column') {
                    // Group by columns
                    $cols = [];
                    foreach ($cards as $card) {
                        $page = (int)$card['page_index'];
                        $col = (int)$card['col_index'];
                        if (!isset($cols[$page])) {
                            $cols[$page] = [];
                        }
                        if (!isset($cols[$page][$col])) {
                            $cols[$page][$col] = [];
                        }
                        $cols[$page][$col][] = [
                            'card_id' => $card['card_id'],
                            'title' => $card['title'],
                            'row' => (int)$card['row_index']
                        ];
                    }
                    $navigation = $cols;
                }
                
                return successResponse([
                    'mode' => $mode,
                    'navigation' => $navigation,
                    'total_cards' => count($cards),
                    'profile_id' => $profileId,
                    'page_index' => $pageIndex
                ]);
            } else {
                return errorResponse('profile_id is required', 400);
            }
            
        } catch (Exception $e) {
            error_log("Get scanning navigation error: " . $e->getMessage() . " | Trace: " . $e->getTraceAsString());
            return errorResponse('Failed to get navigation: ' . $e->getMessage(), 500);
        }
    }
    
    // If we get here, no route matched
    error_log("Scanning route not matched - Method: $method, PathParts: " . json_encode($pathParts) . ", pathParts[1]: " . ($pathParts[1] ?? 'NOT SET'));
    return errorResponse('Scanning route not found. Method: ' . $method . ', Path: ' . json_encode($pathParts), 404);
}

