# Cleanup unnecessary files from server
# Usage: .\cleanup-server-files.ps1

$SERVER_HOST = "r77.igt.com.hk"
$SERVER_USER = "root"
$SERVER_PASS = "yyTTr437"
$SERVER_PATH = "/var/www/aac.uplifor.org"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Cleaning Up Unnecessary Files on Server" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "⚠️  This will remove unnecessary files from the server" -ForegroundColor Yellow
Write-Host "   Files to be removed:" -ForegroundColor Yellow
Write-Host "   - IDE files (.vscode, .idea, Welcome.*, welcome.ico, etc.)" -ForegroundColor White
Write-Host "   - Development scripts (*.ps1, setup-*.sh, fix-*.sh, etc.)" -ForegroundColor White
Write-Host "   - Test files and coverage reports" -ForegroundColor White
Write-Host "   - Temporary and cache files" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Continue? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🧹 Cleaning up server..." -ForegroundColor Cyan

$cleanupScript = @"
cd $SERVER_PATH

echo "=== Removing IDE files ==="
find . -type d -name ".vscode" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".idea" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".vs" -exec rm -rf {} + 2>/dev/null || true
find . -name "Welcome.*" -type f -delete 2>/dev/null || true
find . -name "welcome.ico" -type f -delete 2>/dev/null || true
find . -name "VisualStudio.png" -type f -delete 2>/dev/null || true

echo "=== Removing Visual Studio files ==="
find . -name "*.vsdir" -type f -delete 2>/dev/null || true
find . -name "*.vsz" -type f -delete 2>/dev/null || true
find . -name "*.vstemplate" -type f -delete 2>/dev/null || true
find . -name "*.vcxproj" -type f -delete 2>/dev/null || true
find . -name "*.vcxproj.filters" -type f -delete 2>/dev/null || true
find . -name "*.sln" -type f -delete 2>/dev/null || true
find . -name "*.suo" -type f -delete 2>/dev/null || true
find . -name "*.user" -type f -delete 2>/dev/null || true
find . -name "*.userosscache" -type f -delete 2>/dev/null || true
find . -name "*.sdf" -type f -delete 2>/dev/null || true
find . -name "*.opensdf" -type f -delete 2>/dev/null || true
find . -name "*.db" -type f -delete 2>/dev/null || true
find . -name "*.opendb" -type f -delete 2>/dev/null || true

echo "=== Removing Visual Studio debugger files ==="
find . -name "msvsmon.*" -type f -delete 2>/dev/null || true
find . -name "vsdebugeng.*" -type f -delete 2>/dev/null || true
find . -name "DiagnosticsHub.*" -type f -delete 2>/dev/null || true
find . -name "Microsoft.VisualStudio.*" -type f -delete 2>/dev/null || true
find . -name "System.*.dll" -type f -delete 2>/dev/null || true
find . -name "api-ms-win-*" -type f -delete 2>/dev/null || true
find . -name "vcruntime*.dll" -type f -delete 2>/dev/null || true
find . -name "msvcp*.dll" -type f -delete 2>/dev/null || true
find . -name "msvcdis*.dll" -type f -delete 2>/dev/null || true
find . -name "msdia*.dll" -type f -delete 2>/dev/null || true
find . -name "concrt*.dll" -type f -delete 2>/dev/null || true
find . -name "ucrtbase.dll" -type f -delete 2>/dev/null || true
find . -name "dbgshim.dll" -type f -delete 2>/dev/null || true
find . -name "*.pdb" -type f -delete 2>/dev/null || true
find . -name "*.manifest" -type f -delete 2>/dev/null || true
find . -type d -name "bin" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "obj" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "Debug" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "Release" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "x64" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "x86" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "ARM" -exec rm -rf {} + 2>/dev/null || true

echo "=== Removing development scripts ==="
find . -name "*.ps1" -type f -delete 2>/dev/null || true
find . -name "setup-*.sh" -type f -delete 2>/dev/null || true
find . -name "fix-*.sh" -type f -delete 2>/dev/null || true
find . -name "update-*.sh" -type f -delete 2>/dev/null || true
find . -name "start-*.sh" -type f -delete 2>/dev/null || true
find . -name "test-*.sh" -type f -delete 2>/dev/null || true
find . -name "cleanup-*.ps1" -type f -delete 2>/dev/null || true

echo "=== Removing test files ==="
find . -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "coverage" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name ".nyc_output" -exec rm -rf {} + 2>/dev/null || true
find . -name "*.test.js" -type f -delete 2>/dev/null || true
find . -name "*.test.ts" -type f -delete 2>/dev/null || true
find . -name "*.spec.js" -type f -delete 2>/dev/null || true
find . -name "*.spec.ts" -type f -delete 2>/dev/null || true

echo "=== Removing temporary files ==="
find . -name "*.tmp" -type f -delete 2>/dev/null || true
find . -name "*.bak" -type f -delete 2>/dev/null || true
find . -name "*.cache" -type f -delete 2>/dev/null || true
find . -name "*.swp" -type f -delete 2>/dev/null || true
find . -name "*.swo" -type f -delete 2>/dev/null || true
find . -name "*~" -type f -delete 2>/dev/null || true
find . -name ".DS_Store" -type f -delete 2>/dev/null || true
find . -name "Thumbs.db" -type f -delete 2>/dev/null || true

echo "=== Removing conversion scripts ==="
find . -name "convert-*.js" -type f -delete 2>/dev/null || true
find . -name "check-*.js" -type f -delete 2>/dev/null || true
find . -name "find-*.js" -type f -delete 2>/dev/null || true
find . -name "download-*.js" -type f -delete 2>/dev/null || true
find . -name "comprehensive-*.js" -type f -delete 2>/dev/null || true

echo "=== Removing OpenCC files ==="
find . -name "opencc-*.txt" -type f -delete 2>/dev/null || true
find . -name "opencc-*.json" -type f -delete 2>/dev/null || true
find . -name "s2t*.json" -type f -delete 2>/dev/null || true

echo "=== Removing log files ==="
find . -name "*.log" -type f -delete 2>/dev/null || true
find . -name "npm-debug.log*" -type f -delete 2>/dev/null || true
find . -name "yarn-debug.log*" -type f -delete 2>/dev/null || true
find . -name "yarn-error.log*" -type f -delete 2>/dev/null || true

echo ""
echo "=== Cleanup Summary ==="
echo "Remaining files count:"
find . -type f 2>/dev/null | wc -l
echo ""
echo "Disk space usage:"
du -sh . 2>/dev/null || du -sh /var/www/aac.uplifor.org 2>/dev/null || echo "Unable to check disk usage"
"@

# Convert Windows line endings to Unix (remove \r)
# First replace CRLF with LF, then any remaining CR with LF
$cleanupScriptUnix = $cleanupScript -replace "`r`n", "`n"
$cleanupScriptUnix = $cleanupScriptUnix -replace "`r", "`n"

if (Get-Command plink -ErrorAction SilentlyContinue) {
    $cleanupScriptUnix | & plink -pw $SERVER_PASS "${SERVER_USER}@${SERVER_HOST}" "bash -s"
} else {
    Write-Host "Please run manually:" -ForegroundColor Yellow
    Write-Host "ssh root@r77.igt.com.hk" -ForegroundColor White
    Write-Host "cd /var/www/aac.uplifor.org" -ForegroundColor White
    Write-Host "# Then run the cleanup commands above" -ForegroundColor White
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Cleanup completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

