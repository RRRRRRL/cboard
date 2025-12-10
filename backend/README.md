# Cboard PHP Backend API

This is the PHP/MySQL backend API for Cboard, replacing the Firebase backend.

## Requirements

- PHP 7.4 or higher
- MySQL 5.7+ or MariaDB 10.2+
- Apache with mod_rewrite enabled (or Nginx with proper configuration)
- PDO MySQL extension

## Installation

### 1. Database Setup

1. Create a MySQL database:
```bash
mysql -u root -p
CREATE DATABASE cboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Import the database schema:
```bash
mysql -u root -p cboard < database/schema.sql
```

### 2. Configuration

1. Copy the environment example file:
```bash
cp .env.example .env
```

2. Edit `.env` with your database credentials:
```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=cboard
DB_USER=your_username
DB_PASS=your_password
JWT_SECRET=your-random-secret-key
```

### 3. Web Server Configuration

#### Apache

1. Ensure mod_rewrite is enabled
2. Point your virtual host document root to the `backend` directory
3. The `.htaccess` file will handle URL rewriting

Example Apache virtual host:
```apache
<VirtualHost *:80>
    ServerName api.localhost
    DocumentRoot /path/to/cboard/backend
    
    <Directory /path/to/cboard/backend>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

#### Nginx

Example Nginx configuration:
```nginx
server {
    listen 80;
    server_name api.localhost;
    root /path/to/cboard/backend;
    index index.php;

    location / {
        try_files $uri $uri/ /api/index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php7.4-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```

### 4. PHP Built-in Server (Development)

For quick testing, you can use PHP's built-in server:

```bash
cd backend
php -S localhost:8000 router.php
```

This router script will:
- Serve uploaded files from `/uploads/` directly
- Route API requests to `api/index.php`

Then access the API at: `http://localhost:8000/api`

## API Structure

The API follows RESTful conventions:

- `GET /api/user/{id}` - Get user
- `POST /api/user/login` - User login
- `GET /api/board` - Get public boards
- `POST /api/board` - Create board
- `GET /api/board/{id}` - Get board
- `PUT /api/board/{id}` - Update board
- `DELETE /api/board/{id}` - Delete board
- `GET /api/communicator/byemail/{email}` - Get user communicators
- `POST /api/communicator` - Create communicator
- `GET /api/settings` - Get user settings
- `POST /api/settings` - Update user settings

## Testing

Test the API health endpoint:
```bash
curl http://localhost/api/
```

Expected response:
```json
{
  "message": "Cboard API is running",
  "version": "1.0.0"
}
```

## Frontend Integration

Update the frontend `.env` file or `src/constants.js` to point to your local API:

```javascript
// For development
export const API_URL = 'http://localhost/api/';
```

Or set environment variable:
```
REACT_APP_DEV_API_URL=http://localhost/api/
```

## Project Structure

```
backend/
├── api/
│   ├── index.php          # Main API entry point
│   ├── helpers.php        # Helper functions
│   └── routes/            # Route handlers
│       ├── user.php
│       ├── board.php
│       ├── communicator.php
│       ├── settings.php
│       ├── media.php
│       └── other.php
├── config/
│   ├── config.php         # Application config
│   └── database.php       # Database config
├── database/
│   ├── init.php           # Database initialization
│   └── schema.sql         # Database schema
├── .htaccess              # Apache configuration
├── .env.example           # Environment template
└── README.md              # This file
```

## Current Status

**Sprint 1 - Placeholder Implementation**

All API endpoints are currently placeholders that return mock data. The following sprints will implement:

- Sprint 2: User profiles and database CRUD operations
- Sprint 3+: Full feature implementation

## Development Notes

- All routes currently return placeholder/mock data
- Authentication is stubbed (will be implemented in Sprint 2)
- Database queries are not yet implemented (will be added in Sprint 2)
- File uploads are not yet implemented

## Next Steps

1. Complete Sprint 1: Verify API endpoints are accessible
2. Start Sprint 2: Implement actual database operations
3. Add proper authentication (JWT tokens)
4. Implement file upload handling

