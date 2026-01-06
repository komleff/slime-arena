# PostgreSQL Backup Script for Slime Arena
# Run: .\scripts\backup.ps1

param(
    [string]$OutputDir = "backups"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Slime Arena PostgreSQL Backup ===" -ForegroundColor Cyan
Write-Host ""

# Load environment variables from .env if exists
$envFile = ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Database connection parameters (with defaults)
$PGHOST = if ($env:PGHOST) { $env:PGHOST } else { "localhost" }
$PGPORT = if ($env:PGPORT) { $env:PGPORT } else { "5432" }
$PGUSER = if ($env:PGUSER) { $env:PGUSER } else { "slime" }
$PGDATABASE = if ($env:PGDATABASE) { $env:PGDATABASE } else { "slime_arena" }
$PGPASSWORD = $env:PGPASSWORD

if (-not $PGPASSWORD) {
    Write-Host "Warning: PGPASSWORD not set. You may be prompted for password." -ForegroundColor Yellow
}

# Set PGPASSWORD for pg_dump
$env:PGPASSWORD = $PGPASSWORD

# Create output directory if not exists
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "Created directory: $OutputDir" -ForegroundColor Gray
}

# Generate backup filename with timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $OutputDir "slime_arena_$timestamp.dump"

Write-Host "Host:     $PGHOST`:$PGPORT" -ForegroundColor Gray
Write-Host "Database: $PGDATABASE" -ForegroundColor Gray
Write-Host "User:     $PGUSER" -ForegroundColor Gray
Write-Host "Output:   $backupFile" -ForegroundColor Gray
Write-Host ""

# Check if pg_dump is available
try {
    $pgDumpVersion = & pg_dump --version 2>&1
    Write-Host "Using: $pgDumpVersion" -ForegroundColor Gray
} catch {
    Write-Host "Error: pg_dump not found. Install PostgreSQL client tools." -ForegroundColor Red
    Write-Host "  Windows: choco install postgresql" -ForegroundColor Yellow
    Write-Host "  Or download from: https://www.postgresql.org/download/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Starting backup..." -ForegroundColor Yellow

# Run pg_dump with custom format (compressed, supports parallel restore)
try {
    $startTime = Get-Date

    & pg_dump `
        --host=$PGHOST `
        --port=$PGPORT `
        --username=$PGUSER `
        --dbname=$PGDATABASE `
        --format=custom `
        --verbose `
        --file=$backupFile `
        2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE"
    }

    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds

    # Get file info
    $fileInfo = Get-Item $backupFile
    $sizeKB = [math]::Round($fileInfo.Length / 1KB, 2)
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)

    # Calculate checksum
    $hash = Get-FileHash -Path $backupFile -Algorithm SHA256
    $checksum = $hash.Hash.Substring(0, 16)

    Write-Host ""
    Write-Host "=== Backup Complete ===" -ForegroundColor Green
    Write-Host "File:     $backupFile" -ForegroundColor White
    Write-Host "Size:     $sizeMB MB ($sizeKB KB)" -ForegroundColor White
    Write-Host "Duration: $([math]::Round($duration, 2)) seconds" -ForegroundColor White
    Write-Host "Checksum: $checksum... (SHA256)" -ForegroundColor White
    Write-Host ""
    Write-Host "To restore: .\scripts\restore.ps1 -BackupFile `"$backupFile`"" -ForegroundColor Cyan

} catch {
    Write-Host ""
    Write-Host "Backup failed: $_" -ForegroundColor Red

    # Clean up partial backup
    if (Test-Path $backupFile) {
        Remove-Item $backupFile -Force
        Write-Host "Removed partial backup file" -ForegroundColor Gray
    }

    exit 1
}
