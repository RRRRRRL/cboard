<?php
/**
 * Jyutping Keyboard API Routes Handler
 * Sprint 7: Jyutping Keyboard Implementation
 *
 * Endpoints:
 * - GET /api/jyutping/search?code={code} - Search Jyutping dictionary
 * - POST /api/jyutping/translate - Translate Chinese text to Jyutping
 * - GET /api/jyutping/suggestions?input={input} - Get word suggestions
 * - POST /api/jyutping/audio - Generate audio for Jyutping
 * - POST /api/jyutping/learning-log - Log learning progress
 * - GET /api/jyutping/dictionary - List dictionary entries (admin/teacher/therapist only)
 * - POST /api/jyutping/dictionary - Add new dictionary entry (admin/teacher/therapist only)
 * - PUT /api/jyutping/dictionary/{id} - Update dictionary entry (admin/teacher/therapist only)
 * - DELETE /api/jyutping/dictionary/{id} - Delete dictionary entry (admin/teacher/therapist only)
 */

require_once __DIR__ . '/../auth.php';

/**
 * Get matching rules for keyboard search (for a user/profile)
 * Returns default rules if none are configured
 * This matches the structure used in games.php getMatchingRules function
 */
function getKeyboardMatchingRules($db, $userId = null, $profileId = null) {
    // Default rules when no user rules are configured - rules are DISABLED by default
    $defaultRules = [
        'enabled' => false,
        'frequency_threshold' => 50,
        'allow_exact_match' => true,
        'allow_substring_match' => true,
        'allow_single_char_match' => true,
        'require_ai_correction' => false,
        'ai_confidence_threshold' => 0.50,
        // Phonological adaptation rules - all disabled by default
        'merge_n_ng_finals' => false,
        'allow_coda_simplification' => false,
        'ignore_tones' => false,
        'allow_fuzzy_tones' => false,
        'fuzzy_tone_pairs' => null,
        'allow_ng_zero_confusion' => false,
        'allow_n_l_confusion' => false
    ];

    if (!$userId) {
        // debug: getKeyboardMatchingRules: no userId, using defaults
        // error_log("getKeyboardMatchingRules: no userId, using defaults");
        return $defaultRules;
    }

    try {
        // Try to get profile-specific rules first, then user-level rules
        $sql = "SELECT * FROM jyutping_matching_rules
                WHERE user_id = ?
                  AND (profile_id = ? OR (profile_id IS NULL AND ? IS NULL))
                ORDER BY profile_id DESC
                LIMIT 1";
        $stmt = $db->prepare($sql);
        $stmt->execute([$userId, $profileId, $profileId]);
        $rule = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($rule) {
                // debug: loaded matching rules row for inspection
                // error_log("getKeyboardMatchingRules: loaded row for user_id={$userId}, profile_id=" . var_export($profileId, true) . " => " . json_encode($rule));
            return [
                'frequency_threshold' => isset($rule['frequency_threshold']) ? (int)$rule['frequency_threshold'] : 50,
                'allow_exact_match' => isset($rule['allow_exact_match']) ? (bool)$rule['allow_exact_match'] : true,
                'allow_substring_match' => isset($rule['allow_substring_match']) ? (bool)$rule['allow_substring_match'] : true,
                'allow_single_char_match' => isset($rule['allow_single_char_match']) ? (bool)$rule['allow_single_char_match'] : true,
                'require_ai_correction' => isset($rule['require_ai_correction']) ? (bool)$rule['require_ai_correction'] : false,
                'ai_confidence_threshold' => isset($rule['ai_confidence_threshold']) ? (float)$rule['ai_confidence_threshold'] : 0.50,
                'enabled' => isset($rule['enabled']) ? (bool)$rule['enabled'] : false,
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
        // debug: no matching rules row found, using defaults
        // error_log("getKeyboardMatchingRules: no row for user_id={$userId}, profile_id=" . var_export($profileId, true) . ", using defaults");
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
    $baseVariants = []; // To hold base forms without tone

    $tone = '';
    $codeWithoutTone = preg_replace('/\d+$/', '', $code);
    if (preg_match('/(\d+)$/', $code, $matches)) {
        $tone = $matches[1];
    }
    if (!empty($codeWithoutTone)) {
        $baseVariants[] = $codeWithoutTone;
    }
    
    // Rule 1: Merge -n and -ng finals
    if ($rules['merge_n_ng_finals']) {
        // Generate base variants without tone first
        if (preg_match('/([a-z]+)n$/', $codeWithoutTone, $matches)) {
            $base = $matches[1];
            $ngBase = $base . 'ng';
            if (!in_array($ngBase, $baseVariants)) {
                $baseVariants[] = $ngBase;
            }
        }
        if (preg_match('/([a-z]+)ng$/', $codeWithoutTone, $matches)) {
            $base = $matches[1];
            $nBase = $base . 'n';
            if (!in_array($nBase, $baseVariants)) {
                $baseVariants[] = $nBase;
            }
        }

        // Existing per‑code variant logic (keep if you want direct swaps with tone)
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
        foreach ($baseVariants as $base) {
            if (!empty($base)) {
                // add base without tone
                if (!in_array($base, $variants)) {
                    $variants[] = $base;
                }
                // add all tones for each base
                for ($i = 1; $i <= 6; $i++) {
                    $variant = $base . $i;
                    if (!in_array($variant, $variants)) {
                        $variants[] = $variant;
                    }
                }
            }
        }
        return array_unique($variants);
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
    $profileId = isset($_GET['profile_id'])
    ? (($_GET['profile_id'] === '' || $_GET['profile_id'] === 'null') ? null : (int)$_GET['profile_id'])
    : null;
    // debug: Jyutping search auth info
    // error_log("Jyutping search auth: userId=" . var_export($userId, true) .
    //       ", profileId=" . var_export($profileId, true));

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

        // SPECIAL HANDLING FOR CHINESE CHARACTERS: If input contains Chinese characters,
        // segment them and search for each character individually
        $isChinesePhrase = preg_match('/\p{Han}+/u', $code);
            if ($isChinesePhrase && mb_strlen($code) > 1) {
            // debug: detected multi-character Chinese phrase
            // error_log("Jyutping search: Detected multi-character Chinese phrase: '$code' (length: " . mb_strlen($code) . ")");

            // Segment the Chinese phrase into individual characters
            $characters = preg_split('//u', $code, -1, PREG_SPLIT_NO_EMPTY);
            $characters = array_filter($characters, function($char) {
                return !empty(trim($char)) && preg_match('/\p{Han}/u', $char);
            });

            if (empty($characters)) {
                return successResponse([
                    'code' => $code,
                    'matches' => [],
                    'match_type' => 'none',
                    'rules' => $rules
                ]);
            }

            // debug: segmented characters
            // error_log("Jyutping search: Segmented into " . count($characters) . " characters: " . implode(', ', $characters));

            // Search for Jyutping for each character
            $jyutpingParts = [];
            $allMatches = [];
            $hasAllMatches = true;

            foreach ($characters as $char) {
                // Search for this individual character
                $charSql = "SELECT jyutping_code, hanzi, frequency
                           FROM jyutping_dictionary
                           WHERE hanzi = ?
                             AND frequency > ?
                           ORDER BY frequency DESC
                           LIMIT 5";
                $charStmt = $db->prepare($charSql);
                $charStmt->execute([$char, $frequencyThreshold]);
                $charMatches = $charStmt->fetchAll(PDO::FETCH_ASSOC);

                if (!empty($charMatches)) {
                    // Take the highest frequency match for this character
                    $bestMatch = $charMatches[0];
                    $jyutpingParts[] = $bestMatch['jyutping_code'];
                    $allMatches[] = $bestMatch;
                } else {
                    // debug: no match for character
                    // error_log("Jyutping search: No match found for character '$char'");
                    $hasAllMatches = false;
                    break;
                }
            }

                if ($hasAllMatches && !empty($jyutpingParts)) {
                // Combine all Jyutping parts
                $combinedJyutping = implode(' ', $jyutpingParts);

                // debug: combined jyutping for phrase
                // error_log("Jyutping search: Successfully combined Jyutping for '$code': $combinedJyutping");

                return successResponse([
                    'code' => $code,
                    'matches' => [[
                        'jyutping_code' => $combinedJyutping,
                        'hanzi' => $code,
                        'word' => $code,
                        'frequency' => 100, // Default frequency for combined phrases
                        'character_matches' => $allMatches
                    ]],
                    'match_type' => 'phrase_segmented',
                    'segmented_characters' => count($characters),
                    'rules' => $rules
                ]);
                } else {
                // debug: could not find jyutping for all characters, fall back
                // error_log("Jyutping search: Could not find Jyutping for all characters in '$code'");
                // Fall back to regular search logic below
            }
        }

        // Generate matching variants based on phonological rules (for Jyutping input)
        $variants = generateJyutpingVariants($code, $rules);

        $variants = array_values(array_unique($variants));
        if (empty($variants)) {
            return successResponse([
                'code' => $code,
                'matches' => [],
                'match_type' => 'none',
                'rules' => $rules
            ]);
        }

        // Log which phonological rules are enabled
        $enabledRules = [];
        if ($rules['merge_n_ng_finals']) $enabledRules[] = 'merge_n_ng_finals';
        if ($rules['allow_coda_simplification']) $enabledRules[] = 'allow_coda_simplification';
        if ($rules['ignore_tones']) $enabledRules[] = 'ignore_tones';
        if ($rules['allow_fuzzy_tones']) $enabledRules[] = 'allow_fuzzy_tones';
        if ($rules['allow_ng_zero_confusion']) $enabledRules[] = 'allow_ng_zero_confusion';
        if ($rules['allow_n_l_confusion']) $enabledRules[] = 'allow_n_l_confusion';

        $rulesDescription = empty($enabledRules) ? 'no phonological rules enabled' : 'phonological rules: ' . implode(', ', $enabledRules);
        // debug: rules description and variants
        // error_log("Jyutping search for '$code' - $rulesDescription, variants: " . implode(', ', $variants));
        
        // Search for exact match first (try all variants)
        // After $variants = generateJyutpingVariants($code, $rules);

        $placeholders = implode(',', array_fill(0, count($variants), '?'));

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
        $stmt   = $db->prepare($sql);
        $stmt->execute($params);
        $exactMatches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        
        // If we have exact matches, return them immediately
        if (!empty($exactMatches)) {
            return successResponse([
                'code' => $code,
                'matches' => $exactMatches,
                'match_type' => 'exact',
                'variants_used' => $variants,
                'rules' => $rules
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
                $conditions = implode(' OR ', array_fill(0, count($likePatterns), 'jyutping_code LIKE ?'));
                $sql = "SELECT * FROM jyutping_dictionary 
                        WHERE ($conditions)
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
                        'variants_used' => $variantsWithoutTone,
                        'rules' => $rules
                    ]);
                }
            }
        }
        
        // Search for partial match (starts with) - shows all matches like "nei*"
        // This handles cases where user types "nei" to see all "nei1", "nei2", "nei5", etc.
        // Use all variants for LIKE search
        $likePatterns = array_map(function($v) { return $v . '%'; }, $variants);
        $conditions = implode(' OR ', array_fill(0, count($likePatterns), 'jyutping_code LIKE ?'));
        $sql = "SELECT * FROM jyutping_dictionary 
                WHERE ($conditions)
                AND frequency > ?
                ORDER BY 
                    CASE 
                        WHEN jyutping_code = ? THEN 1
                        ELSE 2
                    END,
                    frequency DESC, id ASC 
                LIMIT 15";
        $params = array_merge($likePatterns, [$frequencyThreshold, $code]);
        // debug: search execution details
        // error_log("Jyutping search: code='$code', variants=" . implode(', ', $variants) . ", threshold=$frequencyThreshold");
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $partialMatches = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // debug: partial matches count
        // error_log("Jyutping partial matches found: " . count($partialMatches));
        
        if (!empty($partialMatches)) {
            return successResponse([
                'code' => $code,
                'matches' => $partialMatches,
                'match_type' => 'partial',
                'rules' => $rules
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
                    'match_type' => 'base_match',
                    'rules' => $rules
                ]);
            }
        }
        
        // If no matches found at all, return empty result
        return successResponse([
            'code' => $code,
            'matches' => [],
            'match_type' => 'none',
            'rules' => $rules
        ]);
        
    } catch (Exception $e) {
        error_log("Jyutping search error: " . $e->getMessage());
        return errorResponse('Failed to search Jyutping dictionary', 500);
    }
}

    // POST /jyutping/translate - Translate Chinese text to Jyutping
    if ($method === 'POST' && isset($pathParts[1]) && $pathParts[1] === 'translate') {
        try {
            $chineseText = $data['text'] ?? '';

            if (empty($chineseText)) {
                return errorResponse('Chinese text is required', 400);
            }

            // For translation, we want to find ALL characters in dictionary
            // Use a very low frequency threshold (0) to include all entries
            $translationFrequencyThreshold = 0;

            // Convert Chinese characters to Jyutping
            $characters = preg_split('//u', $chineseText, -1, PREG_SPLIT_NO_EMPTY);
            $jyutpingResults = [];
            $unknownCharacters = [];

            foreach ($characters as $char) {
                if (preg_match('/[\x{4e00}-\x{9fff}]/u', $char)) {
                    // Chinese character - find Jyutping
                    // For translation, we search without restrictive frequency filtering
                    // to ensure we can translate all known characters
                    // debug: translate lookup for character
                    // error_log("Jyutping translate: Looking up character '$char' (mb_ord: " . mb_ord($char, 'UTF-8') . ", hex: " . bin2hex($char) . ", length: " . strlen($char) . ")");

                    // Ensure database connection uses UTF-8
                    $db->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

                    // Debug: Check what we're actually querying
                    // error_log("Jyutping translate: Executing query for char '$char' with threshold $translationFrequencyThreshold");

                    $stmt = $db->prepare("
                        SELECT hanzi, jyutping_code, word, frequency
                        FROM jyutping_dictionary
                        WHERE hanzi = ? COLLATE utf8mb4_unicode_ci
                          AND frequency > ?
                        ORDER BY frequency DESC
                        LIMIT 1
                    ");
                    $stmt->execute([$char, $translationFrequencyThreshold]);
                    $result = $stmt->fetch(PDO::FETCH_ASSOC);

                    // Debug: Log the result
                    if ($result) {
                        // debug: query returned a result
                        // error_log("Jyutping translate: Query returned: hanzi='{$result['hanzi']}', jyutping='{$result['jyutping_code']}', freq={$result['frequency']}");
                    } else {
                        // debug: query returned null/empty result
                        // error_log("Jyutping translate: Query returned null/empty result");

                        // Debug: Try a broader query to see if the character exists at all
                        $stmt = $db->prepare("SELECT COUNT(*) as count FROM jyutping_dictionary WHERE hanzi = ?");
                        $stmt->execute([$char]);
                        $countResult = $stmt->fetch(PDO::FETCH_ASSOC);
                        // debug: total entries for char
                        // error_log("Jyutping translate: Total entries for '$char': " . ($countResult['count'] ?? 0));

                        // Debug: Try without frequency filter
                        $stmt2 = $db->prepare("SELECT hanzi, jyutping_code, frequency FROM jyutping_dictionary WHERE hanzi = ? ORDER BY frequency DESC LIMIT 1");
                        $stmt2->execute([$char]);
                        $debugResult = $stmt2->fetch(PDO::FETCH_ASSOC);
                        if ($debugResult) {
                            
                        } else {
                            // debug: character not found even without frequency filter
                            // error_log("Jyutping translate: Character '$char' not found even without frequency filter");
                        }
                    }

                        if ($result) {
                        // debug: found translation
                        // error_log("Jyutping translate: Found '$char' -> '{$result['jyutping_code']}' (freq: {$result['frequency']})");
                        $jyutpingResults[] = [
                            'character' => $char,
                            'jyutping' => $result['jyutping_code'],
                            'meaning' => $result['word'] ?? $result['hanzi'] ?? '',
                            'frequency' => (int)$result['frequency'],
                            'confidence' => min(1.0, $result['frequency'] / 1000)
                        ];
                        } else {
                        // debug: character not found in dictionary at threshold
                        // error_log("Jyutping translate: Character '$char' NOT FOUND in dictionary (threshold: $translationFrequencyThreshold)");

                        // Try without frequency threshold as absolute fallback
                        $fallbackStmt = $db->prepare("
                            SELECT hanzi, jyutping_code, word, frequency
                            FROM jyutping_dictionary
                            WHERE hanzi = ?
                            ORDER BY frequency DESC
                            LIMIT 1
                        ");
                        $fallbackStmt->execute([$char]);
                        $fallbackResult = $fallbackStmt->fetch(PDO::FETCH_ASSOC);

                        if ($fallbackResult) {
                            // debug: fallback found
                            // error_log("Jyutping translate: Fallback found '$char' -> '{$fallbackResult['jyutping_code']}' (freq: {$fallbackResult['frequency']})");
                            $jyutpingResults[] = [
                                'character' => $char,
                                'jyutping' => $fallbackResult['jyutping_code'],
                                'meaning' => $fallbackResult['word'] ?? $fallbackResult['hanzi'] ?? '',
                                'frequency' => (int)$fallbackResult['frequency'],
                                'confidence' => min(1.0, $fallbackResult['frequency'] / 1000)
                            ];
                        } else {
                            // debug: character not found even with no frequency threshold
                            // error_log("Jyutping translate: Character '$char' NOT FOUND even with no frequency threshold");
                            // Character not found in dictionary
                            $jyutpingResults[] = [
                                'character' => $char,
                                'jyutping' => null,
                                'meaning' => null,
                                'frequency' => 0,
                                'confidence' => 0.0
                            ];
                            $unknownCharacters[] = $char;
                        }
                    }
                } else {
                    // Non-Chinese character (punctuation, space, etc.)
                    $jyutpingResults[] = [
                        'character' => $char,
                        'jyutping' => $char,
                        'meaning' => null,
                        'frequency' => 0,
                        'confidence' => 1.0
                    ];
                }
            }

            // Build full Jyutping string
            $fullJyutping = '';
            foreach ($jyutpingResults as $result) {
                if ($result['jyutping']) {
                    $fullJyutping .= $result['jyutping'] . ' ';
                }
            }
            $fullJyutping = trim($fullJyutping);

            // Get keyboard matching rules for the response
            $rules = getKeyboardMatchingRules($db, $userId, $profileId);

            return successResponse([
                'original_text' => $chineseText,
                'jyutping' => $fullJyutping,
                'characters' => $jyutpingResults,
                'unknown_characters' => $unknownCharacters,
                'coverage' => count($characters) > 0 ? (count($characters) - count($unknownCharacters)) / count($characters) : 0,
                'rules_used' => $rules,
                'translation_type' => 'traditional_chinese_to_jyutping'
            ]);

        } catch (Exception $e) {
            error_log("Jyutping translation error: " . $e->getMessage());
            return errorResponse('Failed to translate to Jyutping', 500);
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
        // debug: jyutping dictionary table count
        // error_log("Jyutping dictionary table count: " . ($tableCount['count'] ?? 0));
        
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
        
        // debug: suggestions search params
        // error_log("Jyutping suggestions search: input='$input', pattern='$searchPattern', limit=$limit, threshold=$frequencyThreshold");
        
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
        // debug: suggestions count
        // error_log("Jyutping suggestions found: " . count($suggestions));
        
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
                // debug: no related words found
                // error_log("Related words: No results found for hanzi='$hanzi', jyutping='$jyutping', context='$fullContext' (threshold=$frequencyThreshold)");
            } else {
                // Limit to 15 results if we have enough
                $uniqueRelated = array_slice($uniqueRelated, 0, 15);
                // debug: related words count
                // error_log("Related words found: " . count($uniqueRelated) . " for hanzi='$hanzi', jyutping='$jyutping', context='$fullContext' (threshold=$frequencyThreshold)");
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

    // GET /api/jyutping/dictionary - List dictionary entries
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'dictionary') {
        try {
            // Require admin/teacher/therapist authentication for dictionary management
            $user = requireAuth($authToken);
            $allowedRoles = ['admin', 'teacher', 'therapist'];
            if (!in_array($user['role'], $allowedRoles)) {
                return errorResponse('Insufficient permissions', 403);
            }

            // Parse query parameters
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
            $offset = ($page - 1) * $limit;

            $jyutpingFilter = $_GET['jyutping_code'] ?? null;
            $hanziFilter = $_GET['hanzi'] ?? null;
            $wordFilter = $_GET['word'] ?? null;
            $tagsFilter = $_GET['tags'] ?? null;
            $minFrequency = isset($_GET['min_frequency']) ? (int)$_GET['min_frequency'] : null;

            // Build query
            $where = [];
            $params = [];

            if ($jyutpingFilter) {
                $where[] = "jyutping_code LIKE ?";
                $params[] = '%' . $jyutpingFilter . '%';
            }
            if ($hanziFilter) {
                $where[] = "hanzi LIKE ?";
                $params[] = '%' . $hanziFilter . '%';
            }
            if ($wordFilter) {
                $where[] = "word LIKE ?";
                $params[] = '%' . $wordFilter . '%';
            }
            if ($tagsFilter) {
                $where[] = "tags LIKE ?";
                $params[] = '%' . $tagsFilter . '%';
            }
            if ($minFrequency !== null) {
                $where[] = "frequency >= ?";
                $params[] = $minFrequency;
            }

            $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

            // Get total count
            $countSql = "SELECT COUNT(*) as total FROM jyutping_dictionary $whereClause";
            $countStmt = $db->prepare($countSql);
            $countStmt->execute($params);
            $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

            // Get entries
            $sql = "SELECT id, jyutping_code, hanzi, word, frequency, tags, created_at, updated_at
                    FROM jyutping_dictionary
                    $whereClause
                    ORDER BY frequency DESC, jyutping_code ASC, id ASC
                    LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;

            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return successResponse([
                'entries' => $entries,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'total_pages' => ceil($total / $limit)
                ]
            ]);

        } catch (Exception $e) {
            error_log("Get jyutping dictionary error: " . $e->getMessage());
            return errorResponse('Failed to get dictionary entries', 500);
        }
    }

    // POST /api/jyutping/dictionary - Add new dictionary entry
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'dictionary') {
        try {
            // Require admin/teacher/therapist authentication
            $user = requireAuth($authToken);
            $allowedRoles = ['admin', 'teacher', 'therapist'];
            if (!in_array($user['role'], $allowedRoles)) {
                return errorResponse('Insufficient permissions', 403);
            }

            // Validate required fields
            if (!isset($data['jyutping_code']) || empty(trim($data['jyutping_code']))) {
                return errorResponse('jyutping_code is required', 400);
            }

            // Validate jyutping_code format (basic validation)
            $jyutpingCode = trim($data['jyutping_code']);
            if (!preg_match('/^[a-z]+[1-6]?$/', $jyutpingCode)) {
                return errorResponse('Invalid jyutping_code format', 400);
            }

            // Check for duplicates (same jyutping_code + hanzi + word combination)
            $checkSql = "SELECT id FROM jyutping_dictionary
                        WHERE jyutping_code = ?
                          AND (hanzi = ? OR (hanzi IS NULL AND ? IS NULL))
                          AND (word = ? OR (word IS NULL AND ? IS NULL))";
            $checkStmt = $db->prepare($checkSql);
            $checkStmt->execute([
                $jyutpingCode,
                $data['hanzi'] ?? null,
                $data['hanzi'] ?? null,
                $data['word'] ?? null,
                $data['word'] ?? null
            ]);

            if ($checkStmt->fetch()) {
                return errorResponse('Duplicate entry already exists', 409);
            }

            // Insert new entry
            $sql = "INSERT INTO jyutping_dictionary
                    (jyutping_code, hanzi, word, frequency, tags, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, NOW(), NOW())";

            $stmt = $db->prepare($sql);
            $stmt->execute([
                $jyutpingCode,
                $data['hanzi'] ?? null,
                $data['word'] ?? null,
                isset($data['frequency']) ? (int)$data['frequency'] : 0,
                $data['tags'] ?? null
            ]);

            $newId = $db->lastInsertId();

            // Get the created entry
            $selectSql = "SELECT id, jyutping_code, hanzi, word, frequency, tags, created_at, updated_at
                         FROM jyutping_dictionary WHERE id = ?";
            $selectStmt = $db->prepare($selectSql);
            $selectStmt->execute([$newId]);
            $entry = $selectStmt->fetch(PDO::FETCH_ASSOC);

            return successResponse($entry, 201);

        } catch (Exception $e) {
            error_log("Create jyutping dictionary entry error: " . $e->getMessage());
            return errorResponse('Failed to create dictionary entry', 500);
        }
    }

    // PUT /api/jyutping/dictionary/{id} - Update dictionary entry
    if ($method === 'PUT' && count($pathParts) === 3 && $pathParts[1] === 'dictionary') {
        try {
            // Require admin/teacher/therapist authentication
            $user = requireAuth($authToken);
            $allowedRoles = ['admin', 'teacher', 'therapist'];
            if (!in_array($user['role'], $allowedRoles)) {
                return errorResponse('Insufficient permissions', 403);
            }

            $id = (int)$pathParts[2];

            // Check if entry exists
            $checkStmt = $db->prepare("SELECT id FROM jyutping_dictionary WHERE id = ?");
            $checkStmt->execute([$id]);
            if (!$checkStmt->fetch()) {
                return errorResponse('Dictionary entry not found', 404);
            }

            // Validate jyutping_code if provided
            if (isset($data['jyutping_code'])) {
                $jyutpingCode = trim($data['jyutping_code']);
                if (empty($jyutpingCode) || !preg_match('/^[a-z]+[1-6]?$/', $jyutpingCode)) {
                    return errorResponse('Invalid jyutping_code format', 400);
                }
            }

            // Check for duplicates if jyutping_code, hanzi, or word are being updated
            if (isset($data['jyutping_code']) || isset($data['hanzi']) || isset($data['word'])) {
                $checkDuplicateSql = "SELECT id FROM jyutping_dictionary
                                    WHERE id != ?
                                      AND jyutping_code = ?
                                      AND (hanzi = ? OR (hanzi IS NULL AND ? IS NULL))
                                      AND (word = ? OR (word IS NULL AND ? IS NULL))";
                $checkDuplicateStmt = $db->prepare($checkDuplicateSql);
                $checkDuplicateStmt->execute([
                    $id,
                    $data['jyutping_code'] ?? null,
                    $data['hanzi'] ?? null,
                    $data['hanzi'] ?? null,
                    $data['word'] ?? null,
                    $data['word'] ?? null
                ]);

                if ($checkDuplicateStmt->fetch()) {
                    return errorResponse('Duplicate entry would be created', 409);
                }
            }

            // Build update query
            $updates = [];
            $params = [];

            if (isset($data['jyutping_code'])) {
                $updates[] = "jyutping_code = ?";
                $params[] = trim($data['jyutping_code']);
            }
            if (isset($data['hanzi'])) {
                $updates[] = "hanzi = ?";
                $params[] = $data['hanzi'];
            }
            if (isset($data['word'])) {
                $updates[] = "word = ?";
                $params[] = $data['word'];
            }
            if (isset($data['frequency'])) {
                $updates[] = "frequency = ?";
                $params[] = (int)$data['frequency'];
            }
            if (isset($data['tags'])) {
                $updates[] = "tags = ?";
                $params[] = $data['tags'];
            }

            if (empty($updates)) {
                return errorResponse('No fields to update', 400);
            }

            $updates[] = "updated_at = NOW()";
            $params[] = $id;

            $sql = "UPDATE jyutping_dictionary SET " . implode(', ', $updates) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);

            // Get updated entry
            $selectSql = "SELECT id, jyutping_code, hanzi, word, frequency, tags, created_at, updated_at
                         FROM jyutping_dictionary WHERE id = ?";
            $selectStmt = $db->prepare($selectSql);
            $selectStmt->execute([$id]);
            $entry = $selectStmt->fetch(PDO::FETCH_ASSOC);

            return successResponse($entry);

        } catch (Exception $e) {
            error_log("Update jyutping dictionary entry error: " . $e->getMessage());
            return errorResponse('Failed to update dictionary entry', 500);
        }
    }

    // DELETE /api/jyutping/dictionary/{id} - Delete dictionary entry
    if ($method === 'DELETE' && count($pathParts) === 3 && $pathParts[1] === 'dictionary') {
        try {
            // Require admin/teacher/therapist authentication
            $user = requireAuth($authToken);
            $allowedRoles = ['admin', 'teacher', 'therapist'];
            if (!in_array($user['role'], $allowedRoles)) {
                return errorResponse('Insufficient permissions', 403);
            }

            $id = (int)$pathParts[2];

            // Check if entry exists
            $checkStmt = $db->prepare("SELECT id FROM jyutping_dictionary WHERE id = ?");
            $checkStmt->execute([$id]);
            if (!$checkStmt->fetch()) {
                return errorResponse('Dictionary entry not found', 404);
            }

            // Delete entry
            $stmt = $db->prepare("DELETE FROM jyutping_dictionary WHERE id = ?");
            $stmt->execute([$id]);

            return successResponse(['message' => 'Dictionary entry deleted successfully']);

        } catch (Exception $e) {
            error_log("Delete jyutping dictionary entry error: " . $e->getMessage());
            return errorResponse('Failed to delete dictionary entry', 500);
        }
    }

    // Jyutping Matching Rules API Routes
    // GET /api/jyutping-rules/matching/{userId} - Get matching rules for user
    if ($method === 'GET' && count($pathParts) >= 3 && isset($pathParts[3]) && $pathParts[1] === 'rules' && $pathParts[2] === 'matching') {
        try {
            $userId = (int)$pathParts[3];
            $profileId = isset($_GET['profile_id']) ? (int)$_GET['profile_id'] : null;

            // Require authentication and ownership
            $user = requireAuth($authToken);
            if ($user['id'] != $userId && !in_array($user['role'], ['admin', 'teacher', 'therapist'])) {
                return errorResponse('Access denied', 403);
            }

            // Get matching rules
            $rules = getKeyboardMatchingRules($db, $userId, $profileId);

            return successResponse([
                'user_id' => $userId,
                'profile_id' => $profileId,
                'rules' => $rules
            ]);

        } catch (Exception $e) {
            error_log("Get jyutping matching rules error: " . $e->getMessage());
            return errorResponse('Failed to get matching rules', 500);
        }
    }

    // PUT /api/jyutping-rules/matching/{userId} - Update matching rules for user
    if ($method === 'PUT' && count($pathParts) >= 3 && isset($pathParts[3]) && $pathParts[1] === 'rules' && $pathParts[2] === 'matching') {
        try {
            $userId = (int)$pathParts[3];
            

            // Require authentication and ownership
            $user = requireAuth($authToken);
            

            if ($user['id'] != $userId && !in_array($user['role'], ['admin', 'teacher', 'therapist'])) {
                
                return errorResponse('Access denied', 403);
            }

            // Validate required fields
            $requiredFields = ['enabled'];
            foreach ($requiredFields as $field) {
                if (!isset($data[$field])) {
                    
                    return errorResponse("Field '$field' is required", 400);
                }
            }

            $profileId = $data['profile_id'] ?? null;
            $enabled = (bool)$data['enabled'];
            

            // If rules are disabled, just return defaults
            if (!$enabled) {
                
                $defaultRules = [
                    'enabled' => false,
                    'frequency_threshold' => 50,
                    'allow_exact_match' => true,
                    'allow_substring_match' => true,
                    'allow_single_char_match' => true,
                    'require_ai_correction' => false,
                    'ai_confidence_threshold' => 0.50,
                    'merge_n_ng_finals' => false,
                    'allow_coda_simplification' => false,
                    'ignore_tones' => false,
                    'allow_fuzzy_tones' => false,
                    'fuzzy_tone_pairs' => null,
                    'allow_ng_zero_confusion' => false,
                    'allow_n_l_confusion' => false
                ];
                return successResponse($defaultRules);
            }

            // Build insert/update data
            $ruleData = [
                'user_id' => $userId,
                'profile_id' => $profileId,
                'enabled' => $enabled,
                'frequency_threshold' => isset($data['frequency_threshold']) ? (int)$data['frequency_threshold'] : 50,
                'allow_exact_match' => isset($data['allow_exact_match']) ? (bool)$data['allow_exact_match'] : true,
                'allow_substring_match' => isset($data['allow_substring_match']) ? (bool)$data['allow_substring_match'] : true,
                'allow_single_char_match' => isset($data['allow_single_char_match']) ? (bool)$data['allow_single_char_match'] : true,
                'require_ai_correction' => isset($data['require_ai_correction']) ? (bool)$data['require_ai_correction'] : false,
                'ai_confidence_threshold' => isset($data['ai_confidence_threshold']) ? (float)$data['ai_confidence_threshold'] : 0.50,
                'merge_n_ng_finals' => isset($data['merge_n_ng_finals']) ? (bool)$data['merge_n_ng_finals'] : false,
                'allow_coda_simplification' => isset($data['allow_coda_simplification']) ? (bool)$data['allow_coda_simplification'] : false,
                'ignore_tones' => isset($data['ignore_tones']) ? (bool)$data['ignore_tones'] : false,
                'allow_fuzzy_tones' => isset($data['allow_fuzzy_tones']) ? (bool)$data['allow_fuzzy_tones'] : false,
                'fuzzy_tone_pairs' => isset($data['fuzzy_tone_pairs']) ? $data['fuzzy_tone_pairs'] : null,
                'allow_ng_zero_confusion' => isset($data['allow_ng_zero_confusion']) ? (bool)$data['allow_ng_zero_confusion'] : false,
                'allow_n_l_confusion' => isset($data['allow_n_l_confusion']) ? (bool)$data['allow_n_l_confusion'] : false
            ];

            

            // Normalize boolean-like values to 0/1 for DB
            $ruleData['enabled'] = (int)!empty($ruleData['enabled']);
            $ruleData['allow_exact_match'] = (int)!empty($ruleData['allow_exact_match']);
            $ruleData['allow_substring_match'] = (int)!empty($ruleData['allow_substring_match']);
            $ruleData['allow_single_char_match'] = (int)!empty($ruleData['allow_single_char_match']);
            $ruleData['require_ai_correction'] = (int)!empty($ruleData['require_ai_correction']);
            $ruleData['merge_n_ng_finals'] = (int)!empty($ruleData['merge_n_ng_finals']);
            $ruleData['allow_coda_simplification'] = (int)!empty($ruleData['allow_coda_simplification']);
            $ruleData['ignore_tones'] = (int)!empty($ruleData['ignore_tones']);
            $ruleData['allow_fuzzy_tones'] = (int)!empty($ruleData['allow_fuzzy_tones']);
            $ruleData['allow_ng_zero_confusion'] = (int)!empty($ruleData['allow_ng_zero_confusion']);
            $ruleData['allow_n_l_confusion'] = (int)!empty($ruleData['allow_n_l_confusion']);


            // Check if rule already exists
            $checkSql = "SELECT id FROM jyutping_matching_rules
                        WHERE user_id = ?
                          AND (profile_id = ? OR (profile_id IS NULL AND ? IS NULL))";
            $checkStmt = $db->prepare($checkSql);
            $checkStmt->execute([$userId, $profileId, $profileId]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
            

            if ($existing) {
                // Update existing rule
                $updateFields = [];
                $params = [];
                foreach ($ruleData as $field => $value) {
                    if ($field !== 'user_id' && $field !== 'profile_id') {
                        $updateFields[] = "$field = ?";
                        $params[] = $value;
                    }
                }
                $params[] = $existing['id'];

                $updateSql = "UPDATE jyutping_matching_rules SET " . implode(', ', $updateFields) . ", updated_at = NOW() WHERE id = ?";
                
                

                $updateStmt = $db->prepare($updateSql);
                $updateResult = $updateStmt->execute($params);
                
            } else {
                // Insert new rule
                $fields = array_keys($ruleData);
                $placeholders = str_repeat('?,', count($fields) - 1) . '?';
                $insertSql = "INSERT INTO jyutping_matching_rules (" . implode(',', $fields) . ", created_by)
                             VALUES ($placeholders, ?)";
                $params = array_values($ruleData);
                $params[] = $user['id']; // created_by

                
                

                $insertStmt = $db->prepare($insertSql);
                $insertResult = $insertStmt->execute($params);
                
            }

            return successResponse([
                'user_id' => $userId,
                'profile_id' => $profileId,
                'rules' => $ruleData,
                'message' => 'Matching rules updated successfully'
            ]);

        } catch (Exception $e) {
            
            
            return errorResponse('Failed to update matching rules', 500);
        }
    }

    // GET /api/jyutping-rules/exceptions/{userId} - Get exception rules for user
    if ($method === 'GET' && count($pathParts) >= 3 && isset($pathParts[3]) && $pathParts[1] === 'rules' && $pathParts[2] === 'exceptions') {
        try {
            $userId = (int)$pathParts[3];
            $profileId = isset($_GET['profile_id']) ? (int)$_GET['profile_id'] : null;

            // Require authentication and ownership
            $user = requireAuth($authToken);
            if ($user['id'] != $userId && !in_array($user['role'], ['admin', 'teacher', 'therapist'])) {
                return errorResponse('Access denied', 403);
            }

            // Get all exception rules
            $rulesSql = "SELECT * FROM jyutping_exception_rules ORDER BY rule_name ASC";
            $rulesStmt = $db->prepare($rulesSql);
            $rulesStmt->execute();
            $allRules = $rulesStmt->fetchAll(PDO::FETCH_ASSOC);

            // Get user-specific enabled rules
            $userRulesSql = "SELECT rule_id, enabled FROM jyutping_student_exception_rules
                           WHERE user_id = ?
                             AND (profile_id = ? OR (profile_id IS NULL AND ? IS NULL))";
            $userRulesStmt = $db->prepare($userRulesSql);
            $userRulesStmt->execute([$userId, $profileId, $profileId]);
            $userRules = $userRulesStmt->fetchAll(PDO::FETCH_ASSOC);

            // Merge with user settings
            $userRuleMap = [];
            foreach ($userRules as $userRule) {
                $userRuleMap[$userRule['rule_id']] = (bool)$userRule['enabled'];
            }

            $rules = array_map(function($rule) use ($userRuleMap) {
                return [
                    'id' => (int)$rule['id'],
                    'rule_key' => $rule['rule_key'],
                    'rule_name' => $rule['rule_name'],
                    'rule_description' => $rule['rule_description'],
                    'rule_category' => $rule['rule_category'],
                    'default_enabled' => (bool)$rule['default_enabled'],
                    'is_system_rule' => (bool)$rule['is_system_rule'],
                    'enabled' => isset($userRuleMap[$rule['id']]) ? $userRuleMap[$rule['id']] : (bool)$rule['default_enabled']
                ];
            }, $allRules);

            return successResponse([
                'user_id' => $userId,
                'profile_id' => $profileId,
                'rules' => $rules
            ]);

        } catch (Exception $e) {
            error_log("Get jyutping exception rules error: " . $e->getMessage());
            return errorResponse('Failed to get exception rules', 500);
        }
    }

    // PUT /api/jyutping-rules/exceptions/{userId} - Update exception rules for user
    if ($method === 'PUT' && count($pathParts) >= 3 && isset($pathParts[3]) && $pathParts[1] === 'rules' && $pathParts[2] === 'exceptions') {
        try {
            $userId = (int)$pathParts[3];

            // Require authentication and ownership
            $user = requireAuth($authToken);
            if ($user['id'] != $userId && !in_array($user['role'], ['admin', 'teacher', 'therapist'])) {
                return errorResponse('Access denied', 403);
            }

            $profileId = $data['profile_id'] ?? null;
            $rulesToUpdate = $data['rules'] ?? [];

            if (!is_array($rulesToUpdate)) {
                return errorResponse('Rules must be an array', 400);
            }

            // Process each rule update
            foreach ($rulesToUpdate as $ruleUpdate) {
                if (!isset($ruleUpdate['rule_id']) || !isset($ruleUpdate['enabled'])) {
                    continue;
                }

                $ruleId = (int)$ruleUpdate['rule_id'];
                $enabled = (bool)$ruleUpdate['enabled'];

                // Check if rule exists in exception rules table
                $checkRuleSql = "SELECT id FROM jyutping_exception_rules WHERE id = ?";
                $checkRuleStmt = $db->prepare($checkRuleSql);
                $checkRuleStmt->execute([$ruleId]);
                if (!$checkRuleStmt->fetch()) {
                    continue; // Skip invalid rule IDs
                }

                // Check if user rule already exists
                $checkUserSql = "SELECT id FROM jyutping_student_exception_rules
                               WHERE user_id = ?
                                 AND profile_id <=> ?
                                 AND rule_id = ?";
                $checkUserStmt = $db->prepare($checkUserSql);
                $checkUserStmt->execute([$userId, $profileId, $ruleId]);
                $existing = $checkUserStmt->fetch(PDO::FETCH_ASSOC);

                if ($existing) {
                    // Update existing
                    $updateSql = "UPDATE jyutping_student_exception_rules
                                 SET enabled = ?, updated_at = NOW()
                                 WHERE id = ?";
                    $updateStmt = $db->prepare($updateSql);
                    $updateStmt->execute([$enabled, $existing['id']]);
                } else {
                    // Insert new
                    $insertSql = "INSERT INTO jyutping_student_exception_rules
                                 (user_id, profile_id, rule_id, enabled, created_by, created_at, updated_at)
                                 VALUES (?, ?, ?, ?, ?, NOW(), NOW())";
                    $insertStmt = $db->prepare($insertSql);
                    $insertStmt->execute([$userId, $profileId, $ruleId, $enabled, $user['id']]);
                }
            }

            return successResponse([
                'user_id' => $userId,
                'profile_id' => $profileId,
                'message' => 'Exception rules updated successfully'
            ]);

        } catch (Exception $e) {
            error_log("Update jyutping exception rules error: " . $e->getMessage());
            return errorResponse('Failed to update exception rules', 500);
        }
    }

    // If no route matches
    return errorResponse('Jyutping route not found. Method: ' . $method . ', Path: ' . json_encode($pathParts), 404);
}
