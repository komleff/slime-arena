# Smoke Tests for MetaServer

Simple smoke tests for critical API endpoints.

## Prerequisites

- MetaServer running on http://localhost:3000
- PostgreSQL and Redis available

## Running Tests

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok", ...}`

### 2. Get Runtime Config

```bash
curl http://localhost:3000/api/v1/config/runtime
```

Expected: Config with `configVersion`, `features`, etc.

### 3. Auth - Verify and Get Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"platformType":"standalone","platformAuthToken":"testuser123:TestPlayer"}'
```

Expected: `{"accessToken":"...", "userId":"...", ...}`

Save the `accessToken` for next requests.

### 4. Get Profile (requires auth token from step 3)

```bash
curl http://localhost:3000/api/v1/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

Expected: Profile with nickname, level, xp, wallet

### 5. Update Nickname (requires auth token)

```bash
curl -X POST http://localhost:3000/api/v1/profile/nickname \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"NewName","operationId":"test-op-001"}'
```

Expected: Updated profile with new nickname

### 6. Idempotency Test - Repeat nickname update

```bash
curl -X POST http://localhost:3000/api/v1/profile/nickname \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"NewName","operationId":"test-op-001"}'
```

Expected: Same result as step 5 (no duplicate transaction)

## Automated Test Script

```bash
# Save this as tests/smoke/run-smoke-tests.sh

#!/bin/bash
set -e

BASE_URL="http://localhost:3000"

echo "=== MetaServer Smoke Tests ==="

# 1. Health check
echo -e "\n[1/6] Health check..."
curl -s $BASE_URL/health | grep -q "ok" && echo "✓ Health check passed" || (echo "✗ Health check failed" && exit 1)

# 2. Get config
echo -e "\n[2/6] Get runtime config..."
curl -s $BASE_URL/api/v1/config/runtime | grep -q "configVersion" && echo "✓ Config endpoint passed" || (echo "✗ Config endpoint failed" && exit 1)

# 3. Auth
echo -e "\n[3/6] Authentication..."
AUTH_RESPONSE=$(curl -s -X POST $BASE_URL/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"platformType":"standalone","platformAuthToken":"smoketest:SmokeTestUser"}')

echo "$AUTH_RESPONSE" | grep -q "accessToken" && echo "✓ Auth passed" || (echo "✗ Auth failed" && exit 1)

ACCESS_TOKEN=$(echo $AUTH_RESPONSE | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')
USER_ID=$(echo $AUTH_RESPONSE | grep -o '"userId":"[^"]*' | grep -o '[^"]*$')

echo "  User ID: $USER_ID"

# 4. Get profile
echo -e "\n[4/6] Get profile..."
curl -s $BASE_URL/api/v1/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN" | grep -q "nickname" && echo "✓ Profile endpoint passed" || (echo "✗ Profile endpoint failed" && exit 1)

# 5. Update nickname
echo -e "\n[5/6] Update nickname..."
curl -s -X POST $BASE_URL/api/v1/profile/nickname \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"SmokeTester","operationId":"smoke-test-001"}' | grep -q "SmokeTester" && echo "✓ Nickname update passed" || (echo "✗ Nickname update failed" && exit 1)

# 6. Idempotency test
echo -e "\n[6/6] Idempotency test (repeat nickname update)..."
curl -s -X POST $BASE_URL/api/v1/profile/nickname \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"SmokeTester","operationId":"smoke-test-001"}' | grep -q "SmokeTester" && echo "✓ Idempotency passed" || (echo "✗ Idempotency failed" && exit 1)

echo -e "\n=== All smoke tests passed! ==="
```

Make it executable:
```bash
chmod +x tests/smoke/run-smoke-tests.sh
```

Run:
```bash
./tests/smoke/run-smoke-tests.sh
```
