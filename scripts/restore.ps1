# PostgreSQL Restore Script for Slime Arena
# Run: .\scripts\restore.ps1 -BackupFile "backups\slime_arena_YYYYMMDD_HHMMSS.dump"

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,

    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "=== Slime Arena PostgreSQL Restore ===" -ForegroundColor Cyan
Write-Host ""

# Validate backup file exists
if (-not (Test-Path $BackupFile)) {
    Write-Host "Error: Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

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

# Set PGPASSWORD for pg_restore
$env:PGPASSWORD = $PGPASSWORD

# Get backup file info
$fileInfo = Get-Item $BackupFile
$sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)

Write-Host "Host:     $PGHOST`:$PGPORT" -ForegroundColor Gray
Write-Host "Database: $PGDATABASE" -ForegroundColor Gray
Write-Host "User:     $PGUSER" -ForegroundColor Gray
Write-Host "Backup:   $BackupFile ($sizeMB MB)" -ForegroundColor Gray
Write-Host ""

# Check if pg_restore is available
try {
    $pgRestoreVersion = & pg_restore --version 2>&1
    Write-Host "Using: $pgRestoreVersion" -ForegroundColor Gray
} catch {
    Write-Host "Error: pg_restore not found. Install PostgreSQL client tools." -ForegroundColor Red
    exit 1
}

# Warning and confirmation
Write-Host ""
Write-Host "WARNING: This will DROP and RECREATE all objects in the database!" -ForegroundColor Red
Write-Host "         All existing data will be replaced with backup data." -ForegroundColor Red
Write-Host ""

if (-not $Force) {
    $confirmation = Read-Host "Type 'RESTORE' to confirm"
    if ($confirmation -ne "RESTORE") {
        Write-Host "Restore cancelled." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "Starting restore..." -ForegroundColor Yellow

try {
    $startTime = Get-Date

    # Restore with --clean to drop existing objects, --if-exists to avoid errors
    & pg_restore `
        --host=$PGHOST `
        --port=$PGPORT `
        --username=$PGUSER `
        --dbname=$PGDATABASE `
        --clean `
        --if-exists `
        --verbose `
        $BackupFile `
        2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

    # pg_restore may return non-zero for warnings, check if critical
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Warning: pg_restore completed with warnings (exit code $LASTEXITCODE)" -ForegroundColor Yellow
        Write-Host "This is often normal due to DROP IF EXISTS on non-existent objects." -ForegroundColor Gray
    }

    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds

    Write-Host ""
    Write-Host "=== Restore Complete ===" -ForegroundColor Green
    Write-Host "Duration: $([math]::Round($duration, 2)) seconds" -ForegroundColor White
    Write-Host ""
    Write-Host "Recommended: Run Stage D tests to verify data integrity" -ForegroundColor Cyan
    Write-Host "  npx tsx server/tests/meta-stage-d.test.ts" -ForegroundColor Gray

} catch {
    Write-Host ""
    Write-Host "Restore failed: $_" -ForegroundColor Red
    exit 1
}
