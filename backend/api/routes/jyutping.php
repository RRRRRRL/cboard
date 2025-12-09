<?php
/**
 * Jyutping Keyboard API Routes Handler
 * Sprint 7: Jyutping Keyboard Implementation
 * 
 * Endpoints:
 * - GET /api/jyutping/search?code={code} - Search Jyutping dictionary
 * - GET /api/jyutping/suggestions?input={input} - Get word suggestions
 * - POST /api/jyutping/audio - Generate audio for Jyutping
 * - POST /api/jyutping/learning-log - Log learning progress
 */

function handleJyutpingRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }

    // GET /jyutping/search?code={code}
    if ($method === 'GET' && isset($pathParts[1]) && $pathParts[1] === 'search') {
    try {
        $code = $_GET['code'] ?? '';
        
        if (empty($code)) {
            return errorResponse('Jyutping code is required', 400);
        }
        
        $db = getDB();
        
        // Search for exact match first
        $sql = "SELECT * FROM jyutping_dictionary 
                WHERE jyutping_code = ? 
                ORDER BY frequency DESC, id ASC 
                LIMIT 10";
        $stmt = $db->prepare($sql);
        $stmt->execute([$code]);
        $exactMatches = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // If no exact match, try matching without tone number (e.g., "nei" matches "nei5")
        if (empty($exactMatches)) {
            // Try matching code without tone (remove last character if it's a digit)
            $codeWithoutTone = preg_replace('/\d+$/', '', $code);
            if ($codeWithoutTone !== $code && !empty($codeWithoutTone)) {
                $sql = "SELECT * FROM jyutping_dictionary 
                        WHERE jyutping_code LIKE ? 
                        ORDER BY frequency DESC, id ASC 
                        LIMIT 10";
                $stmt = $db->prepare($sql);
                $stmt->execute([$codeWithoutTone . '%']);
                $toneMatches = $stmt->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($toneMatches)) {
                    return successResponse([
                        'code' => $code,
                        'matches' => $toneMatches,
                        'match_type' => 'tone_variant'
                    ]);
                }
            }
            
            // If still no match, search for partial match (starts with)
            $sql = "SELECT * FROM jyutping_dictionary 
                    WHERE jyutping_code LIKE ? 
                    ORDER BY frequency DESC, id ASC 
                    LIMIT 10";
            $stmt = $db->prepare($sql);
            $stmt->execute([$code . '%']);
            $partialMatches = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return successResponse([
                'code' => $code,
                'matches' => $partialMatches,
                'match_type' => 'partial'
            ]);
        }
        
        return successResponse([
            'code' => $code,
            'matches' => $exactMatches,
            'match_type' => 'exact'
        ]);
        
    } catch (Exception $e) {
        error_log("Jyutping search error: " . $e->getMessage());
        return errorResponse('Failed to search Jyutping dictionary', 500);
    }
}

    // GET /jyutping/suggestions?input={input}
    if ($method === 'GET' && isset($pathParts[1]) && $pathParts[1] === 'suggestions') {
    try {
        $input = $_GET['input'] ?? '';
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        
        if (empty($input)) {
            return successResponse(['suggestions' => []]);
        }
        
        $db = getDB();
        
        // Search for suggestions based on input
        // Priority: exact match > starts with > contains > frequency
        $sql = "SELECT * FROM jyutping_dictionary 
                WHERE jyutping_code LIKE ? 
                   OR hanzi LIKE ? 
                   OR word LIKE ?
                ORDER BY 
                    CASE 
                        WHEN jyutping_code = ? THEN 1
                        WHEN jyutping_code LIKE ? THEN 2
                        WHEN hanzi LIKE ? THEN 3
                        WHEN word LIKE ? THEN 4
                        ELSE 5
                    END,
                    frequency DESC,
                    id ASC
                LIMIT ?";
        
        $searchPattern = '%' . $input . '%';
        $exactPattern = $input;
        $startsPattern = $input . '%';
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            $searchPattern,  // jyutping_code LIKE
            $searchPattern,  // hanzi LIKE
            $searchPattern,  // word LIKE
            $exactPattern,   // jyutping_code = (priority 1)
            $startsPattern,  // jyutping_code LIKE (priority 2)
            $startsPattern,  // hanzi LIKE (priority 3)
            $startsPattern,  // word LIKE (priority 4)
            $limit
        ]);
        
        $suggestions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        return successResponse([
            'input' => $input,
            'suggestions' => $suggestions,
            'count' => count($suggestions)
        ]);
        
    } catch (Exception $e) {
        error_log("Jyutping suggestions error: " . $e->getMessage());
        return errorResponse('Failed to get suggestions', 500);
    }
}

// POST /jyutping/audio
    if ($method === 'POST' && isset($pathParts[1]) && $pathParts[1] === 'audio') {
        try {
            // Audio endpoint doesn't require authentication for basic playback
            // Authentication is optional for logging purposes
            $user = verifyAuth($authToken); // Optional auth
            
            $text = $data['text'] ?? '';
            $jyutping = $data['jyutping'] ?? '';
            $type = $data['type'] ?? 'character'; // 'character' or 'word'
            
            if (empty($text) && empty($jyutping)) {
                return errorResponse('Text or Jyutping code is required', 400);
            }
            
            // Use existing TTS endpoint logic
            // For now, return a placeholder response
            // In production, this would call the TTS service with Cantonese voice
            
            return successResponse([
                'text' => $text,
                'jyutping' => $jyutping,
                'type' => $type,
                'audio_url' => null, // Would be generated by TTS service
                'message' => 'Audio generation will be integrated with TTS service'
            ]);
            
        } catch (Exception $e) {
            error_log("Jyutping audio error: " . $e->getMessage());
            return errorResponse('Failed to generate audio', 500);
        }
    }

    // POST /jyutping/learning-log
    if ($method === 'POST' && isset($pathParts[1]) && $pathParts[1] === 'learning-log') {
    try {
        $user = requireAuth($authToken);
        
        $jyutpingCode = $data['jyutping_code'] ?? '';
        $hanziExpected = $data['hanzi_expected'] ?? null;
        $hanziSelected = $data['hanzi_selected'] ?? null;
        $profileId = $data['profile_id'] ?? null;
        
        if (empty($jyutpingCode)) {
            return errorResponse('Jyutping code is required', 400);
        }
        
        // Validate profile_id if provided
        if ($profileId !== null) {
            $db = getDB();
            $stmt = $db->prepare("SELECT id FROM profiles WHERE id = ? AND user_id = ?");
            $stmt->execute([$profileId, $user['id']]);
            if (!$stmt->fetch()) {
                $profileId = null; // Invalid profile, set to null
            }
        }
        
        $isCorrect = ($hanziExpected && $hanziSelected && $hanziExpected === $hanziSelected) ? 1 : 0;
        
        $db = getDB();
        
        // Check if there's an existing log entry for this user/jyutping today
        $sql = "SELECT id, attempt_count FROM jyutping_learning_log 
                WHERE user_id = ? 
                  AND jyutping_code = ? 
                  AND DATE(created_at) = CURDATE()
                ORDER BY created_at DESC 
                LIMIT 1";
        $stmt = $db->prepare($sql);
        $stmt->execute([$user['id'], $jyutpingCode]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existing) {
            // Update existing entry
            $attemptCount = (int)$existing['attempt_count'] + 1;
            $sql = "UPDATE jyutping_learning_log 
                    SET hanzi_expected = ?,
                        hanzi_selected = ?,
                        is_correct = ?,
                        attempt_count = ?,
                        created_at = NOW()
                    WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute([
                $hanziExpected,
                $hanziSelected,
                $isCorrect,
                $attemptCount,
                $existing['id']
            ]);
            $logId = $existing['id'];
        } else {
            // Create new entry
            $sql = "INSERT INTO jyutping_learning_log 
                    (user_id, profile_id, jyutping_code, hanzi_expected, hanzi_selected, is_correct, attempt_count)
                    VALUES (?, ?, ?, ?, ?, ?, 1)";
            $stmt = $db->prepare($sql);
            $stmt->execute([
                $user['id'],
                $profileId,
                $jyutpingCode,
                $hanziExpected,
                $hanziSelected,
                $isCorrect
            ]);
            $logId = $db->lastInsertId();
        }
        
        return successResponse([
            'id' => $logId,
            'jyutping_code' => $jyutpingCode,
            'is_correct' => (bool)$isCorrect,
            'message' => 'Learning log saved successfully'
        ], 201);
        
    } catch (Exception $e) {
        error_log("Jyutping learning log error: " . $e->getMessage());
        return errorResponse('Failed to save learning log', 500);
    }
}

    // If no route matches
    return errorResponse('Jyutping route not found. Method: ' . $method . ', Path: ' . json_encode($pathParts), 404);
}

