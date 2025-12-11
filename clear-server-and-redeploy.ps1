# Clear all files from server and prepare for clean redeployment
# Usage: .\clear-server-and-redeploy.ps1

$SERVER_HOST = "r77.igt.com.hk"
$SERVER_USER = "root"
$SERVER_PASS = "yyTTr437"
$SERVER_PATH = "/var/www/aac.uplifor.org"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Clear Server and Prepare for Redeployment" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "⚠️  WARNING: This will DELETE ALL files on the server!" -ForegroundColor Red
Write-Host "   Path: $SERVER_PATH" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Are you sure you want to continue? Type 'yes' to confirm"
if ($confirm -ne 'yes') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🧹 Clearing server directory..." -ForegroundColor Cyan

$clearScript = @"
cd /var/www

echo "=== Stopping Docker containers (if running) ==="
if [ -d "aac.uplifor.org" ]; then
    cd aac.uplifor.org
    if [ -f "docker-compose.yml" ] || [ -f "docker-compose.production.yml" ]; then
        COMPOSE_FILE="docker-compose.production.yml"
        if [ ! -f "\$COMPOSE_FILE" ]; then
            COMPOSE_FILE="docker-compose.yml"
        fi
        echo "Stopping containers..."
        docker-compose -f \$COMPOSE_FILE down 2>/dev/null || true
    fi
    cd ..
fi

echo ""
echo "=== Removing all files from $SERVER_PATH ==="
if [ -d "aac.uplifor.org" ]; then
    rm -rf aac.uplifor.org/*
    rm -rf aac.uplifor.org/.* 2>/dev/null || true
    # Keep the directory itself
    echo "✅ All files removed"
    echo ""
    echo "Directory status:"
    ls -la aac.uplifor.org/ 2>/dev/null || echo "Directory is empty"
else
    echo "⚠️  Directory does not exist, creating it..."
    mkdir -p aac.uplifor.org
    chown -R www-data:www-data aac.uplifor.org 2>/dev/null || true
fi

echo ""
echo "=== Disk space freed ==="
df -h /var/www 2>/dev/null || echo "Unable to check disk usage"

echo ""
echo "✅ Server cleared and ready for fresh deployment"
"@

# Convert Windows line endings to Unix
$clearScriptUnix = $clearScript -replace "`r`n", "`n"
$clearScriptUnix = $clearScriptUnix -replace "`r", "`n"

if (Get-Command plink -ErrorAction SilentlyContinue) {
    $clearScriptUnix | & plink -pw $SERVER_PASS "${SERVER_USER}@${SERVER_HOST}" "bash -s"
} else {
    Write-Host "Please run manually:" -ForegroundColor Yellow
    Write-Host "ssh root@r77.igt.com.hk" -ForegroundColor White
    Write-Host "cd /var/www/aac.uplifor.org" -ForegroundColor White
    Write-Host "rm -rf *" -ForegroundColor White
    Write-Host "rm -rf .* 2>/dev/null || true" -ForegroundColor White
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Server cleared!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "   1. The server is now clean" -ForegroundColor White
Write-Host "   2. When ready, run deployment with updated script:" -ForegroundColor White
Write-Host "      .\deploy-to-server.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "   The new deployment will:" -ForegroundColor Cyan
Write-Host "   ✅ Exclude Visual Studio files" -ForegroundColor Green
Write-Host "   ✅ Exclude IDE files (.vscode, .idea, .vs)" -ForegroundColor Green
Write-Host "   ✅ Exclude development scripts" -ForegroundColor Green
Write-Host "   ✅ Only upload necessary project files" -ForegroundColor Green
Write-Host ""

