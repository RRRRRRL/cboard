# Cboard Setup Script for Windows
# Run this script to quickly setup the environment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cboard Enhancement - Quick Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
Write-Host "Checking Docker installation..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker not found. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is installed
Write-Host "Checking Docker Compose..." -ForegroundColor Yellow
try {
    $composeVersion = docker-compose --version
    Write-Host "✓ Docker Compose found: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker Compose not found." -ForegroundColor Red
    exit 1
}

# Check if .env file exists
Write-Host ""
Write-Host "Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✓ .env file exists" -ForegroundColor Green
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Keeping existing .env file" -ForegroundColor Yellow
        $skipEnv = $true
    }
} else {
    $skipEnv = $false
}

# Create .env file
if (-not $skipEnv) {
    Write-Host ""
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    
    # Generate random JWT secret
    $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    
    $envContent = @"
# Database Configuration
DB_NAME=cboard
DB_USER=cboard_user
DB_PASS=ChangeThisPassword123!
MYSQL_ROOT_PASSWORD=ChangeThisRootPassword123!

# JWT Secret (auto-generated)
JWT_SECRET=$jwtSecret

# Azure TTS (Optional - leave empty if not using)
AZURE_TTS_KEY=
AZURE_TTS_REGION=eastasia
"@
    
    $envContent | Out-File -FilePath ".env" -Encoding utf8 -NoNewline
    Write-Host "✓ .env file created" -ForegroundColor Green
    Write-Host "⚠ Please edit .env file and change the default passwords!" -ForegroundColor Yellow
}

# Create backups directory
Write-Host ""
Write-Host "Creating backups directory..." -ForegroundColor Yellow
if (-not (Test-Path "backups")) {
    New-Item -ItemType Directory -Path "backups" | Out-Null
    Write-Host "✓ Backups directory created" -ForegroundColor Green
} else {
    Write-Host "✓ Backups directory exists" -ForegroundColor Green
}

# Check if containers are already running
Write-Host ""
Write-Host "Checking existing containers..." -ForegroundColor Yellow
$runningContainers = docker ps --filter "name=cboard" --format "{{.Names}}"
if ($runningContainers) {
    Write-Host "⚠ Found running Cboard containers:" -ForegroundColor Yellow
    $runningContainers | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    $stop = Read-Host "Do you want to stop them first? (y/N)"
    if ($stop -eq "y" -or $stop -eq "Y") {
        Write-Host "Stopping containers..." -ForegroundColor Yellow
        docker-compose down
        Write-Host "✓ Containers stopped" -ForegroundColor Green
    }
}

# Start containers
Write-Host ""
Write-Host "Starting containers..." -ForegroundColor Yellow
Write-Host "This may take a few minutes on first run..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✓ Setup Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Application is starting..." -ForegroundColor Yellow
    Write-Host "Wait 30-60 seconds for database initialization" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Access your application:" -ForegroundColor Cyan
    Write-Host "  Frontend: http://localhost" -ForegroundColor White
    Write-Host "  API:      http://localhost/api" -ForegroundColor White
    Write-Host ""
    Write-Host "View logs:" -ForegroundColor Cyan
    Write-Host "  docker-compose logs -f" -ForegroundColor White
    Write-Host ""
    Write-Host "Check status:" -ForegroundColor Cyan
    Write-Host "  docker-compose ps" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "✗ Setup failed. Check the errors above." -ForegroundColor Red
    Write-Host "View logs: docker-compose logs" -ForegroundColor Yellow
    exit 1
}

