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

/**
 * Load translation JSON file (e.g., zh-TW.json) into an associative array.
 */
function loadTranslations($path) {
    if (empty($path)) {
        error_log("  [loadTranslations] Empty path provided");
        return [];
    }
    if (!file_exists($path)) {
        error_log("  [loadTranslations] File does not exist: $path");
        return [];
    }
    if (!is_readable($path)) {
        error_log("  [loadTranslations] File is not readable: $path");
        return [];
    }
    $json = file_get_contents($path);
    if ($json === false) {
        error_log("  [loadTranslations] Failed to read file: $path");
        return [];
    }
    if (empty($json)) {
        error_log("  [loadTranslations] File is empty: $path");
        return [];
    }
    $data = json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("  [loadTranslations] JSON decode error: " . json_last_error_msg() . " in $path");
        return [];
    }
    if (!is_array($data)) {
        error_log("  [loadTranslations] Decoded data is not an array in $path");
        return [];
    }
    error_log("  [loadTranslations] Successfully loaded " . count($data) . " entries from $path");
    return $data;
}

/**
 * Resolve labelKey to Chinese text using translation files.
 * Returns the Chinese text if found, or null.
 */
function resolveLabelKeyToChinese($labelKey, $translationsZhTw, $translationsZhCn, $debug = false) {
    if (empty($labelKey)) {
        if ($debug) error_log("    [resolveLabelKey] Empty labelKey");
        return null;
    }
    
    if ($debug) error_log("    [resolveLabelKey] Looking up: '$labelKey'");
    
    // Try zh-TW first, then zh-CN
    if (isset($translationsZhTw[$labelKey])) {
        $translated = $translationsZhTw[$labelKey];
        if ($debug) error_log("    [resolveLabelKey] Found in zh-TW: '$translated'");
        if (preg_match('/\p{Han}/u', $translated)) {
            if ($debug) error_log("    [resolveLabelKey] ✓ Contains Chinese, returning");
            return $translated;
        } else {
            if ($debug) error_log("    [resolveLabelKey] ✗ No Chinese characters in translation");
        }
    } else {
        if ($debug) {
            $count = is_array($translationsZhTw) ? count($translationsZhTw) : 0;
            error_log("    [resolveLabelKey] Not found in zh-TW (count: $count)");
        }
    }
    
    if (isset($translationsZhCn[$labelKey])) {
        $translated = $translationsZhCn[$labelKey];
        if ($debug) error_log("    [resolveLabelKey] Found in zh-CN: '$translated'");
        if (preg_match('/\p{Han}/u', $translated)) {
            if ($debug) error_log("    [resolveLabelKey] ✓ Contains Chinese, returning");
            return $translated;
        } else {
            if ($debug) error_log("    [resolveLabelKey] ✗ No Chinese characters in translation");
        }
    } else {
        if ($debug) {
            $count = is_array($translationsZhCn) ? count($translationsZhCn) : 0;
            error_log("    [resolveLabelKey] Not found in zh-CN (count: $count)");
        }
    }
    
    if ($debug) error_log("    [resolveLabelKey] ✗ No match found");
    return null;
}

/**
 * Get matching rules for a user/profile
 * Returns array with rule configuration or default rules
 */
function getMatchingRules($db, $userId = null, $profileId = null) {
    if (!$userId) {
        // Return default rules
        return [
            'frequency_threshold' => 50,
            'allow_exact_match' => true,
            'allow_substring_match' => true,
            'allow_single_char_match' => true,
            'require_ai_correction' => false,
            'ai_confidence_threshold' => 0.50,
            'enabled' => true
        ];
    }
    
    try {
        $sql = "SELECT * FROM jyutping_matching_rules 
                WHERE user_id = ? 
                  AND enabled = 1
                  AND (profile_id = ? OR (profile_id IS NULL AND ? IS NULL))
                ORDER BY profile_id DESC
                LIMIT 1";
        $stmt = $db->prepare($sql);
        $stmt->execute([$userId, $profileId, $profileId]);
        $rule = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($rule) {
            return [
                'frequency_threshold' => (int)$rule['frequency_threshold'],
                'allow_exact_match' => (bool)$rule['allow_exact_match'],
                'allow_substring_match' => (bool)$rule['allow_substring_match'],
                'allow_single_char_match' => (bool)$rule['allow_single_char_match'],
                'require_ai_correction' => (bool)$rule['require_ai_correction'],
                'ai_confidence_threshold' => (float)$rule['ai_confidence_threshold'],
                'enabled' => true
            ];
        }
    } catch (Exception $e) {
        error_log("Get matching rules error: " . $e->getMessage());
    }
    
    // Return default rules
    return [
        'frequency_threshold' => 50,
        'allow_exact_match' => true,
        'allow_substring_match' => true,
        'allow_single_char_match' => true,
        'require_ai_correction' => false,
        'ai_confidence_threshold' => 0.50,
        'enabled' => true
    ];
}

/**
 * Get enabled exception rules for a user/profile
 * Returns array of enabled rule keys
 */
function getEnabledExceptionRules($db, $userId = null, $profileId = null) {
    if (!$userId) {
        // Return default enabled rules
        return ['allow_tone_variants', 'enable_ai_correction', 'allow_character_variants'];
    }
    
    try {
        $sql = "SELECT er.rule_key
                FROM jyutping_exception_rules er
                LEFT JOIN jyutping_student_exception_rules ser 
                    ON ser.rule_id = er.id 
                    AND ser.user_id = ?
                    AND (ser.profile_id = ? OR (ser.profile_id IS NULL AND ? IS NULL))
                WHERE COALESCE(ser.enabled, er.default_enabled) = 1
                ORDER BY er.rule_key";
        $stmt = $db->prepare($sql);
        $stmt->execute([$userId, $profileId, $profileId]);
        $rules = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        return $rules ?: ['allow_tone_variants', 'enable_ai_correction', 'allow_character_variants'];
    } catch (Exception $e) {
        error_log("Get exception rules error: " . $e->getMessage());
        return ['allow_tone_variants', 'enable_ai_correction', 'allow_character_variants'];
    }
}


/**
 * Count Jyutping syllables in a code string.
 */
function count_jyutping_syllables(string $jp): int {
    $jp = trim(preg_replace('/\s+/', ' ', $jp));
    if ($jp === '') return 0;
    return count(explode(' ', $jp));
}

/**
 * Require Jyutping syllable count to match Hanzi length.
 */
function is_valid_full_jyutping(string $hanzi, string $jp): bool {
    $hanziLen = mb_strlen($hanzi, 'UTF-8');
    $sylCount = count_jyutping_syllables($jp);
    return $hanziLen > 0 && $hanziLen === $sylCount;
}

/**
 * Validate AI‑generated Jyutping: length + basic pattern.
 */
function validate_ai_jyutping(string $hanzi, string $aiJp): ?string {
    $jp = trim($aiJp);
    if ($jp === '') return null;

    // 1) syllable count must equal Hanzi length
    if (!is_valid_full_jyutping($hanzi, $jp)) {
        return null;
    }

    // 2) basic Jyutping form: letters+tone per syllable
    if (!preg_match('/^[a-z]+[1-6](\s+[a-z]+[1-6])*$/', $jp)) {
        return null;
    }

    return $jp;
}

/**
 * Find Jyutping for a given Chinese text (hanzi/word).
 * Returns array with jyutping_code, hanzi, word, or null if not found.
 * 
 * Matching strategy (in order of preference):
 * 1. Exact match (highest priority)
 * 2. Longest substring match (prefer longer matches over shorter ones)
 * 3. Single character match (last resort)
 * 
 * @param PDO $db Database connection
 * @param string $chineseText Chinese text to find Jyutping for
 * @param bool $debug Enable debug logging
 * @param int|null $userId Optional: user ID to apply custom matching rules
 * @param int|null $profileId Optional: profile ID to apply profile-specific rules
 */
function findJyutpingForText($db, $chineseText, $debug = false, $userId = null, $profileId = null) {
    if (empty($chineseText)) {
        if ($debug) error_log("  [findJyutping] Empty chineseText");
        return null;
    }
    
    if ($debug) error_log("  [findJyutping] Searching for: '$chineseText' (length: " . mb_strlen($chineseText, 'UTF-8') . ")");
    
    // Get matching rules for this user/profile
    $rules = getMatchingRules($db, $userId, $profileId);
    $exceptionRules = getEnabledExceptionRules($db, $userId, $profileId);
    
    if (!$rules['enabled']) {
        if ($debug) error_log("  [findJyutping] Matching rules disabled for user");
        return null;
    }
    
    $textLength = mb_strlen($chineseText, 'UTF-8');
    $frequencyThreshold = $rules['frequency_threshold'];
    
    // Strategy 1: Exact match (hanzi or word) - prioritize by frequency
    if ($rules['allow_exact_match']) {
        $stmt = $db->prepare("
            SELECT jyutping_code, hanzi, word, frequency
            FROM jyutping_dictionary
            WHERE (hanzi = ? OR word = ?)
              AND frequency > ?
            ORDER BY frequency DESC, id ASC
            LIMIT 1
        ");
        $stmt->execute([$chineseText, $chineseText, $frequencyThreshold]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($result) {
            // 標記匹配類型與長度，方便下游計算置信度
            $result['_match_type'] = 'exact';
            $result['_match_length'] = $textLength;
            if ($debug) error_log("  [findJyutping] ✓ Exact match found: {$result['jyutping_code']} (hanzi={$result['hanzi']}, word={$result['word']}, freq={$result['frequency']})");
            return $result;
        }
        if ($debug) error_log("  [findJyutping] ✗ No exact match");
    }
    
    // Strategy 2: Try to find longest matching substring
    // For multi-character text, try matching progressively shorter substrings
    // This ensures we match "今天" as a whole rather than just "天"
    if ($rules['allow_substring_match'] && $textLength > 1) {
        // Try matching from longest to shortest substring
        for ($len = $textLength; $len >= 2; $len--) {
            for ($start = 0; $start <= $textLength - $len; $start++) {
                $substring = mb_substr($chineseText, $start, $len, 'UTF-8');
                $stmt = $db->prepare("
                    SELECT jyutping_code, hanzi, word, frequency
                    FROM jyutping_dictionary
                    WHERE (hanzi = ? OR word = ?)
                      AND frequency > ?
                    ORDER BY frequency DESC, id ASC
                    LIMIT 1
                ");
                $stmt->execute([$substring, $substring, $frequencyThreshold]);
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($result) {
                    $result['_match_type'] = 'substring';
                    $result['_match_length'] = mb_strlen($substring, 'UTF-8');
                    if ($debug) error_log("  [findJyutping] ✓ Substring match (length $len): '$substring' -> {$result['jyutping_code']} (hanzi={$result['hanzi']}, freq={$result['frequency']})");
                    return $result;
                }
            }
        }
    }
    
    // Strategy 3: Single character match (only if text is single character or no multi-char match found)
    if ($rules['allow_single_char_match'] && $textLength === 1) {
        $stmt = $db->prepare("
            SELECT jyutping_code, hanzi, word, frequency
            FROM jyutping_dictionary
            WHERE (hanzi = ? OR word = ?)
              AND frequency > ?
            ORDER BY frequency DESC, id ASC
            LIMIT 1
        ");
        $stmt->execute([$chineseText, $chineseText, $frequencyThreshold]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($result) {
            $result['_match_type'] = 'single_char';
            $result['_match_length'] = 1;
            if ($debug) error_log("  [findJyutping] ✓ Single char match: {$result['jyutping_code']} (hanzi={$result['hanzi']}, freq={$result['frequency']})");
            return $result;
        }
    }
    
    if ($debug) error_log("  [findJyutping] ✗ No match found - giving up");
    return null;
}

/**
 * Safe Jyutping lookup for games: only full‑word mappings allowed.
 */
function findFullWordJyutpingForGame(PDO $db, string $chineseText, ?bool $debug, ?int $userId, ?int $profileId): ?array {
    $debug = (bool)$debug;
    $result = findJyutpingForText($db, $chineseText, $debug, $userId, $profileId);
    if (!$result) return null;

    $jp = $result['jyutping_code'] ?? '';
    $hanzi = $result['hanzi'] ?? $result['word'] ?? $chineseText;

    // Reject if Jyutping structure or length do not match
    if (!is_valid_full_jyutping($chineseText, $jp)) {
        if ($debug) {
            error_log("  [findFullWordJyutpingForGame] Rejecting non‑full match for '$chineseText': jp='$jp'");
        }
        return null;
    }

    // Also require the matched hanzi to be the full text (no partial like '椒鹽')
    if (mb_strlen($hanzi, 'UTF-8') !== mb_strlen($chineseText, 'UTF-8')) {
        if ($debug) {
            error_log("  [findFullWordJyutpingForGame] Rejecting substring hanzi='$hanzi' for '$chineseText'");
        }
        return null;
    }

    return $result;
}


function handleGamesRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    
    if ($db === null) {
        error_log("Database connection failed in handleGamesRoutes");
        return errorResponse('Database connection failed. Please check server configuration.', 500);
    }
    
    // Load translations for labelKey resolution (same as export script)
    // __DIR__ is backend/api/routes, so we need to go up 3 levels to get to project root
    $projectRoot = realpath(__DIR__ . '/../../..'); // backend/api/routes -> backend/api -> backend -> project root
    if (!$projectRoot) {
        // Fallback: try alternative paths
        $projectRoot = realpath(__DIR__ . '/../..'); // backend/api -> backend
        if ($projectRoot) {
            $projectRoot = dirname($projectRoot); // Go up one more level
        }
    }
    
    $zhTwPath = $projectRoot ? realpath($projectRoot . '/src/translations/zh-TW.json') : null;
    $zhCnPath = $projectRoot ? realpath($projectRoot . '/src/translations/zh-CN.json') : null;
    
    // Debug: Log path resolution
    error_log("Project root: " . ($projectRoot ?: 'NOT FOUND'));
    error_log("zh-TW path: " . ($zhTwPath ?: 'NOT FOUND'));
    error_log("zh-CN path: " . ($zhCnPath ?: 'NOT FOUND'));
    
    $translationsZhTw = $zhTwPath ? loadTranslations($zhTwPath) : [];
    $translationsZhCn = $zhCnPath ? loadTranslations($zhCnPath) : [];
    
    // Debug: Log translation loading
    error_log("Translation files loaded: zh-TW=" . count($translationsZhTw) . " entries, zh-CN=" . count($translationsZhCn) . " entries");
    if (count($translationsZhTw) > 0) {
        $sampleKeys = array_slice(array_keys($translationsZhTw), 0, 3);
        error_log("Sample zh-TW keys: " . implode(', ', $sampleKeys));
    } else {
        error_log("WARNING: Translation files not loaded! Check paths above.");
    }
    
    /**
     * Load default boards from frontend JSON file.
     * These contain default Cboard symbols that aren't in the database.
     */
    function loadDefaultBoards($projectRoot) {
        // Try multiple possible paths
        $possiblePaths = [
            $projectRoot . '/src/api/boards.json',
            __DIR__ . '/../../../src/api/boards.json', // backend/api/routes -> backend/api -> backend -> project root -> src/api
            dirname(dirname(dirname(__DIR__))) . '/src/api/boards.json',
            __DIR__ . '/../../src/api/boards.json' // Fallback: backend/api -> backend -> src/api (wrong but try anyway)
        ];
        
        $boardsJsonPath = null;
        foreach ($possiblePaths as $path) {
            $resolved = realpath($path);
            if ($resolved && is_readable($resolved)) {
                $boardsJsonPath = $resolved;
                break;
            }
        }
        
        if (!$boardsJsonPath) {
            error_log("Could not find boards.json. Tried: " . implode(', ', $possiblePaths));
            return [];
        }
        
        error_log("Loading default boards from: $boardsJsonPath");
        $json = file_get_contents($boardsJsonPath);
        if ($json === false) {
            error_log("Failed to read boards.json file");
            return [];
        }
        
        $data = json_decode($json, true);
        if (!is_array($data) || !isset($data['advanced'])) {
            error_log("boards.json structure invalid or missing 'advanced' key");
            return [];
        }
        
        // Return all boards from advanced array
        $boards = is_array($data['advanced']) ? $data['advanced'] : [];
        error_log("Loaded " . count($boards) . " default boards from JSON");
        return $boards;
    }
    
    // Recursively extract all tiles from all boards (including nested sub-boards)
    function extractAllTilesFromBoards($boards, $boardMap = null) {
        if ($boardMap === null) {
            // First pass: build a map of board ID -> board for quick lookup
            $boardMap = [];
            foreach ($boards as $board) {
                if (isset($board['id']) && is_array($board)) {
                    $boardMap[$board['id']] = $board;
                }
            }
        }
        
        $allTiles = [];
        $processedBoards = []; // Track processed boards to avoid infinite loops
        
        $processBoard = function($board, $depth = 0) use (&$processBoard, &$allTiles, &$processedBoards, $boardMap) {
            if (!is_array($board) || !isset($board['id'])) {
                return;
            }
            
            $boardId = $board['id'];
            
            // Avoid infinite loops (circular references)
            if (isset($processedBoards[$boardId])) {
                return;
            }
            $processedBoards[$boardId] = true;
            
            // Process tiles in this board
            if (isset($board['tiles']) && is_array($board['tiles'])) {
                foreach ($board['tiles'] as $tile) {
                    if (!is_array($tile)) {
                        continue;
                    }
                    
                    // If tile has loadBoard, recursively process that sub-board
                    if (isset($tile['loadBoard']) && isset($boardMap[$tile['loadBoard']])) {
                        $subBoard = $boardMap[$tile['loadBoard']];
                        $processBoard($subBoard, $depth + 1);
                    }
                    
                    // Add this tile (if it's not a folder tile, or if we want folder tiles too)
                    // For matching games, we want actual symbol tiles, not folder tiles
                    // So we skip tiles that only have loadBoard without image
                    if (isset($tile['image']) && isset($tile['labelKey'])) {
                        $allTiles[] = $tile;
                    }
                }
            }
        };
        
        // Process all boards
        foreach ($boards as $board) {
            $processBoard($board);
        }
        
        return $allTiles;
    }
    
    $defaultBoards = loadDefaultBoards($projectRoot);
    
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
                WHERE frequency > 50
                  AND frequency >= ? AND frequency <= ?
                ORDER BY RAND()
                LIMIT ?
            ");
            $stmt->execute([$frequencyMin, $frequencyMax, $limit]);
            $words = $stmt->fetchAll();
            
            // Generate questions: Given jyutping, choose correct hanzi
            $questions = [];
            foreach ($words as $word) {
                // Get wrong hanzi options (different hanzi with different jyutping)
                $stmt = $db->prepare("
                    SELECT hanzi, word
                    FROM jyutping_dictionary
                    WHERE jyutping_code != ?
                      AND (hanzi IS NOT NULL AND hanzi != '')
                    ORDER BY RAND()
                    LIMIT 3
                ");
                $stmt->execute([$word['jyutping_code']]);
                $wrongOptions = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Build options array with correct and wrong hanzi
                $options = [];
                // Add correct answer
                $correctHanzi = $word['hanzi'] ?? $word['word'] ?? '';
                if ($correctHanzi) {
                    $options[] = $correctHanzi;
                }
                // Add wrong options
                foreach ($wrongOptions as $wrong) {
                    $wrongHanzi = $wrong['hanzi'] ?? $wrong['word'] ?? '';
                    if ($wrongHanzi && $wrongHanzi !== $correctHanzi) {
                        $options[] = $wrongHanzi;
                    }
                }
                // Remove duplicates and shuffle
                $options = array_unique($options);
                shuffle($options);
                
                $questions[] = [
                    'id' => uniqid('q_'),
                    'jyutping' => $word['jyutping_code'], // Display jyutping as question
                    'correct_answer' => $correctHanzi, // Correct hanzi to select
                    'correct_jyutping' => $word['jyutping_code'], // Store for logging
                    'options' => $options // Options are hanzi
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
        $profileId = isset($_GET['profile_id']) ? (int)$_GET['profile_id'] : null; // Optional: current profile ID to prioritize
        
        try {
            // For jyutping-picture games, verify dictionary has data
            if ($gameType === 'jyutping-picture') {
                $stmt = $db->prepare("SELECT COUNT(*) as count FROM jyutping_dictionary");
                $stmt->execute();
                $dictCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
                error_log("=== JYUTPING MATCHING GAME START ===");
                error_log("Dictionary has $dictCount entries");
                
                // Show sample entries from dictionary
                $stmt = $db->prepare("SELECT jyutping_code, hanzi, word, frequency FROM jyutping_dictionary ORDER BY frequency DESC LIMIT 10");
                $stmt->execute();
                $samples = $stmt->fetchAll(PDO::FETCH_ASSOC);
                error_log("Sample dictionary entries:");
                foreach ($samples as $sample) {
                    error_log("  - jyutping='{$sample['jyutping_code']}', hanzi='{$sample['hanzi']}', word='{$sample['word']}', freq={$sample['frequency']}");
                }
                
                if ($dictCount == 0) {
                    return successResponse([
                        'game_type' => 'matching',
                        'match_type' => $gameType,
                        'pairs' => [],
                        'options' => [],
                        'count' => 0,
                        'message' => 'Jyutping dictionary is empty. Please run: php backend/scripts/seed-jyutping-from-csv.php'
                    ]);
                }
            }
            $allItems = [];
            
            // Add default Cboard symbols from frontend JSON (if not in database)
            // These are the original symbols like clock, food, etc.
            // Recursively extract ALL tiles from ALL boards (including nested sub-boards)
            $defaultItemsCount = 0;
            $allDefaultTiles = extractAllTilesFromBoards($defaultBoards);
            
            if ($gameType === 'jyutping-picture') {
                error_log("Extracted " . count($allDefaultTiles) . " tiles from all default boards (including nested)");
            }
            
            foreach ($allDefaultTiles as $tile) {
                if (!is_array($tile)) {
                    continue;
                }
                
                $image = $tile['image'] ?? null;
                $labelKey = $tile['labelKey'] ?? '';
                
                if ($image && $labelKey) {
                    // 根據遊戲類型與可用翻譯決定要顯示的文字
                    $resolvedLabel = resolveLabelKeyToChinese($labelKey, $translationsZhTw, $translationsZhCn);
                    
                    // word-picture：可以用任何語言的文字，優先用翻譯，否則用 labelKey
                    if ($gameType === 'word-picture') {
                        $displayText = $resolvedLabel ?: $labelKey;
                        
                        // Skip 空字串或僅空白
                        $labelLower = strtolower(trim($displayText));
                        if (empty($labelLower)) {
                            continue;
                        }
                        
                        // 過濾掉 hello 類型的預設卡
                        if ($labelLower === 'hello') {
                            continue;
                        }
                        if (stripos($image, 'hello') !== false) {
                            continue;
                        }
                        
                        $allItems[] = [
                            'id' => 'default_tile_' . ($tile['id'] ?? uniqid('', true)),
                            'title' => $displayText,
                            'label_text' => $displayText,
                            'image_path' => $image,
                            'image_url' => $image,
                            'category' => $tile['category'] ?? 'default',
                            'source_type' => 'default_board',
                            'priority' => 0,
                            'labelKey' => $labelKey
                        ];
                        $defaultItemsCount++;
                    } else {
                        // jyutping-picture：必須是中文，因為後面要用來查 jyutping
                        if (!$resolvedLabel) {
                            continue;
                        }
                        
                        $labelLower = strtolower(trim($resolvedLabel));
                        if (empty($labelLower) || $labelLower === 'hello') {
                            continue;
                        }
                        if (stripos($image, 'hello') !== false) {
                            continue;
                        }
                        
                        $allItems[] = [
                            'id' => 'default_tile_' . ($tile['id'] ?? uniqid('', true)),
                            'title' => $resolvedLabel,
                            'label_text' => $resolvedLabel,
                            'image_path' => $image,
                            'image_url' => $image,
                            'category' => $tile['category'] ?? 'default',
                            'source_type' => 'default_board',
                            'priority' => 0,
                            'labelKey' => $labelKey
                        ];
                        $defaultItemsCount++;
                    }
                }
            }
            
            if ($gameType === 'jyutping-picture') {
                error_log("Loaded $defaultItemsCount default board items from JSON (after filtering)");
                // Log sample of default items
                $sampleCount = min(5, count($allItems));
                for ($i = 0; $i < $sampleCount; $i++) {
                    $item = $allItems[$i];
                    error_log("  Sample default item #$i: title='{$item['title']}', labelKey='{$item['labelKey']}', image=" . substr($item['image_url'] ?? '', 0, 50));
                }
            }
            
            // If profile_id is provided, prioritize cards from that profile
            // Also get student user_id for applying matching rules
            $studentUserId = null;
            if ($profileId) {
                // Verify profile access and get student user_id
                $stmt = $db->prepare("SELECT id, user_id, is_public FROM profiles WHERE id = ?");
                $stmt->execute([$profileId]);
                $profile = $stmt->fetch();
                
                if ($profile && ($profile['user_id'] == $user['id'] || $profile['is_public'])) {
                    $studentUserId = (int)$profile['user_id']; // Get student's user_id for matching rules
                    // Get cards from this profile via profile_cards
                    $stmt = $db->prepare("
                        SELECT DISTINCT
                            CONCAT('card_', c.id) as id,
                            c.title,
                            c.label_text,
                            c.image_path,
                            c.image_url,
                            c.category,
                            'current_profile' as source_type
                        FROM cards c
                        INNER JOIN profile_cards pc ON c.id = pc.card_id
                        WHERE pc.profile_id = ?
                        AND ((c.image_path IS NOT NULL AND c.image_path != '')
                             OR (c.image_url IS NOT NULL AND c.image_url != ''))
                        AND c.title IS NOT NULL 
                        AND c.title != ''
                        AND LOWER(TRIM(c.title)) != 'hello'
                        AND (c.label_text IS NULL OR c.label_text = '' OR LOWER(TRIM(c.label_text)) != 'hello')
                    ");
                    $stmt->execute([$profileId]);
                    $profileCards = $stmt->fetchAll();
                    
                    foreach ($profileCards as $card) {
                        $title = trim($card['title'] ?? '');
                        $labelText = trim($card['label_text'] ?? '');
                        $imagePath = $card['image_url'] ?? $card['image_path'] ?? null;
                        
                        if (empty($title) || empty($imagePath)) {
                            continue;
                        }
                        
                        // Skip if label is "hello"
                        if (strtolower($title) === 'hello' || strtolower($labelText) === 'hello') {
                            continue;
                        }
                        
                        // Skip if image path contains "hello"
                        if (stripos($imagePath, 'hello') !== false) {
                            continue;
                        }
                        
                        $allItems[] = [
                            'id' => $card['id'],
                            'title' => $title,
                            'label_text' => $labelText ?: $title,
                            'image_path' => $imagePath,
                            'image_url' => $imagePath,
                            'category' => $card['category'] ?? 'profile',
                            'source_type' => 'current_profile',
                            'priority' => 1, // High priority for current profile
                        ];
                    }
                }
            }
            
            // Get cards with images and valid titles (exclude empty or default "hello" cards)
            $stmt = $db->prepare("
                SELECT DISTINCT 
                    CONCAT('card_', c.id) as id,
                    c.title, 
                    c.label_text, 
                    c.image_path, 
                    c.image_url, 
                    c.category,
                    'card' as source_type
                FROM cards c
                WHERE ((c.image_path IS NOT NULL AND c.image_path != '')
                   OR (c.image_url IS NOT NULL AND c.image_url != ''))
                AND c.title IS NOT NULL 
                AND c.title != ''
                AND LOWER(TRIM(c.title)) != 'hello'
                AND (c.label_text IS NULL OR c.label_text = '' OR LOWER(TRIM(c.label_text)) != 'hello')
                AND c.category IS NOT NULL
                AND c.category != ''
                ORDER BY RAND()
                LIMIT ?
            ");
            $stmt->execute([$limit * 2]);
            $cards = $stmt->fetchAll();
            foreach ($cards as $card) {
                $card['priority'] = 2; // Medium priority for cards
            }
            $allItems = array_merge($allItems, $cards);
            
            // Get cards from other profiles (user's profiles and public profiles)
            // This provides additional card variety beyond the current profile
            // NOTE: MySQL 5.7+ with ONLY_FULL_GROUP_BY / strict mode does not allow
            // ORDER BY columns that are not in the SELECT list when using DISTINCT.
            // The original query used "ORDER BY p.is_public DESC, RAND()" which
            // causes "Expression #1 of ORDER BY clause is not in SELECT list" errors
            // on some MySQL configurations. For the matching game we only need a
            // random sampling of cards, so it's safe to drop the p.is_public ordering
            // and simply randomize the results.
            $stmt = $db->prepare("
                SELECT DISTINCT
                    CONCAT('card_', c.id) as id,
                    c.title,
                    c.label_text,
                    c.image_path,
                    c.image_url,
                    c.category,
                    'profile' as source_type
                FROM cards c
                INNER JOIN profile_cards pc ON c.id = pc.card_id
                INNER JOIN profiles p ON pc.profile_id = p.id
                WHERE (p.user_id = ? OR p.is_public = 1)
                " . ($profileId ? "AND p.id != ?" : "") . "
                AND ((c.image_path IS NOT NULL AND c.image_path != '')
                     OR (c.image_url IS NOT NULL AND c.image_url != ''))
                AND c.title IS NOT NULL 
                AND c.title != ''
                AND LOWER(TRIM(c.title)) != 'hello'
                AND (c.label_text IS NULL OR c.label_text = '' OR LOWER(TRIM(c.label_text)) != 'hello')
                ORDER BY RAND()
                LIMIT 100
            ");
            if ($profileId) {
                $stmt->execute([$user['id'], $profileId]);
            } else {
                $stmt->execute([$user['id']]);
            }
            $otherProfileCards = $stmt->fetchAll();
            
            foreach ($otherProfileCards as $card) {
                $title = trim($card['title'] ?? '');
                $labelText = trim($card['label_text'] ?? '');
                $imagePath = $card['image_url'] ?? $card['image_path'] ?? null;
                
                if (empty($title) || empty($imagePath)) {
                    continue;
                }
                
                // Skip if label is "hello"
                if (strtolower($title) === 'hello' || strtolower($labelText) === 'hello') {
                    continue;
                }
                
                // Skip if image path contains "hello"
                if (stripos($imagePath, 'hello') !== false) {
                    continue;
                }
                
                $allItems[] = [
                    'id' => $card['id'],
                    'title' => $title,
                    'label_text' => $labelText ?: $title,
                    'image_path' => $imagePath,
                    'image_url' => $imagePath,
                    'category' => $card['category'] ?? 'profile',
                    'source_type' => 'profile',
                    'priority' => 2, // Medium priority for other profiles
                ];
            }
            
            // Sort items by priority (current board first, then cards, then other boards, then default)
            // This ensures current board tiles are processed first, but default boards are still included
            usort($allItems, function($a, $b) {
                $priorityA = $a['priority'] ?? 999;
                $priorityB = $b['priority'] ?? 999;
                return $priorityA - $priorityB;
            });
            
            if ($gameType === 'jyutping-picture') {
                error_log("Total items after sorting: " . count($allItems) . " (default: $defaultItemsCount)");
            }
            
            // Filter out items with invalid titles more strictly
            $validItems = [];
            foreach ($allItems as $item) {
                $title = trim($item['title'] ?? '');
                $labelText = trim($item['label_text'] ?? '');
                
                // Skip if title is empty or "hello"
                if (empty($title) || strtolower($title) === 'hello') {
                    continue;
                }
                
                // Skip if label_text is "hello" (even if title is different)
                if (!empty($labelText) && strtolower($labelText) === 'hello') {
                    continue;
                }
                
                // Skip if title contains only "hello" (case-insensitive)
                if (preg_match('/^hello\s*$/i', $title)) {
                    continue;
                }
                
                // Ensure we have a valid image
                $imagePath = $item['image_url'] ?? $item['image_path'] ?? null;
                if (empty($imagePath)) {
                    continue;
                }
                
                // Skip if image path looks invalid or contains "hello"
                if (stripos($imagePath, 'hello') !== false) {
                    continue;
                }
                
                $validItems[] = $item;
            }
            
            // Get Jyutping for items if needed
            $pairs = [];
            // For jyutping-picture, we need more items since some might not have jyutping
            // Increase multiplier to ensure we get enough matches including default boards
            $itemCount = $gameType === 'jyutping-picture' 
                ? min($limit * 5, count($validItems)) // Get 5x more for jyutping games to include defaults
                : min($limit * 2, count($validItems)); // Get 2x more for word games
            $usedTitles = []; // Track used titles to avoid duplicates
            
        if ($gameType === 'jyutping-picture') {
            error_log("Jyutping matching: Processing " . count($validItems) . " valid items, will check up to $itemCount");
            $defaultInValid = 0;
            foreach ($validItems as $item) {
                if (($item['source_type'] ?? '') === 'default_board') {
                    $defaultInValid++;
                }
            }
            error_log("Default board items in validItems: $defaultInValid");
        } else {
            error_log("Word-picture matching: Processing " . count($validItems) . " valid items, will check up to $itemCount");
        }
            
            // Shuffle validItems to ensure randomness
            // For better variety, do a full shuffle but still prioritize current board items slightly
            $shuffledValidItems = $validItems;
            shuffle($shuffledValidItems);
            
            // If we have a current profile, give its items a slight boost by moving some to front
            // But still keep randomness
            if ($profileId && count($shuffledValidItems) > $limit) {
                $currentProfileItems = [];
                $otherItems = [];
                foreach ($shuffledValidItems as $item) {
                    if (($item['source_type'] ?? '') === 'current_profile') {
                        $currentProfileItems[] = $item;
                    } else {
                        $otherItems[] = $item;
                    }
                }
                // Shuffle both groups separately
                shuffle($currentProfileItems);
                shuffle($otherItems);
                // Interleave: take some from current profile, then mix with others
                $shuffledValidItems = array_merge(
                    array_slice($currentProfileItems, 0, min(3, count($currentProfileItems))),
                    $otherItems
                );
                shuffle($shuffledValidItems); // Final shuffle to mix them
            }
            
            // Process items (now shuffled within priority groups)
            $processedCount = 0;
            $matchedCount = 0;
            $skippedNoJyutping = 0;
            foreach (array_slice($shuffledValidItems, 0, $itemCount) as $item) {
                $processedCount++;
                // Use image_url if available, otherwise image_path
                $imagePath = $item['image_url'] ?? $item['image_path'] ?? null;
                // Prefer labelKey if available (for proper resolution), otherwise use title
                $title = trim($item['labelKey'] ?? $item['title'] ?? $item['label_text'] ?? '');
                $sourceType = $item['source_type'] ?? 'unknown';
                
                // Skip if no valid title or image
                if (empty($title) || empty($imagePath)) {
                    if ($gameType === 'jyutping-picture') {
                        error_log("Skipping item #$processedCount: empty title or image (title='$title', source=$sourceType)");
                    }
                    continue;
                }
                
                // Skip if title is "hello" (double-check)
                if (strtolower($title) === 'hello') {
                    continue;
                }
                
                // Skip if we already have this exact pair (avoid duplicates by title + image)
                $pairKey = strtolower($title) . '|' . md5($imagePath);
                if (isset($usedTitles[$pairKey])) {
                    if ($gameType === 'jyutping-picture') {
                        error_log("Skipping item #$processedCount: duplicate (title='$title', source=$sourceType)");
                    }
                    continue;
                }
                
                $usedTitles[$pairKey] = true;
                
                if ($gameType === 'jyutping-picture') {
                    error_log("Processing item #$processedCount: title='$title', source=$sourceType, image=" . substr($imagePath, 0, 50));
                }
                
                $pair = [
                    'id' => uniqid('pair_'),
                    'item_id' => $item['id'],
                    'source_type' => $item['source_type'] ?? 'card',
                    'image' => $imagePath,
                    'title' => $title
                ];
                
                if ($gameType === 'jyutping-picture') {
                    // Get Jyutping for the item title
                    // Improved matching logic that uses translation files and prioritizes frequency
                    $jyutping = null;
                    $chineseText = null;
                    
                    // Step 1: Determine the Chinese text to search for
                    // If title already contains Chinese, use it directly
                    if (preg_match('/\p{Han}/u', $title)) {
                        $chineseText = $title;
                        if ($gameType === 'jyutping-picture') {
                            error_log("  [jyutping] Title contains Chinese: '$chineseText'");
                        }
                    } 
                    // If title is a labelKey (contains dots), try to resolve via translations
                    elseif (strpos($title, '.') !== false) {
                        if ($gameType === 'jyutping-picture') {
                            error_log("  [jyutping] Title is labelKey: '$title', resolving...");
                        }
                        $chineseText = resolveLabelKeyToChinese($title, $translationsZhTw, $translationsZhCn, $gameType === 'jyutping-picture');
                        if ($chineseText) {
                            if ($gameType === 'jyutping-picture') {
                                error_log("  [jyutping] ✓ Resolved labelKey to: '$chineseText'");
                            }
                        } else {
                            if ($gameType === 'jyutping-picture') {
                                error_log("  [jyutping] ✗ LabelKey resolution failed, trying last segment");
                            }
                            // If translation lookup failed, try extracting last segment
                            $parts = preg_split('/[._-]/', $title);
                            $lastPart = end($parts);
                            if (preg_match('/\p{Han}/u', $lastPart)) {
                                $chineseText = $lastPart;
                                if ($gameType === 'jyutping-picture') {
                                    error_log("  [jyutping] Using last segment: '$chineseText'");
                                }
                            }
                        }
                    }
                    // If title doesn't look like Chinese or labelKey, try direct lookup anyway
                    else {
                        $chineseText = $title;
                        if ($gameType === 'jyutping-picture') {
                            error_log("  [jyutping] Title is neither Chinese nor labelKey, using as-is: '$chineseText'");
                        }
                    }
                    
                    // Step 2: Find Jyutping using improved search function
                    // Apply student-specific matching rules if profileId is provided
                    if ($chineseText) {
                        $jyutping = findFullWordJyutpingForGame($db, $chineseText, false, $userId, $profileId);
                        $jyutpingCode = $jyutping ? $jyutping['jyutping_code'] : null;
                        // Enable debug
                    } else {
                        if ($gameType === 'jyutping-picture') {
                            error_log("  [jyutping] No chineseText determined for title='$title'");
                        }
                    }
                    
                    // Step 3: 根據匹配方式估算置信度，低於 0.5 則嘗試用 AI 修正粵拼
                    $jyutpingCode = null;
                    $confidence = 0.0;
                    if ($jyutping && !empty($jyutping['jyutping_code'])) {
                        $jyutpingCode = $jyutping['jyutping_code'];
                        $matchType = $jyutping['_match_type'] ?? 'unknown';
                        $matchLen  = isset($jyutping['_match_length']) ? (int)$jyutping['_match_length'] : 0;
                        $totalLen  = $chineseText ? mb_strlen($chineseText, 'UTF-8') : $matchLen;

                        if ($matchType === 'exact') {
                            $confidence = 1.0;
                        } elseif ($matchType === 'substring' && $totalLen > 0) {
                            // 子串長度佔原文比例，作為簡單置信度指標
                            $confidence = max(0.1, min(1.0, $matchLen / $totalLen));
                        } elseif ($matchType === 'single_char') {
                            // 多字詞語只命中單字，視為極低置信度
                            $confidence = ($totalLen > 1) ? 0.0 : 0.3;
                        } else {
                            $confidence = 0.6;
                        }
                    }

                    // 若置信度低於 0.5，嘗試用 AI 重新標注粵拼（僅影響本局遊戲，不直接寫回資料庫）
                    if ($chineseText && $confidence < 0.5) {
                        if ($gameType === 'jyutping-picture') {
                            error_log("  [jyutping] Low confidence match (type=" . ($jyutping['_match_type'] ?? 'none') . ", conf=$confidence), trying AI for '$chineseText'");
                        }
                        // 延遲載入 AI helper，避免無用開銷
                        require_once __DIR__ . '/../helpers/ollama.php';
                        $aiJyutping = predictJyutpingForChinese($chineseText);
                        $validatedAi = $aiJyutping ? validate_ai_jyutping($chineseText, $aiJyutping) : null;
                        if ($validatedAi) {
                            $jyutpingCode = $validatedAi;
                            $confidence = 0.9;
                            if ($gameType === 'jyutping-picture') {
                                error_log("  [jyutping] ✓ AI corrected jyutping for '$chineseText' -> '$jyutpingCode'");
                            }
                        } else {
                            if ($gameType === 'jyutping-picture') {
                                error_log("  [jyutping] ✗ AI jyutping rejected for '$chineseText' -> '" . ($aiJyutping ?? '') . "'");
                            }
                            if (($jyutping['_match_type'] ?? null) === 'single_char' || $confidence < 0.5) {
                                $jyutpingCode = null;
                            }
                        }
                    }

                    if ($jyutpingCode) {
                        $pair['jyutping'] = $jyutpingCode;
                        $pair['character'] = $jyutping['hanzi'] ?? $jyutping['word'] ?? $chineseText;
                        // Only add pair if it has jyutping code
                        $pairs[] = $pair;
                        $matchedCount++;
                        if ($gameType === 'jyutping-picture') {
                            error_log("✓ Matched #$matchedCount: title='$title' (source=$sourceType) -> jyutping='$jyutpingCode' (conf=$confidence)");
                        }
                    } else {
                        // Skip this pair if no jyutping found for jyutping-picture game
                        $skippedNoJyutping++;
                        if ($gameType === 'jyutping-picture') {
                            error_log("✗ No jyutping #$skippedNoJyutping: title='$title' (source=$sourceType), chineseText='$chineseText', labelKey='" . ($item['labelKey'] ?? 'none') . "'");
                        }
                        continue;
                    }
                } else {
                    // For word-picture, add all pairs
                    $pairs[] = $pair;
                }
                
                // Stop if we have enough pairs
                if (count($pairs) >= $limit) {
                    break;
                }
            }
            
            if ($gameType === 'jyutping-picture') {
                error_log("=== MATCHING SUMMARY ===");
                error_log("Processed: $processedCount items");
                error_log("Matched: $matchedCount pairs");
                error_log("Skipped (no jyutping): $skippedNoJyutping");
                error_log("Final pairs count: " . count($pairs));
                if (count($pairs) > 0) {
                    error_log("Sample pairs:");
                    foreach (array_slice($pairs, 0, 3) as $idx => $pair) {
                        error_log("  Pair #$idx: title='{$pair['title']}', jyutping='{$pair['jyutping']}', source={$pair['source_type']}");
                    }
                } else {
                    error_log("⚠️ NO PAIRS GENERATED - This is the problem!");
                }
            }
            
            // For jyutping-picture: filter pairs to only include those with jyutping codes
            if ($gameType === 'jyutping-picture') {
                $pairs = array_filter($pairs, function($pair) {
                    return isset($pair['jyutping']) && !empty($pair['jyutping']);
                });
                $pairs = array_values($pairs); // Re-index array
                
                // If we don't have enough pairs with jyutping, try to get more
                if (count($pairs) < $limit) {
                    // Try to get more items and find their jyutping codes
                    $additionalNeeded = $limit - count($pairs);
                    $stmt = $db->prepare("
                        SELECT DISTINCT 
                            CONCAT('card_', c.id) as id,
                            c.title, 
                            c.label_text, 
                            c.image_path, 
                            c.image_url, 
                            c.category,
                            'card' as source_type
                        FROM cards c
                        WHERE ((c.image_path IS NOT NULL AND c.image_path != '')
                           OR (c.image_url IS NOT NULL AND c.image_url != ''))
                        AND c.title IS NOT NULL 
                        AND c.title != ''
                        AND LOWER(TRIM(c.title)) != 'hello'
                        AND (c.label_text IS NULL OR c.label_text = '' OR LOWER(TRIM(c.label_text)) != 'hello')
                        AND c.category IS NOT NULL
                        AND c.category != ''
                        ORDER BY RAND()
                        LIMIT ?
                    ");
                    $stmt->execute([$additionalNeeded * 3]); // Get more to account for ones without jyutping
                    $additionalCards = $stmt->fetchAll();
                    
                    foreach ($additionalCards as $item) {
                        if (count($pairs) >= $limit) {
                            break;
                        }
                        
                        $imagePath = $item['image_path'] ?? $item['image_url'] ?? '';
                        $title = $item['title'] ?? $item['label_text'] ?? '';
                        
                        if (empty($imagePath) || empty($title)) {
                            continue;
                        }
                        
                        // Check if we already have this pair
                        $exists = false;
                        foreach ($pairs as $existingPair) {
                            if ($existingPair['id'] === 'card_' . $item['id']) {
                                $exists = true;
                                break;
                            }
                        }
                        if ($exists) {
                            continue;
                        }
                        
                        // Get Jyutping for this item (use improved matching logic)
                        $chineseText = null;
                        
                        // Determine Chinese text (same logic as main loop)
                        if (preg_match('/\p{Han}/u', $title)) {
                            $chineseText = $title;
                        } elseif (strpos($title, '.') !== false) {
                            $chineseText = resolveLabelKeyToChinese($title, $translationsZhTw, $translationsZhCn);
                            if (!$chineseText) {
                                $parts = preg_split('/[._-]/', $title);
                                $lastPart = end($parts);
                                if (preg_match('/\p{Han}/u', $lastPart)) {
                                    $chineseText = $lastPart;
                                }
                            }
                        } else {
                            $chineseText = $title;
                        }
                        
                        $jyutping = null;
                        if ($chineseText) {
                            // Apply student-specific matching rules if profileId is provided
                            $jyutping = findFullWordJyutpingForGame($db, $chineseText, false, $studentUserId, $profileId);
                        }
                        
                        $jyutpingCode = null;
                        $confidence = 0.0;
                        if ($jyutping && !empty($jyutping['jyutping_code'])) {
                            $jyutpingCode = $jyutping['jyutping_code'];
                            $matchType = $jyutping['_match_type'] ?? 'unknown';
                            $matchLen  = isset($jyutping['_match_length']) ? (int)$jyutping['_match_length'] : 0;
                            $totalLen  = $chineseText ? mb_strlen($chineseText, 'UTF-8') : $matchLen;

                            if ($matchType === 'exact') {
                                $confidence = 1.0;
                            } elseif ($matchType === 'substring' && $totalLen > 0) {
                                $confidence = max(0.1, min(1.0, $matchLen / $totalLen));
                            } elseif ($matchType === 'single_char') {
                                $confidence = ($totalLen > 1) ? 0.0 : 0.3;
                            } else {
                                $confidence = 0.6;
                            }
                        }

                        // 低置信度時也嘗試 AI 修正
                        if ($chineseText && $confidence < 0.5) {
                            require_once __DIR__ . '/../helpers/ollama.php';
                            $aiJyutping = predictJyutpingForChinese($chineseText);
                            $validatedAi = $aiJyutping ? validate_ai_jyutping($chineseText, $aiJyutping) : null;
                            if ($validatedAi) {
                                $jyutpingCode = $validatedAi;
                            } else {
                                if (($jyutping['_match_type'] ?? null) === 'single_char' || $confidence < 0.5) {
                                    $jyutpingCode = null;
                                }
                            }
                        }

                        if ($jyutpingCode) {
                            $pair = [
                                'id' => 'card_' . $item['id'],
                                'source_type' => 'card',
                                'image' => $imagePath,
                                'title' => $title,
                                'jyutping' => $jyutpingCode,
                                'character' => $jyutping['hanzi'] ?? $jyutping['word'] ?? $chineseText
                            ];
                            $pairs[] = $pair;
                        }
                    }
                }
            }
            
            // Generate options for matching - use correct labels based on game type
            $allOptions = [];
            foreach ($pairs as $pair) {
                if ($gameType === 'word-picture') {
                    // For word-picture: options should be the word/title
                    $allOptions[] = $pair['title'];
                } else if ($gameType === 'jyutping-picture') {
                    // For jyutping-picture: options should be the jyutping code ONLY
                    if (isset($pair['jyutping']) && !empty($pair['jyutping'])) {
                        $allOptions[] = $pair['jyutping'];
                    }
                }
            }
            
            // Ensure we have options for jyutping-picture
            if ($gameType === 'jyutping-picture' && empty($allOptions)) {
                error_log("Warning: No jyutping options generated from boards/cards. Trying fallback: query dictionary directly.");
                
                // Fallback: Query jyutping_dictionary directly and try to find matching cards/boards
                $stmt = $db->prepare("
                    SELECT jyutping_code, hanzi, word, frequency
                    FROM jyutping_dictionary
                    WHERE jyutping_code IS NOT NULL 
                      AND jyutping_code != ''
                      AND (hanzi IS NOT NULL OR word IS NOT NULL)
                      AND frequency > 50
                    ORDER BY frequency DESC
                    LIMIT ?
                ");
                $stmt->execute([$limit * 2]);
                $jyutpingEntries = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                error_log("Fallback: Found " . count($jyutpingEntries) . " jyutping entries from dictionary");
                
                foreach ($jyutpingEntries as $entry) {
                    if (count($pairs) >= $limit) {
                        break;
                    }
                    
                    $hanzi = $entry['hanzi'] ?? $entry['word'] ?? '';
                    if (empty($hanzi)) {
                        continue;
                    }
                    
                    // Try to find a card or board tile with this label
                    $stmt = $db->prepare("
                        SELECT DISTINCT 
                            CONCAT('card_', c.id) as id,
                            c.title, 
                            c.label_text, 
                            c.image_path, 
                            c.image_url, 
                            c.category,
                            'card' as source_type
                        FROM cards c
                        WHERE ((c.image_path IS NOT NULL AND c.image_path != '')
                           OR (c.image_url IS NOT NULL AND c.image_url != ''))
                        AND (c.title = ? OR c.label_text = ?)
                        LIMIT 1
                    ");
                    $stmt->execute([$hanzi, $hanzi]);
                    $card = $stmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($card) {
                        $imagePath = $card['image_url'] ?? $card['image_path'] ?? '';
                        if ($imagePath) {
                            $pairs[] = [
                                'id' => $card['id'],
                                'source_type' => 'card',
                                'image' => $imagePath,
                                'title' => $hanzi,
                                'jyutping' => $entry['jyutping_code'],
                                'character' => $hanzi
                            ];
                            $allOptions[] = $entry['jyutping_code'];
                            continue;
                        }
                    }
                    
                    // Try to find in profile cards
                    $stmt = $db->prepare("
                        SELECT DISTINCT
                            CONCAT('card_', c.id) as id,
                            c.title,
                            c.label_text,
                            c.image_path,
                            c.image_url,
                            c.category
                        FROM cards c
                        INNER JOIN profile_cards pc ON c.id = pc.card_id
                        WHERE (c.title = ? OR c.label_text = ?)
                        AND ((c.image_path IS NOT NULL AND c.image_path != '')
                             OR (c.image_url IS NOT NULL AND c.image_url != ''))
                        LIMIT 10
                    ");
                    $stmt->execute([$hanzi, $hanzi]);
                    $matchingCards = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    
                    foreach ($matchingCards as $card) {
                        if (count($pairs) >= $limit) {
                            break;
                        }
                        
                        $imagePath = $card['image_url'] ?? $card['image_path'] ?? '';
                        if (empty($imagePath)) {
                            continue;
                        }
                        
                        // Check if this pair already exists
                        $exists = false;
                        foreach ($pairs as $existingPair) {
                            if ($existingPair['id'] === $card['id'] || 
                                ($existingPair['image'] === $imagePath && $existingPair['jyutping'] === $entry['jyutping_code'])) {
                                $exists = true;
                                break;
                            }
                        }
                        if (!$exists) {
                            $pairs[] = [
                                'id' => $card['id'],
                                'source_type' => 'card',
                                'image' => $imagePath,
                                'title' => $hanzi,
                                'jyutping' => $entry['jyutping_code'],
                                'character' => $hanzi
                            ];
                            $allOptions[] = $entry['jyutping_code'];
                        }
                    }
                }
                
                // If still no pairs, return helpful error
                if (empty($allOptions)) {
                    error_log("Fallback also failed: no matching cards/boards found for dictionary entries");
                    return successResponse([
                        'game_type' => 'matching',
                        'match_type' => $gameType,
                        'pairs' => [],
                        'options' => [],
                        'count' => 0,
                        'message' => 'No matching pictures found for jyutping entries. Dictionary has data but no cards/boards match the labels. Try: php backend/scripts/export-board-labels-for-jyutping.php to see available labels.'
                    ]);
                }
            }
            
            // Final deduplication: remove duplicates by ID and by Jyutping code
            $uniquePairs = [];
            $seenIds = [];
            $seenJyutpingCodes = []; // Track Jyutping codes to prevent duplicates
            foreach ($pairs as $pair) {
                $pairId = $pair['id'] ?? '';
                $jyutpingCode = $pair['jyutping'] ?? null;
                
                // Skip if we've seen this ID before
                if (!empty($pairId) && isset($seenIds[$pairId])) {
                    continue;
                }
                
                // For jyutping-picture games, skip if we've seen this Jyutping code before
                if ($gameType === 'jyutping-picture' && $jyutpingCode && isset($seenJyutpingCodes[$jyutpingCode])) {
                    continue;
                }
                
                $seenIds[$pairId] = true;
                if ($jyutpingCode) {
                    $seenJyutpingCodes[$jyutpingCode] = true;
                }
                $uniquePairs[] = $pair;
            }
            $pairs = $uniquePairs;
            
            // Limit pairs to requested limit
            $pairs = array_slice($pairs, 0, $limit);
            
            // Update options to match final pairs and ensure uniqueness
            $allOptions = [];
            $seenJyutping = []; // Track seen Jyutping codes to prevent duplicates
            foreach ($pairs as $pair) {
                if ($gameType === 'word-picture') {
                    $allOptions[] = $pair['title'];
                } else if ($gameType === 'jyutping-picture') {
                    if (isset($pair['jyutping']) && !empty($pair['jyutping'])) {
                        $jyutping = $pair['jyutping'];
                        // Only add if we haven't seen this Jyutping code yet
                        if (!isset($seenJyutping[$jyutping])) {
                            $allOptions[] = $jyutping;
                            $seenJyutping[$jyutping] = true;
                        }
                    }
                }
            }
            
            // Remove duplicate pairs with same Jyutping (keep first occurrence)
            $uniquePairs = [];
            $seenPairKeys = [];
            foreach ($pairs as $pair) {
                if ($gameType === 'jyutping-picture' && isset($pair['jyutping'])) {
                    $key = $pair['jyutping'];
                    if (!isset($seenPairKeys[$key])) {
                        $uniquePairs[] = $pair;
                        $seenPairKeys[$key] = true;
                    }
                } else {
                    $uniquePairs[] = $pair;
                }
            }
            $pairs = $uniquePairs;
            
            // Ensure we have enough unique options (add more if needed)
            if ($gameType === 'jyutping-picture' && count($allOptions) < count($pairs) && !empty($seenJyutping)) {
                // Get additional unique Jyutping codes from dictionary
                // Guard against empty IN () which would cause SQL errors
                $placeholders = implode(',', array_fill(0, count($seenJyutping), '?'));
                if (!empty($placeholders)) {
                    $sql = "
                        SELECT DISTINCT jyutping_code
                        FROM jyutping_dictionary
                        WHERE jyutping_code NOT IN ($placeholders)
                          AND frequency > 50
                        ORDER BY RAND()
                        LIMIT ?
                    ";
                    $stmt = $db->prepare($sql);
                    $params = array_keys($seenJyutping);
                    $params[] = count($pairs) - count($allOptions);
                    $stmt->execute($params);
                    $additionalOptions = $stmt->fetchAll(PDO::FETCH_COLUMN);
                    $allOptions = array_merge($allOptions, $additionalOptions);
                }
            }
            
            // Shuffle pairs
            shuffle($pairs);
            
            // Shuffle options separately to ensure randomness and remove duplicates
            $allOptions = array_values(array_unique($allOptions));
            shuffle($allOptions);
            
            return successResponse([
                'game_type' => 'matching',
                'match_type' => $gameType,
                'pairs' => $pairs,
                'options' => $allOptions,
                'count' => count($pairs)
            ]);
            
        } catch (Exception $e) {
            // 不要让学习游戏直接 500 掉，记录错误并返回空遊戲資料
            error_log("Matching game error: " . $e->getMessage());
            return successResponse([
                'game_type' => 'matching',
                'match_type' => $_GET['type'] ?? 'word-picture',
                'pairs' => [],
                'options' => [],
                'count' => 0,
                'message' => 'Failed to generate matching game automatically. Please check jyutping dictionary and board labels.'
            ]);
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
        $profileId = isset($data['profile_id']) ? (int)$data['profile_id'] : null; // optional: link result to profile
        $questions = $data['questions'] ?? null; // Optional: array of question results for detailed logging
        
        if (!$gameType) {
            return errorResponse('Game type is required', 400);
        }
        
        try {
            // Calculate accuracy
            $accuracy = $totalQuestions > 0 ? ($score / $totalQuestions) * 100 : 0;
            
            // For spelling games, log each question to jyutping_learning_log
            if ($gameType === 'spelling' && is_array($questions) && !empty($questions)) {
                error_log("[Games Submit] Logging spelling game questions to jyutping_learning_log: " . count($questions) . " questions");
                
                foreach ($questions as $question) {
                    // New format: Given jyutping, user selects hanzi
                    // question structure: { jyutping_code, hanzi_expected (correct), hanzi_selected (user's choice), is_correct }
                    $jyutpingCode = $question['jyutping_code'] ?? null;
                    $hanziExpected = $question['hanzi_expected'] ?? null;
                    $hanziSelected = $question['hanzi_selected'] ?? null;
                    $isCorrect = isset($question['is_correct']) ? (bool)$question['is_correct'] : false;
                    
                    // If hanzi_expected is not provided, try to find it from dictionary
                    if ($jyutpingCode && !$hanziExpected) {
                        $stmt = $db->prepare("
                            SELECT hanzi, word
                            FROM jyutping_dictionary
                            WHERE jyutping_code = ?
                            ORDER BY frequency DESC
                            LIMIT 1
                        ");
                        $stmt->execute([$jyutpingCode]);
                        $correctData = $stmt->fetch(PDO::FETCH_ASSOC);
                        if ($correctData) {
                            $hanziExpected = $correctData['hanzi'] ?? $correctData['word'] ?? null;
                        }
                    }
                    
                    if ($jyutpingCode) {
                        // Always create a new log entry for each attempt
                        // This allows AI learning stats to track all attempts and analyze learning patterns
                        // Each attempt is a separate record, which provides better granularity for analysis
                        $stmt = $db->prepare("
                            INSERT INTO jyutping_learning_log 
                            (user_id, profile_id, jyutping_code, hanzi_expected, hanzi_selected, is_correct, attempt_count)
                            VALUES (?, ?, ?, ?, ?, ?, 1)
                        ");
                        $stmt->execute([
                            $user['id'],
                            $profileId,
                            $jyutpingCode,
                            $hanziExpected,
                            $hanziSelected,
                            $isCorrect ? 1 : 0
                        ]);
                        
                        error_log("[Games Submit] Logged question to jyutping_learning_log: jyutping={$jyutpingCode}, expected={$hanziExpected}, selected={$hanziSelected}, correct=" . ($isCorrect ? 'yes' : 'no'));
                    } else {
                        error_log("[Games Submit] Warning: Missing jyutping_code for question, skipping log entry");
                    }
                }
                
                error_log("[Games Submit] Successfully logged " . count($questions) . " spelling game questions to jyutping_learning_log");
            }
            
            // Save game result using action_logs, linked to profile if provided
            $stmt = $db->prepare("
                INSERT INTO action_logs (user_id, profile_id, action_type, metadata, created_at)
                VALUES (?, ?, 'game_completed', ?, NOW())
            ");
            $metadata = json_encode([
                'game_type' => $gameType,
                'score' => $score,
                'total_questions' => $totalQuestions,
                'accuracy' => round($accuracy, 2),
                'time_spent' => $timeSpent,
                'difficulty' => $difficulty,
                'questions_count' => is_array($questions) ? count($questions) : 0
            ]);
            $stmt->execute([$user['id'], $profileId, $metadata]);
            
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
            error_log("Game submit error trace: " . $e->getTraceAsString());
            return errorResponse('Failed to submit game result: ' . $e->getMessage(), 500);
        }
    }
    
    // GET /games/history - Get game history
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'history') {
        $user = requireAuth($authToken);
        $gameType = $_GET['game_type'] ?? null;
        $profileId = isset($_GET['profile_id']) ? (int)$_GET['profile_id'] : null;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        
        try {
            $sql = "
                SELECT id, profile_id, metadata, created_at
                FROM action_logs
                WHERE user_id = ? AND action_type = 'game_completed'
            ";
            $params = [$user['id']];
            
            if ($gameType) {
                $sql .= " AND JSON_EXTRACT(metadata, '$.game_type') = ?";
                $params[] = $gameType;
            }

            if ($profileId) {
                $sql .= " AND profile_id = ?";
                $params[] = $profileId;
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
                    'profile_id' => $log['profile_id'],
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

