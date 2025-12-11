#!/bin/bash
# Automated deployment script for aac.uplifor.org
# Usage: ./deploy-to-server.sh

set -e  # Exit on error

SERVER_HOST="r77.igt.com.hk"
SERVER_USER="root"
SERVER_PASS="yyTTr437"
SERVER_PATH="/var/www/aac.uplifor.org"
MYSQL_HOST="r79.igt.com.hk"
MYSQL_USER="root"
MYSQL_PASS="yyTTr437"

echo "=========================================="
echo "Cboard Deployment to aac.uplifor.org"
echo "=========================================="
echo ""

# Check if sshpass is installed (for password authentication)
if ! command -v sshpass &> /dev/null; then
    echo "⚠️  sshpass not found. Installing..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y sshpass
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install hudochenkov/sshpass/sshpass
    else
        echo "❌ Please install sshpass manually"
        exit 1
    fi
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env created. Please edit it with your values."
        echo "   Required: DB_HOST, DB_PASS, JWT_SECRET"
        read -p "Press Enter after editing .env file..."
    else
        echo "❌ .env.example not found. Cannot proceed."
        exit 1
    fi
fi

echo "📦 Preparing deployment package..."
# Create temporary directory for files to upload
TEMP_DIR=$(mktemp -d)
echo "   Temporary directory: $TEMP_DIR"

# Copy necessary files (exclude node_modules, .git, etc.)
echo "   Copying files..."
rsync -av --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude 'build' \
    --exclude 'backend/uploads' \
    --exclude 'backend/vendor' \
    --exclude '.DS_Store' \
    --exclude '*.log' \
    . "$TEMP_DIR/"

echo ""
echo "🔐 Connecting to server..."
# Upload files to server
sshpass -p "$SERVER_PASS" scp -r "$TEMP_DIR"/* "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/"

echo ""
echo "🚀 Deploying on server..."
# Execute deployment commands on server
sshpass -p "$SERVER_PASS" ssh "$SERVER_USER@$SERVER_HOST" << EOF
    set -e
    cd $SERVER_PATH
    
    echo "📋 Checking Docker..."
    if ! command -v docker &> /dev/null; then
        echo "   Installing Docker..."
        apt-get update
        apt-get install -y docker.io docker-compose
        systemctl start docker
        systemctl enable docker
    fi
    
    echo "📝 Updating .env file..."
    if [ ! -f ".env" ]; then
        cp .env.example .env
        # Update with server-specific values
        sed -i "s/DB_HOST=.*/DB_HOST=$MYSQL_HOST/" .env
        sed -i "s/DB_PASS=.*/DB_PASS=$MYSQL_PASS/" .env
        sed -i "s|REACT_APP_API_URL=.*|REACT_APP_API_URL=https://aac.uplifor.org/api|" .env
    fi
    
    echo "🗄️  Checking database..."
    # Test MySQL connection
    if mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASS -e "SELECT 1;" &> /dev/null; then
        echo "   ✅ MySQL connection successful"
        # Create database if not exists
        mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASS -e "CREATE DATABASE IF NOT EXISTS cboard;" 2>/dev/null || true
    else
        echo "   ⚠️  Cannot connect to MySQL. Please check credentials."
    fi
    
    echo "🔨 Building Docker images..."
    docker-compose build
    
    echo "🚀 Starting services..."
    docker-compose up -d
    
    echo "⏳ Waiting for services to start..."
    sleep 10
    
    echo "📊 Service status:"
    docker-compose ps
    
    echo ""
    echo "✅ Deployment complete!"
    echo "   Frontend: https://aac.uplifor.org/"
    echo "   API: https://aac.uplifor.org/api"
EOF

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "=========================================="
echo "✅ Deployment completed!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Verify deployment: https://aac.uplifor.org/"
echo "2. Check logs: ssh root@r77.igt.com.hk 'cd /var/www/aac.uplifor.org && docker-compose logs -f'"
echo "3. Initialize database if needed via phpMyAdmin: https://r79.igt.com.hk/phpmyadmin/"
echo ""

