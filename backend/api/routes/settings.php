<?php
/**
 * Settings Routes Handler
 * Sprint 4: Voice settings, speech rate, accessibility settings
 */

function handleSettingsRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }
    
    $user = requireAuth($authToken);
    
    // GET /settings
    if ($method === 'GET' && count($pathParts) === 1) {
        try {
            $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $settingsRow = $stmt->fetch();
            
            if ($settingsRow && $settingsRow['settings_data']) {
                $settings = json_decode($settingsRow['settings_data'], true);
            } else {
                // Return default settings
                $settings = [
                    'speech' => [
                        'voice' => 'en-US-Neural-A',
                        'language' => 'en',
                        'rate' => 1.0,
                        'pitch' => 1.0,
                        'volume' => 1.0
                    ],
                    'accessibility' => [
                        'scanning' => [
                            'mode' => 'single',
                            'speed' => 1.0,
                            'loop' => 'finite',
                            'loop_count' => 3
                        ],
                        'audio_guide' => 'off',
                        'switch' => [
                            'type' => null,
                            'device_id' => null
                        ],
                        'eye_tracking' => [
                            'enabled' => false,
                            'device' => null
                        ]
                    ]
                ];
            }
            
            return successResponse(['settings' => $settings]);
            
        } catch (Exception $e) {
            error_log("Get settings error: " . $e->getMessage());
            return errorResponse('Failed to fetch settings', 500);
        }
    }
    
    // POST /settings (update settings)
    if ($method === 'POST' && count($pathParts) === 1) {
        try {
            // Validate and merge settings
            $settingsData = json_encode($data);
            
            // Check if settings exist
            $stmt = $db->prepare("SELECT id FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $existing = $stmt->fetch();
            
            if ($existing) {
                // Update existing
                $stmt = $db->prepare("
                    UPDATE settings 
                    SET settings_data = ?, updated_at = NOW()
                    WHERE user_id = ?
                ");
                $stmt->execute([$settingsData, $user['id']]);
            } else {
                // Create new
                $stmt = $db->prepare("
                    INSERT INTO settings (user_id, settings_data, created_at, updated_at)
                    VALUES (?, ?, NOW(), NOW())
                ");
                $stmt->execute([$user['id'], $settingsData]);
            }
            
            return successResponse([
                'success' => true,
                'message' => 'Settings updated',
                'settings' => $data
            ]);
            
        } catch (Exception $e) {
            error_log("Update settings error: " . $e->getMessage());
            return errorResponse('Failed to update settings', 500);
        }
    }
    
    // GET /settings/speech (get speech settings only)
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'speech') {
        try {
            $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $settingsRow = $stmt->fetch();
            
            if ($settingsRow && $settingsRow['settings_data']) {
                $allSettings = json_decode($settingsRow['settings_data'], true);
                $speechSettings = $allSettings['speech'] ?? [
                    'voice' => 'en-US-Neural-A',
                    'language' => 'en',
                    'rate' => 1.0,
                    'pitch' => 1.0
                ];
            } else {
                $speechSettings = [
                    'voice' => 'en-US-Neural-A',
                    'language' => 'en',
                    'rate' => 1.0,
                    'pitch' => 1.0
                ];
            }
            
            return successResponse(['speech' => $speechSettings]);
            
        } catch (Exception $e) {
            error_log("Get speech settings error: " . $e->getMessage());
            return errorResponse('Failed to fetch speech settings', 500);
        }
    }
    
    // POST /settings/speech (update speech settings only)
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'speech') {
        try {
            // Get existing settings
            $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $settingsRow = $stmt->fetch();
            
            $allSettings = $settingsRow && $settingsRow['settings_data'] 
                ? json_decode($settingsRow['settings_data'], true) 
                : [];
            
            // Update speech settings
            $allSettings['speech'] = $data;
            $settingsData = json_encode($allSettings);
            
            // Save
            $stmt = $db->prepare("
                INSERT INTO settings (user_id, settings_data, created_at, updated_at)
                VALUES (?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE settings_data = ?, updated_at = NOW()
            ");
            $stmt->execute([$user['id'], $settingsData, $settingsData]);
            
            return successResponse([
                'success' => true,
                'speech' => $data
            ]);
            
        } catch (Exception $e) {
            error_log("Update speech settings error: " . $e->getMessage());
            return errorResponse('Failed to update speech settings', 500);
        }
    }
    
    // GET /settings/accessibility (get accessibility/scanning settings)
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'accessibility') {
        try {
            $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $settingsRow = $stmt->fetch();
            
            if ($settingsRow && $settingsRow['settings_data']) {
                $allSettings = json_decode($settingsRow['settings_data'], true);
                $accessibilitySettings = $allSettings['accessibility'] ?? [
                    'scanning' => [
                        'enabled' => false,
                        'mode' => 'single',
                        'speed' => 2.0,
                        'loop' => 'finite',
                        'loop_count' => 3
                    ],
                    'audio_guide' => 'off',
                    'switch' => [
                        'type' => null,
                        'device_id' => null
                    ],
                    'eye_tracking' => [
                        'enabled' => false,
                        'device' => null
                    ]
                ];
            } else {
                $accessibilitySettings = [
                    'scanning' => [
                        'enabled' => false,
                        'mode' => 'single',
                        'speed' => 2.0,
                        'loop' => 'finite',
                        'loop_count' => 3
                    ],
                    'audio_guide' => 'off',
                    'switch' => [
                        'type' => null,
                        'device_id' => null
                    ],
                    'eye_tracking' => [
                        'enabled' => false,
                        'device' => null
                    ]
                ];
            }
            
            return successResponse(['accessibility' => $accessibilitySettings]);
            
        } catch (Exception $e) {
            error_log("Get accessibility settings error: " . $e->getMessage());
            return errorResponse('Failed to fetch accessibility settings', 500);
        }
    }
    
    // POST /settings/accessibility (update accessibility/scanning settings)
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'accessibility') {
        try {
            // Validate scanning settings if provided
            if (isset($data['scanning'])) {
                $scanning = $data['scanning'];
                
                // Validate mode
                $validModes = ['single', 'row', 'column', 'operation'];
                if (isset($scanning['mode']) && !in_array($scanning['mode'], $validModes)) {
                    return errorResponse('Invalid scanning mode. Must be: ' . implode(', ', $validModes), 400);
                }
                
                // Validate speed (0.5 to 10.0 seconds, in 0.5 increments)
                if (isset($scanning['speed'])) {
                    $speed = (float)$scanning['speed'];
                    if ($speed < 0.5 || $speed > 10.0) {
                        return errorResponse('Scanning speed must be between 0.5 and 10.0 seconds', 400);
                    }
                    // Round to nearest 0.5
                    $scanning['speed'] = round($speed * 2) / 2;
                }
                
                // Validate loop
                if (isset($scanning['loop'])) {
                    if (!in_array($scanning['loop'], ['finite', 'infinite'])) {
                        return errorResponse('Loop must be "finite" or "infinite"', 400);
                    }
                }
                
                // Validate loop_count for finite loops
                if (isset($scanning['loop']) && $scanning['loop'] === 'finite') {
                    if (isset($scanning['loop_count'])) {
                        $loopCount = (int)$scanning['loop_count'];
                        if ($loopCount < 1 || $loopCount > 100) {
                            return errorResponse('Loop count must be between 1 and 100', 400);
                        }
                    }
                }
            }
            
            // Validate audio_guide
            if (isset($data['audio_guide'])) {
                $validAudioGuides = ['off', 'beep', 'card_audio'];
                if (!in_array($data['audio_guide'], $validAudioGuides)) {
                    return errorResponse('Audio guide must be: ' . implode(', ', $validAudioGuides), 400);
                }
            }
            
            // Get existing settings
            $stmt = $db->prepare("SELECT settings_data FROM settings WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $settingsRow = $stmt->fetch();
            
            $allSettings = $settingsRow && $settingsRow['settings_data'] 
                ? json_decode($settingsRow['settings_data'], true) 
                : [];
            
            // Merge accessibility settings
            if (!isset($allSettings['accessibility'])) {
                $allSettings['accessibility'] = [];
            }
            
            // Update scanning settings
            if (isset($data['scanning'])) {
                if (!isset($allSettings['accessibility']['scanning'])) {
                    $allSettings['accessibility']['scanning'] = [];
                }
                $allSettings['accessibility']['scanning'] = array_merge(
                    $allSettings['accessibility']['scanning'],
                    $data['scanning']
                );
            }
            
            // Update other accessibility settings
            if (isset($data['audio_guide'])) {
                $allSettings['accessibility']['audio_guide'] = $data['audio_guide'];
            }
            
            if (isset($data['switch'])) {
                if (!isset($allSettings['accessibility']['switch'])) {
                    $allSettings['accessibility']['switch'] = [];
                }
                $allSettings['accessibility']['switch'] = array_merge(
                    $allSettings['accessibility']['switch'],
                    $data['switch']
                );
            }
            
            if (isset($data['eye_tracking'])) {
                if (!isset($allSettings['accessibility']['eye_tracking'])) {
                    $allSettings['accessibility']['eye_tracking'] = [];
                }
                $allSettings['accessibility']['eye_tracking'] = array_merge(
                    $allSettings['accessibility']['eye_tracking'],
                    $data['eye_tracking']
                );
            }
            
            $settingsData = json_encode($allSettings);
            
            // Save
            $stmt = $db->prepare("
                INSERT INTO settings (user_id, settings_data, created_at, updated_at)
                VALUES (?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE settings_data = ?, updated_at = NOW()
            ");
            $stmt->execute([$user['id'], $settingsData, $settingsData]);
            
            return successResponse([
                'success' => true,
                'accessibility' => $allSettings['accessibility']
            ]);
            
        } catch (Exception $e) {
            error_log("Update accessibility settings error: " . $e->getMessage());
            return errorResponse('Failed to update accessibility settings', 500);
        }
    }
    
    return errorResponse('Settings route not found', 404);
}

