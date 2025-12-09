<?php
/**
 * Media Routes Handler
 * Sprint 3: File upload, image processing, compression
 */

function handleMediaRoutes($method, $pathParts, $data, $authToken) {
    $db = getDB();
    if (!$db) {
        return errorResponse('Database connection failed', 500);
    }
    
    $user = requireAuth($authToken);
    
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
            
            // Generate URL (relative to API base)
            $fileUrl = '/uploads/user_' . $userId . '/' . $filename;
            
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
    
    // POST /media/text-to-image (placeholder for text-to-image generator)
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'text-to-image') {
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
            
            // Add text (using built-in font, for better fonts use imagettftext)
            $textX = ($width - strlen($text) * imagefontwidth(5)) / 2;
            $textY = ($height - imagefontheight(5)) / 2;
            imagestring($image, 5, (int)$textX, (int)$textY, $text, $txt);
            
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
            $fileUrl = '/uploads/user_' . $user['id'] . '/' . $filename;
            
            // Save to database
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
