# Download WebGazer TensorFlow.js Models for Self-Hosting (PowerShell)
# This script downloads the required models from TensorFlow Hub and saves them locally
# to avoid CORS issues when loading from external URLs

$ErrorActionPreference = "Stop"

$MODELS_DIR = "public\models"
$FACEMESH_DIR = "$MODELS_DIR\facemesh"
$IRIS_DIR = "$MODELS_DIR\iris"
$BLAZEFACE_DIR = "$MODELS_DIR\blazeface"

# Create directories
New-Item -ItemType Directory -Force -Path $FACEMESH_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $IRIS_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $BLAZEFACE_DIR | Out-Null

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Downloading WebGazer TensorFlow Models" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Function to download a file
function Download-File {
    param(
        [string]$Url,
        [string]$Output
    )
    
    Write-Host "Downloading: $Url" -ForegroundColor Gray
    Write-Host "  -> $Output" -ForegroundColor Gray
    
    try {
        # Use Invoke-WebRequest with proper headers to avoid getting HTML error pages
        $response = Invoke-WebRequest -Uri $Url -OutFile $Output -UseBasicParsing -ErrorAction Stop
        
        if (Test-Path $Output) {
            $fileInfo = Get-Item $Output
            $sizeKB = [math]::Round($fileInfo.Length / 1KB, 2)
            $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
            
            # Check if file is too small (likely an error page)
            if ($fileInfo.Length -lt 10000) {
                Write-Host "  ⚠ Downloaded file is too small ($sizeKB KB) - may be an error page" -ForegroundColor Yellow
                Write-Host "    Checking file content..." -ForegroundColor Gray
                $content = Get-Content $Output -Raw -ErrorAction SilentlyContinue
                if ($content -and $content.Contains('<!DOCTYPE html>')) {
                    Write-Host "  ✗ File appears to be an HTML error page, not a model file" -ForegroundColor Red
                    Remove-Item $Output -Force
                    Write-Host "    Try accessing the URL directly in a browser to verify it's accessible" -ForegroundColor Yellow
                    return $false
                }
            }
            
            Write-Host "  ✓ Downloaded successfully ($sizeMB MB)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ✗ Download failed - file not found" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "  ✗ Download failed: $_" -ForegroundColor Red
        if (Test-Path $Output) {
            Remove-Item $Output -Force -ErrorAction SilentlyContinue
        }
        return $false
    }
}

# Download Facemesh model
Write-Host "[1/3] Downloading Facemesh model..." -ForegroundColor Cyan
$FACEMESH_BASE = "https://tfhub.dev/mediapipe/tfjs-model/facemesh/1/default/1"
$result1 = Download-File -Url "$FACEMESH_BASE/model.json" -Output "$FACEMESH_DIR\model.json"
$result2 = Download-File -Url "$FACEMESH_BASE/group1-shard1of1.bin" -Output "$FACEMESH_DIR\group1-shard1of1.bin"
if (-not $result1 -or -not $result2) {
    Write-Host "  ⚠ Facemesh model download had issues - you may need to download manually" -ForegroundColor Yellow
}

# Download Iris model
Write-Host "[2/3] Downloading Iris model..." -ForegroundColor Cyan
$IRIS_BASE = "https://tfhub.dev/mediapipe/tfjs-model/iris/1/default/2"
$result1 = Download-File -Url "$IRIS_BASE/model.json" -Output "$IRIS_DIR\model.json"
$result2 = Download-File -Url "$IRIS_BASE/group1-shard1of1.bin" -Output "$IRIS_DIR\group1-shard1of1.bin"
if (-not $result1 -or -not $result2) {
    Write-Host "  ⚠ Iris model download had issues - you may need to download manually" -ForegroundColor Yellow
}

# Download Blazeface model (used by face-landmarks-detection)
Write-Host "[3/3] Downloading Blazeface model..." -ForegroundColor Cyan
$BLAZEFACE_BASE = "https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1"
$result1 = Download-File -Url "$BLAZEFACE_BASE/model.json" -Output "$BLAZEFACE_DIR\model.json"
$result2 = Download-File -Url "$BLAZEFACE_BASE/group1-shard1of1.bin" -Output "$BLAZEFACE_DIR\group1-shard1of1.bin"
if (-not $result1 -or -not $result2) {
    Write-Host "  ⚠ Blazeface model download had issues - you may need to download manually" -ForegroundColor Yellow
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " ✓ All models downloaded successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Models are now available at:" -ForegroundColor Gray
Write-Host "  - $FACEMESH_DIR\" -ForegroundColor Gray
Write-Host "  - $IRIS_DIR\" -ForegroundColor Gray
Write-Host "  - $BLAZEFACE_DIR\" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Update WebGazer initialization to use local model URLs"
Write-Host "  2. Restart the development server"
Write-Host ""

