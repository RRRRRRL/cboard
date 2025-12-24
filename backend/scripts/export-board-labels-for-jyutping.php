<?php
/**
 * Export board/card labels for Jyutping generation (Method 3 helper).
 *
 * This script scans:
 *   - cards.title / cards.label_text
 *   - boards.board_data JSON tiles (label / labelKey)
 * and collects **Chinese** labels that correspond to pictures.
 *
 * It then writes a CSV file that can be used as input for
 * generate-jyutping-from-pycantonese.py.
 *
 * Run from project root:
 *
 *   php backend/scripts/export-board-labels-for-jyutping.php
 *
 * Output:
 *   backend/database/jyutping_pycantonese_input_from_boards.csv
 *
 * Columns:
 *   hanzi,word,frequency,tags
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../database/init.php';

/**
 * Check whether a string contains at least one Chinese character.
 *
 * We use Unicode Han block detection to avoid exporting purely
 * English labels or technical keys.
 */
function containsChinese($text)
{
    if (!is_string($text) || $text === '') {
        return false;
    }
    return (bool) preg_match('/\p{Han}/u', $text);
}

/**
 * Load translation JSON file (e.g., zh-TW.json) into an associative array.
 *
 * @param string $path
 * @return array
 */
function loadTranslations($path)
{
    if (!is_readable($path)) {
        return [];
    }

    $json = file_get_contents($path);
    if ($json === false) {
        return [];
    }

    $data = json_decode($json, true);
    if (!is_array($data)) {
        return [];
    }

    return $data;
}

$db = getDB();

if (!$db) {
    echo "ERROR: Database connection failed!\n";
    exit(1);
}

echo "Scanning cards and boards for Chinese labels...\n\n";

$projectRoot = realpath(__DIR__ . '/..'); // backend/

// Load translations so we can resolve labelKey (e.g. cboard.symbol.time -> 時間)
$zhTwPath = realpath($projectRoot . '/../src/translations/zh-TW.json');
$zhCnPath = realpath($projectRoot . '/../src/translations/zh-CN.json');

$translationsZhTw = $zhTwPath ? loadTranslations($zhTwPath) : [];
$translationsZhCn = $zhCnPath ? loadTranslations($zhCnPath) : [];

$candidates = [];

/**
 * Helper to add a candidate label.
 *
 * @param string $label
 * @param string|null $category
 */
$addCandidate = function ($label, $category = null) use (&$candidates) {
    $label = trim((string) $label);
    if ($label === '') {
        return;
    }

    // Skip trivial or default labels
    $lower = mb_strtolower($label, 'UTF-8');
    if ($lower === 'hello') {
        return;
    }

    if (!containsChinese($label)) {
        // Only keep labels that contain Chinese characters
        return;
    }

    if (!isset($candidates[$label])) {
        $tags = ['board', 'auto'];
        if (!empty($category)) {
            $tags[] = $category;
        }
        $candidates[$label] = [
            'hanzi' => $label,
            'word' => '',
            'frequency' => 400, // reasonable default for game words
            'tags' => implode(',', array_unique($tags))
        ];
    }
};

// 1) Collect from cards table (titles and label_text)
try {
    $sql = "
        SELECT DISTINCT title, label_text, category
        FROM cards
        WHERE ((image_path IS NOT NULL AND image_path != '')
            OR (image_url IS NOT NULL AND image_url != ''))
          AND (title IS NOT NULL AND TRIM(title) != '')
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute();
    $cards = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($cards) . " cards with images and titles.\n";

    foreach ($cards as $card) {
        $title = $card['title'] ?? '';
        $labelText = $card['label_text'] ?? '';
        $category = $card['category'] ?? '';

        // Prefer label_text if it looks like user-visible text
        if ($labelText && $labelText !== $title) {
            $addCandidate($labelText, $category);
        }
        $addCandidate($title, $category);
    }
} catch (Exception $e) {
    echo "ERROR scanning cards: " . $e->getMessage() . "\n";
}

// 2) Collect from boards.board_data JSON (tiles)
try {
    $sql = "
        SELECT board_id, board_data
        FROM boards
        WHERE board_data IS NOT NULL
    ";
    $stmt = $db->prepare($sql);
    $stmt->execute();
    $boards = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($boards) . " boards with board_data.\n";

    foreach ($boards as $board) {
        $dataJson = $board['board_data'];
        $data = json_decode($dataJson, true);
        if (!is_array($data) || !isset($data['tiles']) || !is_array($data['tiles'])) {
            continue;
        }

        foreach ($data['tiles'] as $tile) {
            if (!is_array($tile)) {
                continue;
            }
            $image = $tile['image'] ?? null;
            if (!$image) {
                continue;
            }

            $label = $tile['label'] ?? '';
            $labelKey = $tile['labelKey'] ?? '';
            $category = $tile['category'] ?? 'board';

            // Prefer an explicit Chinese label if present
            if ($label && containsChinese($label)) {
                $addCandidate($label, $category);
            } elseif ($labelKey) {
                // Try to resolve labelKey via translations (e.g. zh-TW / zh-CN)
                $translated = null;
                if (isset($translationsZhTw[$labelKey])) {
                    $translated = $translationsZhTw[$labelKey];
                } elseif (isset($translationsZhCn[$labelKey])) {
                    $translated = $translationsZhCn[$labelKey];
                }

                if ($translated && containsChinese($translated)) {
                    $addCandidate($translated, $category);
                } else {
                    // As a last resort, use the last segment of labelKey
                    // if it itself contains Chinese.
                    if (strpos($labelKey, '.') !== false) {
                        $parts = preg_split('/[._-]/', $labelKey);
                        $last = end($parts);
                        if ($last && containsChinese($last)) {
                            $addCandidate($last, $category);
                        }
                    }
                }
            }
        }
    }
} catch (Exception $e) {
    echo "ERROR scanning boards: " . $e->getMessage() . "\n";
}

// 3) Collect from default boards JSON (src/api/boards.json)
try {
    $boardsJsonPath = realpath($projectRoot . '/../src/api/boards.json');
    if ($boardsJsonPath && is_readable($boardsJsonPath)) {
        echo "Loading default boards from: $boardsJsonPath\n";
        $json = file_get_contents($boardsJsonPath);
        if ($json !== false) {
            $data = json_decode($json, true);
            if (is_array($data) && isset($data['advanced']) && is_array($data['advanced'])) {
                $defaultBoards = $data['advanced'];
                echo "Found " . count($defaultBoards) . " default boards.\n";
                
                // Recursively extract all tiles from all boards
                $allTiles = [];
                $boardMap = [];
                foreach ($defaultBoards as $board) {
                    if (isset($board['id']) && is_array($board)) {
                        $boardMap[$board['id']] = $board;
                    }
                }
                
                $processBoard = function($board, &$processedBoards) use (&$processBoard, &$allTiles, $boardMap) {
                    if (!is_array($board) || !isset($board['id'])) {
                        return;
                    }
                    $boardId = $board['id'];
                    if (isset($processedBoards[$boardId])) {
                        return; // Avoid infinite loops
                    }
                    $processedBoards[$boardId] = true;
                    
                    if (isset($board['tiles']) && is_array($board['tiles'])) {
                        foreach ($board['tiles'] as $tile) {
                            if (!is_array($tile)) {
                                continue;
                            }
                            if (isset($tile['loadBoard']) && isset($boardMap[$tile['loadBoard']])) {
                                $subBoard = $boardMap[$tile['loadBoard']];
                                $processBoard($subBoard, $processedBoards);
                            }
                            if (isset($tile['image']) && isset($tile['labelKey'])) {
                                $allTiles[] = $tile;
                            }
                        }
                    }
                };
                
                $processedBoards = [];
                foreach ($defaultBoards as $board) {
                    $processBoard($board, $processedBoards);
                }
                
                echo "Extracted " . count($allTiles) . " tiles from default boards (including nested).\n";
                
                foreach ($allTiles as $tile) {
                    $label = $tile['label'] ?? '';
                    $labelKey = $tile['labelKey'] ?? '';
                    $category = $tile['category'] ?? 'default_board';
                    
                    if ($label && containsChinese($label)) {
                        $addCandidate($label, $category);
                    } elseif ($labelKey) {
                        $translated = null;
                        if (isset($translationsZhTw[$labelKey])) {
                            $translated = $translationsZhTw[$labelKey];
                        } elseif (isset($translationsZhCn[$labelKey])) {
                            $translated = $translationsZhCn[$labelKey];
                        }
                        
                        if ($translated && containsChinese($translated)) {
                            $addCandidate($translated, $category);
                        }
                    }
                }
            }
        }
    } else {
        echo "Default boards JSON not found at: " . ($projectRoot . '/../src/api/boards.json') . "\n";
    }
} catch (Exception $e) {
    echo "ERROR scanning default boards: " . $e->getMessage() . "\n";
}

$totalCandidates = count($candidates);

if ($totalCandidates === 0) {
    echo "No Chinese labels found. Nothing to export.\n";
    exit(0);
}

$outputPath = __DIR__ . '/../database/jyutping_pycantonese_input_from_boards.csv';

// Ensure directory exists
@mkdir(dirname($outputPath), 0777, true);

$fp = fopen($outputPath, 'w');

if ($fp === false) {
    echo "ERROR: Unable to open output file: $outputPath\n";
    exit(1);
}

// CSV header
fputcsv($fp, ['hanzi', 'word', 'frequency', 'tags']);

foreach ($candidates as $row) {
    fputcsv($fp, [
        $row['hanzi'],
        $row['word'],
        $row['frequency'],
        $row['tags']
    ]);
}

fclose($fp);

echo "✓ Exported $totalCandidates unique Chinese labels to:\n";
echo "  $outputPath\n\n";
echo "You can now:\n";
echo "  1) Review/edit this CSV (adjust frequency/tags if needed)\n";
echo "  2) Option A: Copy rows you want into jyutping_pycantonese_input.csv\n";
echo "  3) Option B: Point the Python generator to this CSV and generate SQL\n";


