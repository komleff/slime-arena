# Stage D Integration Tests Runner
# Run: .\tests\smoke\run-stage-d.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Stage D: Full Flow Integration Tests ===" -ForegroundColor Cyan
Write-Host ""

# Check if MetaServer is running
$BaseUrl = $env:META_URL
if (-not $BaseUrl) {
    $BaseUrl = "http://localhost:3000"
}

Write-Host "Target: $BaseUrl" -ForegroundColor Gray

try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get -TimeoutSec 5
    if ($health.status -ne "ok") {
        Write-Host "MetaServer not healthy: $($health.status)" -ForegroundColor Red
        exit 1
    }
    Write-Host "MetaServer is healthy" -ForegroundColor Green
} catch {
    Write-Host "Cannot connect to MetaServer at $BaseUrl" -ForegroundColor Red
    Write-Host "Make sure MetaServer is running: npm run meta:dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Run Stage C tests first
Write-Host "[1/3] Running Stage C tests..." -ForegroundColor Yellow
try {
    $stageC = & npx tsx server/tests/meta-stage-c.test.ts 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Stage C tests failed:" -ForegroundColor Red
        Write-Host $stageC
        exit 1
    }
    Write-Host "Stage C tests passed" -ForegroundColor Green
} catch {
    Write-Host "Stage C tests error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Run Stage D tests
Write-Host "[2/3] Running Stage D tests..." -ForegroundColor Yellow
try {
    $stageD = & npx tsx server/tests/meta-stage-d.test.ts 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Stage D tests failed:" -ForegroundColor Red
        Write-Host $stageD
        exit 1
    }
    Write-Host "Stage D tests passed" -ForegroundColor Green
} catch {
    Write-Host "Stage D tests error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Run Stage B PowerShell tests
Write-Host "[3/3] Running Stage B PowerShell tests..." -ForegroundColor Yellow
try {
    Push-Location "tests/smoke"
    & .\run-smoke-tests.ps1
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Write-Host "Stage B tests failed" -ForegroundColor Red
        exit 1
    }
    Pop-Location
    Write-Host "Stage B tests passed" -ForegroundColor Green
} catch {
    Pop-Location
    Write-Host "Stage B tests error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== All Stage D Integration Tests Passed! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run load tests: k6 run tests/load/soft-launch.js" -ForegroundColor Gray
Write-Host "  2. Verify p99 < 2000ms, errors < 1%" -ForegroundColor Gray
