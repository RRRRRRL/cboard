# Import Database to Server Script (PowerShell)
# This script imports the project database schema and seed data to the server
#
# Usage:
#   .\backend\scripts\import-database-to-server.ps1
#
# Or with custom parameters:
#   $env:DB_HOST="r77.igt.com.hk"; $env:DB_USER="root"; $env:DB_PASS="yourpassword"; .\backend\scripts\import-database-to-server.ps1

param(
    [string]$DB_HOST = "r77.igt.com.hk",
    [string]$DB_USER = "root",
    [string]$DB_NAME = "cboard",
    [string]$DB_PASS = ""
)

$ErrorActionPreference = "Stop"

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $SCRIPT_DIR)
$DB_DIR = Join-Path $PROJECT_ROOT "backend\database"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Import Database to Server" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target Server: $DB_HOST" -ForegroundColor Gray
Write-Host "Database: $DB_NAME" -ForegroundColor Gray
Write-Host "User: $DB_USER" -ForegroundColor Gray
Write-Host ""

# Check if MySQL is available
$mysqlCmd = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysqlCmd) {
    Write-Host "[X] Error: mysql command not found. Please install MySQL client or add it to PATH." -ForegroundColor Red
    exit 1
}

# Build MySQL command
$mysqlArgs = @()
if ($DB_HOST -ne "localhost" -and $DB_HOST -ne "127.0.0.1") {
    $mysqlArgs += "-h", $DB_HOST
}
$mysqlArgs += "-u", $DB_USER
if ($DB_PASS) {
    $mysqlArgs += "-p$DB_PASS"
}

# Check if database files exist
if (-not (Test-Path "$DB_DIR\schema.sql")) {
    Write-Host "[X] Error: schema.sql not found at $DB_DIR\schema.sql" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[*] Step 1: Creating database (if not exists)..." -ForegroundColor Cyan
$createDbQuery = "CREATE DATABASE IF NOT EXISTS ``${DB_NAME}`` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;"
$createDbQuery | & mysql $mysqlArgs
Write-Host "   [OK] Database created/verified" -ForegroundColor Green

Write-Host ""
Write-Host "[*] Step 2: Importing schema..." -ForegroundColor Cyan
Get-Content "$DB_DIR\schema.sql" | & mysql $mysqlArgs $DB_NAME
Write-Host "   [OK] Schema imported" -ForegroundColor Green

Write-Host ""
Write-Host "[*] Step 3: Importing seed data..." -ForegroundColor Cyan

# Import seed files in order
$seedFiles = @(
    "seed-system-user.sql",
    "seed-preset-profiles.sql",
    "seed-jyutping-dictionary.sql",
    "seed-jyutping-dictionary-extended.sql"
)

foreach ($seedFile in $seedFiles) {
    $seedPath = Join-Path $DB_DIR $seedFile
    if (Test-Path $seedPath) {
        Write-Host "   Importing $seedFile..." -ForegroundColor Gray
        try {
            Get-Content $seedPath | & mysql $mysqlArgs $DB_NAME
        } catch {
            Write-Host "   [WARNING] Failed to import $seedFile (may already exist)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   [SKIP] $seedFile not found" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "[*] Step 4: Creating admin user..." -ForegroundColor Cyan
$adminUserPath = Join-Path $DB_DIR "create-admin-user.sql"
if (Test-Path $adminUserPath) {
    try {
        Get-Content $adminUserPath | & mysql $mysqlArgs $DB_NAME
        Write-Host "   [OK] Admin user created/updated" -ForegroundColor Green
    } catch {
        Write-Host "   [WARNING] Failed to create admin user (may already exist)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [SKIP] create-admin-user.sql not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[*] Step 5: Verifying database..." -ForegroundColor Cyan
$verifyQuery = @"
SELECT 'Tables' as Type, COUNT(*) as Count
FROM information_schema.tables 
WHERE table_schema = '$DB_NAME'
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'Boards', COUNT(*) FROM boards
UNION ALL
SELECT 'Jyutping Dictionary', COUNT(*) FROM jyutping_dictionary;
"@

$verifyQuery | & mysql $mysqlArgs $DB_NAME

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " [OK] Database import completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database: $DB_NAME" -ForegroundColor Gray
Write-Host "Host: $DB_HOST" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify the data was imported correctly"
Write-Host "  2. Update backend/.env with correct database credentials"
Write-Host "  3. Test the API endpoints"
Write-Host ""

