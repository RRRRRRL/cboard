<?php
/**
 * Media Routes Handler
 * Sprint 3: File upload, image processing, compression
 */

function handleMediaRoutes($method, $pathParts, $data, $authToken) {
    $user = requireAuth($authToken);
    
    // Get DB connection (will be used later if needed)
    $db = getDB();
    
    // POST /media (file upload)
    if ($method === 'POST' && count($pathParts) === 1) {
        try {
            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                return errorResponse('No file uploaded or upload error', 400);
            }
            
            $file = $_FILES['file'];
            $uploadDir = __DIR__ . '/../../uploads/';
            $userId = $user['id'];
            
            // Create user-specific directory
            $userDir = $uploadDir . 'user_' . $userId . '/';
            if (!is_dir($userDir)) {
                mkdir($userDir, 0755, true);
            }
            
            // Generate unique filename
            $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
            $filename = uniqid('media_', true) . '.' . $extension;
            $filePath = $userDir . $filename;
            
            // Move uploaded file
            if (!move_uploaded_file($file['tmp_name'], $filePath)) {
                return errorResponse('Failed to save file', 500);
            }
            
            // Get file info
            $fileSize = filesize($filePath);
            $mimeType = mime_content_type($filePath);
            $fileType = strpos($mimeType, 'image/') === 0 ? 'image' : 
                       (strpos($mimeType, 'audio/') === 0 ? 'audio' : 'other');
            
            // Generate URL (relative to backend root, without leading slash)
            $fileUrl = 'uploads/user_' . $userId . '/' . $filename;
            
            // Save to database
            $stmt = $db->prepare("
                INSERT INTO media (user_id, filename, original_filename, file_path, file_url, file_type, file_size, mime_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([
                $userId,
                $filename,
                $file['name'],
                $filePath,
                $fileUrl,
                $fileType,
                $fileSize,
                $mimeType
            ]);
            
            $mediaId = $db->lastInsertId();
            
            return successResponse([
                'id' => (int)$mediaId,
                'url' => $fileUrl,
                'filename' => $filename,
                'original_filename' => $file['name'],
                'file_type' => $fileType,
                'file_size' => $fileSize,
                'mime_type' => $mimeType
            ], 201);
            
        } catch (Exception $e) {
            error_log("File upload error: " . $e->getMessage());
            return errorResponse('File upload failed', 500);
        }
    }
    
    // POST /media/compress (compress image)
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'compress') {
        $imageUrl = $data['image_url'] ?? $data['url'] ?? null;
        $quality = isset($data['quality']) ? (int)$data['quality'] : 80;
        $maxWidth = isset($data['max_width']) ? (int)$data['max_width'] : 800;
        $maxHeight = isset($data['max_height']) ? (int)$data['max_height'] : 800;
        
        if (!$imageUrl) {
            return errorResponse('image_url is required', 400);
        }
        
        try {
            // Resolve file path
            $filePath = __DIR__ . '/../..' . $imageUrl;
            if (!file_exists($filePath)) {
                return errorResponse('Image file not found', 404);
            }
            
            // Get image info
            $imageInfo = getimagesize($filePath);
            if (!$imageInfo) {
                return errorResponse('Invalid image file', 400);
            }
            
            $width = $imageInfo[0];
            $height = $imageInfo[1];
            $mimeType = $imageInfo['mime'];
            
            // Calculate new dimensions (maintain aspect ratio)
            $ratio = min($maxWidth / $width, $maxHeight / $height, 1);
            $newWidth = (int)($width * $ratio);
            $newHeight = (int)($height * $ratio);
            
            // Create image resource
            switch ($mimeType) {
                case 'image/jpeg':
                    $source = imagecreatefromjpeg($filePath);
                    break;
                case 'image/png':
                    $source = imagecreatefrompng($filePath);
                    break;
                case 'image/gif':
                    $source = imagecreatefromgif($filePath);
                    break;
                default:
                    return errorResponse('Unsupported image type', 400);
            }
            
            // Create resized image
            $resized = imagecreatetruecolor($newWidth, $newHeight);
            
            // Preserve transparency for PNG/GIF
            if ($mimeType === 'image/png' || $mimeType === 'image/gif') {
                imagealphablending($resized, false);
                imagesavealpha($resized, true);
                $transparent = imagecolorallocatealpha($resized, 255, 255, 255, 127);
                imagefilledrectangle($resized, 0, 0, $newWidth, $newHeight, $transparent);
            }
            
            imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            
            // Save compressed image
            $compressedPath = $filePath;
            switch ($mimeType) {
                case 'image/jpeg':
                    imagejpeg($resized, $compressedPath, $quality);
                    break;
                case 'image/png':
                    imagepng($resized, $compressedPath, 9);
                    break;
                case 'image/gif':
                    imagegif($resized, $compressedPath);
                    break;
            }
            
            imagedestroy($source);
            imagedestroy($resized);
            
            $newSize = filesize($compressedPath);
            
            return successResponse([
                'url' => $imageUrl,
                'original_size' => filesize($filePath),
                'compressed_size' => $newSize,
                'compression_ratio' => round((1 - $newSize / filesize($filePath)) * 100, 2) . '%',
                'dimensions' => ['width' => $newWidth, 'height' => $newHeight]
            ]);
            
        } catch (Exception $e) {
            error_log("Image compression error: " . $e->getMessage());
            return errorResponse('Image compression failed', 500);
        }
    }
    
    // POST /media/square (make image square)
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'square') {
        $imageUrl = $data['image_url'] ?? $data['url'] ?? null;
        $size = isset($data['size']) ? (int)$data['size'] : 400;
        
        if (!$imageUrl) {
            return errorResponse('image_url is required', 400);
        }
        
        try {
            $filePath = __DIR__ . '/../..' . $imageUrl;
            if (!file_exists($filePath)) {
                return errorResponse('Image file not found', 404);
            }
            
            $imageInfo = getimagesize($filePath);
            if (!$imageInfo) {
                return errorResponse('Invalid image file', 400);
            }
            
            $width = $imageInfo[0];
            $height = $imageInfo[1];
            $mimeType = $imageInfo['mime'];
            
            // Create square image
            $square = imagecreatetruecolor($size, $size);
            
            // Fill with white background
            $white = imagecolorallocate($square, 255, 255, 255);
            imagefill($square, 0, 0, $white);
            
            // Load source image
            switch ($mimeType) {
                case 'image/jpeg':
                    $source = imagecreatefromjpeg($filePath);
                    break;
                case 'image/png':
                    $source = imagecreatefrompng($filePath);
                    imagealphablending($square, false);
                    imagesavealpha($square, true);
                    break;
                case 'image/gif':
                    $source = imagecreatefromgif($filePath);
                    break;
                default:
                    return errorResponse('Unsupported image type', 400);
            }
            
            // Calculate position to center image
            $scale = min($size / $width, $size / $height);
            $newWidth = (int)($width * $scale);
            $newHeight = (int)($height * $scale);
            $x = (int)(($size - $newWidth) / 2);
            $y = (int)(($size - $newHeight) / 2);
            
            imagecopyresampled($square, $source, $x, $y, 0, 0, $newWidth, $newHeight, $width, $height);
            
            // Save
            switch ($mimeType) {
                case 'image/jpeg':
                    imagejpeg($square, $filePath, 90);
                    break;
                case 'image/png':
                    imagepng($square, $filePath, 9);
                    break;
                case 'image/gif':
                    imagegif($square, $filePath);
                    break;
            }
            
            imagedestroy($source);
            imagedestroy($square);
            
            return successResponse([
                'url' => $imageUrl,
                'size' => $size,
                'dimensions' => ['width' => $size, 'height' => $size]
            ]);
            
        } catch (Exception $e) {
            error_log("Square image error: " . $e->getMessage());
            return errorResponse('Failed to create square image', 500);
        }
    }
    
    // POST /media/text-to-image (text-to-image generator)
    // Note: $pathParts includes 'media' as first element, so ['media', 'text-to-image']
    // Also handle if pathParts[0] is 'text-to-image' (in case routing is different)
    if ($method === 'POST' && (
        (count($pathParts) === 2 && isset($pathParts[1]) && $pathParts[1] === 'text-to-image') ||
        (count($pathParts) === 1 && isset($pathParts[0]) && $pathParts[0] === 'text-to-image')
    )) {
        $text = $data['text'] ?? '';
        $width = isset($data['width']) ? (int)$data['width'] : 400;
        $height = isset($data['height']) ? (int)$data['height'] : 400;
        $backgroundColor = $data['background_color'] ?? '#FFFFFF';
        $textColor = $data['text_color'] ?? '#000000';
        $fontSize = isset($data['font_size']) ? (int)$data['font_size'] : 24;
        
        if (empty($text)) {
            return errorResponse('text is required', 400);
        }
        
        // Check if GD extension is available
        if (!function_exists('imagecreatetruecolor')) {
            return errorResponse('GD extension is not installed. Install with: sudo apt-get install php-gd', 500);
        }
        
        try {
            // Create image
            $image = @imagecreatetruecolor($width, $height);
            if (!$image) {
                return errorResponse('Failed to create image resource', 500);
            }
            
            // Parse colors
            $bgColor = hexToRgb($backgroundColor);
            $txtColor = hexToRgb($textColor);
            $bg = imagecolorallocate($image, $bgColor['r'], $bgColor['g'], $bgColor['b']);
            $txt = imagecolorallocate($image, $txtColor['r'], $txtColor['g'], $txtColor['b']);
            
            imagefill($image, 0, 0, $bg);
            
            // Add text using TrueType font for better size control
            // Try to use a system font, fallback to built-in font if not available
            $fontPath = null;
            $useTTF = false;
            
            // Common system font paths (try these in order)
            // Prioritize fonts that support Chinese characters (Traditional Chinese)
            $systemFonts = [
                // Chinese-supporting fonts (Traditional Chinese) - try first
                '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
                '/usr/share/fonts/truetype/noto/NotoSansCJKtc-Regular.otf',
                '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
                '/usr/share/fonts/truetype/arphic/uming.ttc', // AR PL UMing (Traditional Chinese)
                '/usr/share/fonts/truetype/arphic/ukai.ttc', // AR PL UKai (Traditional Chinese)
                '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', // WenQuanYi Micro Hei
                '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', // WenQuanYi Zen Hei
                '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf', // Noto Sans (supports many languages)
                // Windows Chinese fonts
                'C:/Windows/Fonts/msjh.ttc', // Microsoft JhengHei (Traditional Chinese)
                'C:/Windows/Fonts/msjhbd.ttc', // Microsoft JhengHei Bold
                'C:/Windows/Fonts/mingliu.ttc', // MingLiU (Traditional Chinese)
                'C:/Windows/Fonts/simsun.ttc', // SimSun (Simplified Chinese, but supports Traditional)
                // macOS Chinese fonts
                '/System/Library/Fonts/Supplemental/PingFang.ttc',
                '/System/Library/Fonts/Supplemental/STHeiti Light.ttc',
                // Fallback to general fonts (may not support Chinese)
                '/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf',
                '/usr/share/fonts/truetype/ubuntu/Ubuntu-Regular.ttf',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
                '/System/Library/Fonts/Helvetica.ttc',
                'C:/Windows/Fonts/arial.ttf',
                __DIR__ . '/../../fonts/arial.ttf',
                __DIR__ . '/../../fonts/DejaVuSans.ttf'
            ];
            
            foreach ($systemFonts as $font) {
                if (file_exists($font)) {
                    $fontPath = $font;
                    $useTTF = true;
                    break;
                }
            }
            
            if ($useTTF && function_exists('imagettftext')) {
                // Use TrueType font with actual fontSize
                // Clamp fontSize to reasonable range for TTF (10-200)
                $actualFontSize = max(10, min(200, (int)$fontSize));
                
                // Calculate text bounding box to center it
                // Note: For Chinese characters, we need to handle multi-byte strings properly
                $bbox = imagettfbbox($actualFontSize, 0, $fontPath, $text);
                if ($bbox && $bbox[0] !== false) {
                    // Calculate text dimensions
                    $textWidth = abs($bbox[4] - $bbox[0]);
                    $textHeight = abs($bbox[5] - $bbox[1]);
                    
                    // Calculate baseline offset (negative value indicates distance above baseline)
                    $baselineOffset = abs($bbox[7] - $bbox[1]);
                    
                    // Center the text
                    // Note: imagettftext Y coordinate is baseline (bottom of text)
                    $textX = ($width - $textWidth) / 2;
                    $textY = ($height / 2) + ($textHeight / 2) - $baselineOffset;
                    
                    // Add text with TrueType font (supports Unicode including Chinese)
                    imagettftext($image, $actualFontSize, 0, (int)$textX, (int)$textY, $txt, $fontPath, $text);
                } else {
                    // Fallback if bbox calculation fails - estimate position
                    // For Chinese text, estimate width based on character count
                    $charCount = mb_strlen($text, 'UTF-8');
                    $estimatedWidth = $charCount * ($actualFontSize * 0.6); // Approximate width per character
                    $textX = ($width - $estimatedWidth) / 2;
                    $textY = $height / 2 + $actualFontSize / 2; // Approximate center
                    imagettftext($image, $actualFontSize, 0, (int)$textX, (int)$textY, $txt, $fontPath, $text);
                }
            } else {
                // Fallback to built-in font with better scaling
                // Map fontSize (10-200) to font size 1-5, but use better formula
                // fontSize 10-50 -> 1, 50-100 -> 2, 100-150 -> 3, 150-180 -> 4, 180-200 -> 5
                if ($fontSize <= 50) {
                    $fontSizeMapped = 1;
                } elseif ($fontSize <= 100) {
                    $fontSizeMapped = 2;
                } elseif ($fontSize <= 150) {
                    $fontSizeMapped = 3;
                } elseif ($fontSize <= 180) {
                    $fontSizeMapped = 4;
                } else {
                    $fontSizeMapped = 5;
                }
                
                $textX = ($width - strlen($text) * imagefontwidth($fontSizeMapped)) / 2;
                $textY = ($height - imagefontheight($fontSizeMapped)) / 2;
                imagestring($image, $fontSizeMapped, (int)$textX, (int)$textY, $text, $txt);
            }
            
            // Save to user directory
            $uploadDir = __DIR__ . '/../../uploads/user_' . $user['id'] . '/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            $filename = 'text_' . uniqid() . '.png';
            $filePath = $uploadDir . $filename;
            
            // Save image
            if (!@imagepng($image, $filePath)) {
                imagedestroy($image);
                return errorResponse('Failed to save image file. Check directory permissions.', 500);
            }
            
            imagedestroy($image);
            
            // Verify file was created
            if (!file_exists($filePath)) {
                return errorResponse('Image file was not created', 500);
            }
            
            $fileSize = filesize($filePath);
            // Return URL without leading slash - frontend will prepend API_URL
            $fileUrl = 'uploads/user_' . $user['id'] . '/' . $filename;
            
            // Save to database (optional - continue even if DB fails)
            if ($db) {
                try {
                    $stmt = $db->prepare("
                        INSERT INTO media (user_id, filename, original_filename, file_path, file_url, file_type, file_size, mime_type, created_at)
                        VALUES (?, ?, ?, ?, ?, 'image', ?, 'image/png', NOW())
                    ");
                    $stmt->execute([
                        $user['id'],
                        $filename,
                        'text-to-image.png',
                        $filePath,
                        $fileUrl,
                        $fileSize
                    ]);
                } catch (Exception $dbError) {
                    // File was created but DB insert failed - still return success with URL
                    error_log("Media DB insert error: " . $dbError->getMessage());
                }
            } else {
                error_log("Database not available - skipping media table insert");
            }
            
            return successResponse([
                'url' => $fileUrl,
                'filename' => $filename,
                'text' => $text,
                'width' => $width,
                'height' => $height
            ], 201);
            
        } catch (Exception $e) {
            error_log("Text-to-image error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return errorResponse('Text-to-image generation failed: ' . $e->getMessage(), 500);
        }
    }
    
    return errorResponse('Media route not found', 404);
}

/**
 * Convert hex color to RGB
 */
function hexToRgb($hex) {
    $hex = ltrim($hex, '#');
    return [
        'r' => hexdec(substr($hex, 0, 2)),
        'g' => hexdec(substr($hex, 2, 2)),
        'b' => hexdec(substr($hex, 4, 2))
    ];
}
