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
    'jwt_secret' => getenv('JWT_SECRET') ?: 'your-secret-key-change-in-production',
    'jwt_expiration' => 86400, // 24 hours
    'timezone' => 'UTC',
    'error_reporting' => getenv('APP_ENV') === 'production' ? 0 : E_ALL,
    'display_errors' => getenv('APP_ENV') !== 'production',
];

