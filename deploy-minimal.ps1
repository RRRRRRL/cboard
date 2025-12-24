<# 
  Minimal deployment script for Cboard enhancement
  - Builds the React frontend locally
  - Uploads only the built frontend (build/) and backend/ to the server
  - Leaves database and most server config as-is

  Usage:
    powershell -ExecutionPolicy Bypass -File .\deploy-minimal.ps1
#>

$ErrorActionPreference = "Stop"

# --- Server configuration (reuse same target as existing deploy-to-server.ps1) ---
$SERVER_HOST = "r77.igt.com.hk"
$SERVER_USER = "root"
$SERVER_PASS = "yyTTr437"
$SERVER_PATH = "/var/www/aac.uplifor.org"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Cboard Minimal Deployment to aac.uplifor.org" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# --- Check SCP/PSCP availability ---
$usePSCP = $false
if (Get-Command pscp -ErrorAction SilentlyContinue) {
    $usePSCP = $true
    Write-Host "[OK] Found PSCP (PuTTY)" -ForegroundColor Green
} elseif (Get-Command scp -ErrorAction SilentlyContinue) {
    Write-Host "[OK] Found SCP" -ForegroundColor Green
} else {
    Write-Host "[!] SCP not found. Please install:" -ForegroundColor Yellow
    Write-Host "   - OpenSSH (Windows 10+): Add-WindowsCapability -Online -Name OpenSSH.Client" -ForegroundColor White
    Write-Host "   - Or PuTTY: https://www.putty.org/" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "[*] Building frontend (React)..." -ForegroundColor Cyan

if ((Test-Path "package.json") -and (Test-Path "src")) {
    try {
        # Check if .env file exists and contains REACT_APP_DEV_API_URL with local IP
        $envBackupCreated = $false
        if (Test-Path ".env") {
            $envContent = Get-Content ".env" -Raw
            if ($envContent -match "REACT_APP_DEV_API_URL.*192\.168") {
                Write-Host "   [WARNING] Found REACT_APP_DEV_API_URL with local IP in .env file" -ForegroundColor Yellow
                Write-Host "   Temporarily removing REACT_APP_DEV_API_URL from .env for production build..." -ForegroundColor Yellow
                # Backup .env and remove REACT_APP_DEV_API_URL line
                Copy-Item ".env" ".env.backup"
                $newEnvContent = (Get-Content ".env") | Where-Object { $_ -notmatch "^REACT_APP_DEV_API_URL=" }
                $newEnvContent | Set-Content ".env"
                $envBackupCreated = $true
            }
        }
        
        # Set environment variables for production build
        $env:NODE_ENV = "production"
        $env:REACT_APP_DEV_API_URL = $null
        Remove-Item Env:\REACT_APP_DEV_API_URL -ErrorAction SilentlyContinue
        
        if (-not (Test-Path "node_modules")) {
            Write-Host "   node_modules not found, running npm install (this may take a while)..." -ForegroundColor Yellow
            npm install
        }
        
        Write-Host "   Building with NODE_ENV=production..." -ForegroundColor Gray
        Write-Host "   REACT_APP_DEV_API_URL is unset (will use relative /api path)" -ForegroundColor Gray
        npm run build
        
        # Restore .env file if we backed it up
        if ($envBackupCreated) {
            Write-Host "   Restoring .env file..." -ForegroundColor Gray
            Move-Item ".env.backup" ".env" -Force
        }
        
        Write-Host "   [OK] npm run build completed." -ForegroundColor Green
    } catch {
        # Restore .env file if we backed it up (even on error)
        if ($envBackupCreated -and (Test-Path ".env.backup")) {
            Move-Item ".env.backup" ".env" -Force
        }
        Write-Host "   [!] Frontend build failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "       Deployment aborted to avoid pushing stale assets." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "   [!] package.json or src/ not found - not a React project?" -ForegroundColor Yellow
    Write-Host "       Aborting minimal deployment." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[*] Preparing files for upload..." -ForegroundColor Cyan

# Create temporary directory
$TEMP_DIR = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
Write-Host "   Temporary directory: $TEMP_DIR" -ForegroundColor Gray

# 1) Copy built frontend
if (-not (Test-Path "build")) {
    Write-Host "   [X] build/ directory not found after npm run build." -ForegroundColor Red
    exit 1
}

Write-Host "   Copying build/ (frontend)..." -ForegroundColor Gray
Copy-Item -Path "build" -Destination (Join-Path $TEMP_DIR "build") -Recurse -Force

# 2) Copy backend API code
if (-not (Test-Path "backend")) {
    Write-Host "   [X] backend/ directory not found." -ForegroundColor Red
    exit 1
}

Write-Host "   Copying backend/..." -ForegroundColor Gray
Copy-Item -Path "backend" -Destination (Join-Path $TEMP_DIR "backend") -Recurse -Force

# 3) Copy minimal root files that frontend/backend might rely on
foreach ($file in @("index.php", ".htaccess", ".env.example", "deploy-to-server.ps1")) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination (Join-Path $TEMP_DIR $file) -Force
    }
}

Write-Host ""
Write-Host "[*] Uploading minimal payload to server..." -ForegroundColor Cyan

# Upload temp directory contents to server path
if ($usePSCP) {
    $env:PUTTY_PASSWORD = $SERVER_PASS
    & pscp -pw $SERVER_PASS -r "$TEMP_DIR\*" "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/"
} else {
    Write-Host "   Note: You may be prompted for password: $SERVER_PASS" -ForegroundColor Yellow
    & scp -r "$TEMP_DIR\*" "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/"
}

Write-Host ""
Write-Host "[*] Upload complete. Frontend and backend files are now on the server." -ForegroundColor Cyan
Write-Host "    If needed, you can SSH to the server to reload PHP-FPM/Nginx manually." -ForegroundColor Gray

# Cleanup local temp
Remove-Item -Recurse -Force $TEMP_DIR

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "[OK] Minimal deployment completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host 'Frontend: https://aac.uplifor.org/' -ForegroundColor White
Write-Host 'API:      https://aac.uplifor.org/api' -ForegroundColor White

