<?php
/**
 * Application Configuration
 */

return [
    'api_version' => 'v1',
    'api_base_path' => '/api',
    'cors_enabled' => true,
    'cors_origins' => [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://app.cboard.io',
        'https://app.dev.cboard.io',
        'https://app.qa.cboard.io'
    ],
    // Set application default timezone (used by PHP date/time functions)
    // For Hong Kong / China environment, use Asia/Hong_Kong
    // Adjust here if you deploy to a different region
    'timezone' => getenv('APP_TIMEZONE') ?: 'Asia/Hong_Kong',
    // JWT configuration
    'jwt_secret' => getenv('JWT_SECRET') ?: 'your-secret-key-change-in-production',
    'jwt_expiration' => 86400, // 24 hours
    // Error reporting settings: in production, hide errors; in dev/test, show all
    'error_reporting' => getenv('APP_ENV') === 'production' ? 0 : E_ALL,
    'display_errors' => getenv('APP_ENV') !== 'production',
];

