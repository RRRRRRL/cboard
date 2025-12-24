<?php
/**
 * Profile Transfer Routes Handler
 * Sprint 8: Profile Transfer Engine
 * 
 * Handles:
 * - Profile export (JSON/OBF format)
 * - Profile import (backend processing)
 * - QR code generation and transfer
 * - Cloud code transfer
 * - Email ZIP transfer
 * - Transfer token validation
 */

require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers/email.php';

function handleTransferRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    
    if ($db === null) {
        error_log("Database connection failed in handleTransferRoutes");
        return errorResponse('Database connection failed. Please check server configuration.', 500);
    }
    
    // POST /transfer/export - Export profile to JSON/OBF format
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'export') {
        $user = requireAuth($authToken);
        $profileId = $data['profile_id'] ?? null;
        $format = $data['format'] ?? 'json'; // 'json' or 'obf'
        
        if (!$profileId) {
            return errorResponse('Profile ID is required', 400);
        }
        
        try {
            // Verify profile ownership
            $stmt = $db->prepare("SELECT id, display_name, description, layout_type, language, user_id FROM profiles WHERE id = ? AND user_id = ?");
            $stmt->execute([$profileId, $user['id']]);
            $profile = $stmt->fetch();
            
            if (!$profile) {
                return errorResponse('Profile not found or access denied', 404);
            }
            
            // Profile board data is now constructed from profile_cards + cards, not from boards table
            // We'll get the board data using the profile board endpoint logic
            
            // Get all cards for this profile
            $stmt = $db->prepare("
                SELECT c.id, c.title, c.label_text, c.image_path, c.audio_path, 
                       c.text_color, c.background_color, c.category,
                       pc.row_index, pc.col_index, pc.page_index, pc.is_visible
                FROM cards c
                INNER JOIN profile_cards pc ON c.id = pc.card_id
                WHERE pc.profile_id = ?
                ORDER BY pc.page_index, pc.row_index, pc.col_index
            ");
            $stmt->execute([$profileId]);
            $cards = $stmt->fetchAll();
            
            // Build tiles from cards for root_board export
            $tiles = [];
            foreach ($cards as $card) {
                $tiles[] = [
                    'id' => 'card_' . $card['id'],
                    'label' => $card['label_text'] ?: $card['title'],
                    'image' => $card['image_path'],
                    'sound' => $card['audio_path'],
                    'textColor' => $card['text_color'],
                    'backgroundColor' => $card['background_color'],
                    'category' => $card['category'],
                    'row' => (int)$card['row_index'],
                    'col' => (int)$card['col_index'],
                    'page' => (int)$card['page_index'],
                    'isVisible' => (bool)$card['is_visible']
                ];
            }
            
            // Build export data
            $exportData = [
                'version' => '1.0',
                'format' => $format,
                'exported_at' => date('Y-m-d H:i:s'),
                'profile' => [
                    'id' => $profile['id'],
                    'display_name' => $profile['display_name'],
                    'description' => $profile['description'],
                    'layout_type' => $profile['layout_type'],
                    'language' => $profile['language']
                ],
                'root_board' => [
                    'id' => (string)$profile['id'],
                    'name' => $profile['display_name'],
                    'description' => $profile['description'],
                    'is_public' => false,
                    'tiles' => $tiles
                ],
                'cards' => []
            ];
            
            // Process cards
            foreach ($cards as $card) {
                $exportData['cards'][] = [
                    'id' => $card['id'],
                    'title' => $card['title'],
                    'label_text' => $card['label_text'],
                    'image_path' => $card['image_path'],
                    'audio_path' => $card['audio_path'],
                    'text_color' => $card['text_color'],
                    'background_color' => $card['background_color'],
                    'category' => $card['category'],
                    'position' => [
                        'row' => $card['row_index'],
                        'col' => $card['col_index'],
                        'page' => $card['page_index'],
                        'visible' => (bool)$card['is_visible']
                    ]
                ];
            }
            
            // Return JSON or OBF format
            if ($format === 'obf') {
                // OBF format is essentially JSON with specific structure
                // For now, return JSON (OBF can be enhanced later)
                return successResponse([
                    'format' => 'obf',
                    'data' => $exportData,
                    'download_url' => null // Would generate download link
                ]);
            } else {
                return successResponse($exportData);
            }
            
        } catch (Exception $e) {
            error_log("Profile export error: " . $e->getMessage());
            return errorResponse('Failed to export profile', 500);
        }
    }
    
    // POST /transfer/import - Import profile from JSON/OBF format
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'import') {
        $user = requireAuth($authToken);
        $importData = $data['data'] ?? null;
        $format = $data['format'] ?? 'json';
        
        if (!$importData) {
            return errorResponse('Import data is required', 400);
        }
        
        try {
            // Parse import data
            if (is_string($importData)) {
                $importData = json_decode($importData, true);
            }
            
            if (!$importData || !isset($importData['profile'])) {
                return errorResponse('Invalid import data format', 400);
            }
            
            $profileData = $importData['profile'];
            $rootBoardData = $importData['root_board'] ?? null;
            $cardsData = $importData['cards'] ?? [];
            
            // Create new profile
            $stmt = $db->prepare("
                INSERT INTO profiles (user_id, display_name, description, layout_type, language, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([
                $user['id'],
                $profileData['display_name'] ?? 'Imported Profile',
                $profileData['description'] ?? '',
                $profileData['layout_type'] ?? '4x6',
                $profileData['language'] ?? 'en'
            ]);
            $newProfileId = $db->lastInsertId();
            
            // Import cards and link to profile (from root_board tiles if provided, or from cards array)
            $tilesToImport = [];
            if ($rootBoardData && isset($rootBoardData['tiles']) && is_array($rootBoardData['tiles'])) {
                $tilesToImport = $rootBoardData['tiles'];
            }
            
            // If we have tiles from root_board, import them as cards
            foreach ($tilesToImport as $tile) {
                if (!is_array($tile) || empty($tile)) {
                    continue;
                }
                
                // Create card from tile data
                $stmt = $db->prepare("
                    INSERT INTO cards (title, label_text, image_path, audio_path, text_color, background_color, category, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $tile['label'] ?? $tile['title'] ?? '',
                    $tile['label'] ?? $tile['title'] ?? '',
                    $tile['image'] ?? $tile['image_path'] ?? null,
                    $tile['sound'] ?? $tile['audio_path'] ?? null,
                    $tile['textColor'] ?? $tile['text_color'] ?? '#000000',
                    $tile['backgroundColor'] ?? $tile['background_color'] ?? '#FFFFFF',
                    $tile['category'] ?? null
                ]);
                $newCardId = $db->lastInsertId();
                
                // Link card to profile with position from tile
                $stmt = $db->prepare("
                    INSERT INTO profile_cards (profile_id, card_id, row_index, col_index, page_index, is_visible, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $newProfileId,
                    $newCardId,
                    $tile['row'] ?? 0,
                    $tile['col'] ?? 0,
                    $tile['page'] ?? 0,
                    ($tile['isVisible'] ?? $tile['is_visible'] ?? true) ? 1 : 0
                ]);
            }
            
            // Import cards from cards array
            foreach ($cardsData as $cardData) {
                // Create card
                $stmt = $db->prepare("
                    INSERT INTO cards (title, label_text, image_path, audio_path, text_color, background_color, category, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $cardData['title'] ?? '',
                    $cardData['label_text'] ?? '',
                    $cardData['image_path'] ?? null,
                    $cardData['audio_path'] ?? null,
                    $cardData['text_color'] ?? '#000000',
                    $cardData['background_color'] ?? '#FFFFFF',
                    $cardData['category'] ?? null
                ]);
                $newCardId = $db->lastInsertId();
                
                // Link card to profile
                $position = $cardData['position'] ?? [];
                $stmt = $db->prepare("
                    INSERT INTO profile_cards (profile_id, card_id, row_index, col_index, page_index, is_visible, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $newProfileId,
                    $newCardId,
                    $position['row'] ?? 0,
                    $position['col'] ?? 0,
                    $position['page'] ?? 0,
                    ($position['visible'] ?? true) ? 1 : 0
                ]);
            }
            
            return successResponse([
                'success' => true,
                'profile_id' => $newProfileId,
                'message' => 'Profile imported successfully',
                'imported_cards' => count($cardsData) + count($tilesToImport)
            ]);
            
        } catch (Exception $e) {
            error_log("Profile import error: " . $e->getMessage());
            return errorResponse('Failed to import profile: ' . $e->getMessage(), 500);
        }
    }
    
    // POST /transfer/qr/generate - Generate QR code for profile transfer
    if ($method === 'POST' && count($pathParts) === 3 && $pathParts[1] === 'qr' && $pathParts[2] === 'generate') {
        $user = requireAuth($authToken);
        $profileId = $data['profile_id'] ?? null;
        $expiresIn = $data['expires_in'] ?? 24; // hours
        
        if (!$profileId) {
            return errorResponse('Profile ID is required', 400);
        }
        
        try {
            // Verify profile ownership
            $stmt = $db->prepare("SELECT id, user_id FROM profiles WHERE id = ? AND user_id = ?");
            $stmt->execute([$profileId, $user['id']]);
            $profile = $stmt->fetch();
            
            if (!$profile) {
                return errorResponse('Profile not found or access denied', 404);
            }
            
            // Generate unique token
            $token = bin2hex(random_bytes(32));
            
            // Create transfer token
            $stmt = $db->prepare("
                INSERT INTO profile_transfer_tokens (profile_id, user_id, token, transfer_type, expires_at, created_at)
                VALUES (?, ?, ?, 'qr', DATE_ADD(NOW(), INTERVAL ? HOUR), NOW())
            ");
            $stmt->execute([$profileId, $user['id'], $token, $expiresIn]);
            $tokenId = $db->lastInsertId();
            
            // Generate QR code data URL (would use a QR code library in production)
            // For now, return token and QR data structure
            $qrData = [
                'type' => 'profile_transfer',
                'token' => $token,
                'profile_id' => $profileId,
                'expires_at' => date('Y-m-d H:i:s', strtotime("+{$expiresIn} hours"))
            ];
            
            // In production, use a QR code library like phpqrcode
            // $qrCodeUrl = generateQRCode($qrData);
            
            return successResponse([
                'token' => $token,
                'token_id' => $tokenId,
                'qr_data' => $qrData,
                'qr_code_url' => null, // Would be generated by QR library
                'expires_at' => $qrData['expires_at'],
                'message' => 'QR code token generated. Use a QR code library to generate the image.'
            ]);
            
        } catch (Exception $e) {
            error_log("QR code generation error: " . $e->getMessage());
            return errorResponse('Failed to generate QR code', 500);
        }
    }
    
    // POST /transfer/cloud/generate - Generate cloud code for profile transfer
    if ($method === 'POST' && count($pathParts) === 3 && $pathParts[1] === 'cloud' && $pathParts[2] === 'generate') {
        $user = requireAuth($authToken);
        $profileId = $data['profile_id'] ?? null;
        $expiresIn = $data['expires_in'] ?? 168; // 7 days default
        
        if (!$profileId) {
            return errorResponse('Profile ID is required', 400);
        }
        
        try {
            // Verify profile ownership
            $stmt = $db->prepare("SELECT id, user_id FROM profiles WHERE id = ? AND user_id = ?");
            $stmt->execute([$profileId, $user['id']]);
            $profile = $stmt->fetch();
            
            if (!$profile) {
                return errorResponse('Profile not found or access denied', 404);
            }
            
            // Generate readable cloud code (e.g., ABC-123-XYZ)
            $code = strtoupper(substr(md5(uniqid(rand(), true)), 0, 3) . '-' . 
                                 substr(md5(uniqid(rand(), true)), 0, 3) . '-' . 
                                 substr(md5(uniqid(rand(), true)), 0, 3));
            
            // Create transfer token
            $stmt = $db->prepare("
                INSERT INTO profile_transfer_tokens (profile_id, user_id, token, transfer_type, expires_at, created_at)
                VALUES (?, ?, ?, 'cloud', DATE_ADD(NOW(), INTERVAL ? HOUR), NOW())
            ");
            $stmt->execute([$profileId, $user['id'], $code, $expiresIn]);
            $tokenId = $db->lastInsertId();
            
            return successResponse([
                'code' => $code,
                'token_id' => $tokenId,
                'expires_at' => date('Y-m-d H:i:s', strtotime("+{$expiresIn} hours")),
                'message' => 'Cloud code generated successfully'
            ]);
            
        } catch (Exception $e) {
            error_log("Cloud code generation error: " . $e->getMessage());
            return errorResponse('Failed to generate cloud code', 500);
        }
    }
    
    // POST /transfer/cloud/redeem - Redeem cloud code to import profile
    if ($method === 'POST' && count($pathParts) === 3 && $pathParts[1] === 'cloud' && $pathParts[2] === 'redeem') {
        $user = requireAuth($authToken);
        $code = trim($data['code'] ?? '');
        
        if (empty($code)) {
            return errorResponse('Cloud code is required', 400);
        }
        
        try {
            // Find valid token
            $stmt = $db->prepare("
                SELECT pt.*, p.display_name, p.description, p.layout_type, p.language
                FROM profile_transfer_tokens pt
                INNER JOIN profiles p ON pt.profile_id = p.id
                WHERE pt.token = ? 
                  AND pt.transfer_type = 'cloud'
                  AND pt.expires_at > NOW()
                  AND pt.used_at IS NULL
            ");
            $stmt->execute([$code]);
            $token = $stmt->fetch();
            
            if (!$token) {
                return errorResponse('Invalid or expired cloud code', 400);
            }
            
            // Import profile (reuse import logic from QR code)
            $sourceProfileId = $token['profile_id'];
            $sourceUserId = $token['user_id'];
            
            // Get source profile data
            $stmt = $db->prepare("SELECT * FROM profiles WHERE id = ?");
            $stmt->execute([$sourceProfileId]);
            $sourceProfile = $stmt->fetch();
            
            if (!$sourceProfile) {
                return errorResponse('Source profile not found', 404);
            }
            
            // Get source profile's cards
            $stmt = $db->prepare("
                SELECT c.*, pc.row_index, pc.col_index, pc.page_index, pc.is_visible
                FROM cards c
                INNER JOIN profile_cards pc ON c.id = pc.card_id
                WHERE pc.profile_id = ?
            ");
            $stmt->execute([$sourceProfileId]);
            $sourceCards = $stmt->fetchAll();
            
            // Create new profile for current user
            $newProfileName = $sourceProfile['display_name'] . ' (Imported)';
            $stmt = $db->prepare("
                INSERT INTO profiles (user_id, display_name, description, layout_type, language, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([
                $user['id'],
                $newProfileName,
                $sourceProfile['description'],
                $sourceProfile['layout_type'],
                $sourceProfile['language']
            ]);
            $newProfileId = $db->lastInsertId();
            
            // Import cards and link to new profile
            $importedCardsCount = 0;
            foreach ($sourceCards as $card) {
                // Create new card
                $stmt = $db->prepare("
                    INSERT INTO cards (title, label_text, image_path, audio_path, text_color, background_color, category, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $card['title'] ?? '',
                    $card['label_text'] ?? '',
                    $card['image_path'] ?? null,
                    $card['audio_path'] ?? null,
                    $card['text_color'] ?? '#000000',
                    $card['background_color'] ?? '#FFFFFF',
                    $card['category'] ?? null
                ]);
                $newCardId = $db->lastInsertId();
                
                // Link card to new profile
                $stmt = $db->prepare("
                    INSERT INTO profile_cards (profile_id, card_id, row_index, col_index, page_index, is_visible, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $newProfileId,
                    $newCardId,
                    $card['row_index'] ?? 0,
                    $card['col_index'] ?? 0,
                    $card['page_index'] ?? 0,
                    ($card['is_visible'] ?? true) ? 1 : 0
                ]);
                $importedCardsCount++;
            }
            
            // Mark token as used
            $stmt = $db->prepare("UPDATE profile_transfer_tokens SET used_at = NOW() WHERE id = ?");
            $stmt->execute([$token['id']]);
            
            return successResponse([
                'success' => true,
                'message' => 'Profile imported successfully via cloud code',
                'profile_id' => $newProfileId,
                'imported_cards' => $importedCardsCount
            ]);
            
        } catch (Exception $e) {
            error_log("Cloud code redeem error: " . $e->getMessage());
            return errorResponse('Failed to redeem cloud code', 500);
        }
    }
    
    // POST /transfer/qr/redeem - Redeem QR token to import profile
    if ($method === 'POST' && count($pathParts) === 3 && $pathParts[1] === 'qr' && $pathParts[2] === 'redeem') {
        $user = requireAuth($authToken);
        $token = trim($data['token'] ?? '');
        
        if (empty($token)) {
            return errorResponse('QR token is required', 400);
        }
        
        try {
            // Find valid token
            $stmt = $db->prepare("
                SELECT pt.*, p.display_name, p.description, p.layout_type, p.language, p.user_id as source_user_id
                FROM profile_transfer_tokens pt
                INNER JOIN profiles p ON pt.profile_id = p.id
                WHERE pt.token = ? 
                  AND pt.transfer_type = 'qr'
                  AND pt.expires_at > NOW()
                  AND pt.used_at IS NULL
            ");
            $stmt->execute([$token]);
            $tokenData = $stmt->fetch();
            
            if (!$tokenData) {
                return errorResponse('Invalid or expired QR token', 400);
            }
            
            // Import profile (reuse import logic from cloud code)
            $sourceProfileId = $tokenData['profile_id'];
            $sourceUserId = $tokenData['source_user_id'];
            
            // Get source profile data
            $stmt = $db->prepare("SELECT * FROM profiles WHERE id = ?");
            $stmt->execute([$sourceProfileId]);
            $sourceProfile = $stmt->fetch();
            
            if (!$sourceProfile) {
                return errorResponse('Source profile not found', 404);
            }
            
            // Get source profile's cards
            $stmt = $db->prepare("
                SELECT c.*, pc.row_index, pc.col_index, pc.page_index, pc.is_visible
                FROM cards c
                INNER JOIN profile_cards pc ON c.id = pc.card_id
                WHERE pc.profile_id = ?
            ");
            $stmt->execute([$sourceProfileId]);
            $sourceCards = $stmt->fetchAll();
            
            // Create new profile for current user
            $newProfileName = $sourceProfile['display_name'] . ' (Imported)';
            $stmt = $db->prepare("
                INSERT INTO profiles (user_id, display_name, description, layout_type, language, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([
                $user['id'],
                $newProfileName,
                $sourceProfile['description'],
                $sourceProfile['layout_type'],
                $sourceProfile['language']
            ]);
            $newProfileId = $db->lastInsertId();
            
            // Import cards and link to new profile
            $importedCardsCount = 0;
            foreach ($sourceCards as $card) {
                // Create new card
                $stmt = $db->prepare("
                    INSERT INTO cards (title, label_text, image_path, audio_path, text_color, background_color, category, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $card['title'] ?? '',
                    $card['label_text'] ?? '',
                    $card['image_path'] ?? null,
                    $card['audio_path'] ?? null,
                    $card['text_color'] ?? '#000000',
                    $card['background_color'] ?? '#FFFFFF',
                    $card['category'] ?? null
                ]);
                $newCardId = $db->lastInsertId();
                
                // Link card to new profile
                $stmt = $db->prepare("
                    INSERT INTO profile_cards (profile_id, card_id, row_index, col_index, page_index, is_visible, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $newProfileId,
                    $newCardId,
                    $card['row_index'] ?? 0,
                    $card['col_index'] ?? 0,
                    $card['page_index'] ?? 0,
                    ($card['is_visible'] ?? true) ? 1 : 0
                ]);
                $importedCardsCount++;
            }
            
            // Mark token as used
            $stmt = $db->prepare("UPDATE profile_transfer_tokens SET used_at = NOW() WHERE id = ?");
            $stmt->execute([$tokenData['id']]);
            
            return successResponse([
                'success' => true,
                'message' => 'Profile imported successfully via QR code',
                'profile_id' => $newProfileId,
                'imported_cards' => $importedCardsCount
            ]);
            
        } catch (Exception $e) {
            error_log("QR token redeem error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return errorResponse('Failed to redeem QR token: ' . $e->getMessage(), 500);
        }
    }
    
    // POST /transfer/email/generate - Generate email ZIP transfer
    if ($method === 'POST' && count($pathParts) === 3 && $pathParts[1] === 'email' && $pathParts[2] === 'generate') {
        $user = requireAuth($authToken);
        $profileId = $data['profile_id'] ?? null;
        $email = trim($data['email'] ?? '');
        $expiresIn = $data['expires_in'] ?? 168; // 7 days default
        
        if (!$profileId) {
            return errorResponse('Profile ID is required', 400);
        }
        
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return errorResponse('Valid email address is required', 400);
        }
        
        try {
            // Verify profile ownership
            $stmt = $db->prepare("SELECT id, user_id FROM profiles WHERE id = ? AND user_id = ?");
            $stmt->execute([$profileId, $user['id']]);
            $profile = $stmt->fetch();
            
            if (!$profile) {
                return errorResponse('Profile not found or access denied', 404);
            }
            
            // Generate token
            $token = bin2hex(random_bytes(32));
            
            // Create transfer token with email in transfer_data
            $transferData = json_encode(['email' => $email]);
            $stmt = $db->prepare("
                INSERT INTO profile_transfer_tokens (profile_id, user_id, token, transfer_type, transfer_data, expires_at, created_at)
                VALUES (?, ?, ?, 'email', ?, DATE_ADD(NOW(), INTERVAL ? HOUR), NOW())
            ");
            $stmt->execute([$profileId, $user['id'], $token, $transferData, $expiresIn]);
            $tokenId = $db->lastInsertId();
            
            // Get profile data for export
            $stmt = $db->prepare("SELECT id, display_name, description, layout_type, language FROM profiles WHERE id = ?");
            $stmt->execute([$profileId]);
            $profileData = $stmt->fetch();
            
            // Get cards for this profile
            $stmt = $db->prepare("
                SELECT c.id, c.title, c.label_text, c.image_path, c.audio_path, 
                       c.text_color, c.background_color, c.category,
                       pc.row_index, pc.col_index, pc.page_index, pc.is_visible
                FROM cards c
                INNER JOIN profile_cards pc ON c.id = pc.card_id
                WHERE pc.profile_id = ?
            ");
            $stmt->execute([$profileId]);
            $cards = $stmt->fetchAll();
            
            // Build tiles from cards for root_board export
            $tiles = [];
            foreach ($cards as $card) {
                $tiles[] = [
                    'id' => 'card_' . $card['id'],
                    'label' => $card['label_text'] ?: $card['title'],
                    'image' => $card['image_path'],
                    'sound' => $card['audio_path'],
                    'textColor' => $card['text_color'],
                    'backgroundColor' => $card['background_color'],
                    'category' => $card['category'],
                    'row' => (int)$card['row_index'],
                    'col' => (int)$card['col_index'],
                    'page' => (int)$card['page_index'],
                    'isVisible' => (bool)$card['is_visible']
                ];
            }
            
            // Build export data
            $exportData = [
                'profile' => $profileData,
                'root_board' => [
                    'id' => (string)$profileData['id'],
                    'name' => $profileData['display_name'],
                    'description' => $profileData['description'],
                    'is_public' => false,
                    'tiles' => $tiles
                ],
                'cards' => $cards,
                'token' => $token
            ];
            
            // Generate ZIP file
            $zipPath = generateProfileZIP($exportData);
            
            if (!$zipPath) {
                return errorResponse('Failed to generate ZIP file', 500);
            }
            
            // Prepare email
            $subject = 'Cboard Profile Transfer: ' . ($profileData['display_name'] ?? 'Profile');
            $body = '<html><body>';
            $body .= '<h2>Cboard Profile Transfer</h2>';
            $body .= '<p>You have received a Cboard profile transfer.</p>';
            $body .= '<p><strong>Profile:</strong> ' . htmlspecialchars($profileData['display_name'] ?? 'Untitled') . '</p>';
            $body .= '<p><strong>Description:</strong> ' . htmlspecialchars($profileData['description'] ?? '') . '</p>';
            $body .= '<p>Please find the profile ZIP file attached to this email.</p>';
            $body .= '<p>To import this profile:</p>';
            $body .= '<ol>';
            $body .= '<li>Open Cboard</li>';
            $body .= '<li>Go to Settings > Profile Transfer</li>';
            $body .= '<li>Click Import and select the attached ZIP file</li>';
            $body .= '</ol>';
            $body .= '<p>This transfer link expires on: ' . date('Y-m-d H:i:s', strtotime("+{$expiresIn} hours")) . '</p>';
            $body .= '<p>If you did not request this transfer, please ignore this email.</p>';
            $body .= '<hr>';
            $body .= '<p><small>This is an automated message from Cboard.</small></p>';
            $body .= '</body></html>';
            
            // Send email with ZIP attachment
            $emailSent = sendEmail($email, $subject, $body, [$zipPath]);
            
            // Clean up ZIP file after sending
            if (file_exists($zipPath)) {
                unlink($zipPath);
            }
            
            if (!$emailSent) {
                return errorResponse('Failed to send email', 500);
            }
            
            return successResponse([
                'token' => $token,
                'token_id' => $tokenId,
                'email' => $email,
                'expires_at' => date('Y-m-d H:i:s', strtotime("+{$expiresIn} hours")),
                'message' => 'Profile transfer email sent successfully'
            ]);
            
        } catch (Exception $e) {
            error_log("Email transfer generation error: " . $e->getMessage());
            return errorResponse('Failed to generate email transfer', 500);
        }
    }
    
    // GET /transfer/validate/{token} - Validate transfer token
    if ($method === 'GET' && count($pathParts) === 3 && $pathParts[1] === 'validate') {
        $token = $pathParts[2] ?? null;
        
        if (empty($token)) {
            return errorResponse('Token is required', 400);
        }
        
        try {
            $stmt = $db->prepare("
                SELECT pt.*, p.display_name, p.description, p.layout_type, p.language
                FROM profile_transfer_tokens pt
                INNER JOIN profiles p ON pt.profile_id = p.id
                WHERE pt.token = ?
                  AND pt.expires_at > NOW()
                  AND pt.used_at IS NULL
            ");
            $stmt->execute([$token]);
            $tokenData = $stmt->fetch();
            
            if (!$tokenData) {
                return errorResponse('Invalid or expired token', 400);
            }
            
            return successResponse([
                'valid' => true,
                'token' => $token,
                'transfer_type' => $tokenData['transfer_type'],
                'profile' => [
                    'id' => $tokenData['profile_id'],
                    'display_name' => $tokenData['display_name'],
                    'description' => $tokenData['description']
                ],
                'expires_at' => $tokenData['expires_at']
            ]);
            
        } catch (Exception $e) {
            error_log("Token validation error: " . $e->getMessage());
            return errorResponse('Failed to validate token', 500);
        }
    }
    
    return errorResponse('Transfer route not found', 404);
}

