<?php
/**
 * Learning Games Routes Handler
 * Sprint 11: Learning Games
 * 
 * Handles:
 * - Jyutping spelling game
 * - Word-picture matching
 * - Jyutping-picture matching
 * - Game scoring and history
 */

require_once __DIR__ . '/../auth.php';

function handleGamesRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    
    if ($db === null) {
        error_log("Database connection failed in handleGamesRoutes");
        return errorResponse('Database connection failed. Please check server configuration.', 500);
    }
    
    // GET /games/spelling - Get spelling game questions
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'spelling') {
        $user = requireAuth($authToken);
        $difficulty = $_GET['difficulty'] ?? 'medium'; // 'easy', 'medium', 'hard'
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        
        try {
            // Get words from Jyutping dictionary based on difficulty
            $frequencyMin = 0;
            $frequencyMax = 999999;
            
            if ($difficulty === 'easy') {
                $frequencyMin = 1000; // Common words
            } elseif ($difficulty === 'hard') {
                $frequencyMax = 100; // Less common words
            }
            
            // Check if jyutping_dictionary table exists, if not return empty questions
            $stmt = $db->prepare("SHOW TABLES LIKE 'jyutping_dictionary'");
            $stmt->execute();
            $tableExists = $stmt->fetch();
            
            if (!$tableExists) {
                error_log("jyutping_dictionary table does not exist");
                return successResponse([
                    'game_type' => 'spelling',
                    'difficulty' => $difficulty,
                    'questions' => [],
                    'count' => 0,
                    'message' => 'Jyutping dictionary not available. Please initialize the database.'
                ]);
            }
            
            $stmt = $db->prepare("
                SELECT hanzi, jyutping_code, word, frequency
                FROM jyutping_dictionary
                WHERE frequency >= ? AND frequency <= ?
                ORDER BY RAND()
                LIMIT ?
            ");
            $stmt->execute([$frequencyMin, $frequencyMax, $limit]);
            $words = $stmt->fetchAll();
            
            // Generate questions
            $questions = [];
            foreach ($words as $word) {
                // Create multiple choice options
                $stmt = $db->prepare("
                    SELECT jyutping_code
                    FROM jyutping_dictionary
                    WHERE jyutping_code != ?
                    ORDER BY RAND()
                    LIMIT 3
                ");
                $stmt->execute([$word['jyutping_code']]);
                $wrongOptions = $stmt->fetchAll(PDO::FETCH_COLUMN);
                
                $options = array_merge([$word['jyutping_code']], $wrongOptions);
                shuffle($options);
                
                $questions[] = [
                    'id' => uniqid('q_'),
                    'character' => $word['hanzi'] ?? $word['word'] ?? '',
                    'meaning' => $word['word'] ?? $word['hanzi'] ?? '',
                    'correct_answer' => $word['jyutping_code'],
                    'options' => $options
                ];
            }
            
            return successResponse([
                'game_type' => 'spelling',
                'difficulty' => $difficulty,
                'questions' => $questions,
                'count' => count($questions)
            ]);
            
        } catch (Exception $e) {
            error_log("Spelling game error: " . $e->getMessage());
            return errorResponse('Failed to get spelling game questions', 500);
        }
    }
    
    // GET /games/matching - Get matching game (word-picture or jyutping-picture)
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'matching') {
        $user = requireAuth($authToken);
        $gameType = $_GET['type'] ?? 'word-picture'; // 'word-picture' or 'jyutping-picture'
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 8;
        
        try {
            // Get cards with images and valid titles (exclude empty or default "hello" cards)
            $stmt = $db->prepare("
                SELECT DISTINCT c.id, c.title, c.label_text, c.image_path, c.image_url, c.category
                FROM cards c
                WHERE ((c.image_path IS NOT NULL AND c.image_path != '')
                   OR (c.image_url IS NOT NULL AND c.image_url != ''))
                AND c.title IS NOT NULL 
                AND c.title != ''
                AND LOWER(c.title) != 'hello'
                ORDER BY RAND()
                LIMIT ?
            ");
            $stmt->execute([$limit * 2]);
            $cards = $stmt->fetchAll();
            
            // Filter out cards with invalid titles
            $validCards = [];
            foreach ($cards as $card) {
                $title = trim($card['title'] ?? '');
                if (!empty($title) && strtolower($title) !== 'hello') {
                    $validCards[] = $card;
                }
            }
            
            // Get Jyutping for cards if needed
            $pairs = [];
            $cardCount = min($limit, count($validCards));
            foreach (array_slice($validCards, 0, $cardCount) as $card) {
                // Use image_url if available, otherwise image_path
                $imagePath = $card['image_url'] ?? $card['image_path'] ?? null;
                $title = trim($card['title'] ?? $card['label_text'] ?? '');
                
                // Skip if no valid title or image
                if (empty($title) || empty($imagePath)) {
                    continue;
                }
                
                $pair = [
                    'id' => uniqid('pair_'),
                    'card_id' => $card['id'],
                    'image' => $imagePath,
                    'title' => $title
                ];
                
                if ($gameType === 'jyutping-picture') {
                    // Get Jyutping for the card title
                    $stmt = $db->prepare("
                        SELECT jyutping_code, hanzi, word
                        FROM jyutping_dictionary
                        WHERE hanzi LIKE ? OR word LIKE ?
                        LIMIT 1
                    ");
                    $searchTerm = '%' . $card['title'] . '%';
                    $stmt->execute([$searchTerm, $searchTerm]);
                    $jyutping = $stmt->fetch();
                    
                    if ($jyutping) {
                        $pair['jyutping'] = $jyutping['jyutping_code'];
                        $pair['character'] = $jyutping['hanzi'] ?? $jyutping['word'] ?? '';
                    }
                }
                
                $pairs[] = $pair;
            }
            
            // Generate wrong options for matching
            $allOptions = [];
            foreach ($pairs as $pair) {
                if ($gameType === 'word-picture') {
                    $allOptions[] = $pair['title'];
                } else {
                    $allOptions[] = $pair['jyutping'] ?? $pair['title'];
                }
            }
            
            // Shuffle pairs
            shuffle($pairs);
            
            return successResponse([
                'game_type' => 'matching',
                'match_type' => $gameType,
                'pairs' => $pairs,
                'options' => $allOptions,
                'count' => count($pairs)
            ]);
            
        } catch (Exception $e) {
            error_log("Matching game error: " . $e->getMessage());
            return errorResponse('Failed to get matching game', 500);
        }
    }
    
    // POST /games/submit - Submit game result
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'submit') {
        $user = requireAuth($authToken);
        $gameType = $data['game_type'] ?? null; // 'spelling', 'word-picture', 'jyutping-picture'
        $score = isset($data['score']) ? (int)$data['score'] : 0;
        $totalQuestions = isset($data['total_questions']) ? (int)$data['total_questions'] : 0;
        $timeSpent = isset($data['time_spent']) ? (int)$data['time_spent'] : 0; // seconds
        $difficulty = $data['difficulty'] ?? 'medium';
        
        if (!$gameType) {
            return errorResponse('Game type is required', 400);
        }
        
        try {
            // Calculate accuracy
            $accuracy = $totalQuestions > 0 ? ($score / $totalQuestions) * 100 : 0;
            
            // Save game result (assuming there's a games table, or use action_logs)
            $stmt = $db->prepare("
                INSERT INTO action_logs (user_id, action_type, metadata, created_at)
                VALUES (?, 'game_completed', ?, NOW())
            ");
            $metadata = json_encode([
                'game_type' => $gameType,
                'score' => $score,
                'total_questions' => $totalQuestions,
                'accuracy' => round($accuracy, 2),
                'time_spent' => $timeSpent,
                'difficulty' => $difficulty
            ]);
            $stmt->execute([$user['id'], $metadata]);
            
            // Get user's game statistics
            $stmt = $db->prepare("
                SELECT 
                    COUNT(*) as games_played,
                    AVG(CAST(JSON_EXTRACT(metadata, '$.accuracy') AS DECIMAL(5,2))) as avg_accuracy,
                    MAX(CAST(JSON_EXTRACT(metadata, '$.score') AS UNSIGNED)) as best_score
                FROM action_logs
                WHERE user_id = ? AND action_type = 'game_completed'
                  AND JSON_EXTRACT(metadata, '$.game_type') = ?
            ");
            $stmt->execute([$user['id'], $gameType]);
            $stats = $stmt->fetch();
            
            return successResponse([
                'success' => true,
                'score' => $score,
                'total_questions' => $totalQuestions,
                'accuracy' => round($accuracy, 2),
                'stats' => [
                    'games_played' => (int)$stats['games_played'],
                    'avg_accuracy' => round((float)$stats['avg_accuracy'], 2),
                    'best_score' => (int)$stats['best_score']
                ]
            ]);
            
        } catch (Exception $e) {
            error_log("Game submit error: " . $e->getMessage());
            return errorResponse('Failed to submit game result', 500);
        }
    }
    
    // GET /games/history - Get game history
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'history') {
        $user = requireAuth($authToken);
        $gameType = $_GET['game_type'] ?? null;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        
        try {
            $sql = "
                SELECT id, metadata, created_at
                FROM action_logs
                WHERE user_id = ? AND action_type = 'game_completed'
            ";
            $params = [$user['id']];
            
            if ($gameType) {
                $sql .= " AND JSON_EXTRACT(metadata, '$.game_type') = ?";
                $params[] = $gameType;
            }
            
            $sql .= " ORDER BY created_at DESC LIMIT ?";
            $params[] = $limit;
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $logs = $stmt->fetchAll();
            
            $history = [];
            foreach ($logs as $log) {
                $metadata = json_decode($log['metadata'], true);
                $history[] = [
                    'id' => $log['id'],
                    'game_type' => $metadata['game_type'] ?? 'unknown',
                    'score' => $metadata['score'] ?? 0,
                    'total_questions' => $metadata['total_questions'] ?? 0,
                    'accuracy' => $metadata['accuracy'] ?? 0,
                    'time_spent' => $metadata['time_spent'] ?? 0,
                    'difficulty' => $metadata['difficulty'] ?? 'medium',
                    'played_at' => $log['created_at']
                ];
            }
            
            return successResponse([
                'history' => $history,
                'count' => count($history)
            ]);
            
        } catch (Exception $e) {
            error_log("Game history error: " . $e->getMessage());
            return errorResponse('Failed to get game history', 500);
        }
    }
    
    return errorResponse('Games route not found', 404);
}

