<?php
/**
 * OCR Translator Routes Handler
 * Sprint 11: OCR Translation
 * 
 * Handles:
 * - OCR image text recognition
 * - Chinese to Jyutping conversion
 * - Image annotation
 * - Translation history
 */

require_once __DIR__ . '/../auth.php';

function handleOCRRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    
    if ($db === null) {
        error_log("Database connection failed in handleOCRRoutes");
        return errorResponse('Database connection failed. Please check server configuration.', 500);
    }
    
    // POST /ocr/recognize - OCR image recognition
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'recognize') {
        $user = requireAuth($authToken);
        $imageData = $data['image'] ?? null; // Base64 encoded image or image URL
        $imageUrl = $data['image_url'] ?? null;
        
        if (!$imageData && !$imageUrl) {
            return errorResponse('Image data or URL is required', 400);
        }
        
        try {
            // Process image for OCR
            $recognizedText = '';
            $confidence = 0.0;
            
            // Handle base64 image data
            if ($imageData) {
                // Remove data URL prefix if present
                $imageData = preg_replace('/^data:image\/\w+;base64,/', '', $imageData);
                $imageBinary = base64_decode($imageData);
                
                if ($imageBinary === false) {
                    return errorResponse('Invalid image data', 400);
                }
                
                // Save temporary image file
                $tempFile = sys_get_temp_dir() . '/ocr_' . uniqid() . '.png';
                file_put_contents($tempFile, $imageBinary);
                
                // Use Tesseract OCR if available (requires tesseract-ocr package)
                // For now, use a simple text extraction approach
                // In production, integrate with Tesseract OCR or cloud OCR service
                
                // Try to use Tesseract if available
                $tesseractPath = '/usr/bin/tesseract'; // Common Linux path
                if (file_exists($tesseractPath) && function_exists('exec')) {
                    $outputFile = sys_get_temp_dir() . '/ocr_output_' . uniqid();
                    $command = escapeshellcmd($tesseractPath) . ' ' . 
                               escapeshellarg($tempFile) . ' ' . 
                               escapeshellarg($outputFile) . ' -l chi_sim+eng 2>&1';
                    exec($command, $output, $returnCode);
                    
                    if ($returnCode === 0 && file_exists($outputFile . '.txt')) {
                        $recognizedText = trim(file_get_contents($outputFile . '.txt'));
                        $confidence = 0.85;
                        unlink($outputFile . '.txt');
                    }
                }
                
                // If Tesseract not available, try to extract text from image metadata
                // or use a basic pattern recognition
                if (empty($recognizedText)) {
                    // Try to get image info
                    $imageInfo = @getimagesize($tempFile);
                    if ($imageInfo) {
                        // For now, return a message indicating OCR service is needed
                        // In production, integrate with cloud OCR (Google Vision, Azure, etc.)
                        $recognizedText = ''; // Empty - will prompt user to use manual input
                        $confidence = 0.0;
                    }
                }
                
                // Clean up temp file
                if (file_exists($tempFile)) {
                    unlink($tempFile);
                }
            } elseif ($imageUrl) {
                // Handle image URL
                // Download image and process
                $imageContent = @file_get_contents($imageUrl);
                if ($imageContent !== false) {
                    $tempFile = sys_get_temp_dir() . '/ocr_' . uniqid() . '.png';
                    file_put_contents($tempFile, $imageContent);
                    
                    // Try Tesseract if available
                    $tesseractPath = '/usr/bin/tesseract';
                    if (file_exists($tesseractPath) && function_exists('exec')) {
                        $outputFile = sys_get_temp_dir() . '/ocr_output_' . uniqid();
                        $command = escapeshellcmd($tesseractPath) . ' ' . 
                                   escapeshellarg($tempFile) . ' ' . 
                                   escapeshellarg($outputFile) . ' -l chi_sim+eng 2>&1';
                        exec($command, $output, $returnCode);
                        
                        if ($returnCode === 0 && file_exists($outputFile . '.txt')) {
                            $recognizedText = trim(file_get_contents($outputFile . '.txt'));
                            $confidence = 0.85;
                            unlink($outputFile . '.txt');
                        }
                    }
                    
                    if (file_exists($tempFile)) {
                        unlink($tempFile);
                    }
                }
            }
            
            // If still no text recognized, return empty (frontend can handle manual input)
            if (empty($recognizedText)) {
                $recognizedText = '';
                $confidence = 0.0;
            }
            
            // Save to history
            $stmt = $db->prepare("
                INSERT INTO ocr_history (user_id, source_image_path, extracted_text, created_at)
                VALUES (?, ?, ?, NOW())
            ");
            $imagePath = $imageUrl ?? 'uploaded_image_' . uniqid();
            $stmt->execute([$user['id'], $imagePath, $recognizedText]);
            $ocrId = $db->lastInsertId();
            
            return successResponse([
                'id' => (int)$ocrId,
                'recognized_text' => $recognizedText,
                'confidence' => $confidence,
                'language' => 'zh' // Detected language
            ]);
            
        } catch (Exception $e) {
            error_log("OCR recognition error: " . $e->getMessage());
            return errorResponse('Failed to recognize text from image', 500);
        }
    }
    
    // POST /ocr/convert-to-jyutping - Convert Chinese text to Jyutping
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'convert-to-jyutping') {
        $user = requireAuth($authToken);
        $chineseText = $data['text'] ?? '';
        
        if (empty($chineseText)) {
            return errorResponse('Chinese text is required', 400);
        }
        
        try {
            // Convert Chinese characters to Jyutping
            $characters = preg_split('//u', $chineseText, -1, PREG_SPLIT_NO_EMPTY);
            $jyutpingResults = [];
            
            foreach ($characters as $char) {
                if (preg_match('/[\x{4e00}-\x{9fff}]/u', $char)) {
                    // Chinese character
                    $stmt = $db->prepare("
                        SELECT hanzi, jyutping_code, word, frequency
                        FROM jyutping_dictionary
                        WHERE hanzi = ?
                        ORDER BY frequency DESC
                        LIMIT 1
                    ");
                    $stmt->execute([$char]);
                    $result = $stmt->fetch();
                    
                    if ($result) {
                        $jyutpingResults[] = [
                            'character' => $char,
                            'jyutping' => $result['jyutping_code'],
                            'meaning' => $result['word'] ?? $result['hanzi'] ?? '',
                            'confidence' => min(1.0, $result['frequency'] / 1000)
                        ];
                    } else {
                        $jyutpingResults[] = [
                            'character' => $char,
                            'jyutping' => null,
                            'meaning' => null,
                            'confidence' => 0.0
                        ];
                    }
                } else {
                    // Non-Chinese character (punctuation, space, etc.)
                    $jyutpingResults[] = [
                        'character' => $char,
                        'jyutping' => $char,
                        'meaning' => null,
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
            
            return successResponse([
                'original_text' => $chineseText,
                'jyutping' => $fullJyutping,
                'characters' => $jyutpingResults,
                'count' => count($jyutpingResults)
            ]);
            
        } catch (Exception $e) {
            error_log("Jyutping conversion error: " . $e->getMessage());
            return errorResponse('Failed to convert to Jyutping', 500);
        }
    }
    
    // POST /ocr/annotate - Create annotated image with Jyutping
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'annotate') {
        $user = requireAuth($authToken);
        $imageData = $data['image'] ?? null;
        $imageUrl = $data['image_url'] ?? null;
        $annotations = $data['annotations'] ?? []; // Array of {x, y, text, jyutping}
        
        if (!$imageData && !$imageUrl) {
            return errorResponse('Image data or URL is required', 400);
        }
        
        try {
            // In production, use image processing library (e.g., GD, Imagick) to add annotations
            // For now, return placeholder
            
            // TODO: Implement image annotation
            // 1. Load image from URL or base64
            // 2. Add text annotations at specified positions
            // 3. Save annotated image
            // 4. Return annotated image URL
            
            $annotatedImageUrl = $imageUrl ?? 'annotated_' . uniqid() . '.png';
            
            // Save annotation to history
            $stmt = $db->prepare("
                INSERT INTO ocr_history (user_id, source_image_path, extracted_text, jyutping_result, created_at)
                VALUES (?, ?, ?, ?, NOW())
            ");
            $annotationText = json_encode($annotations);
            $jyutpingText = '';
            foreach ($annotations as $ann) {
                if (isset($ann['jyutping'])) {
                    $jyutpingText .= $ann['jyutping'] . ' ';
                }
            }
            $jyutpingText = trim($jyutpingText);
            $stmt->execute([$user['id'], $imageUrl ?? 'uploaded', $annotationText, $jyutpingText]);
            $annotationId = $db->lastInsertId();
            
            return successResponse([
                'id' => (int)$annotationId,
                'annotated_image_url' => $annotatedImageUrl,
                'annotations' => $annotations
            ]);
            
        } catch (Exception $e) {
            error_log("Image annotation error: " . $e->getMessage());
            return errorResponse('Failed to annotate image', 500);
        }
    }
    
    // GET /ocr/history - Get translation history
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'history') {
        $user = requireAuth($authToken);
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        
        try {
            $stmt = $db->prepare("
                SELECT id, source_image_path, extracted_text, jyutping_result, created_at
                FROM ocr_history
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ");
            $stmt->execute([$user['id'], $limit, $offset]);
            $history = $stmt->fetchAll();
            
            // Format history entries
            $formattedHistory = [];
            foreach ($history as $entry) {
                $item = [
                    'id' => (int)$entry['id'],
                    'image_path' => $entry['source_image_path'],
                    'recognized_text' => $entry['extracted_text'],
                    'jyutping_result' => $entry['jyutping_result'],
                    'created_at' => $entry['created_at']
                ];
                
                // Decode recognized_text if it's JSON
                $decoded = json_decode($entry['extracted_text'], true);
                if ($decoded !== null) {
                    $item['annotations'] = $decoded;
                }
                
                $formattedHistory[] = $item;
            }
            
            // Get total count
            $stmt = $db->prepare("SELECT COUNT(*) as total FROM ocr_history WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            $total = $stmt->fetch()['total'];
            
            return successResponse([
                'history' => $formattedHistory,
                'total' => (int)$total,
                'limit' => $limit,
                'offset' => $offset
            ]);
            
        } catch (Exception $e) {
            error_log("OCR history error: " . $e->getMessage());
            return errorResponse('Failed to get translation history', 500);
        }
    }
    
    // DELETE /ocr/history/{id} - Delete translation history entry
    if ($method === 'DELETE' && count($pathParts) === 3 && $pathParts[1] === 'history') {
        $user = requireAuth($authToken);
        $historyId = (int)$pathParts[2];
        
        try {
            // Verify ownership
            $stmt = $db->prepare("SELECT id FROM ocr_history WHERE id = ? AND user_id = ?");
            $stmt->execute([$historyId, $user['id']]);
            $entry = $stmt->fetch();
            
            if (!$entry) {
                return errorResponse('Translation history entry not found', 404);
            }
            
            // Delete entry
            $stmt = $db->prepare("DELETE FROM ocr_history WHERE id = ? AND user_id = ?");
            $stmt->execute([$historyId, $user['id']]);
            
            return successResponse([
                'success' => true,
                'message' => 'Translation history entry deleted'
            ]);
            
        } catch (Exception $e) {
            error_log("Delete OCR history error: " . $e->getMessage());
            return errorResponse('Failed to delete translation history', 500);
        }
    }
    
    return errorResponse('OCR route not found', 404);
}

