@echo off
REM Jyutping Dictionary Import Script (Windows PowerShell wrapper)
REM 
REM Usage (from project root):
REM   powershell -File backend\scripts\import-jyutping-data.ps1 [OPTIONS]
REM
REM Options:
REM   -Truncate        Clear jyutping_dictionary before import
REM   -Verify          Show row count after import
REM   -Backup          Backup before import
REM   -Help            Show help
REM

param(
    [switch]$Truncate,
    [switch]$Verify,
    [switch]$Backup,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
Jyutping Dictionary Import Script

Usage:
  powershell -File backend\scripts\import-jyutping-data.ps1 [OPTIONS]

Options:
  -Truncate        Clear jyutping_dictionary before import (fresh start)
  -Verify          Show row count after import
  -Backup          Backup jyutping_dictionary before import
  -Help            Show this message

Examples:
  # Standard import (upsert, no truncate)
  powershell -File backend\scripts\import-jyutping-data.ps1

  # Clean rebuild with verification
  powershell -File backend\scripts\import-jyutping-data.ps1 -Truncate -Verify

  # Backup before import
  powershell -File backend\scripts\import-jyutping-data.ps1 -Backup -Verify
"@
    exit 0
}

$ProjectRoot = (Get-Item -Path $PSScriptRoot).Parent.Parent.FullName
$EnvFile = Join-Path $ProjectRoot "backend\.env"
$Importer = Join-Path $PSScriptRoot "seed-jyutping-from-multiple-csv.php"

Write-Host "[INFO] Jyutping Dictionary Import Tool"
Write-Host "[INFO] Project root: $ProjectRoot"

if (-not (Test-Path $Importer)) {
    Write-Error "Importer script not found: $Importer"
    exit 1
}

if (-not (Test-Path $EnvFile)) {
    Write-Error ".env file not found: $EnvFile"
    exit 1
}

# Parse .env
$env_vars = @{}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"', "'")
        $env_vars[$key] = $value
    }
}

$DB_HOST = $env_vars['DB_HOST']
$DB_USER = $env_vars['DB_USER']
$DB_PASS = $env_vars['DB_PASS']
$DB_NAME = $env_vars['DB_NAME']

if (-not $DB_HOST -or -not $DB_USER -or -not $DB_NAME) {
    Write-Error "Missing database credentials in .env file"
    exit 1
}

Write-Host "[INFO] Database: $DB_NAME @ $DB_HOST (user: $DB_USER)"

# Optional backup
if ($Backup) {
    Write-Host "[INFO] Creating backup..."
    $BackupDir = Join-Path $ProjectRoot "backend\database\backups"
    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir | Out-Null
    }
    $BackupFile = Join-Path $BackupDir "jyutping_dictionary_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
    
    $Query = "SELECT * FROM jyutping_dictionary;"
    $ExportCmd = "mysql -h `"$DB_HOST`" -u `"$DB_USER`" -p`"$DB_PASS`" `"$DB_NAME`" -e `"$Query`" > `"$BackupFile`""
    Invoke-Expression $ExportCmd 2>$null
    
    Write-Host "[SUCCESS] Backup saved: $BackupFile"
}

# Build importer command
$Cmd = "php `"$Importer`""
if ($Truncate) {
    Write-Host "[INFO] Truncate flag set: will clear table before import"
    $Cmd += " --truncate"
}

Write-Host ""
Write-Host "[INFO] Running Jyutping importer..."
Write-Host "[INFO] CSVs: jyutping_cc-canto.csv, jyutping_pycantonese_input.csv, jyutping_pycantonese_input_from_boards.csv"
Write-Host ""

# Run importer
Push-Location $ProjectRoot
Invoke-Expression $Cmd
Pop-Location

# Verify results
if ($Verify) {
    Write-Host ""
    Write-Host "[INFO] Verification..."
    $Query = "SELECT COUNT(*) FROM jyutping_dictionary;"
    $CountCmd = "mysql -h `"$DB_HOST`" -u `"$DB_USER`" -p`"$DB_PASS`" `"$DB_NAME`" -N -e `"$Query`""
    $Count = Invoke-Expression $CountCmd
    Write-Host "[SUCCESS] Total entries in jyutping_dictionary: $Count"
}

Write-Host "[SUCCESS] Import completed!"
