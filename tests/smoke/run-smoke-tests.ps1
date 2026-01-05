# MetaServer Smoke Tests (Stage B)
# Run: .\run-smoke-tests.ps1

$BaseUrl = "http://localhost:3000"
$ErrorActionPreference = "Stop"

Write-Host "=== MetaServer Smoke Tests (Stage B) ===" -ForegroundColor Cyan

# 1. Health check
Write-Host "`n[1/11] Health check..." -ForegroundColor Yellow
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
Write-Host "`n[2/11] Get runtime config..." -ForegroundColor Yellow
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
Write-Host "`n[3/11] Authentication..." -ForegroundColor Yellow
try {
    $authBody = @{
        platformType = "dev"
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
Write-Host "`n[4/11] Get profile..." -ForegroundColor Yellow
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
Write-Host "`n[5/11] Update nickname..." -ForegroundColor Yellow
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

# 6. Wallet balance
Write-Host "`n[6/11] Wallet balance..." -ForegroundColor Yellow
try {
    $wallet = Invoke-RestMethod -Uri "$BaseUrl/api/v1/wallet/balance" `
        -Method Get `
        -Headers $headers

    if ($null -ne $wallet.softCurrency -and $null -ne $wallet.hardCurrency) {
        Write-Host "✓ Wallet balance passed (soft: $($wallet.softCurrency), hard: $($wallet.hardCurrency))" -ForegroundColor Green
    } else {
        throw "Wallet balance missing currencies"
    }
} catch {
    Write-Host "✗ Wallet balance failed: $_" -ForegroundColor Red
    exit 1
}

# 7. Matchmaking join
Write-Host "`n[7/11] Matchmaking join..." -ForegroundColor Yellow
try {
    $mmBody = @{
        rating = 1500
    } | ConvertTo-Json

    $mmResponse = Invoke-RestMethod -Uri "$BaseUrl/api/v1/matchmaking/join" `
        -Method Post `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $mmBody

    if ($mmResponse.success) {
        Write-Host "✓ Matchmaking join passed (position: $($mmResponse.queuePosition))" -ForegroundColor Green
    } else {
        throw "Matchmaking join failed"
    }
} catch {
    Write-Host "✗ Matchmaking join failed: $_" -ForegroundColor Red
    exit 1
}

# 8. Matchmaking status
Write-Host "`n[8/11] Matchmaking status..." -ForegroundColor Yellow
try {
    $mmStatus = Invoke-RestMethod -Uri "$BaseUrl/api/v1/matchmaking/status" `
        -Method Get `
        -Headers $headers

    if ($mmStatus.inQueue) {
        Write-Host "✓ Matchmaking status passed (in queue: $($mmStatus.inQueue))" -ForegroundColor Green
    } else {
        throw "User not in matchmaking queue"
    }
} catch {
    Write-Host "✗ Matchmaking status failed: $_" -ForegroundColor Red
    exit 1
}

# 9. Matchmaking cancel
Write-Host "`n[9/11] Matchmaking cancel..." -ForegroundColor Yellow
try {
    $cancelResponse = Invoke-RestMethod -Uri "$BaseUrl/api/v1/matchmaking/cancel" `
        -Method Post `
        -Headers $headers

    if ($cancelResponse.success) {
        Write-Host "✓ Matchmaking cancel passed" -ForegroundColor Green
    } else {
        throw "Matchmaking cancel failed"
    }
} catch {
    Write-Host "✗ Matchmaking cancel failed: $_" -ForegroundColor Red
    exit 1
}

# 10. Shop offers
Write-Host "`n[10/11] Shop offers..." -ForegroundColor Yellow
try {
    $offers = Invoke-RestMethod -Uri "$BaseUrl/api/v1/shop/offers" `
        -Method Get `
        -Headers $headers

    Write-Host "✓ Shop offers passed (offers: $($offers.offers.Count))" -ForegroundColor Green
} catch {
    Write-Host "✗ Shop offers failed: $_" -ForegroundColor Red
    exit 1
}

# 11. Idempotency test (repeat nickname update)
Write-Host "`n[11/11] Idempotency test (repeat nickname update)..." -ForegroundColor Yellow
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

Write-Host "`n=== All Stage B smoke tests passed! ===" -ForegroundColor Green
