#!/bin/bash
# Database Setup Script for Cboard

set -e

echo "🔧 Setting up Cboard database..."

# Check if MySQL is running
if ! systemctl is-active --quiet mysql 2>/dev/null; then
    echo "⚠️  MySQL is not running. Starting MySQL..."
    sudo systemctl start mysql || {
        echo "❌ Failed to start MySQL. Please start it manually."
        exit 1
    }
fi

echo "✅ MySQL is running"

# Try to connect with different methods
echo "🔐 Attempting to connect to MySQL..."

# Method 1: Try sudo mysql (no password needed)
if sudo mysql -e "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ Connected via sudo mysql"
    sudo mysql <<EOF
CREATE DATABASE IF NOT EXISTS cboard;
CREATE USER IF NOT EXISTS 'cboard_user'@'localhost' IDENTIFIED BY 'Igear';
GRANT ALL PRIVILEGES ON cboard.* TO 'cboard_user'@'localhost';
FLUSH PRIVILEGES;
EOF
    echo "✅ Database and user created"
    
    # Initialize schema
    if [ -f backend/database/schema.sql ]; then
        echo "📦 Initializing database schema..."
        mysql -u cboard_user -pIgear cboard < backend/database/schema.sql
        echo "✅ Schema initialized"
    else
        echo "⚠️  Schema file not found: backend/database/schema.sql"
    fi
    
    # Test connection
    if mysql -u cboard_user -pIgear cboard -e "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Database connection test successful!"
        echo ""
        echo "📋 Database Info:"
        echo "   Host: localhost"
        echo "   Port: 3306"
        echo "   Database: cboard"
        echo "   User: cboard_user"
        echo "   Password: Igear"
        echo ""
        echo "✅ Setup complete! You can now start the backend server."
        exit 0
    else
        echo "❌ Connection test failed"
        exit 1
    fi
fi

# Method 2: Try with root password from environment
if [ -n "$MYSQL_ROOT_PASSWORD" ]; then
    echo "🔐 Trying with MYSQL_ROOT_PASSWORD..."
    if mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1;" >/dev/null 2>&1; then
        mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<EOF
CREATE DATABASE IF NOT EXISTS cboard;
CREATE USER IF NOT EXISTS 'cboard_user'@'localhost' IDENTIFIED BY 'Igear';
GRANT ALL PRIVILEGES ON cboard.* TO 'cboard_user'@'localhost';
FLUSH PRIVILEGES;
EOF
        echo "✅ Database setup complete"
        exit 0
    fi
fi

# Method 3: Use Docker MySQL
echo "🐳 Attempting to use Docker MySQL..."
if command -v docker-compose >/dev/null 2>&1; then
    echo "Starting Docker MySQL container..."
    docker-compose up -d database
    
    echo "Waiting for MySQL to initialize (30 seconds)..."
    sleep 30
    
    # Test connection
    if docker exec cboard-database mysql -u cboard_user -pcboard_pass cboard -e "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Docker MySQL is ready!"
        echo ""
        echo "📋 Database Info (Docker):"
        echo "   Host: localhost"
        echo "   Port: 3307"
        echo "   Database: cboard"
        echo "   User: cboard_user"
        echo "   Password: cboard_pass (or Igear if DB_PASS is set)"
        echo ""
        echo "⚠️  Make sure your backend/.env has:"
        echo "   DB_PORT=3307"
        exit 0
    fi
fi

echo "❌ Could not set up database automatically."
echo ""
echo "Please choose one of these options:"
echo ""
echo "Option 1: Use Docker MySQL"
echo "  docker-compose up -d database"
echo "  # Wait 30 seconds, then test"
echo ""
echo "Option 2: Manual MySQL setup"
echo "  mysql -u root -p"
echo "  # Then run:"
echo "  CREATE DATABASE cboard;"
echo "  CREATE USER 'cboard_user'@'localhost' IDENTIFIED BY 'Igear';"
echo "  GRANT ALL PRIVILEGES ON cboard.* TO 'cboard_user'@'localhost';"
echo "  FLUSH PRIVILEGES;"
echo "  EXIT;"
echo "  mysql -u cboard_user -pIgear cboard < backend/database/schema.sql"
echo ""
exit 1

