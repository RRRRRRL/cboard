<?php
/**
 * Action Log Routes Handler
 * Sprint 4: Log card clicks, sentence composition, and communication actions
 */

require_once __DIR__ . '/../auth.php';

/**
 * Helper function to insert action log entry
 * Handles both old schema (with board_id) and new schema (without board_id)
 * In new profile model, board_id is deprecated - use profile_id instead
 */
function insertActionLog($db, $userId, $profileId, $cardId, $actionType, $metadata) {
    // Check if board_id column exists in action_logs table
    $stmt = $db->query("SHOW COLUMNS FROM action_logs LIKE 'board_id'");
    $boardIdColumnExists = $stmt->rowCount() > 0;
    
    if ($boardIdColumnExists) {
        // Old schema with board_id column - insert with board_id set to null (we use profile_id)
        $stmt = $db->prepare("
            INSERT INTO action_logs (user_id, profile_id, board_id, card_id, action_type, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([$userId, $profileId, null, $cardId, $actionType, $metadata]);
    } else {
        // New schema without board_id column - only insert profile_id
        $stmt = $db->prepare("
            INSERT INTO action_logs (user_id, profile_id, card_id, action_type, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([$userId, $profileId, $cardId, $actionType, $metadata]);
    }
    
    return $db->lastInsertId();
}

function handleActionLogRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }
    
    // POST /action-logs (create log entry)
    if ($method === 'POST' && count($pathParts) === 1) {
        // Action logs can be created by authenticated users or anonymously (for view-only mode)
        $user = null;
        if ($authToken) {
            $user = verifyAuth($authToken);
        }
        
        $userId = $user ? $user['id'] : null;
        
        // In the new profile model, board_id is actually profile_id
        // If board_id is provided but profile_id is not, use board_id as profile_id
        $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : null;
        $boardId = isset($data['board_id']) ? (int)$data['board_id'] : null;
        
        // Convert board_id to profile_id if profile_id is not set
        // This handles backward compatibility with frontend code that still sends board_id
        if (!$profileId && $boardId) {
            // Verify that board_id is actually a valid profile_id
            $checkStmt = $db->prepare("SELECT id FROM profiles WHERE id = ?");
            $checkStmt->execute([$boardId]);
            if ($checkStmt->fetch()) {
                $profileId = $boardId;
                error_log("[ACTION LOG] Converted board_id ({$boardId}) to profile_id");
            } else {
                // If board_id doesn't exist as profile, set to null
                error_log("[ACTION LOG] board_id ({$boardId}) does not exist as profile, ignoring");
                $boardId = null;
            }
        }
        
        // Extract card_id from card_xxx format if needed
        $cardId = null;
        if (isset($data['card_id'])) {
            $cardIdRaw = $data['card_id'];
            // Handle both integer and string formats (e.g., "card_123" or 123)
            if (is_string($cardIdRaw) && strpos($cardIdRaw, 'card_') === 0) {
                $cardId = (int)substr($cardIdRaw, 5);
            } else {
                $cardId = (int)$cardIdRaw;
            }
        }
        
        $actionType = $data['action_type'] ?? 'card_click';
        $metadata = isset($data['metadata']) ? json_encode($data['metadata']) : null;
        
        if (empty($actionType)) {
            return errorResponse('action_type is required', 400);
        }
        
        error_log("[ACTION LOG] Creating log entry: " . json_encode([
            'user_id' => $userId,
            'profile_id' => $profileId,
            'board_id' => $boardId,
            'card_id' => $cardId,
            'action_type' => $actionType
        ]));
        
        // Validate action types for scanning
        $scanningActions = ['scan_start', 'scan_stop', 'scan_select', 'scan_highlight', 'scan_navigate'];
        if (in_array($actionType, $scanningActions)) {
            // Ensure metadata includes scanning info
            $metadataArray = isset($data['metadata']) ? $data['metadata'] : [];
            if (!isset($metadataArray['scanning_mode'])) {
                $metadataArray['scanning_mode'] = 'single';
            }
            if (!isset($metadataArray['scanning_speed'])) {
                $metadataArray['scanning_speed'] = 2.0;
            }
            $metadata = json_encode($metadataArray);
        }
        
        // Validate action types for devices (Sprint 6)
        $deviceActions = ['device_register', 'switch_longpress', 'eyetracking_select', 'eyetracking_calibrate'];
        if (in_array($actionType, $deviceActions)) {
            // Ensure metadata includes device info
            $metadataArray = isset($data['metadata']) ? $data['metadata'] : [];
            if (!isset($metadataArray['device_type'])) {
                $metadataArray['device_type'] = 'unknown';
            }
            $metadata = json_encode($metadataArray);
        }
        
        try {
            $logId = insertActionLog($db, $userId, $profileId, $cardId, $actionType, $metadata);
            
            error_log("[ACTION LOG] Log entry created successfully: " . json_encode([
                'log_id' => $logId,
                'user_id' => $userId,
                'profile_id' => $profileId,
                'card_id' => $cardId,
                'action_type' => $actionType
            ]));
            
            return successResponse([
                'id' => (int)$logId,
                'success' => true,
                'message' => 'Action logged'
            ], 201);
            
        } catch (Exception $e) {
            error_log("[ACTION LOG] Error: " . $e->getMessage() . " | Trace: " . $e->getTraceAsString());
            return errorResponse('Failed to log action', 500);
        }
    }
    
    // GET /action-logs (get logs with filters)
    if ($method === 'GET' && count($pathParts) === 1) {
        $user = requireAuth($authToken);
        
        try {
            $profileId = $_GET['profile_id'] ?? null;
            $actionType = $_GET['action_type'] ?? null;
            $startDate = $_GET['start_date'] ?? null;
            $endDate = $_GET['end_date'] ?? null;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
            $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
            
            // Check if board_id column exists
            $stmt = $db->query("SHOW COLUMNS FROM action_logs LIKE 'board_id'");
            $boardIdColumnExists = $stmt->rowCount() > 0;
            
            if ($boardIdColumnExists) {
                $sql = "SELECT id, user_id, profile_id, board_id, card_id, action_type, metadata, created_at
                        FROM action_logs
                        WHERE user_id = ?";
            } else {
                $sql = "SELECT id, user_id, profile_id, card_id, action_type, metadata, created_at
                        FROM action_logs
                        WHERE user_id = ?";
            }
            $params = [$user['id']];
            
            if ($profileId) {
                $sql .= " AND profile_id = ?";
                $params[] = $profileId;
            }
            
            if ($actionType) {
                $sql .= " AND action_type = ?";
                $params[] = $actionType;
            }
            
            if ($startDate) {
                $sql .= " AND created_at >= ?";
                $params[] = $startDate;
            }
            
            if ($endDate) {
                $sql .= " AND created_at <= ?";
                $params[] = $endDate;
            }
            
            $sql .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $logs = $stmt->fetchAll();
            
            // Process logs: extract important info from metadata and format response
            // Metadata is still included in response, but we extract key fields for easy display
            $processedLogs = [];
            foreach ($logs as $log) {
                $metadata = null;
                if ($log['metadata']) {
                    $metadata = json_decode($log['metadata'], true);
                }
                
                // Extract important information from metadata for display
                $processedLog = [
                    'id' => (int)$log['id'],
                    'created_at' => $log['created_at'],
                    'action_type' => $log['action_type'],
                    'profile_id' => $log['profile_id'] ?? null,
                    'card_id' => $log['card_id'] ?? null,
                    'sentence' => $metadata['sentence'] ?? $metadata['text'] ?? null,
                    'device' => $metadata['device_type'] ?? $metadata['device'] ?? null,
                    'score' => isset($metadata['score']) ? (int)$metadata['score'] : null,
                    'game_type' => $metadata['game_type'] ?? $metadata['gameType'] ?? null,
                    'total_questions' => isset($metadata['total_questions']) ? (int)$metadata['total_questions'] : null,
                    'accuracy' => isset($metadata['accuracy']) ? (float)$metadata['accuracy'] : null,
                    // Profile and card specific fields - initialize as null
                    'profile_name' => null,
                    'card_title' => null,
                    'profile_created_at' => null,
                    'profile_updated_at' => null,
                    'card_created_at' => null,
                    'card_updated_at' => null,
                    'metadata' => $metadata // Keep full metadata for export/advanced use
                ];
                
                // For profile actions, get profile info from database
                if ($log['profile_id'] && in_array($log['action_type'], ['profile_create', 'profile_update'])) {
                    $profileStmt = $db->prepare("SELECT display_name, created_at, updated_at FROM profiles WHERE id = ?");
                    $profileStmt->execute([$log['profile_id']]);
                    $profile = $profileStmt->fetch();
                    if ($profile) {
                        $processedLog['profile_name'] = $profile['display_name'];
                        $processedLog['profile_created_at'] = $profile['created_at'];
                        $processedLog['profile_updated_at'] = $profile['updated_at'];
                    }
                } else if ($log['profile_id']) {
                    // For other actions with profile_id, just get name
                    $profileStmt = $db->prepare("SELECT display_name FROM profiles WHERE id = ?");
                    $profileStmt->execute([$log['profile_id']]);
                    $profile = $profileStmt->fetch();
                    if ($profile) {
                        $processedLog['profile_name'] = $profile['display_name'];
                    }
                }
                
                // For card actions, get card info from database
                if ($log['card_id'] && in_array($log['action_type'], ['card_create', 'card_update'])) {
                    $cardStmt = $db->prepare("SELECT title, created_at, updated_at FROM cards WHERE id = ?");
                    $cardStmt->execute([$log['card_id']]);
                    $card = $cardStmt->fetch();
                    if ($card) {
                        $processedLog['card_title'] = $card['title'];
                        $processedLog['card_created_at'] = $card['created_at'];
                        $processedLog['card_updated_at'] = $card['updated_at'];
                    }
                } else if ($log['card_id']) {
                    // For other actions with card_id, just get title
                    $cardStmt = $db->prepare("SELECT title FROM cards WHERE id = ?");
                    $cardStmt->execute([$log['card_id']]);
                    $card = $cardStmt->fetch();
                    if ($card) {
                        $processedLog['card_title'] = $card['title'];
                    }
                }
                
                // If metadata has profile/card info but database query didn't return it, use metadata
                if (!$processedLog['profile_name'] && isset($metadata['profile_name'])) {
                    $processedLog['profile_name'] = $metadata['profile_name'];
                }
                if (!$processedLog['card_title'] && isset($metadata['card_title'])) {
                    $processedLog['card_title'] = $metadata['card_title'];
                }
                // Use metadata timestamps as fallback if database query didn't return them
                if (!$processedLog['profile_created_at'] && isset($metadata['created_at']) && in_array($log['action_type'], ['profile_create', 'profile_update'])) {
                    $processedLog['profile_created_at'] = $metadata['created_at'];
                }
                if (!$processedLog['profile_updated_at'] && isset($metadata['updated_at']) && in_array($log['action_type'], ['profile_create', 'profile_update'])) {
                    $processedLog['profile_updated_at'] = $metadata['updated_at'];
                }
                if (!$processedLog['card_created_at'] && isset($metadata['created_at']) && in_array($log['action_type'], ['card_create', 'card_update'])) {
                    $processedLog['card_created_at'] = $metadata['created_at'];
                }
                if (!$processedLog['card_updated_at'] && isset($metadata['updated_at']) && in_array($log['action_type'], ['card_create', 'card_update'])) {
                    $processedLog['card_updated_at'] = $metadata['updated_at'];
                }
                
                $processedLogs[] = $processedLog;
            }
            
            // Get total count
            $countSql = "SELECT COUNT(*) as total FROM action_logs WHERE user_id = ?";
            $countParams = [$user['id']];
            if ($profileId) {
                $countSql .= " AND profile_id = ?";
                $countParams[] = $profileId;
            }
            if ($actionType) {
                $countSql .= " AND action_type = ?";
                $countParams[] = $actionType;
            }
            $stmt = $db->prepare($countSql);
            $stmt->execute($countParams);
            $total = $stmt->fetch()['total'];
            
            return successResponse([
                'logs' => $processedLogs,
                'total' => (int)$total,
                'limit' => $limit,
                'offset' => $offset
            ]);
            
        } catch (Exception $e) {
            error_log("Get action logs error: " . $e->getMessage());
            return errorResponse('Failed to fetch action logs', 500);
        }
    }
    
    // GET /action-logs/export (export to Excel format - CSV for now)
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'export') {
        $user = requireAuth($authToken);
        
        try {
            $profileId = $_GET['profile_id'] ?? null;
            $startDate = $_GET['start_date'] ?? null;
            $endDate = $_GET['end_date'] ?? null;
            
            $sql = "SELECT al.created_at, al.action_type, 
                           p.display_name as profile_name,
                           c.title as card_title,
                           al.metadata
                    FROM action_logs al
                    LEFT JOIN profiles p ON al.profile_id = p.id
                    LEFT JOIN cards c ON al.card_id = c.id
                    WHERE al.user_id = ?";
            $params = [$user['id']];
            
            if ($profileId) {
                $sql .= " AND al.profile_id = ?";
                $params[] = $profileId;
            }
            
            if ($startDate) {
                $sql .= " AND al.created_at >= ?";
                $params[] = $startDate;
            }
            
            if ($endDate) {
                $sql .= " AND al.created_at <= ?";
                $params[] = $endDate;
            }
            
            $sql .= " ORDER BY al.created_at DESC";
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $logs = $stmt->fetchAll();
            
            // Generate CSV with important information (metadata still included in raw data)
            $csv = "Date,Time,Action Type,Sentence,Device,Score,Game Type,Metadata\n";
            foreach ($logs as $log) {
                $date = date('Y-m-d', strtotime($log['created_at']));
                $time = date('H:i:s', strtotime($log['created_at']));
                
                // Extract important info from metadata
                $metadata = $log['metadata'] ? json_decode($log['metadata'], true) : [];
                $sentence = $metadata['sentence'] ?? $metadata['text'] ?? '';
                $device = $metadata['device_type'] ?? $metadata['device'] ?? '';
                $score = '';
                if (isset($metadata['score'])) {
                    $score = isset($metadata['total_questions']) 
                        ? $metadata['score'] . '/' . $metadata['total_questions']
                        : (string)$metadata['score'];
                }
                $gameType = $metadata['game_type'] ?? $metadata['gameType'] ?? '';
                $metadataJson = $log['metadata'] ? $log['metadata'] : '';
                
                $csv .= sprintf(
                    "%s,%s,%s,%s,%s,%s,%s,%s\n",
                    $date,
                    $time,
                    $log['action_type'],
                    $sentence,
                    $device,
                    $score,
                    $gameType,
                    $metadataJson
                );
            }
            
            // Return CSV as download
            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="action_logs_' . date('Y-m-d') . '.csv"');
            echo $csv;
            exit;
            
        } catch (Exception $e) {
            error_log("Export action logs error: " . $e->getMessage());
            return errorResponse('Failed to export action logs', 500);
        }
    }
    
    return errorResponse('Action log route not found', 404);
}

