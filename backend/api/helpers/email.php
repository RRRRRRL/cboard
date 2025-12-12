<?php
/**
 * Email Helper Functions
 * Sprint 8: Email ZIP Transfer
 */

/**
 * Send email with attachment
 * 
 * @param string $to Recipient email address
 * @param string $subject Email subject
 * @param string $body Email body (HTML or plain text)
 * @param array $attachments Array of attachment paths
 * @return bool Success status
 */
function sendEmail($to, $subject, $body, $attachments = []) {
    // Email headers
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'From: Cboard <noreply@cboard.app>',
        'Reply-To: noreply@cboard.app',
        'X-Mailer: PHP/' . phpversion()
    ];
    
    // If attachments exist, use multipart email
    if (!empty($attachments)) {
        $boundary = md5(uniqid(time()));
        $headers = [
            'MIME-Version: 1.0',
            'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
            'From: Cboard <noreply@cboard.app>',
            'Reply-To: noreply@cboard.app',
            'X-Mailer: PHP/' . phpversion()
        ];
        
        $message = "--{$boundary}\r\n";
        $message .= "Content-Type: text/html; charset=UTF-8\r\n";
        $message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
        $message .= $body . "\r\n";
        
        // Add attachments
        foreach ($attachments as $attachment) {
            if (file_exists($attachment)) {
                $filename = basename($attachment);
                $fileContent = file_get_contents($attachment);
                $fileContent = chunk_split(base64_encode($fileContent));
                
                $message .= "--{$boundary}\r\n";
                $message .= "Content-Type: application/zip; name=\"{$filename}\"\r\n";
                $message .= "Content-Transfer-Encoding: base64\r\n";
                $message .= "Content-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n";
                $message .= $fileContent . "\r\n";
            }
        }
        
        $message .= "--{$boundary}--";
        
        return mail($to, $subject, $message, implode("\r\n", $headers));
    } else {
        return mail($to, $subject, $body, implode("\r\n", $headers));
    }
}

/**
 * Generate ZIP file from profile data
 * 
 * @param array $profileData Profile data to include in ZIP
 * @param string $outputPath Output path for ZIP file
 * @return bool|string Path to ZIP file on success, false on failure
 */
function generateProfileZIP($profileData, $outputPath = null) {
    if (!class_exists('ZipArchive')) {
        error_log("ZipArchive class not available");
        return false;
    }
    
    if (!$outputPath) {
        $outputPath = sys_get_temp_dir() . '/profile_' . uniqid() . '.zip';
    }
    
    $zip = new ZipArchive();
    if ($zip->open($outputPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
        error_log("Failed to create ZIP file: $outputPath");
        return false;
    }
    
    // Add profile data as JSON
    $zip->addFromString('profile.json', json_encode($profileData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    // Add metadata
    $metadata = [
        'version' => '1.0',
        'exported_at' => date('Y-m-d H:i:s'),
        'format' => 'cboard_profile'
    ];
    $zip->addFromString('metadata.json', json_encode($metadata, JSON_PRETTY_PRINT));
    
    // Add README
    $readme = "Cboard Profile Export\n\n";
    $readme .= "This ZIP file contains a Cboard profile export.\n";
    $readme .= "To import this profile, use the Import feature in Cboard.\n";
    $readme .= "\nExported: " . date('Y-m-d H:i:s') . "\n";
    $zip->addFromString('README.txt', $readme);
    
    $zip->close();
    
    return file_exists($outputPath) ? $outputPath : false;
}

