# PowerShell script to check all errors on the server
# This script uploads and runs the diagnostic script

param(
    [string]$Server = "r77.igt.com.hk",
    [string]$User = "root",
    [string]$Password = "yyTTr437"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Cboard Server Error Diagnostic Tool" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if required tools are available
if (-not (Get-Command plink -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] plink (PuTTY) is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install PuTTY or add it to your PATH" -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command pscp -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] pscp (PuTTY) is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install PuTTY or add it to your PATH" -ForegroundColor Yellow
    exit 1
}

# Upload diagnostic script
Write-Host "Uploading diagnostic script..." -ForegroundColor Yellow
& pscp -pw $Password "diagnose-all-errors.sh" "${User}@${Server}:/tmp/diagnose-all.sh" 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to upload diagnostic script" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Diagnostic script uploaded" -ForegroundColor Green
Write-Host ""

# Run diagnostic script
Write-Host "Running diagnostic script on server..." -ForegroundColor Yellow
Write-Host ""

plink -pw $Password "${User}@${Server}" "chmod +x /tmp/diagnose-all.sh && bash /tmp/diagnose-all.sh"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Diagnostic complete!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

