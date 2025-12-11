# Check deployment status on server
# Usage: .\check-deployment-status.ps1

$SERVER_HOST = "r77.igt.com.hk"
$SERVER_USER = "root"
$SERVER_PASS = "yyTTr437"
$SERVER_PATH = "/var/www/aac.uplifor.org"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Checking Deployment Status" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if plink (PuTTY) is available
if (Get-Command plink -ErrorAction SilentlyContinue) {
    Write-Host "✅ Using PuTTY plink" -ForegroundColor Green
    $usePlink = $true
} elseif (Get-Command ssh -ErrorAction SilentlyContinue) {
    Write-Host "✅ Using SSH" -ForegroundColor Green
    $usePlink = $false
} else {
    Write-Host "❌ SSH client not found. Please install:" -ForegroundColor Red
    Write-Host "   - OpenSSH (Windows 10+): Add-WindowsCapability -Online -Name OpenSSH.Client" -ForegroundColor White
    Write-Host "   - Or PuTTY: https://www.putty.org/" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "🔍 Checking server status..." -ForegroundColor Cyan
Write-Host ""

$checkScript = @"
cd $SERVER_PATH

echo "=== Docker Status ==="
if command -v docker &> /dev/null; then
    echo "✅ Docker installed: \$(docker --version)"
else
    echo "❌ Docker not installed"
fi

echo ""
echo "=== Docker Compose Status ==="
if command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose installed: \$(docker-compose --version)"
else
    echo "❌ Docker Compose not installed"
fi

echo ""
echo "=== Container Status ==="
if [ -f "docker-compose.production.yml" ] || [ -f "docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.production.yml"
    if [ ! -f "\$COMPOSE_FILE" ]; then
        COMPOSE_FILE="docker-compose.yml"
    fi
    
    echo "Using: \$COMPOSE_FILE"
    docker-compose -f \$COMPOSE_FILE ps 2>/dev/null || echo "No containers running"
    
    echo ""
    echo "=== Recent Logs (last 20 lines) ==="
    docker-compose -f \$COMPOSE_FILE logs --tail=20 2>/dev/null || echo "No logs available"
else
    echo "⚠️  docker-compose.yml not found in $SERVER_PATH"
fi

echo ""
echo "=== Disk Space ==="
df -h / | tail -1

echo ""
echo "=== Memory Usage ==="
free -h 2>/dev/null || echo "free command not available"

echo ""
echo "=== Project Files ==="
if [ -d "$SERVER_PATH" ]; then
    echo "✅ Project directory exists"
    ls -la $SERVER_PATH | head -10
else
    echo "❌ Project directory not found"
fi
"@

if ($usePlink) {
    $checkScript | & plink -pw $SERVER_PASS "${SERVER_USER}@${SERVER_HOST}" "bash -s"
} else {
    # For SSH, we need to use a different approach
    Write-Host "Please run manually:" -ForegroundColor Yellow
    Write-Host "ssh root@r77.igt.com.hk" -ForegroundColor White
    Write-Host "cd /var/www/aac.uplifor.org" -ForegroundColor White
    Write-Host "docker-compose ps" -ForegroundColor White
    Write-Host "docker-compose logs -f" -ForegroundColor White
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Status check complete" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

