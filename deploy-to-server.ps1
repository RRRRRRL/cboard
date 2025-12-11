# PowerShell deployment script for aac.uplifor.org
# Usage: .\deploy-to-server.ps1

$ErrorActionPreference = "Stop"

$SERVER_HOST = "r77.igt.com.hk"
$SERVER_USER = "root"
$SERVER_PASS = "yyTTr437"
$SERVER_PATH = "/var/www/aac.uplifor.org"
$MYSQL_HOST = "r79.igt.com.hk"
$MYSQL_USER = "root"
$MYSQL_PASS = "yyTTr437"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Cboard Deployment to aac.uplifor.org" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found. Creating from .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✅ .env created. Please edit it with your values." -ForegroundColor Green
        Write-Host "   Required: DB_HOST, DB_PASS, JWT_SECRET" -ForegroundColor Yellow
        Read-Host "Press Enter after editing .env file"
    } else {
        Write-Host "❌ .env.example not found. Cannot proceed." -ForegroundColor Red
        exit 1
    }
}

# Check if PSCP (PuTTY SCP) is available, or use built-in SCP
$usePSCP = $false
if (Get-Command pscp -ErrorAction SilentlyContinue) {
    $usePSCP = $true
    Write-Host "✅ Found PSCP (PuTTY)" -ForegroundColor Green
} elseif (Get-Command scp -ErrorAction SilentlyContinue) {
    Write-Host "✅ Found SCP" -ForegroundColor Green
} else {
    Write-Host "⚠️  SCP not found. Please install:" -ForegroundColor Yellow
    Write-Host "   - OpenSSH (Windows 10+): Add-WindowsCapability -Online -Name OpenSSH.Client" -ForegroundColor White
    Write-Host "   - Or PuTTY: https://www.putty.org/" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "📦 Preparing deployment..." -ForegroundColor Cyan

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

Write-Host "   ✅ Files to upload: $($filesToCopy.Count)" -ForegroundColor Green
Write-Host "   ❌ Files skipped: $skippedCount ($([math]::Round($skippedSize / 1MB, 2)) MB)" -ForegroundColor Yellow

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
Write-Host "🔐 Uploading files to server..." -ForegroundColor Cyan

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
Write-Host "🚀 Deploying on server..." -ForegroundColor Cyan

# Create deployment script for server
$deployScript = @"
#!/bin/bash
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
    sed -i "s/DB_HOST=.*/DB_HOST=$MYSQL_HOST/" .env
    sed -i "s/DB_PASS=.*/DB_PASS=$MYSQL_PASS/" .env
    sed -i "s|REACT_APP_API_URL=.*|REACT_APP_API_URL=https://aac.uplifor.org/api|" .env
fi

echo "🗄️  Checking database..."
if mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASS -e "SELECT 1;" &> /dev/null; then
    echo "   ✅ MySQL connection successful"
    mysql -h $MYSQL_HOST -u $MYSQL_USER -p$MYSQL_PASS -e "CREATE DATABASE IF NOT EXISTS cboard;" 2>/dev/null || true
else
    echo "   ⚠️  Cannot connect to MySQL. Please check credentials."
fi

echo "🔨 Building Docker images..."
docker-compose -f docker-compose.production.yml build

echo "🚀 Starting services..."
docker-compose -f docker-compose.production.yml up -d

echo "⏳ Waiting for services to start..."
sleep 10

echo "📊 Service status:"
docker-compose -f docker-compose.production.yml ps

echo ""
echo "✅ Deployment complete!"
echo "   Frontend: https://aac.uplifor.org/"
echo "   API: https://aac.uplifor.org/api"
"@

# Save and upload deployment script
$deployScriptPath = Join-Path $TEMP_DIR "deploy.sh"
$deployScript | Out-File -FilePath $deployScriptPath -Encoding UTF8

# Upload and execute
if ($usePSCP) {
    & pscp -pw $SERVER_PASS "$deployScriptPath" "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/deploy.sh"
} else {
    & scp "$deployScriptPath" "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/deploy.sh"
}

# Execute deployment script
Write-Host "   Executing deployment script..." -ForegroundColor Gray
if (Get-Command plink -ErrorAction SilentlyContinue) {
    & plink -pw $SERVER_PASS "${SERVER_USER}@${SERVER_HOST}" "chmod +x ${SERVER_PATH}/deploy.sh && bash ${SERVER_PATH}/deploy.sh"
} else {
    Write-Host "   Please SSH to server and run:" -ForegroundColor Yellow
    Write-Host "   ssh root@r77.igt.com.hk" -ForegroundColor White
    Write-Host "   cd /var/www/aac.uplifor.org" -ForegroundColor White
    Write-Host "   bash deploy.sh" -ForegroundColor White
}

# Cleanup
Remove-Item -Recurse -Force $TEMP_DIR

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Verify: https://aac.uplifor.org/" -ForegroundColor White
Write-Host "2. Check logs: ssh root@r77.igt.com.hk 'cd /var/www/aac.uplifor.org && docker-compose logs -f'" -ForegroundColor White
Write-Host "3. Initialize database via phpMyAdmin: https://r79.igt.com.hk/phpmyadmin/" -ForegroundColor White
Write-Host ""

