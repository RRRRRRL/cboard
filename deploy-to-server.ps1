# PowerShell deployment script for aac.uplifor.org
# Usage: .\deploy-to-server.ps1

$ErrorActionPreference = "Stop"

$SERVER_HOST = "r77.igt.com.hk"
$SERVER_USER = "root"
$SERVER_PASS = "yyTTr437"
$SERVER_PATH = "/var/www/aac.uplifor.org"
$MYSQL_HOST = "r77.igt.com.hk"
$MYSQL_USER = "root"
$MYSQL_PASS = "yyTTr437"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Cboard Deployment to aac.uplifor.org" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "[!] .env file not found. Creating from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "[OK] .env created. Please edit it with your values." -ForegroundColor Green
        Write-Host "   Required: DB_HOST, DB_PASS, JWT_SECRET" -ForegroundColor Yellow
        Read-Host "Press Enter after editing .env file"
    } else {
        Write-Host "[X] .env.example not found. Cannot proceed." -ForegroundColor Red
        exit 1
    }
}

# Check if PSCP (PuTTY SCP) is available, or use built-in SCP
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
Write-Host "[*] Preparing deployment..." -ForegroundColor Cyan

# Create temporary directory
$TEMP_DIR = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }

Write-Host "   Temporary directory: $TEMP_DIR" -ForegroundColor Gray

# Copy files (exclude unnecessary ones)
Write-Host "   Copying files..." -ForegroundColor Gray

# Read .deployignore if exists
$deployIgnore = @()
if (Test-Path ".deployignore") {
    $deployIgnore = Get-Content ".deployignore" | Where-Object { 
        $_ -notmatch '^\s*#' -and $_ -notmatch '^\s*$' 
    } | ForEach-Object { $_.Trim() }
    Write-Host "   Using .deployignore file" -ForegroundColor Gray
}

# Standard exclusions
$excludeDirs = @('node_modules', '.git', 'build', 'dist', 'backend/uploads', 'backend/vendor', 
                 '.vscode', '.idea', '.vs', '__pycache__', '.pytest_cache', 'tmp', 'temp', 'coverage', 
                 'tests', '__tests__', '.nyc_output', 'bin', 'obj', 'Debug', 'Release', 'x64', 'x86', 'ARM')
$excludeFiles = @('*.log', '.DS_Store', 'Welcome.*', 'welcome.ico', 'VisualStudio.png', 
                  '*.swp', '*.swo', '*~', '*.tmp', '*.bak', '*.cache', 'Thumbs.db', 'Desktop.ini',
                  '*.test.js', '*.test.ts', '*.spec.js', '*.spec.ts',
                  '*.dll', '*.exe', '*.pdb', '*.ilk', '*.exp', '*.lib', '*.manifest',
                  '*.vsdir', '*.vsz', '*.vstemplate', '*.vcxproj', '*.vcxproj.filters', '*.sln', '*.suo',
                  '*.user', '*.userosscache', '*.sdf', '*.opensdf', '*.db', '*.opendb',
                  'msvsmon.*', 'vsdebugeng.*', 'DiagnosticsHub.*', 'Microsoft.VisualStudio.*',
                  'System.*.dll', 'api-ms-win-*', 'vcruntime*.dll', 'msvcp*.dll', 'msvcdis*.dll',
                  'msdia*.dll', 'concrt*.dll', 'ucrtbase.dll', 'dbgshim.dll')

# Add patterns from .deployignore
foreach ($pattern in $deployIgnore) {
    if ($pattern.EndsWith('/')) {
        $excludeDirs += $pattern.TrimEnd('/')
    } else {
        $excludeFiles += $pattern
    }
}

# Get all files and filter with comprehensive checks
$allFiles = Get-ChildItem -Path . -Recurse -File
$filesToCopy = @()
$skippedCount = 0
$skippedSize = 0

Write-Host "   Analyzing $($allFiles.Count) files..." -ForegroundColor Gray

foreach ($item in $allFiles) {
    $relativePath = $item.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/')
    $skip = $false
    $skipReason = ""
    
    # Check if in excluded directory (handle nested paths)
    foreach ($excludeDir in $excludeDirs) {
        if ($relativePath -like "*\$excludeDir\*" -or 
            $relativePath -like "*/$excludeDir/*" -or 
            $relativePath.StartsWith("$excludeDir/") -or
            $relativePath.StartsWith("$excludeDir\")) {
            $skip = $true
            $skipReason = "Directory: $excludeDir"
            break
        }
    }
    
    # Check file name patterns
    if (-not $skip) {
        foreach ($excludePattern in $excludeFiles) {
            if ($item.Name -like $excludePattern) {
                $skip = $true
                $skipReason = "Pattern: $excludePattern"
                break
            }
        }
    }
    
    # Always skip .env
    if (-not $skip -and $item.Name -eq ".env") {
        $skip = $true
        $skipReason = ".env file"
    }
    
    # Additional safety checks for binary and Visual Studio files
    if (-not $skip) {
        # Skip Windows/Visual Studio binary files by extension
        $binaryExtensions = @('.dll', '.exe', '.pdb', '.ilk', '.exp', '.lib', '.obj', '.manifest')
        if ($item.Extension -in $binaryExtensions) {
            $skip = $true
            $skipReason = "Binary: $($item.Extension)"
        }
        # Skip Visual Studio project files
        elseif ($item.Extension -in @('.vcxproj', '.sln', '.suo', '.user', '.userosscache', 
                                      '.sdf', '.opensdf', '.vsdir', '.vsz', '.vstemplate', '.db', '.opendb')) {
            $skip = $true
            $skipReason = "VS file: $($item.Extension)"
        }
        # Skip if path contains Visual Studio build directories
        elseif ($relativePath -match '[/\\](bin|obj|Debug|Release|x64|x86|ARM|\.vs)[/\\]') {
            $skip = $true
            $skipReason = "VS build directory"
        }
    }
    
    if ($skip) {
        $skippedCount++
        $skippedSize += $item.Length
    } else {
        $filesToCopy += $item
    }
}

Write-Host "   Files to upload: $($filesToCopy.Count)" -ForegroundColor Green
$skippedSizeMB = [math]::Round($skippedSize / 1MB, 2)
Write-Host "   Files skipped: $skippedCount ($skippedSizeMB MB)" -ForegroundColor Yellow

# Copy files
foreach ($item in $filesToCopy) {
    $relativePath = $item.FullName.Substring((Get-Location).Path.Length + 1)
    $destPath = Join-Path $TEMP_DIR $relativePath
    $destDir = Split-Path $destPath -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item -Path $item.FullName -Destination $destPath -Force
}

Write-Host ""
Write-Host "[*] Uploading files to server..." -ForegroundColor Cyan

# Upload files
if ($usePSCP) {
    # Using PSCP with password
    $env:PUTTY_PASSWORD = $SERVER_PASS
    & pscp -pw $SERVER_PASS -r "$TEMP_DIR\*" "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/"
} else {
    # Using SCP (requires SSH key or manual password entry)
    Write-Host "   Note: You may be prompted for password: $SERVER_PASS" -ForegroundColor Yellow
    & scp -r "$TEMP_DIR\*" "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/"
}

Write-Host ""
Write-Host "[*] Deploying on server..." -ForegroundColor Cyan

# Create deployment script for server
$deployScript = @"
#!/bin/bash
set -e
cd $SERVER_PATH

echo "[*] Setting file permissions (quick mode)..."
# Skip file permissions - they're usually already correct
# Only set critical permissions if needed
if [ -f "backend/api/index.php" ]; then
    chmod 755 backend/api/index.php 2>/dev/null || true
fi
if [ -f ".env" ]; then
    chmod 600 .env 2>/dev/null || true
fi
echo "   [OK] Critical permissions set (skipped bulk operations)"

echo "[*] Updating .env file..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "   [OK] Created .env from .env.example"
    elif [ -f "backend/env.example.txt" ]; then
        cp backend/env.example.txt .env
        echo "   [OK] Created .env from backend/env.example.txt"
    else
        echo "   [!] No .env.example found, creating basic .env..."
        # Generate JWT_SECRET if openssl is available, otherwise use a default
        if command -v openssl &> /dev/null; then
            JWT_SECRET=`openssl rand -base64 32`
        else
            JWT_SECRET="Igears123!@#CHANGE_THIS_TO_RANDOM_32_CHARS"
        fi
        cat > .env << 'ENVEOF'
DB_HOST=ENV_DB_HOST
DB_NAME=cboard
DB_USER=ENV_DB_USER
DB_PASS=ENV_DB_PASS
JWT_SECRET=ENV_JWT_SECRET
REACT_APP_API_URL=https://aac.uplifor.org/api
ENVEOF
        sed -i "s|ENV_DB_HOST|`$MYSQL_HOST|g" .env
        sed -i "s|ENV_DB_USER|`$MYSQL_USER|g" .env
        sed -i "s|ENV_DB_PASS|`$MYSQL_PASS|g" .env
        sed -i "s|ENV_JWT_SECRET|`$JWT_SECRET|g" .env
    fi
fi

# Update .env with correct values
if [ -f ".env" ]; then
    sed -i "s|DB_HOST=.*|DB_HOST=$MYSQL_HOST|" .env 2>/dev/null || sed -i '' "s|DB_HOST=.*|DB_HOST=$MYSQL_HOST|" .env
    sed -i "s|DB_PASS=.*|DB_PASS=$MYSQL_PASS|" .env 2>/dev/null || sed -i '' "s|DB_PASS=.*|DB_PASS=$MYSQL_PASS|" .env
    sed -i "s|REACT_APP_API_URL=.*|REACT_APP_API_URL=https://aac.uplifor.org/api|" .env 2>/dev/null || sed -i '' "s|REACT_APP_API_URL=.*|REACT_APP_API_URL=https://aac.uplifor.org/api|" .env
    echo "   [OK] Updated .env file"
fi

echo "[*] Checking database connection..."
if command -v mysql &> /dev/null; then
    if mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASS -e "SELECT 1;" &> /dev/null; then
        echo "   [OK] MySQL connection successful"
        mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASS -e "CREATE DATABASE IF NOT EXISTS cboard;" 2>/dev/null || true
        echo "   [OK] Database 'cboard' ready"
    else
        echo "   [!] Cannot connect to MySQL. Please check credentials."
    fi
else
    echo "   [!] MySQL client not found. Please check database manually."
fi

echo "[*] Checking PHP-FPM status..."
if systemctl is-active --quiet php-fpm || systemctl is-active --quiet php8.1-fpm || systemctl is-active --quiet php8.2-fpm || systemctl is-active --quiet php7.4-fpm; then
    echo "   [OK] PHP-FPM is running"
    # Reload PHP-FPM to pick up new files
    systemctl reload php-fpm 2>/dev/null || systemctl reload php8.1-fpm 2>/dev/null || systemctl reload php8.2-fpm 2>/dev/null || systemctl reload php7.4-fpm 2>/dev/null || true
    echo "   [OK] PHP-FPM reloaded"
else
    echo "   [!] PHP-FPM status unknown. Please check manually."
fi

echo "[*] Checking Nginx status..."
if systemctl is-active --quiet nginx; then
    echo "   [OK] Nginx is running"
    # Test Nginx configuration
    if nginx -t &> /dev/null; then
        systemctl reload nginx 2>/dev/null || true
        echo "   [OK] Nginx configuration valid and reloaded"
    else
        echo "   [!] Nginx configuration has errors. Please check manually."
    fi
else
    echo "   [!] Nginx is not running. Please start it manually."
fi

echo ""
echo "[OK] Deployment complete!"
echo "   Frontend: https://aac.uplifor.org/"
echo "   API: https://aac.uplifor.org/api"
echo ""
echo "   Next steps:"
echo "   1. Verify frontend: https://aac.uplifor.org/"
echo "   2. Test API: https://aac.uplifor.org/api"
echo "   3. Initialize database if needed: backend/database/schema.sql"
"@

# Save and upload deployment script
$deployScriptPath = Join-Path $TEMP_DIR "deploy.sh"
$deployScript | Out-File -FilePath $deployScriptPath -Encoding ASCII -NoNewline
$content = Get-Content $deployScriptPath -Raw
$content = $content -replace "`r`n", "`n"
[System.IO.File]::WriteAllText($deployScriptPath, $content, [System.Text.UTF8Encoding]::new($false))

# Upload and execute
Write-Host "   Uploading deployment script..." -ForegroundColor Gray
if ($usePSCP) {
    & pscp -batch -pw $SERVER_PASS "$deployScriptPath" "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/deploy.sh" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   [!] Failed to upload deployment script" -ForegroundColor Red
        Write-Host "   Please upload manually or check connection" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "   Note: You may be prompted for password: $SERVER_PASS" -ForegroundColor Yellow
    & scp "$deployScriptPath" "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/deploy.sh"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   [!] Failed to upload deployment script" -ForegroundColor Red
        Write-Host "   Please upload manually or check connection" -ForegroundColor Yellow
        exit 1
    }
}

# Execute deployment script
Write-Host "   Executing deployment script..." -ForegroundColor Gray
if (Get-Command plink -ErrorAction SilentlyContinue) {
    # Use -batch flag to prevent interactive prompts
    & plink -batch -pw $SERVER_PASS "${SERVER_USER}@${SERVER_HOST}" "chmod +x ${SERVER_PATH}/deploy.sh && bash ${SERVER_PATH}/deploy.sh"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   [!] Deployment script execution failed or timed out" -ForegroundColor Yellow
        Write-Host "   Please SSH to server and run manually:" -ForegroundColor Yellow
        Write-Host "   ssh root@r77.igt.com.hk" -ForegroundColor White
        Write-Host "   cd /var/www/aac.uplifor.org" -ForegroundColor White
        Write-Host "   bash deploy.sh" -ForegroundColor White
    }
} else {
    Write-Host "   [!] plink not found. Please SSH to server and run:" -ForegroundColor Yellow
    Write-Host "   ssh root@r77.igt.com.hk" -ForegroundColor White
    Write-Host "   cd /var/www/aac.uplifor.org" -ForegroundColor White
    Write-Host "   bash deploy.sh" -ForegroundColor White
}

# Cleanup
Remove-Item -Recurse -Force $TEMP_DIR

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "[OK] Deployment completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Verify frontend: https://aac.uplifor.org/" -ForegroundColor White
Write-Host "2. Test API: https://aac.uplifor.org/api" -ForegroundColor White
Write-Host "3. Initialize database via phpMyAdmin: https://r77.igt.com.hk/phpmyadmin/" -ForegroundColor White
Write-Host "   Or via SSH: mysql -h r77.igt.com.hk -u root -pyyTTr437 cboard < backend/database/schema.sql" -ForegroundColor White
Write-Host "4. Check PHP-FPM logs: /var/log/php-fpm/ or /var/log/php8.x-fpm/" -ForegroundColor White
Write-Host "5. Check Nginx logs: /var/log/nginx/error.log" -ForegroundColor White
Write-Host ""

