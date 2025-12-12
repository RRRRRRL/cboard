<?php
/**
 * Devices Routes Handler
 * Sprint 6: External Switch + Eye Tracking
 * Handles device registration, configuration, and management
 */

require_once __DIR__ . '/../auth.php';

function handleDevicesRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }
    
    // GET /devices/list (get all registered devices for user)
    if ($method === 'GET' && count($pathParts) >= 2 && isset($pathParts[1]) && $pathParts[1] === 'list') {
        $user = requireAuth($authToken);
        
        try {
            // Get device settings from user settings
            $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $settingsRow = $stmt->fetch();
            
            $devices = [
                'switches' => [],
                'eye_tracking' => []
            ];
            
            if ($settingsRow && $settingsRow['settings_data']) {
                $allSettings = json_decode($settingsRow['settings_data'], true);
                
                // Extract switch devices
                if (isset($allSettings['accessibility']['switch'])) {
                    $switchConfig = $allSettings['accessibility']['switch'];
                    if (isset($switchConfig['devices']) && is_array($switchConfig['devices'])) {
                        $devices['switches'] = $switchConfig['devices'];
                    } elseif ($switchConfig['type'] || $switchConfig['device_id']) {
                        // Single device format
                        $devices['switches'] = [$switchConfig];
                    }
                }
                
                // Extract eye-tracking devices
                if (isset($allSettings['accessibility']['eye_tracking'])) {
                    $eyeTrackingConfig = $allSettings['accessibility']['eye_tracking'];
                    if (isset($eyeTrackingConfig['devices']) && is_array($eyeTrackingConfig['devices'])) {
                        $devices['eye_tracking'] = $eyeTrackingConfig['devices'];
                    } elseif ($eyeTrackingConfig['enabled'] || $eyeTrackingConfig['device']) {
                        // Single device format
                        $devices['eye_tracking'] = [$eyeTrackingConfig];
                    }
                }
            }
            
            return successResponse([
                'devices' => $devices,
                'total_switches' => count($devices['switches']),
                'total_eye_tracking' => count($devices['eye_tracking'])
            ]);
            
        } catch (Exception $e) {
            error_log("Get devices list error: " . $e->getMessage());
            return errorResponse('Failed to fetch devices', 500);
        }
    }
    
    // POST /devices/switch/register (register a switch device)
    if ($method === 'POST' && count($pathParts) >= 3 && isset($pathParts[1]) && $pathParts[1] === 'switch' && isset($pathParts[2]) && $pathParts[2] === 'register') {
        $user = requireAuth($authToken);
        
        $deviceType = $data['type'] ?? null; // 'wired', 'wireless', 'bluetooth'
        $deviceId = $data['device_id'] ?? null;
        $deviceName = $data['device_name'] ?? '';
        $connectionType = $data['connection_type'] ?? null; // 'usb', 'serial', 'bluetooth', 'wifi'
        $deviceInfo = $data['device_info'] ?? []; // Additional device metadata
        
        if (!$deviceType) {
            return errorResponse('device type is required (wired, wireless, or bluetooth)', 400);
        }
        
        $validTypes = ['wired', 'wireless', 'bluetooth'];
        if (!in_array($deviceType, $validTypes)) {
            return errorResponse('Invalid device type. Must be: ' . implode(', ', $validTypes), 400);
        }
        
        try {
            // Get existing settings
            $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $settingsRow = $stmt->fetch();
            
            $allSettings = $settingsRow && $settingsRow['settings_data'] 
                ? json_decode($settingsRow['settings_data'], true) 
                : [];
            
            // Initialize accessibility settings if not exists
            if (!isset($allSettings['accessibility'])) {
                $allSettings['accessibility'] = [];
            }
            
            // Initialize switch settings
            if (!isset($allSettings['accessibility']['switch'])) {
                $allSettings['accessibility']['switch'] = [
                    'type' => null,
                    'device_id' => null,
                    'devices' => []
                ];
            }
            
            // Create device entry
            $device = [
                'id' => $deviceId ?: uniqid('switch_', true),
                'type' => $deviceType,
                'name' => $deviceName ?: ucfirst($deviceType) . ' Switch',
                'connection_type' => $connectionType,
                'device_info' => $deviceInfo,
                'registered_at' => date('Y-m-d H:i:s'),
                'is_active' => true
            ];
            
            // Add to devices array
            if (!isset($allSettings['accessibility']['switch']['devices'])) {
                $allSettings['accessibility']['switch']['devices'] = [];
            }
            
            // Check if device already exists
            $deviceExists = false;
            foreach ($allSettings['accessibility']['switch']['devices'] as &$existingDevice) {
                if ($existingDevice['id'] === $device['id']) {
                    // Update existing device
                    $existingDevice = array_merge($existingDevice, $device);
                    $deviceExists = true;
                    break;
                }
            }
            
            if (!$deviceExists) {
                $allSettings['accessibility']['switch']['devices'][] = $device;
            }
            
            // Set as active device if it's the first one
            if (!$allSettings['accessibility']['switch']['type']) {
                $allSettings['accessibility']['switch']['type'] = $deviceType;
                $allSettings['accessibility']['switch']['device_id'] = $device['id'];
            }
            
            // Save settings
            $settingsData = json_encode($allSettings);
            $stmt = $db->prepare("
                INSERT INTO settings (user_id, settings_data, created_at, updated_at)
                VALUES (?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE settings_data = ?, updated_at = NOW()
            ");
            $stmt->execute([$user['id'], $settingsData, $settingsData]);
            
            // Log device registration
            $metadata = json_encode([
                'device_type' => $deviceType,
                'device_id' => $device['id'],
                'connection_type' => $connectionType
            ]);
            
            $stmt = $db->prepare("
                INSERT INTO action_logs (user_id, profile_id, board_id, card_id, action_type, metadata, created_at)
                VALUES (?, ?, ?, ?, 'device_register', ?, NOW())
            ");
            $stmt->execute([$user['id'], null, null, null, $metadata]);
            
            return successResponse([
                'success' => true,
                'message' => 'Switch device registered',
                'device' => $device
            ], 201);
            
        } catch (Exception $e) {
            error_log("Register switch device error: " . $e->getMessage());
            return errorResponse('Failed to register switch device: ' . $e->getMessage(), 500);
        }
    }
    
    // POST /devices/eyetracking/register (register an eye-tracking device)
    if ($method === 'POST' && count($pathParts) >= 3 && isset($pathParts[1]) && $pathParts[1] === 'eyetracking' && isset($pathParts[2]) && $pathParts[2] === 'register') {
        $user = requireAuth($authToken);
        
        $deviceId = $data['device_id'] ?? null;
        $deviceName = $data['device_name'] ?? '';
        $deviceType = $data['device_type'] ?? null; // 'tobii', 'eyetribe', 'pupil', 'custom'
        $sdkVersion = $data['sdk_version'] ?? null;
        $calibrationData = $data['calibration_data'] ?? null;
        $deviceInfo = $data['device_info'] ?? [];
        
        if (!$deviceType) {
            return errorResponse('device_type is required', 400);
        }
        
        try {
            // Get existing settings
            $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $settingsRow = $stmt->fetch();
            
            $allSettings = $settingsRow && $settingsRow['settings_data'] 
                ? json_decode($settingsRow['settings_data'], true) 
                : [];
            
            // Initialize accessibility settings if not exists
            if (!isset($allSettings['accessibility'])) {
                $allSettings['accessibility'] = [];
            }
            
            // Initialize eye-tracking settings
            if (!isset($allSettings['accessibility']['eye_tracking'])) {
                $allSettings['accessibility']['eye_tracking'] = [
                    'enabled' => false,
                    'device' => null,
                    'devices' => []
                ];
            }
            
            // Create device entry
            $device = [
                'id' => $deviceId ?: uniqid('eyetrack_', true),
                'type' => $deviceType,
                'name' => $deviceName ?: ucfirst($deviceType) . ' Eye Tracker',
                'sdk_version' => $sdkVersion,
                'calibration_data' => $calibrationData,
                'device_info' => $deviceInfo,
                'registered_at' => date('Y-m-d H:i:s'),
                'is_active' => true
            ];
            
            // Add to devices array
            if (!isset($allSettings['accessibility']['eye_tracking']['devices'])) {
                $allSettings['accessibility']['eye_tracking']['devices'] = [];
            }
            
            // Check if device already exists
            $deviceExists = false;
            foreach ($allSettings['accessibility']['eye_tracking']['devices'] as &$existingDevice) {
                if ($existingDevice['id'] === $device['id']) {
                    // Update existing device
                    $existingDevice = array_merge($existingDevice, $device);
                    $deviceExists = true;
                    break;
                }
            }
            
            if (!$deviceExists) {
                $allSettings['accessibility']['eye_tracking']['devices'][] = $device;
            }
            
            // Set as active device
            $allSettings['accessibility']['eye_tracking']['enabled'] = true;
            $allSettings['accessibility']['eye_tracking']['device'] = $device['id'];
            
            // Save settings
            $settingsData = json_encode($allSettings);
            $stmt = $db->prepare("
                INSERT INTO settings (user_id, settings_data, created_at, updated_at)
                VALUES (?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE settings_data = ?, updated_at = NOW()
            ");
            $stmt->execute([$user['id'], $settingsData, $settingsData]);
            
            // Log device registration
            $metadata = json_encode([
                'device_type' => $deviceType,
                'device_id' => $device['id'],
                'sdk_version' => $sdkVersion
            ]);
            
            $stmt = $db->prepare("
                INSERT INTO action_logs (user_id, profile_id, board_id, card_id, action_type, metadata, created_at)
                VALUES (?, ?, ?, ?, 'device_register', ?, NOW())
            ");
            $stmt->execute([$user['id'], null, null, null, $metadata]);
            
            return successResponse([
                'success' => true,
                'message' => 'Eye-tracking device registered',
                'device' => $device
            ], 201);
            
        } catch (Exception $e) {
            error_log("Register eye-tracking device error: " . $e->getMessage());
            return errorResponse('Failed to register eye-tracking device: ' . $e->getMessage(), 500);
        }
    }
    
    // POST /devices/switch/activate (activate a specific switch device)
    if ($method === 'POST' && count($pathParts) >= 3 && isset($pathParts[1]) && $pathParts[1] === 'switch' && isset($pathParts[2]) && $pathParts[2] === 'activate') {
        $user = requireAuth($authToken);
        
        $deviceId = $data['device_id'] ?? null;
        
        if (!$deviceId) {
            return errorResponse('device_id is required', 400);
        }
        
        try {
            // Get existing settings
            $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $settingsRow = $stmt->fetch();
            
            if (!$settingsRow || !$settingsRow['settings_data']) {
                return errorResponse('No devices registered', 404);
            }
            
            $allSettings = json_decode($settingsRow['settings_data'], true);
            
            if (!isset($allSettings['accessibility']['switch']['devices'])) {
                return errorResponse('No switch devices found', 404);
            }
            
            // Find and activate device
            $deviceFound = false;
            foreach ($allSettings['accessibility']['switch']['devices'] as &$device) {
                if ($device['id'] === $deviceId) {
                    $device['is_active'] = true;
                    $allSettings['accessibility']['switch']['type'] = $device['type'];
                    $allSettings['accessibility']['switch']['device_id'] = $deviceId;
                    $deviceFound = true;
                } else {
                    $device['is_active'] = false;
                }
            }
            
            if (!$deviceFound) {
                return errorResponse('Device not found', 404);
            }
            
            // Save settings
            $settingsData = json_encode($allSettings);
            $stmt = $db->prepare("
                UPDATE settings SET settings_data = ?, updated_at = NOW() WHERE user_id = ?
            ");
            $stmt->execute([$settingsData, $user['id']]);
            
            return successResponse([
                'success' => true,
                'message' => 'Switch device activated',
                'device_id' => $deviceId
            ]);
            
        } catch (Exception $e) {
            error_log("Activate switch device error: " . $e->getMessage());
            return errorResponse('Failed to activate switch device', 500);
        }
    }
    
    // POST /devices/switch/longpress (handle long-press event for operation button scanning)
    if ($method === 'POST' && count($pathParts) >= 3 && isset($pathParts[1]) && $pathParts[1] === 'switch' && isset($pathParts[2]) && $pathParts[2] === 'longpress') {
        $user = verifyAuth($authToken); // Optional
        
        $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : null;
        $duration = isset($data['duration']) ? (float)$data['duration'] : 0; // Press duration in seconds
        $action = $data['action'] ?? 'operation_scan'; // 'operation_scan', 'select', 'cancel'
        
        try {
            // Log long-press event
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
                'action' => $action,
                'duration' => $duration,
                'profile_id' => $profileId,
                'device_type' => 'switch',
                'event_type' => 'long_press'
            ]);
            
            $stmt = $db->prepare("
                INSERT INTO action_logs (user_id, profile_id, board_id, card_id, action_type, metadata, created_at)
                VALUES (?, ?, ?, ?, 'switch_longpress', ?, NOW())
            ");
            $stmt->execute([$userId, $profileId, null, null, $metadata]);
            
            // Determine response based on action
            $response = [
                'success' => true,
                'action' => $action,
                'duration' => $duration
            ];
            
            if ($action === 'operation_scan') {
                $response['message'] = 'Operation button scanning activated';
                $response['scanning_mode'] = 'operation';
            } elseif ($action === 'select') {
                $response['message'] = 'Item selected via long-press';
            } else {
                $response['message'] = 'Long-press event logged';
            }
            
            return successResponse($response);
            
        } catch (Exception $e) {
            error_log("Switch long-press error: " . $e->getMessage());
            return errorResponse('Failed to process long-press event', 500);
        }
    }
    
    // POST /devices/eyetracking/calibrate (calibrate eye-tracking device)
    if ($method === 'POST' && count($pathParts) >= 3 && isset($pathParts[1]) && $pathParts[1] === 'eyetracking' && isset($pathParts[2]) && $pathParts[2] === 'calibrate') {
        $user = requireAuth($authToken);
        
        $deviceId = $data['device_id'] ?? null;
        $calibrationData = $data['calibration_data'] ?? null;
        $calibrationPoints = $data['calibration_points'] ?? [];
        
        if (!$deviceId) {
            return errorResponse('device_id is required', 400);
        }
        
        try {
            // Get existing settings
            $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $settingsRow = $stmt->fetch();
            
            if (!$settingsRow || !$settingsRow['settings_data']) {
                return errorResponse('No devices registered', 404);
            }
            
            $allSettings = json_decode($settingsRow['settings_data'], true);
            
            if (!isset($allSettings['accessibility']['eye_tracking']['devices'])) {
                return errorResponse('No eye-tracking devices found', 404);
            }
            
            // Find and update device calibration
            $deviceFound = false;
            foreach ($allSettings['accessibility']['eye_tracking']['devices'] as &$device) {
                if ($device['id'] === $deviceId) {
                    $device['calibration_data'] = $calibrationData;
                    $device['calibration_points'] = $calibrationPoints;
                    $device['calibrated_at'] = date('Y-m-d H:i:s');
                    $deviceFound = true;
                    break;
                }
            }
            
            if (!$deviceFound) {
                return errorResponse('Device not found', 404);
            }
            
            // Save settings
            $settingsData = json_encode($allSettings);
            $stmt = $db->prepare("
                UPDATE settings SET settings_data = ?, updated_at = NOW() WHERE user_id = ?
            ");
            $stmt->execute([$settingsData, $user['id']]);
            
            // Log calibration
            $metadata = json_encode([
                'device_id' => $deviceId,
                'calibration_points_count' => count($calibrationPoints)
            ]);
            
            $stmt = $db->prepare("
                INSERT INTO action_logs (user_id, profile_id, board_id, card_id, action_type, metadata, created_at)
                VALUES (?, ?, ?, ?, 'eyetracking_calibrate', ?, NOW())
            ");
            $stmt->execute([$user['id'], null, null, null, $metadata]);
            
            return successResponse([
                'success' => true,
                'message' => 'Eye-tracking device calibrated',
                'device_id' => $deviceId
            ]);
            
        } catch (Exception $e) {
            error_log("Calibrate eye-tracking device error: " . $e->getMessage());
            return errorResponse('Failed to calibrate eye-tracking device', 500);
        }
    }
    
    // POST /devices/eyetracking/select (select card via eye-tracking)
    if ($method === 'POST' && count($pathParts) >= 3 && isset($pathParts[1]) && $pathParts[1] === 'eyetracking' && isset($pathParts[2]) && $pathParts[2] === 'select') {
        $user = verifyAuth($authToken); // Optional
        
        $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : null;
        $cardId = isset($data['card_id']) ? (int)$data['card_id'] : null;
        $gazeX = isset($data['gaze_x']) ? (float)$data['gaze_x'] : null;
        $gazeY = isset($data['gaze_y']) ? (float)$data['gaze_y'] : null;
        $dwellTime = isset($data['dwell_time']) ? (float)$data['dwell_time'] : null; // Time in seconds
        
        try {
            // Log eye-tracking selection
            $userId = $user ? $user['id'] : null;
            
            // Verify profile_id exists if provided
            if ($profileId) {
                $checkStmt = $db->prepare("SELECT id FROM profiles WHERE id = ?");
                $checkStmt->execute([$profileId]);
                if (!$checkStmt->fetch()) {
                    $profileId = null; // Set to null if doesn't exist
                }
            }
            
            // Verify card_id exists if provided
            if ($cardId) {
                $checkStmt = $db->prepare("SELECT id FROM cards WHERE id = ?");
                $checkStmt->execute([$cardId]);
                if (!$checkStmt->fetch()) {
                    $cardId = null; // Set to null if doesn't exist
                }
            }
            
            $metadata = json_encode([
                'card_id' => $cardId,
                'gaze_x' => $gazeX,
                'gaze_y' => $gazeY,
                'dwell_time' => $dwellTime,
                'profile_id' => $profileId,
                'device_type' => 'eye_tracking',
                'selection_method' => 'gaze'
            ]);
            
            $stmt = $db->prepare("
                INSERT INTO action_logs (user_id, profile_id, board_id, card_id, action_type, metadata, created_at)
                VALUES (?, ?, ?, ?, 'eyetracking_select', ?, NOW())
            ");
            $stmt->execute([$userId, $profileId, null, $cardId, $metadata]);
            
            return successResponse([
                'success' => true,
                'message' => 'Card selected via eye-tracking',
                'card_id' => $cardId,
                'gaze_position' => [
                    'x' => $gazeX,
                    'y' => $gazeY
                ],
                'dwell_time' => $dwellTime
            ]);
            
        } catch (Exception $e) {
            error_log("Eye-tracking select error: " . $e->getMessage());
            return errorResponse('Failed to log eye-tracking selection', 500);
        }
    }
    
    return errorResponse('Devices route not found', 404);
}

