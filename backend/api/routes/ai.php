<?php
/**
 * AI Routes Handler
 * Sprint 9-10: AI Functionality
 * 
 * Handles:
 * - AI card suggestion
 * - Typing prediction
 * - Jyutping prediction
 * - Adaptive learning system
 * 
 * Current Implementation:
 * - Uses database-based keyword matching (not true AI API)
 * - Can be enhanced with OpenAI, Google Cloud AI, or Azure Cognitive Services
 * - See AI_API_IMPLEMENTATION.md for integration guide
 */

require_once __DIR__ . '/../auth.php';

function handleAIRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    
    if ($db === null) {
        error_log("Database connection failed in handleAIRoutes");
        return errorResponse('Database connection failed. Please check server configuration.', 500);
    }
    
    // POST /ai/suggest-cards - AI card suggestion based on context
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'suggest-cards') {
        $user = requireAuth($authToken);
        $context = $data['context'] ?? ''; // Text context or previous cards
        $profileId = $data['profile_id'] ?? null;
        $limit = isset($data['limit']) ? (int)$data['limit'] : 10;
        
        try {
            // Get user's frequently used cards for context
            $frequentCards = [];
            if ($profileId) {
                $stmt = $db->prepare("
                    SELECT c.id, c.title, c.label_text, c.category, COUNT(al.id) as usage_count
                    FROM cards c
                    INNER JOIN profile_cards pc ON c.id = pc.card_id
                    LEFT JOIN action_logs al ON c.id = al.card_id AND al.profile_id = ?
                    WHERE pc.profile_id = ?
                    GROUP BY c.id
                    ORDER BY usage_count DESC, c.title ASC
                    LIMIT ?
                ");
                $stmt->execute([$profileId, $profileId, $limit * 2]);
                $frequentCards = $stmt->fetchAll();
            }
            
            // Simple keyword-based suggestion (can be enhanced with AI service)
            $suggestions = [];
            if (!empty($context)) {
                $keywords = explode(' ', strtolower($context));
                $keywordPlaceholders = implode(',', array_fill(0, count($keywords), '?'));
                
                $stmt = $db->prepare("
                    SELECT DISTINCT c.id, c.title, c.label_text, c.category, c.image_path
                    FROM cards c
                    WHERE (LOWER(c.title) LIKE ? OR LOWER(c.label_text) LIKE ?)
                    ORDER BY c.title ASC
                    LIMIT ?
                ");
                
                $searchTerm = '%' . implode('%', $keywords) . '%';
                $stmt->execute([$searchTerm, $searchTerm, $limit]);
                $suggestions = $stmt->fetchAll();
            }
            
            // If no context-based suggestions, use frequent cards
            if (empty($suggestions) && !empty($frequentCards)) {
                $suggestions = array_slice($frequentCards, 0, $limit);
            }
            
            // If still no suggestions, get popular cards
            if (empty($suggestions)) {
                $stmt = $db->prepare("
                    SELECT DISTINCT c.id, c.title, c.label_text, c.category, c.image_path
                    FROM cards c
                    INNER JOIN action_logs al ON c.id = al.card_id
                    GROUP BY c.id
                    ORDER BY COUNT(al.id) DESC
                    LIMIT ?
                ");
                $stmt->execute([$limit]);
                $suggestions = $stmt->fetchAll();
            }
            
            return successResponse([
                'suggestions' => $suggestions,
                'count' => count($suggestions)
            ]);
            
        } catch (Exception $e) {
            error_log("AI card suggestion error: " . $e->getMessage());
            return errorResponse('Failed to get card suggestions', 500);
        }
    }
    
    // POST /ai/typing-prediction - Predict next characters/words while typing
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'typing-prediction') {
        $user = requireAuth($authToken);
        $input = $data['input'] ?? ''; // Current typed text
        $language = $data['language'] ?? 'en';
        $limit = isset($data['limit']) ? (int)$data['limit'] : 5;
        
        if (empty($input)) {
            return errorResponse('Input text is required', 400);
        }
        
        try {
            // Simple prediction based on common words/phrases
            // In production, this would use an AI language model
            $predictions = [];
            
            if ($language === 'zh' || $language === 'yue') {
                // For Chinese/Cantonese, use Jyutping dictionary
                $stmt = $db->prepare("
                    SELECT DISTINCT hanzi, jyutping_code, word, frequency
                    FROM jyutping_dictionary
                    WHERE jyutping_code LIKE ?
                    ORDER BY frequency DESC
                    LIMIT ?
                ");
                $searchTerm = $input . '%';
                $stmt->execute([$searchTerm, $limit]);
                $jyutpingResults = $stmt->fetchAll();
                
                foreach ($jyutpingResults as $result) {
                    $predictions[] = [
                        'text' => $result['hanzi'] ?? $result['word'] ?? '',
                        'jyutping' => $result['jyutping_code'],
                        'confidence' => min(1.0, $result['frequency'] / 1000)
                    ];
                }
            } else {
                // For English, use common words from cards
                $stmt = $db->prepare("
                    SELECT DISTINCT c.label_text, COUNT(*) as frequency
                    FROM cards c
                    WHERE LOWER(c.label_text) LIKE ?
                    GROUP BY c.label_text
                    ORDER BY frequency DESC
                    LIMIT ?
                ");
                $searchTerm = strtolower($input) . '%';
                $stmt->execute([$searchTerm, $limit]);
                $wordResults = $stmt->fetchAll();
                
                foreach ($wordResults as $result) {
                    $predictions[] = [
                        'text' => $result['label_text'],
                        'confidence' => min(1.0, $result['frequency'] / 100)
                    ];
                }
            }
            
            return successResponse([
                'input' => $input,
                'predictions' => $predictions,
                'count' => count($predictions)
            ]);
            
        } catch (Exception $e) {
            error_log("Typing prediction error: " . $e->getMessage());
            return errorResponse('Failed to get typing predictions', 500);
        }
    }
    
    // POST /ai/jyutping-prediction - Predict Jyutping from partial input
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'jyutping-prediction') {
        $user = requireAuth($authToken);
        $input = $data['input'] ?? ''; // Partial Jyutping input
        $limit = isset($data['limit']) ? (int)$data['limit'] : 10;
        
        if (empty($input)) {
            return errorResponse('Input is required', 400);
        }
        
        try {
            // Check if jyutping_dictionary table exists
            $stmt = $db->prepare("SHOW TABLES LIKE 'jyutping_dictionary'");
            $stmt->execute();
            $tableExists = $stmt->fetch();
            
            if (!$tableExists) {
                error_log("jyutping_dictionary table does not exist");
                return successResponse([
                    'input' => $input,
                    'predictions' => [],
                    'count' => 0,
                    'message' => 'Jyutping dictionary not available. Please initialize the database.'
                ]);
            }
            
            $stmt = $db->prepare("
                SELECT hanzi, jyutping_code, word, frequency
                FROM jyutping_dictionary
                WHERE jyutping_code LIKE ?
                ORDER BY frequency DESC, jyutping_code ASC
                LIMIT ?
            ");
            $searchTerm = $input . '%';
            $stmt->execute([$searchTerm, $limit]);
            $results = $stmt->fetchAll();
            
            $predictions = [];
            foreach ($results as $result) {
                $predictions[] = [
                    'character' => $result['hanzi'] ?? $result['word'] ?? '',
                    'jyutping' => $result['jyutping_code'],
                    'meaning' => $result['word'] ?? $result['hanzi'] ?? '',
                    'frequency' => (int)$result['frequency']
                ];
            }
            
            return successResponse([
                'input' => $input,
                'predictions' => $predictions,
                'count' => count($predictions)
            ]);
            
        } catch (Exception $e) {
            error_log("Jyutping prediction error: " . $e->getMessage());
            return errorResponse('Failed to get Jyutping predictions', 500);
        }
    }
    
    // POST /ai/adaptive-learning - Update adaptive learning data
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'adaptive-learning') {
        $user = requireAuth($authToken);
        $profileId = $data['profile_id'] ?? null;
        $cardId = $data['card_id'] ?? null;
        $difficulty = $data['difficulty'] ?? null; // 'easy', 'medium', 'hard'
        $performance = $data['performance'] ?? null; // 'correct', 'incorrect', 'skipped'
        
        if (!$profileId || !$cardId) {
            return errorResponse('Profile ID and Card ID are required', 400);
        }
        
        try {
            // Check if learning record exists
            $stmt = $db->prepare("
                SELECT id, attempts, correct_count, difficulty_level
                FROM jyutping_learning_log
                WHERE user_id = ? AND profile_id = ? AND card_id = ?
                LIMIT 1
            ");
            $stmt->execute([$user['id'], $profileId, $cardId]);
            $existing = $stmt->fetch();
            
            if ($existing) {
                // Update existing record
                $newAttempts = $existing['attempts'] + 1;
                $newCorrect = $existing['correct_count'];
                if ($performance === 'correct') {
                    $newCorrect++;
                }
                
                // Adjust difficulty based on performance
                $newDifficulty = $existing['difficulty_level'];
                if ($performance === 'correct' && $newCorrect / $newAttempts > 0.8) {
                    // Increase difficulty if performing well
                    $newDifficulty = min(3, $existing['difficulty_level'] + 1);
                } elseif ($performance === 'incorrect' && $newCorrect / $newAttempts < 0.5) {
                    // Decrease difficulty if struggling
                    $newDifficulty = max(1, $existing['difficulty_level'] - 1);
                }
                
                $stmt = $db->prepare("
                    UPDATE jyutping_learning_log
                    SET attempts = ?, correct_count = ?, difficulty_level = ?, last_practiced = NOW()
                    WHERE id = ?
                ");
                $stmt->execute([$newAttempts, $newCorrect, $newDifficulty, $existing['id']]);
            } else {
                // Create new record
                $initialDifficulty = $difficulty === 'hard' ? 3 : ($difficulty === 'medium' ? 2 : 1);
                $initialCorrect = $performance === 'correct' ? 1 : 0;
                
                $stmt = $db->prepare("
                    INSERT INTO jyutping_learning_log (user_id, profile_id, card_id, attempts, correct_count, difficulty_level, created_at, last_practiced)
                    VALUES (?, ?, ?, 1, ?, ?, NOW(), NOW())
                ");
                $stmt->execute([$user['id'], $profileId, $cardId, $initialCorrect, $initialDifficulty]);
            }
            
            return successResponse([
                'success' => true,
                'message' => 'Learning data updated'
            ]);
            
        } catch (Exception $e) {
            error_log("Adaptive learning update error: " . $e->getMessage());
            return errorResponse('Failed to update learning data', 500);
        }
    }
    
    // GET /ai/learning-stats - Get adaptive learning statistics
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'learning-stats') {
        $user = requireAuth($authToken);
        $profileId = $_GET['profile_id'] ?? null;
        
        try {
            $sql = "
                SELECT 
                    COUNT(*) as total_cards,
                    SUM(attempts) as total_attempts,
                    SUM(correct_count) as total_correct,
                    AVG(difficulty_level) as avg_difficulty,
                    AVG(correct_count / NULLIF(attempts, 0)) as avg_accuracy
                FROM jyutping_learning_log
                WHERE user_id = ?
            ";
            $params = [$user['id']];
            
            if ($profileId) {
                $sql .= " AND profile_id = ?";
                $params[] = $profileId;
            }
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $stats = $stmt->fetch();
            
            return successResponse([
                'stats' => [
                    'total_cards' => (int)$stats['total_cards'],
                    'total_attempts' => (int)$stats['total_attempts'],
                    'total_correct' => (int)$stats['total_correct'],
                    'avg_difficulty' => round((float)$stats['avg_difficulty'], 2),
                    'avg_accuracy' => round((float)$stats['avg_accuracy'] * 100, 2)
                ]
            ]);
            
        } catch (Exception $e) {
            error_log("Learning stats error: " . $e->getMessage());
            return errorResponse('Failed to get learning stats', 500);
        }
    }
    
    return errorResponse('AI route not found', 404);
}

