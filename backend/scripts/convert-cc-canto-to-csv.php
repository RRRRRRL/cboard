<?php
/**
 * Convert CC-CANTO dictionary file to Cboard CSV format
 * 
 * CC-CANTO format example:
 * 你 你 [nei5] /you/
 * 好 好 [hou2] /good/
 * 
 * Usage:
 *   php backend/scripts/convert-cc-canto-to-csv.php <cc-canto-file> [output_csv]
 */

if (php_sapi_name() !== 'cli') {
    die("This script must be run from command line\n");
}

/**
 * Bad words list - matches frontend filter
 * Chinese profanity characters and English inappropriate keywords
 * Only truly inappropriate content (profanity, explicit sexual, severe violence)
 * Using array_unique to prevent duplicates
 */
function getBadWords() {
    $badWords = [
        // Chinese profanity (single characters and phrases)
        '撚',
        '屌',
        '閪',
        '柒',
        '老母',
        '老味',
        '鳩',
        '戇',
        '仆',
        '冚',
        '屄',
        '肏',
        '頂你個肺',
        // English profanity and offensive slurs
        'slur',
        'fuck',
        'fucking',
        'shit',
        'damn',
        'bitch',
        'asshole',
        'bastard',
        'piss',
        'cunt',
        'cock',
        'dick',
        'pussy',
        'whore',
        'slut',
        'nigger',
        'faggot',
        'retard',
        // Severe violence (only extreme cases)
        'murder',
        'suicide',
        'rape',
        'torture',
        // Hard drugs (not common words like "drug" which can be educational)
        'cocaine',
        'heroin',
        'marijuana',
        // Explicit sexual content
        'porn',
        'pornography',
        'xxx',
        'nude',
        'naked',
        'erotic',
        'genital',
        'penis',
        'vagina',
        'orgasm',
        'masturbat',
        'prostitute',
        'escort',
        'stripper',
        // Offensive/obscene language
        'vulgar',
        'obscene',
        'profanity'
    ];
    
    // Remove duplicates and return
    return array_unique($badWords);
}

/**
 * Check if text contains inappropriate content
 * @param string $text - Text to check (can be Chinese or English)
 * @return bool - True if text contains inappropriate content
 */
function containsBadWords($text) {
    if (empty($text) || !is_string($text)) {
        return false;
    }
    
    $textLower = mb_strtolower(trim($text));
    $badWords = getBadWords();
    
    foreach ($badWords as $badWord) {
        $badWordLower = mb_strtolower($badWord);
        // Check if text contains the bad word
        if (mb_strpos($textLower, $badWordLower) !== false) {
            return true;
        }
    }
    
    return false;
}

/**
 * Calculate frequency based on word characteristics
 */
function calculateFrequency($hanzi, $word, $jyutping, $english) {
    $freq = 200; // Base frequency
    
    // Single character words are usually more common
    if (mb_strlen($hanzi) === 1) {
        $freq = 400;
    } elseif (mb_strlen($word) <= 2) {
        $freq = 300;
    } elseif (mb_strlen($word) <= 3) {
        $freq = 250;
    } else {
        // Longer words/phrases are less common
        $freq = max(50, 200 - (mb_strlen($word) - 3) * 20);
    }
    
    // Common greetings and basic words get higher frequency
    $commonWords = ['你', '好', '我', '他', '她', '是', '不', '有', '在', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    if (in_array($hanzi, $commonWords) || in_array($word, $commonWords)) {
        $freq = max($freq, 800);
    }
    
    // Numbers
    if (preg_match('/^[一二三四五六七八九十百千万]+$/', $hanzi) || preg_match('/^[一二三四五六七八九十百千万]+$/', $word)) {
        $freq = max($freq, 280);
    }
    
    // Very long phrases get lower frequency
    if (mb_strlen($word) > 6) {
        $freq = max(50, $freq - 100);
    }
    
    // Phrases with punctuation or special characters are less common
    if (preg_match('/[，。、；：！？]/u', $word)) {
        $freq = max(50, $freq - 50);
    }
    
    return $freq;
}

/**
 * Determine tags based on content analysis
 */
function determineTags($hanzi, $word, $english, $jyutping) {
    $tags = [];
    
    // Base tag
    $tags[] = 'daily';
    
    // Part of speech detection from English
    $englishLower = strtolower($english);
    if (preg_match('/\b(verb|to\s+\w+|ing\s+)/i', $english)) {
        $tags[] = 'verb';
    } elseif (preg_match('/\b(noun|a\s+\w+|an\s+\w+|the\s+\w+)/i', $english)) {
        $tags[] = 'noun';
    } elseif (preg_match('/\b(adjective|adj|adverb|adv)/i', $english)) {
        $tags[] = 'adjective';
    }
    
    // Greetings
    $greetingWords = ['你好', '早晨', '晚安', '再見', '拜拜', '早', '好'];
    if (in_array($word, $greetingWords) || stripos($english, 'greeting') !== false || stripos($english, 'hello') !== false) {
        $tags[] = 'greeting';
    }
    
    // Numbers
    if (preg_match('/^[一二三四五六七八九十百千万]+$/', $hanzi) || preg_match('/^[一二三四五六七八九十百千万]+$/', $word)) {
        $tags = ['number'];
    }
    
    // Colors
    $colorWords = ['紅', '藍', '黃', '綠', '白', '黑', '紫', '粉', '啡', '金', '銀', '灰'];
    if (in_array($hanzi, $colorWords) || stripos($english, 'color') !== false || stripos($english, 'colour') !== false) {
        $tags[] = 'color';
    }
    
    // Family
    $familyWords = ['媽媽', '爸爸', '哥哥', '姐姐', '弟弟', '妹妹', '爺爺', '奶奶', '外公', '外婆', '叔叔', '阿姨'];
    if (in_array($word, $familyWords) || stripos($english, 'father') !== false || stripos($english, 'mother') !== false || 
        stripos($english, 'brother') !== false || stripos($english, 'sister') !== false || stripos($english, 'family') !== false) {
        $tags[] = 'family';
    }
    
    // School
    if (stripos($english, 'school') !== false || stripos($english, 'learn') !== false || stripos($english, 'study') !== false ||
        stripos($english, 'teach') !== false || stripos($english, 'student') !== false || stripos($english, 'teacher') !== false) {
        $tags[] = 'school';
    }
    
    // Food
    if (stripos($english, 'food') !== false || stripos($english, 'eat') !== false || stripos($english, 'drink') !== false ||
        stripos($english, 'meal') !== false || stripos($english, 'rice') !== false || stripos($english, 'tea') !== false) {
        $tags[] = 'food';
    }
    
    // Body parts
    if (stripos($english, 'body') !== false || stripos($english, 'hand') !== false || stripos($english, 'foot') !== false ||
        stripos($english, 'head') !== false || stripos($english, 'eye') !== false || stripos($english, 'ear') !== false) {
        $tags[] = 'body';
    }
    
    // Animals
    if (stripos($english, 'animal') !== false || stripos($english, 'dog') !== false || stripos($english, 'cat') !== false ||
        stripos($english, 'bird') !== false || stripos($english, 'fish') !== false) {
        $tags[] = 'animal';
    }
    
    // Emotions
    if (stripos($english, 'emotion') !== false || stripos($english, 'feel') !== false || stripos($english, 'happy') !== false ||
        stripos($english, 'sad') !== false || stripos($english, 'angry') !== false) {
        $tags[] = 'emotion';
    }
    
    // Phrases (multi-character expressions)
    if (mb_strlen($word) > 2 && !in_array('number', $tags)) {
        $tags[] = 'phrase';
    }
    
    // Questions
    if (stripos($english, 'question') !== false || stripos($english, 'what') !== false || stripos($english, 'how') !== false ||
        stripos($english, 'why') !== false || stripos($english, 'where') !== false || stripos($english, 'when') !== false) {
        $tags[] = 'question';
    }
    
    // Polite expressions
    if (stripos($english, 'please') !== false || stripos($english, 'thank') !== false || stripos($english, 'sorry') !== false ||
        stripos($english, 'excuse') !== false) {
        $tags[] = 'polite';
    }
    
    return implode(',', array_unique($tags));
}

$inputFile = $argv[1] ?? null;
$outputFile = $argv[2] ?? __DIR__ . '/../database/jyutping_pycantonese_input.csv';

if (!$inputFile || !file_exists($inputFile)) {
    echo "Usage: php convert-cc-canto-to-csv.php <cc-canto-file> [output_csv]\n";
    echo "\n";
    echo "CC-CANTO format:\n";
    echo "  繁體字 簡體字 [粵拼] /英文解釋/\n";
    echo "\n";
    echo "Example:\n";
    echo "  php convert-cc-canto-to-csv.php cc-canto.txt\n";
    echo "\n";
    echo "Download CC-CANTO from: https://cantonese.org/download.html\n";
    exit(1);
}

echo "Converting CC-CANTO file to CSV format...\n";
echo "Input: $inputFile\n";
echo "Output: $outputFile\n\n";

$fp = fopen($inputFile, 'r');
if (!$fp) {
    fwrite(STDERR, "ERROR: Failed to open file: $inputFile\n");
    exit(1);
}

$outputDir = dirname($outputFile);
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0755, true);
}

$outFp = fopen($outputFile, 'w');
if (!$outFp) {
    fwrite(STDERR, "ERROR: Failed to create output file: $outputFile\n");
    fclose($fp);
    exit(1);
}

// Write CSV header
fputcsv($outFp, ['jyutping_code', 'hanzi', 'word', 'frequency', 'tags']);

$processed = 0;
$skipped = 0;
$filtered = 0; // Count of filtered inappropriate words
$lineNum = 0;

while (($line = fgets($fp)) !== false) {
    $lineNum++;
    $line = trim($line);
    
    // Skip empty lines and comments
    if (empty($line) || $line[0] === '#') {
        continue;
    }
    
    // Parse CC-CANTO format: 繁體字 簡體字 [普通話拼音] {粵拼} /英文解釋/
    // Pattern: traditional simplified [pinyin] {jyutping} /english/
    // CC-CANTO uses curly braces {} for Jyutping, square brackets [] for Mandarin pinyin
    $matched = false;
    if (preg_match('/^(.+?)\s+(.+?)\s+\[[^\]]+\]\s+\{([^}]+)\}\s+\/(.+?)\//', $line, $matches)) {
        $traditional = trim($matches[1]);
        $simplified = trim($matches[2]);
        $jyutping = trim($matches[3]); // Jyutping is in curly braces
        $english = trim($matches[4]);
        $matched = true;
    } elseif (preg_match('/^(.+?)\s+(.+?)\s+\[([^\]]+)\]\s+\/(.+?)\//', $line, $matches)) {
        // Fallback: try format without curly braces (just [jyutping])
        $traditional = trim($matches[1]);
        $simplified = trim($matches[2]);
        $jyutping = trim($matches[3]);
        $english = trim($matches[4]);
        $matched = true;
    }
    
    if ($matched) {
        // Skip if jyutping is too long (phrases)
        if (strlen($jyutping) > 50) {
            $skipped++;
            continue;
        }
        
        // Use traditional as primary, simplified as fallback
        $hanzi = $traditional ?: $simplified;
        $word = $traditional; // Use traditional for word field
        
        // Filter out inappropriate words - check Chinese and English
        if (containsBadWords($hanzi) || containsBadWords($word) || containsBadWords($english)) {
            $filtered++;
            $skipped++;
            continue;
        }
        
        // Calculate frequency based on word characteristics
        $frequency = calculateFrequency($hanzi, $word, $jyutping, $english);
        
        // Set tags based on content analysis
        $tags = determineTags($hanzi, $word, $english, $jyutping);
        
        fputcsv($outFp, [
            $jyutping,
            $hanzi,
            $word,
            $frequency,
            $tags
        ]);
        
        $processed++;
        } else {
            // Try alternative format without English
            if (preg_match('/^(.+?)\s+(.+?)\s+\[([^\]]+)\]/', $line, $matches)) {
                $traditional = trim($matches[1]);
                $simplified = trim($matches[2]);
                $jyutping = trim($matches[3]);
                
                if (strlen($jyutping) > 50) {
                    $skipped++;
                    continue;
                }
                
                $hanzi = $traditional ?: $simplified;
                $word = $traditional;
                
                // Filter out inappropriate words - check Chinese
                if (containsBadWords($hanzi) || containsBadWords($word)) {
                    $filtered++;
                    $skipped++;
                    continue;
                }
                
                // Calculate frequency and tags
                $frequency = calculateFrequency($hanzi, $word, $jyutping, '');
                $tags = determineTags($hanzi, $word, '', $jyutping);
                
                fputcsv($outFp, [
                    $jyutping,
                    $hanzi,
                    $word,
                    $frequency,
                    $tags
                ]);
                
                $processed++;
        } else {
            $skipped++;
            if ($lineNum <= 10) {
                echo "Skipping line $lineNum (unrecognized format): " . substr($line, 0, 60) . "...\n";
            }
        }
    }
}

fclose($fp);
fclose($outFp);

echo "✓ Processed: $processed entries\n";
if ($filtered > 0) {
    echo "🚫 Filtered: $filtered inappropriate entries\n";
}
if ($skipped > 0) {
    echo "⚠ Skipped: $skipped entries (unrecognized format, too long, or inappropriate)\n";
}
echo "✓ Output file: $outputFile\n";
echo "\n";
echo "Next step: Import the CSV file using:\n";
echo "  php backend/scripts/seed-jyutping-from-csv.php\n";

