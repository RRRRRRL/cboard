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

require_once __DIR__ . '/../auth.php';

/**
 * Get matching rules for keyboard search (for a user/profile)
 * Returns default rules if none are configured
 * This matches the structure used in games.php getMatchingRules function
 */
function getKeyboardMatchingRules($db, $userId = null, $profileId = null) {
    $defaultRules = [
        'enabled' => true,
        'frequency_threshold' => 50,
        'allow_exact_match' => true,
        'allow_substring_match' => true,
        'allow_single_char_match' => true,
        'require_ai_correction' => false,
        'ai_confidence_threshold' => 0.50,
        // Phonological adaptation rules
        'merge_n_ng_finals' => false,
        'allow_coda_simplification' => false,
        'ignore_tones' => false,
        'allow_fuzzy_tones' => false,
        'fuzzy_tone_pairs' => null,
        'allow_ng_zero_confusion' => false,
        'allow_n_l_confusion' => false
    ];
    
    if (!$userId) {
        return $defaultRules;
    }
    
    try {
        // Try to get profile-specific rules first, then user-level rules
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
                'frequency_threshold' => isset($rule['frequency_threshold']) ? (int)$rule['frequency_threshold'] : 50,
                'allow_exact_match' => isset($rule['allow_exact_match']) ? (bool)$rule['allow_exact_match'] : true,
                'allow_substring_match' => isset($rule['allow_substring_match']) ? (bool)$rule['allow_substring_match'] : true,
                'allow_single_char_match' => isset($rule['allow_single_char_match']) ? (bool)$rule['allow_single_char_match'] : true,
                'require_ai_correction' => isset($rule['require_ai_correction']) ? (bool)$rule['require_ai_correction'] : false,
                'ai_confidence_threshold' => isset($rule['ai_confidence_threshold']) ? (float)$rule['ai_confidence_threshold'] : 0.50,
                'enabled' => true,
                // Phonological adaptation rules
                'merge_n_ng_finals' => isset($rule['merge_n_ng_finals']) ? (bool)$rule['merge_n_ng_finals'] : false,
                'allow_coda_simplification' => isset($rule['allow_coda_simplification']) ? (bool)$rule['allow_coda_simplification'] : false,
                'ignore_tones' => isset($rule['ignore_tones']) ? (bool)$rule['ignore_tones'] : false,
                'allow_fuzzy_tones' => isset($rule['allow_fuzzy_tones']) ? (bool)$rule['allow_fuzzy_tones'] : false,
                'fuzzy_tone_pairs' => isset($rule['fuzzy_tone_pairs']) ? $rule['fuzzy_tone_pairs'] : null,
                'allow_ng_zero_confusion' => isset($rule['allow_ng_zero_confusion']) ? (bool)$rule['allow_ng_zero_confusion'] : false,
                'allow_n_l_confusion' => isset($rule['allow_n_l_confusion']) ? (bool)$rule['allow_n_l_confusion'] : false
            ];
        }
    } catch (Exception $e) {
        error_log("Error fetching keyboard matching rules: " . $e->getMessage());
    }
    
    return $defaultRules;
}

/**
 * Generate matching variants for a Jyutping code based on phonological rules
 * Returns array of possible Jyutping codes to search for
 */
function generateJyutpingVariants($code, $rules) {
    $variants = [$code]; // Always include original
    
    // Remove tone for processing
    $tone = '';
    $codeWithoutTone = preg_replace('/\d+$/', '', $code);
    if (preg_match('/(\d+)$/', $code, $matches)) {
        $tone = $matches[1];
    }
    
    // Rule 1: Merge -n and -ng finals
    if ($rules['merge_n_ng_finals']) {
        if (preg_match('/([a-z]+)n(\d*)$/', $codeWithoutTone, $matches)) {
            $base = $matches[1];
            $variant = $base . 'ng' . ($tone ?: '');
            if (!in_array($variant, $variants)) {
                $variants[] = $variant;
            }
        }
        if (preg_match('/([a-z]+)ng(\d*)$/', $codeWithoutTone, $matches)) {
            $base = $matches[1];
            $variant = $base . 'n' . ($tone ?: '');
            if (!in_array($variant, $variants)) {
                $variants[] = $variant;
            }
        }
    }
    
    // Rule 2: Allow coda simplification (-t and -k interchange)
    if ($rules['allow_coda_simplification']) {
        if (preg_match('/([a-z]+)t(\d*)$/', $codeWithoutTone, $matches)) {
            $base = $matches[1];
            $variant = $base . 'k' . ($tone ?: '');
            if (!in_array($variant, $variants)) {
                $variants[] = $variant;
            }
        }
        if (preg_match('/([a-z]+)k(\d*)$/', $codeWithoutTone, $matches)) {
            $base = $matches[1];
            $variant = $base . 't' . ($tone ?: '');
            if (!in_array($variant, $variants)) {
                $variants[] = $variant;
            }
        }
    }
    
    // Rule 3: Ignore tones completely
    if ($rules['ignore_tones']) {
        if (!empty($codeWithoutTone) && $codeWithoutTone !== $code) {
            if (!in_array($codeWithoutTone, $variants)) {
                $variants[] = $codeWithoutTone;
            }
            // Also add with all possible tones (1-6)
            for ($i = 1; $i <= 6; $i++) {
                $variant = $codeWithoutTone . $i;
                if (!in_array($variant, $variants)) {
                    $variants[] = $variant;
                }
            }
        }
    }
    
    // Rule 4: Allow fuzzy tones
    if ($rules['allow_fuzzy_tones'] && !empty($tone)) {
        $fuzzyPairs = [];
        if (!empty($rules['fuzzy_tone_pairs'])) {
            // Parse fuzzy tone pairs (e.g., "2,5|3,6")
            $pairs = explode('|', $rules['fuzzy_tone_pairs']);
            foreach ($pairs as $pair) {
                $tones = explode(',', trim($pair));
                if (count($tones) === 2) {
                    $fuzzyPairs[trim($tones[0])][] = trim($tones[1]);
                    $fuzzyPairs[trim($tones[1])][] = trim($tones[0]);
                }
            }
        } else {
            // Default fuzzy pairs: 2↔5, 3↔6
            $fuzzyPairs['2'] = ['5'];
            $fuzzyPairs['5'] = ['2'];
            $fuzzyPairs['3'] = ['6'];
            $fuzzyPairs['6'] = ['3'];
        }
        
        if (isset($fuzzyPairs[$tone])) {
            foreach ($fuzzyPairs[$tone] as $fuzzyTone) {
                $variant = $codeWithoutTone . $fuzzyTone;
                if (!in_array($variant, $variants)) {
                    $variants[] = $variant;
                }
            }
        }
    }
    
    // Rule 5: Allow ng-zero initial confusion
    if ($rules['allow_ng_zero_confusion']) {
        // If code starts with 'ng', also try without it
        if (preg_match('/^ng(.+)$/', $codeWithoutTone, $matches)) {
            $variant = $matches[1] . ($tone ?: '');
            if (!in_array($variant, $variants)) {
                $variants[] = $variant;
            }
        }
        // If code doesn't start with 'ng', also try with it
        if (!preg_match('/^ng/', $codeWithoutTone)) {
            $variant = 'ng' . $codeWithoutTone . ($tone ?: '');
            if (!in_array($variant, $variants)) {
                $variants[] = $variant;
            }
        }
    }
    
    // Rule 6: Allow n/l confusion
    if ($rules['allow_n_l_confusion']) {
        // Replace initial 'n' with 'l'
        if (preg_match('/^n(.+)$/', $codeWithoutTone, $matches)) {
            $variant = 'l' . $matches[1] . ($tone ?: '');
            if (!in_array($variant, $variants)) {
                $variants[] = $variant;
            }
        }
        // Replace initial 'l' with 'n'
        if (preg_match('/^l(.+)$/', $codeWithoutTone, $matches)) {
            $variant = 'n' . $matches[1] . ($tone ?: '');
            if (!in_array($variant, $variants)) {
                $variants[] = $variant;
            }
        }
    }
    
    return array_unique($variants);
}

function handleJyutpingRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }
    
    // Get user info for matching rules (optional auth)
    $user = verifyAuth($authToken);
    $userId = $user ? $user['id'] : null;
    $profileId = isset($_GET['profile_id']) ? (int)$_GET['profile_id'] : null;

    // GET /jyutping/search?code={code}
    if ($method === 'GET' && isset($pathParts[1]) && $pathParts[1] === 'search') {
    try {
        $code = $_GET['code'] ?? '';
        
        if (empty($code)) {
            return errorResponse('Jyutping code is required', 400);
        }
        
        // Get matching rules for this user/profile
        $rules = getKeyboardMatchingRules($db, $userId, $profileId);
        $frequencyThreshold = $rules['frequency_threshold'];
        
        // Generate matching variants based on phonological rules
        $variants = generateJyutpingVariants($code, $rules);
        error_log("Jyutping search variants for '$code': " . implode(', ', $variants));
        
        // Search for exact match first (try all variants)
        $placeholders = str_repeat('?,', count($variants) - 1) . '?';
        $sql = "SELECT * FROM jyutping_dictionary 
                WHERE jyutping_code IN ($placeholders)
                  AND frequency > ?
                ORDER BY 
                    CASE 
                        WHEN jyutping_code = ? THEN 1
                        ELSE 2
                    END,
                    frequency DESC, id ASC 
                LIMIT 10";
        $params = array_merge($variants, [$frequencyThreshold, $code]);
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $exactMatches = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // If we have exact matches, return them immediately
        if (!empty($exactMatches)) {
            return successResponse([
                'code' => $code,
                'matches' => $exactMatches,
                'match_type' => 'exact',
                'variants_used' => $variants
            ]);
        }
        
        // If no exact match, try matching without tone number (e.g., "nei" matches "nei5")
        // This handles cases where user types "nei" to see all "nei1", "nei2", "nei5", etc.
        // Try matching code without tone (remove trailing digits)
        $codeWithoutTone = preg_replace('/\d+$/', '', $code);
        
        // If code ends with a number, search for all tone variants (including phonological variants)
        if ($codeWithoutTone !== $code && !empty($codeWithoutTone)) {
            // Generate variants without tone for LIKE search
            $variantsWithoutTone = [];
            foreach ($variants as $variant) {
                $variantWithoutTone = preg_replace('/\d+$/', '', $variant);
                if (!empty($variantWithoutTone) && !in_array($variantWithoutTone, $variantsWithoutTone)) {
                    $variantsWithoutTone[] = $variantWithoutTone;
                }
            }
            
            if (!empty($variantsWithoutTone)) {
                $likePatterns = array_map(function($v) { return $v . '%'; }, $variantsWithoutTone);
                $placeholders = str_repeat('?,', count($likePatterns) - 1) . '?';
                $sql = "SELECT * FROM jyutping_dictionary 
                        WHERE (jyutping_code LIKE $placeholders)
                          AND frequency > ?
                        ORDER BY frequency DESC, id ASC 
                        LIMIT 15";
                $params = array_merge($likePatterns, [$frequencyThreshold]);
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
                $toneMatches = $stmt->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($toneMatches)) {
                    return successResponse([
                        'code' => $code,
                        'matches' => $toneMatches,
                        'match_type' => 'tone_variant',
                        'variants_used' => $variantsWithoutTone
                    ]);
                }
            }
        }
        
        // Search for partial match (starts with) - shows all matches like "nei*"
        // This handles cases where user types "nei" to see all "nei1", "nei2", "nei5", etc.
        // Use all variants for LIKE search
        $likePatterns = array_map(function($v) { return $v . '%'; }, $variants);
        $placeholders = str_repeat('?,', count($likePatterns) - 1) . '?';
        $sql = "SELECT * FROM jyutping_dictionary 
                WHERE (jyutping_code LIKE $placeholders)
                  AND frequency > ?
                ORDER BY 
                    CASE 
                        WHEN jyutping_code = ? THEN 1
                        ELSE 2
                    END,
                    frequency DESC, id ASC 
                LIMIT 15";
        $params = array_merge($likePatterns, [$frequencyThreshold, $code]);
        error_log("Jyutping search: code='$code', variants=" . implode(', ', $variants) . ", threshold=$frequencyThreshold");
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $partialMatches = $stmt->fetchAll(PDO::FETCH_ASSOC);
        error_log("Jyutping partial matches found: " . count($partialMatches));
        
        if (!empty($partialMatches)) {
            return successResponse([
                'code' => $code,
                'matches' => $partialMatches,
                'match_type' => 'partial'
            ]);
        }
        
        // If still no match, try matching base without tone
        if (!empty($codeWithoutTone) && $codeWithoutTone !== $code) {
            $sql = "SELECT * FROM jyutping_dictionary 
                    WHERE jyutping_code LIKE ? 
                    ORDER BY frequency DESC, id ASC 
                    LIMIT 15";
            $stmt = $db->prepare($sql);
            $stmt->execute([$codeWithoutTone . '%']);
            $baseMatches = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($baseMatches)) {
                return successResponse([
                    'code' => $code,
                    'matches' => $baseMatches,
                    'match_type' => 'base_match'
                ]);
            }
        }
        
        // If no matches found at all, return empty result
        return successResponse([
            'code' => $code,
            'matches' => [],
            'match_type' => 'none'
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
        
        // Get matching rules for this user/profile
        $rules = getKeyboardMatchingRules($db, $userId, $profileId);
        $frequencyThreshold = $rules['frequency_threshold'];
        
        // If input is empty, return high-frequency words for daily needs, school, home/community
        if (empty($input)) {
            // Use frequency threshold from matching rules
            $sql = "SELECT * FROM jyutping_dictionary 
                    WHERE frequency > ? 
                      AND (tags LIKE '%daily%' OR tags LIKE '%school%' OR tags LIKE '%home%' OR tags LIKE '%community%' OR tags LIKE '%greeting%' OR tags LIKE '%verb%' OR tags LIKE '%noun%')
                    ORDER BY frequency DESC, id ASC 
                    LIMIT ?";
            $stmt = $db->prepare($sql);
            $stmt->execute([$frequencyThreshold, $limit]);
            $suggestions = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            return successResponse([
                'input' => '',
                'suggestions' => $suggestions,
                'count' => count($suggestions)
            ]);
        }
        
        // Use the DB connection from function start (already checked)
        // $db is already available from line 14
        
        // First check if table exists and has data
        $checkSql = "SELECT COUNT(*) as count FROM jyutping_dictionary";
        $checkStmt = $db->prepare($checkSql);
        $checkStmt->execute();
        $tableCount = $checkStmt->fetch(PDO::FETCH_ASSOC);
        error_log("Jyutping dictionary table count: " . ($tableCount['count'] ?? 0));
        
        // Search for suggestions based on input
        // Priority: exact match > starts with > contains > frequency
        // Use frequency threshold from matching rules
        $sql = "SELECT * FROM jyutping_dictionary 
                WHERE frequency > ?
                  AND (jyutping_code LIKE ? 
                   OR hanzi LIKE ? 
                   OR word LIKE ?)
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
        
        error_log("Jyutping suggestions search: input='$input', pattern='$searchPattern', limit=$limit, threshold=$frequencyThreshold");
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            $frequencyThreshold, // frequency threshold
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
        error_log("Jyutping suggestions found: " . count($suggestions));
        
        return successResponse([
            'input' => $input,
            'suggestions' => $suggestions,
            'count' => count($suggestions)
        ]);
        
    } catch (Exception $e) {
        error_log("Jyutping suggestions error: " . $e->getMessage());
        error_log("Jyutping suggestions error trace: " . $e->getTraceAsString());
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

    // GET /jyutping/related?hanzi={hanzi}&jyutping={jyutping}&context={context}
    if ($method === 'GET' && isset($pathParts[1]) && $pathParts[1] === 'related') {
        try {
            $hanzi = $_GET['hanzi'] ?? '';
            $jyutping = $_GET['jyutping'] ?? '';
            $context = $_GET['context'] ?? ''; // User's current text output for context
            
            if (empty($hanzi) && empty($jyutping)) {
                return successResponse(['related_words' => []]);
            }
            
            $relatedWords = [];
            
            // Strategy 0: Use Ollama to predict next words based on FULL CONTEXT
            // The context should be the COMPLETE sentence the user has typed so far
            // AI will predict logical next words based on the full sentence meaning
            if (!empty($context) || !empty($hanzi)) {
                require_once __DIR__ . '/../helpers/ollama.php';
                
                // Build full context for prediction
                // Use the complete text output as context, not just the last word
                // This allows AI to predict based on the full sentence meaning
                $fullContext = trim($context);
                
                // If we have a selected word (hanzi), add it to the full context
                // This ensures the context includes the word user just selected
                if (!empty($hanzi)) {
                    // If context doesn't already end with this word, add it
                    if (empty($fullContext) || mb_substr($fullContext, -mb_strlen($hanzi)) !== $hanzi) {
                        $fullContext = ($fullContext ? $fullContext . ' ' : '') . $hanzi;
                    }
                }
                
                // Use the FULL CONTEXT as input for prediction
                // This allows AI to understand the complete sentence and predict logical next words
                // AI will generate predictions based on the context, not hardcoded examples
                $predictionInput = $fullContext ?: $hanzi;
                
                // Extract the last word for context (useful for place names, etc.)
                $lastWord = '';
                if (!empty($fullContext)) {
                    $words = preg_split('/\s+/u', $fullContext);
                    $lastWord = end($words);
                } else if (!empty($hanzi)) {
                    $lastWord = $hanzi;
                }
                
                // Use Ollama to predict next words based on FULL CONTEXT
                // Pass the full context and last word for better predictions
                $contextForAI = [
                    'previous_words' => !empty($fullContext) ? preg_split('/\s+/u', $fullContext) : [],
                    'user_history' => [],
                    'selected_word' => $lastWord, // The last word in the context
                    'current_input' => '' // No current input, we're predicting based on full context
                ];
                
                $predictions = [];
                $ollamaFailed = false;
                try {
                    $predictions = predictText($predictionInput, 'zh', 15, $contextForAI);
                } catch (Exception $e) {
                    error_log("Ollama prediction failed: " . $e->getMessage());
                    $ollamaFailed = true;
                }
                
                // If Ollama failed or returned no predictions, use database fallback
                // Use higher frequency threshold (200+) to ensure only common, relevant words
                if ($ollamaFailed || empty($predictions)) {
                    error_log("Using database fallback for related words (high frequency only)");
                    
                    // Higher frequency threshold for fallback to ensure quality recommendations
                    $fallbackFrequencyThreshold = 200; // Only very common words
                    
                    // Strategy 1: Find words with similar Jyutping (same initial or final)
                    // Only include high-frequency words to avoid irrelevant suggestions
                    if (!empty($jyutping)) {
                        // Extract initial and final from jyutping
                        $jyutpingBase = preg_replace('/\d+$/', '', $jyutping); // Remove tone
                        if (mb_strlen($jyutpingBase) >= 2) {
                            $initial = mb_substr($jyutpingBase, 0, 1);
                            $sql = "SELECT * FROM jyutping_dictionary 
                                    WHERE frequency > ?
                                      AND jyutping_code LIKE ?
                                      AND hanzi != ?
                                    ORDER BY frequency DESC 
                                    LIMIT 5"; // Reduced limit for quality
                            $stmt = $db->prepare($sql);
                            $stmt->execute([$fallbackFrequencyThreshold, $initial . '%', $hanzi]);
                            $similarJyutping = $stmt->fetchAll(PDO::FETCH_ASSOC);
                            foreach ($similarJyutping as $word) {
                                // Additional check: ensure frequency is high enough
                                $frequency = (int)($word['frequency'] ?? 0);
                                if ($frequency < $fallbackFrequencyThreshold) continue;
                                
                                $key = ($word['hanzi'] ?? '') . '|' . ($word['jyutping_code'] ?? '');
                                $exists = false;
                                foreach ($relatedWords as $existing) {
                                    if (($existing['hanzi'] ?? '') === ($word['hanzi'] ?? '') &&
                                        ($existing['jyutping_code'] ?? '') === ($word['jyutping_code'] ?? '')) {
                                        $exists = true;
                                        break;
                                    }
                                }
                                if (!$exists) {
                                    $relatedWords[] = $word;
                                }
                            }
                        }
                    }
                    
                    // Strategy 2: Find high-frequency common words that often follow the selected word
                    // Based on common sentence patterns - only very common words
                    if (!empty($hanzi)) {
                        // Only the most common follow words (reduced list for quality)
                        $commonFollowWords = ['的', '了', '是', '在', '有', '要', '去', '來', '到'];
                        foreach ($commonFollowWords as $followWord) {
                            if ($followWord === $hanzi) continue; // Skip if same as selected
                            
                            $sql = "SELECT * FROM jyutping_dictionary 
                                    WHERE frequency > ?
                                      AND hanzi = ?
                                    ORDER BY frequency DESC 
                                    LIMIT 1";
                            $stmt = $db->prepare($sql);
                            $stmt->execute([$fallbackFrequencyThreshold, $followWord]);
                            $word = $stmt->fetch(PDO::FETCH_ASSOC);
                            if ($word) {
                                // Additional frequency check
                                $frequency = (int)($word['frequency'] ?? 0);
                                if ($frequency >= $fallbackFrequencyThreshold) {
                                    $key = ($word['hanzi'] ?? '') . '|' . ($word['jyutping_code'] ?? '');
                                    $exists = false;
                                    foreach ($relatedWords as $existing) {
                                        if (($existing['hanzi'] ?? '') === ($word['hanzi'] ?? '') &&
                                            ($existing['jyutping_code'] ?? '') === ($word['jyutping_code'] ?? '')) {
                                            $exists = true;
                                            break;
                                        }
                                    }
                                    if (!$exists) {
                                        $relatedWords[] = $word;
                                    }
                                }
                            }
                        }
                    }
                    
                    // Strategy 3: Context-based suggestions (if context contains specific keywords)
                    // Only suggest very common, high-frequency words
                    if (!empty($fullContext)) {
                        // If context contains "去" (go), suggest places
                        if (mb_strpos($fullContext, '去') !== false || mb_strpos($fullContext, '到') !== false) {
                            // Only most common places
                            $placeWords = ['學校', '醫院', '屋企', '公園'];
                            foreach ($placeWords as $place) {
                                $sql = "SELECT * FROM jyutping_dictionary 
                                        WHERE frequency > ?
                                          AND hanzi = ?
                                        ORDER BY frequency DESC 
                                        LIMIT 1";
                                $stmt = $db->prepare($sql);
                                $stmt->execute([$fallbackFrequencyThreshold, $place]);
                                $word = $stmt->fetch(PDO::FETCH_ASSOC);
                                if ($word) {
                                    $frequency = (int)($word['frequency'] ?? 0);
                                    if ($frequency >= $fallbackFrequencyThreshold) {
                                        $key = ($word['hanzi'] ?? '') . '|' . ($word['jyutping_code'] ?? '');
                                        $exists = false;
                                        foreach ($relatedWords as $existing) {
                                            if (($existing['hanzi'] ?? '') === ($word['hanzi'] ?? '') &&
                                                ($existing['jyutping_code'] ?? '') === ($word['jyutping_code'] ?? '')) {
                                                $exists = true;
                                                break;
                                            }
                                        }
                                        if (!$exists) {
                                            $relatedWords[] = $word;
                                        }
                                    }
                                }
                            }
                        }
                        
                        // If context contains "想" (want), suggest actions
                        if (mb_strpos($fullContext, '想') !== false) {
                            // Only most common action words
                            $actionWords = ['去', '做', '食', '飲', '睇'];
                            foreach ($actionWords as $action) {
                                $sql = "SELECT * FROM jyutping_dictionary 
                                        WHERE frequency > ?
                                          AND hanzi = ?
                                        ORDER BY frequency DESC 
                                        LIMIT 1";
                                $stmt = $db->prepare($sql);
                                $stmt->execute([$fallbackFrequencyThreshold, $action]);
                                $word = $stmt->fetch(PDO::FETCH_ASSOC);
                                if ($word) {
                                    $frequency = (int)($word['frequency'] ?? 0);
                                    if ($frequency >= $fallbackFrequencyThreshold) {
                                        $key = ($word['hanzi'] ?? '') . '|' . ($word['jyutping_code'] ?? '');
                                        $exists = false;
                                        foreach ($relatedWords as $existing) {
                                            if (($existing['hanzi'] ?? '') === ($word['hanzi'] ?? '') &&
                                                ($existing['jyutping_code'] ?? '') === ($word['jyutping_code'] ?? '')) {
                                                $exists = true;
                                                break;
                                            }
                                        }
                                        if (!$exists) {
                                            $relatedWords[] = $word;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Convert predictions to related words format
                // Allow phrases (multiple words), not just single words
                if (!empty($predictions)) {
                    foreach ($predictions as $prediction) {
                        // Search for this prediction in dictionary
                        $prediction = trim($prediction);
                        // Allow longer predictions (phrases up to 20 characters)
                        if (empty($prediction) || mb_strlen($prediction) > 20) continue;
                        
                        // Filter out predictions that contain the selected word
                        // This prevents suggestions like "我餓了" when user already selected "我"
                        if (!empty($hanzi)) {
                            // If prediction starts with or contains the selected word, skip it
                            // We only want predictions that come AFTER the selected word
                            if (mb_strpos($prediction, $hanzi) === 0) {
                                // Prediction starts with selected word, extract the part after it
                                $remaining = mb_substr($prediction, mb_strlen($hanzi));
                                if (empty($remaining)) {
                                    // Prediction is exactly the selected word, skip it
                                    continue;
                                }
                                // Use the remaining part as the prediction
                                $prediction = $remaining;
                            } elseif (mb_strpos($prediction, $hanzi) !== false) {
                                // Prediction contains selected word in the middle or end, skip it
                                // We want clean predictions that don't repeat the selected word
                                continue;
                            }
                        }
                        
                        // Additional validation: Check if prediction makes sense
                        // Skip predictions that are too short (likely incomplete) or too generic
                        if (mb_strlen($prediction) < 1) {
                            continue;
                        }
                        
                        // Skip predictions that are just punctuation or numbers
                        if (preg_match('/^[^\p{L}]+$/u', $prediction)) {
                            continue;
                        }
                        
                        // Get matching rules for frequency threshold
                        $rules = getKeyboardMatchingRules($db, $userId, $profileId);
                        $frequencyThreshold = $rules['frequency_threshold'];
                        
                        // Try to find matching entries in dictionary
                        // Prioritize exact matches, then partial matches
                        // Allow phrases (multiple words) to be searched
                        $sql = "SELECT * FROM jyutping_dictionary 
                                WHERE frequency > ?
                                  AND (hanzi = ? OR word = ? OR hanzi LIKE ? OR word LIKE ?)
                                ORDER BY 
                                    CASE 
                                        WHEN hanzi = ? OR word = ? THEN 1
                                        WHEN hanzi LIKE ? OR word LIKE ? THEN 2
                                        ELSE 3
                                    END,
                                    frequency DESC 
                                LIMIT 1";
                        $exactMatch = $prediction;
                        $partialMatch = $prediction . '%';
                        $stmt = $db->prepare($sql);
                        $stmt->execute([
                            $frequencyThreshold, // frequency threshold
                            $exactMatch, $exactMatch, $partialMatch, $partialMatch,
                            $exactMatch, $exactMatch, $partialMatch, $partialMatch
                        ]);
                        $match = $stmt->fetch(PDO::FETCH_ASSOC);
                        
                        if ($match) {
                            // Additional check: Only add if frequency is reasonable (not too low)
                            // This filters out very rare or potentially incorrect entries
                            $frequency = (int)($match['frequency'] ?? 0);
                            // If frequency is 0, it might be a placeholder - be more cautious
                            // Only add if it's a meaningful match
                            if ($frequency > 0 || mb_strlen($prediction) <= 2) {
                                // Check if not already added
                                $key = ($match['hanzi'] ?? '') . '|' . ($match['jyutping_code'] ?? '');
                                $exists = false;
                                foreach ($relatedWords as $existing) {
                                    if (($existing['hanzi'] ?? '') === ($match['hanzi'] ?? '') &&
                                        ($existing['jyutping_code'] ?? '') === ($match['jyutping_code'] ?? '')) {
                                        $exists = true;
                                        break;
                                    }
                                }
                                if (!$exists) {
                                    $relatedWords[] = $match;
                                }
                            }
                        } else {
                            // If not found in dictionary, only create placeholder for short, meaningful predictions
                            // Skip long phrases that aren't in dictionary (likely incorrect)
                            if (mb_strlen($prediction) <= 4) {
                                $relatedWords[] = [
                                    'hanzi' => $prediction,
                                    'word' => $prediction,
                                    'jyutping_code' => '',
                                    'frequency' => 0,
                                    'priority' => 0
                                ];
                            }
                        }
                    }
                }
            }
            
            // Remove duplicates and filter by frequency
            // For fallback mode, use higher threshold; for AI predictions, use standard threshold
            $frequencyThreshold = ($ollamaFailed || empty($predictions)) ? 200 : 50;
            
            $uniqueRelated = [];
            $seen = [];
            foreach ($relatedWords as $word) {
                $frequency = (int)($word['frequency'] ?? 0);
                
                // Filter out low-frequency words, especially in fallback mode
                if ($frequency < $frequencyThreshold) {
                    continue;
                }
                
                $key = ($word['hanzi'] ?? '') . '|' . ($word['jyutping_code'] ?? '');
                if (!isset($seen[$key])) {
                    $seen[$key] = true;
                    $uniqueRelated[] = $word;
                }
            }
            
            // Sort by frequency (highest first)
            usort($uniqueRelated, function($a, $b) {
                $freqA = (int)($a['frequency'] ?? 0);
                $freqB = (int)($b['frequency'] ?? 0);
                return $freqB - $freqA;
            });
            
            // Return results if we have at least 1 meaningful prediction
            // Prefer quality over quantity, but show at least 1 if available
            // If we have less than 1 result, return empty array
            if (count($uniqueRelated) < 1) {
                $uniqueRelated = [];
                error_log("Related words: No results found for hanzi='$hanzi', jyutping='$jyutping', context='$fullContext' (threshold=$frequencyThreshold)");
            } else {
                // Limit to 15 results if we have enough
                $uniqueRelated = array_slice($uniqueRelated, 0, 15);
                error_log("Related words found: " . count($uniqueRelated) . " for hanzi='$hanzi', jyutping='$jyutping', context='$fullContext' (threshold=$frequencyThreshold)");
            }
            
            return successResponse([
                'hanzi' => $hanzi,
                'jyutping' => $jyutping,
                'related_words' => $uniqueRelated,
                'count' => count($uniqueRelated)
            ]);
            
        } catch (Exception $e) {
            error_log("Related words error: " . $e->getMessage());
            return errorResponse('Failed to get related words', 500);
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

