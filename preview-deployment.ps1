# Preview what files will be uploaded (dry-run)
# Usage: .\preview-deployment.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Deployment Preview (Dry Run)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Read .deployignore if exists
$deployIgnore = @()
if (Test-Path ".deployignore") {
    $deployIgnore = Get-Content ".deployignore" | Where-Object { 
        $_ -notmatch '^\s*#' -and $_ -notmatch '^\s*$' 
    } | ForEach-Object { $_.Trim() }
    Write-Host "Using .deployignore file" -ForegroundColor Green
} else {
    Write-Host ".deployignore not found" -ForegroundColor Yellow
}

# Standard exclusions (same as deploy script)
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

Write-Host ""
Write-Host "Analyzing files..." -ForegroundColor Cyan

$allFiles = Get-ChildItem -Path . -Recurse -File
$filesToUpload = @()
$skippedFiles = @()
$totalSize = 0
$skippedSize = 0

foreach ($item in $allFiles) {
    $relativePath = $item.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/')
    $skip = $false
    $skipReason = ""
    
    # Check directories
    foreach ($excludeDir in $excludeDirs) {
        if ($relativePath -like "*$excludeDir/*" -or $relativePath.StartsWith("$excludeDir/")) {
            $skip = $true
            $skipReason = "Directory: $excludeDir"
            break
        }
    }
    
    # Check file patterns
    if (-not $skip) {
        foreach ($excludePattern in $excludeFiles) {
            if ($item.Name -like $excludePattern) {
                $skip = $true
                $skipReason = "Pattern: $excludePattern"
                break
            }
        }
    }
    
    # Additional checks
    if (-not $skip) {
        if ($item.Name -eq ".env") {
            $skip = $true
            $skipReason = ".env file"
        }
        elseif ($item.Extension -in @('.dll', '.exe', '.pdb', '.ilk', '.exp', '.lib', '.obj')) {
            $skip = $true
            $skipReason = "Windows binary: $($item.Extension)"
        }
        elseif ($item.Extension -in @('.vcxproj', '.sln', '.suo', '.user', '.vsdir', '.vsz', '.vstemplate')) {
            $skip = $true
            $skipReason = "Visual Studio file: $($item.Extension)"
        }
        elseif ($relativePath -match '[/\\](bin|obj|Debug|Release|x64|x86|ARM|\.vs)[/\\]') {
            $skip = $true
            $skipReason = "VS build directory"
        }
    }
    
    if ($skip) {
        $skippedFiles += [PSCustomObject]@{
            Path = $relativePath
            Size = $item.Length
            Reason = $skipReason
        }
        $skippedSize += $item.Length
    } else {
        $filesToUpload += [PSCustomObject]@{
            Path = $relativePath
            Size = $item.Length
        }
        $totalSize += $item.Length
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Files to upload: $($filesToUpload.Count)" -ForegroundColor Green
Write-Host "Total size: $([math]::Round($totalSize / 1MB, 2)) MB" -ForegroundColor Green
Write-Host ""
Write-Host "Files skipped: $($skippedFiles.Count)" -ForegroundColor Yellow
Write-Host "Skipped size: $([math]::Round($skippedSize / 1MB, 2)) MB" -ForegroundColor Yellow
Write-Host ""

if ($skippedFiles.Count -gt 0) {
    Write-Host "Top 20 skipped files (by size):" -ForegroundColor Cyan
    $skippedFiles | Sort-Object -Property Size -Descending | Select-Object -First 20 | ForEach-Object {
        $sizeKB = [math]::Round($_.Size / 1KB, 2)
        Write-Host "   [$sizeKB KB] $($_.Path) - $($_.Reason)" -ForegroundColor Gray
    }
    if ($skippedFiles.Count -gt 20) {
        Write-Host "   ... and $($skippedFiles.Count - 20) more files" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Sample files to upload (first 20):" -ForegroundColor Cyan
$filesToUpload | Select-Object -First 20 | ForEach-Object {
    $sizeKB = [math]::Round($_.Size / 1KB, 2)
    Write-Host "   [$sizeKB KB] $($_.Path)" -ForegroundColor White
}
if ($filesToUpload.Count -gt 20) {
    Write-Host "   ... and $($filesToUpload.Count - 20) more files" -ForegroundColor Gray
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Preview complete" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you see any unnecessary files in 'Files to upload'," -ForegroundColor Yellow
Write-Host "update .deployignore and run this preview again." -ForegroundColor Yellow
Write-Host ""
