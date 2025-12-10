#!/bin/bash
# Cboard Setup Script for Linux/Mac
# Run this script to quickly setup the environment

echo "========================================"
echo "Cboard Enhancement - Quick Setup"
echo "========================================"
echo ""

# Check if Docker is installed
echo "Checking Docker installation..."
if command -v docker &> /dev/null; then
    echo "✓ Docker found: $(docker --version)"
else
    echo "✗ Docker not found. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
echo "Checking Docker Compose..."
if command -v docker-compose &> /dev/null; then
    echo "✓ Docker Compose found: $(docker-compose --version)"
else
    echo "✗ Docker Compose not found."
    exit 1
fi

# Check if .env file exists
echo ""
echo "Checking environment configuration..."
if [ -f ".env" ]; then
    echo "✓ .env file exists"
    read -p "Do you want to overwrite it? (y/N): " overwrite
    if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "Keeping existing .env file"
        skip_env=true
    fi
else
    skip_env=false
fi

# Create .env file
if [ "$skip_env" != "true" ]; then
    echo ""
    echo "Creating .env file..."
    
    # Generate random JWT secret
    jwt_secret=$(openssl rand -base64 32 | tr -d '\n')
    
    cat > .env << EOF
# Database Configuration
DB_NAME=cboard
DB_USER=cboard_user
DB_PASS=ChangeThisPassword123!
MYSQL_ROOT_PASSWORD=ChangeThisRootPassword123!

# JWT Secret (auto-generated)
JWT_SECRET=$jwt_secret

# Azure TTS (Optional - leave empty if not using)
AZURE_TTS_KEY=
AZURE_TTS_REGION=eastasia
EOF
    
    echo "✓ .env file created"
    echo "⚠ Please edit .env file and change the default passwords!"
fi

# Create backups directory
echo ""
echo "Creating backups directory..."
if [ ! -d "backups" ]; then
    mkdir -p backups
    echo "✓ Backups directory created"
else
    echo "✓ Backups directory exists"
fi

# Check if containers are already running
echo ""
echo "Checking existing containers..."
running_containers=$(docker ps --filter "name=cboard" --format "{{.Names}}")
if [ ! -z "$running_containers" ]; then
    echo "⚠ Found running Cboard containers:"
    echo "$running_containers" | while read container; do
        echo "  - $container"
    done
    read -p "Do you want to stop them first? (y/N): " stop
    if [ "$stop" = "y" ] || [ "$stop" = "Y" ]; then
        echo "Stopping containers..."
        docker-compose down
        echo "✓ Containers stopped"
    fi
fi

# Start containers
echo ""
echo "Starting containers..."
echo "This may take a few minutes on first run..."
docker-compose up -d

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "✓ Setup Complete!"
    echo "========================================"
    echo ""
    echo "Application is starting..."
    echo "Wait 30-60 seconds for database initialization"
    echo ""
    echo "Access your application:"
    echo "  Frontend: http://localhost"
    echo "  API:      http://localhost/api"
    echo ""
    echo "View logs:"
    echo "  docker-compose logs -f"
    echo ""
    echo "Check status:"
    echo "  docker-compose ps"
    echo ""
else
    echo ""
    echo "✗ Setup failed. Check the errors above."
    echo "View logs: docker-compose logs"
    exit 1
fi

