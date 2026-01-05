# MetaServer Smoke Tests
# Run: .\run-smoke-tests.ps1

$BaseUrl = "http://localhost:3000"
$ErrorActionPreference = "Stop"

Write-Host "=== MetaServer Smoke Tests ===" -ForegroundColor Cyan

# 1. Health check
Write-Host "`n[1/6] Health check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
    if ($response.status -eq "ok") {
        Write-Host "✓ Health check passed" -ForegroundColor Green
    } else {
        throw "Health check returned unexpected status"
    }
} catch {
    Write-Host "✗ Health check failed: $_" -ForegroundColor Red
    exit 1
}

# 2. Get config
Write-Host "`n[2/6] Get runtime config..." -ForegroundColor Yellow
try {
    $config = Invoke-RestMethod -Uri "$BaseUrl/api/v1/config/runtime" -Method Get
    if ($config.configVersion) {
        Write-Host "✓ Config endpoint passed (version: $($config.configVersion))" -ForegroundColor Green
    } else {
        throw "Config missing configVersion"
    }
} catch {
    Write-Host "✗ Config endpoint failed: $_" -ForegroundColor Red
    exit 1
}

# 3. Auth
Write-Host "`n[3/6] Authentication..." -ForegroundColor Yellow
try {
    $authBody = @{
        platformType = "standalone"
        platformAuthToken = "smoketest:SmokeTestUser"
    } | ConvertTo-Json

    $authResponse = Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/verify" `
        -Method Post `
        -ContentType "application/json" `
        -Body $authBody

    if ($authResponse.accessToken) {
        Write-Host "✓ Auth passed" -ForegroundColor Green
        $accessToken = $authResponse.accessToken
        $userId = $authResponse.userId
        Write-Host "  User ID: $userId" -ForegroundColor Gray
    } else {
        throw "Auth response missing accessToken"
    }
} catch {
    Write-Host "✗ Auth failed: $_" -ForegroundColor Red
    exit 1
}

# 4. Get profile
Write-Host "`n[4/6] Get profile..." -ForegroundColor Yellow
try {
    $headers = @{
        Authorization = "Bearer $accessToken"
    }
    
    $profile = Invoke-RestMethod -Uri "$BaseUrl/api/v1/profile" `
        -Method Get `
        -Headers $headers

    if ($profile.nickname) {
        Write-Host "✓ Profile endpoint passed (nickname: $($profile.nickname))" -ForegroundColor Green
    } else {
        throw "Profile missing nickname"
    }
} catch {
    Write-Host "✗ Profile endpoint failed: $_" -ForegroundColor Red
    exit 1
}

# 5. Update nickname
Write-Host "`n[5/6] Update nickname..." -ForegroundColor Yellow
try {
    $updateBody = @{
        nickname = "SmokeTester"
        operationId = "smoke-test-001"
    } | ConvertTo-Json

    $updatedProfile = Invoke-RestMethod -Uri "$BaseUrl/api/v1/profile/nickname" `
        -Method Post `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $updateBody

    if ($updatedProfile.nickname -eq "SmokeTester") {
        Write-Host "✓ Nickname update passed" -ForegroundColor Green
    } else {
        throw "Nickname not updated correctly"
    }
} catch {
    Write-Host "✗ Nickname update failed: $_" -ForegroundColor Red
    exit 1
}

# 6. Idempotency test
Write-Host "`n[6/6] Idempotency test (repeat nickname update)..." -ForegroundColor Yellow
try {
    $idempotentProfile = Invoke-RestMethod -Uri "$BaseUrl/api/v1/profile/nickname" `
        -Method Post `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $updateBody

    if ($idempotentProfile.nickname -eq "SmokeTester") {
        Write-Host "✓ Idempotency passed" -ForegroundColor Green
    } else {
        throw "Idempotency test failed"
    }
} catch {
    Write-Host "✗ Idempotency failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== All smoke tests passed! ===" -ForegroundColor Green
