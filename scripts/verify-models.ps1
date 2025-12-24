# Verify WebGazer Model Files
# Checks if model files exist and have correct sizes

$MODELS_DIR = "public\models"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Verifying WebGazer Model Files" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$models = @(
    @{ Name = "Facemesh"; Path = "$MODELS_DIR\facemesh"; Files = @("model.json", "group1-shard1of1.bin"); ExpectedSize = 2MB },
    @{ Name = "Iris"; Path = "$MODELS_DIR\iris"; Files = @("model.json", "group1-shard1of1.bin"); ExpectedSize = 1MB },
    @{ Name = "Blazeface"; Path = "$MODELS_DIR\blazeface"; Files = @("model.json", "group1-shard1of1.bin"); ExpectedSize = 1MB }
)

$allValid = $true

foreach ($model in $models) {
    Write-Host "[$($model.Name)]" -ForegroundColor Cyan
    $modelPath = $model.Path
    
    if (-not (Test-Path $modelPath)) {
        Write-Host "  ✗ Directory not found: $modelPath" -ForegroundColor Red
        $allValid = $false
        continue
    }
    
    foreach ($file in $model.Files) {
        $filePath = Join-Path $modelPath $file
        if (Test-Path $filePath) {
            $fileInfo = Get-Item $filePath
            $sizeKB = [math]::Round($fileInfo.Length / 1KB, 2)
            $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
            
            if ($fileInfo.Length -lt 10000) {
                Write-Host "  ✗ $file - Size: $sizeKB KB (TOO SMALL - should be ~$($model.ExpectedSize/1MB) MB)" -ForegroundColor Red
                $allValid = $false
            } else {
                Write-Host "  ✓ $file - Size: $sizeMB MB" -ForegroundColor Green
            }
        } else {
            Write-Host "  ✗ $file - NOT FOUND" -ForegroundColor Red
            $allValid = $false
        }
    }
    Write-Host ""
}

if ($allValid) {
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host " ✓ All model files are valid!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
} else {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host " ✗ Some model files are missing or invalid" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run the download script:" -ForegroundColor Yellow
    Write-Host "  .\scripts\download-webgazer-models.ps1" -ForegroundColor Yellow
}

