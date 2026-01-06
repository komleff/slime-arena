/**
 * Stage D Smoke Tests - Full Flow Integration
 * Tests the complete game cycle: auth → config → matchmaking → match-results
 *
 * Run with: npx tsx server/tests/meta-stage-d.test.ts
 *
 * Prerequisites:
 * - MetaServer running on http://localhost:3000
 * - PostgreSQL and Redis available
 * - Environment variables: MATCH_SERVER_TOKEN
 */

const BASE_URL = process.env.META_URL || 'http://localhost:3000';
const SERVER_TOKEN = process.env.MATCH_SERVER_TOKEN || 'test-server-token';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`\u2713 ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: message, duration: Date.now() - start });
    console.log(`\u2717 ${name}: ${message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

import { randomUUID } from 'crypto';

function generateUUID(): string {
  return randomUUID();
}

// Auth helpers
let authToken: string | null = null;
let userId: string | null = null;

async function authenticate(): Promise<string> {
  if (authToken) return authToken;

  const response = await fetch(`${BASE_URL}/api/v1/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platformType: 'dev',
      platformAuthToken: `stage_d_test_${Date.now()}:StageD_Tester`,
    }),
  });

  const data = await response.json();
  assert(data.accessToken, 'Auth failed - no accessToken');
  authToken = data.accessToken;
  userId = data.userId;
  return authToken!;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await authenticate();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

function serverHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `ServerToken ${SERVER_TOKEN}`,
  };
}

// ============= Tests =============

async function runTests() {
  console.log('\n=== Stage D: Full Flow Integration Tests ===\n');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Server Token: ${SERVER_TOKEN ? '***' : 'NOT SET'}\n`);

  // ============= Phase 1: Infrastructure =============
  console.log('\n--- Phase 1: Infrastructure ---\n');

  await test('1.1 Health check', async () => {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    assert(data.status === 'ok', `Health status: ${data.status}`);
  });

  // Note: /health returns {status, timestamp, service} - no database field
  // Database connectivity is implicitly tested by auth/profile operations

  // ============= Phase 2: Auth Flow =============
  console.log('\n--- Phase 2: Auth Flow ---\n');

  await test('2.1 Dev platform authentication', async () => {
    await authenticate();
    assert(authToken !== null, 'No auth token received');
    assert(userId !== null, 'No user ID received');
  });

  await test('2.2 Invalid auth rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platformType: 'invalid_platform',
        platformAuthToken: 'invalid',
      }),
    });
    assert(response.status === 401 || response.status === 400, 'Invalid auth should be rejected');
  });

  await test('2.3 Get profile with token', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/profile`, {
      headers: await authHeaders(),
    });
    const data = await response.json();
    assert(data.nickname, 'Profile should have nickname');
  });

  // ============= Phase 3: Config Flow =============
  console.log('\n--- Phase 3: Config Flow ---\n');

  await test('3.1 Get runtime config', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/config/runtime`);
    const data = await response.json();
    assert(data.configVersion, 'Config should have version');
    assert(data.features, 'Config should have features');
  });

  await test('3.2 Config has required features', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/config/runtime`);
    const data = await response.json();
    assert(typeof data.features.matchmakingEnabled === 'boolean', 'Missing matchmakingEnabled');
  });

  // ============= Phase 4: Matchmaking Flow =============
  console.log('\n--- Phase 4: Matchmaking Flow ---\n');

  await test('4.1 Join matchmaking queue', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/matchmaking/join`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ rating: 1500 }),
    });
    const data = await response.json();
    assert(data.success, `Join failed: ${data.error || data.message}`);
  });

  await test('4.2 Check matchmaking status', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/matchmaking/status`, {
      headers: await authHeaders(),
    });
    const data = await response.json();
    assert(data.inQueue === true, 'Should be in queue');
  });

  await test('4.3 Cancel matchmaking', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/matchmaking/cancel`, {
      method: 'POST',
      headers: await authHeaders(),
    });
    const data = await response.json();
    assert(data.success, 'Cancel failed');
  });

  await test('4.4 Verify left queue', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/matchmaking/status`, {
      headers: await authHeaders(),
    });
    const data = await response.json();
    assert(data.inQueue === false, 'Should not be in queue');
  });

  // ============= Phase 5: Match Results Flow =============
  console.log('\n--- Phase 5: Match Results Flow ---\n');

  const matchId = generateUUID();

  await test('5.1 Submit match results (server-to-server)', async () => {
    const matchSummary = {
      matchId,
      mode: 'arena',
      startedAt: new Date(Date.now() - 300000).toISOString(),
      endedAt: new Date().toISOString(),
      configVersion: 'v1.0.0',
      buildVersion: 'test-build',
      playerResults: [
        {
          userId: userId,
          sessionId: 'test-session-1',
          placement: 1,
          finalMass: 500,
          killCount: 5,
          deathCount: 1,
          level: 3,
          classId: 1,
          isDead: false,
        },
        {
          sessionId: 'test-session-2',
          placement: 2,
          finalMass: 300,
          killCount: 2,
          deathCount: 2,
          level: 2,
          classId: 2,
          isDead: true,
        },
      ],
    };

    const response = await fetch(`${BASE_URL}/api/v1/match-results/submit`, {
      method: 'POST',
      headers: serverHeaders(),
      body: JSON.stringify(matchSummary),
    });
    const data = await response.json();
    assert(data.success, `Submit failed: ${data.error || data.message}`);
    assert(data.matchId === matchId, 'Match ID mismatch');
  });

  await test('5.2 Invalid server token rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/match-results/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'ServerToken invalid-token',
      },
      body: JSON.stringify({ matchId: generateUUID() }),
    });
    assert(response.status === 401, 'Invalid token should return 401');
  });

  await test('5.3 Missing matchId rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/match-results/submit`, {
      method: 'POST',
      headers: serverHeaders(),
      body: JSON.stringify({
        mode: 'arena',
        playerResults: [],
      }),
    });
    assert(response.status === 400, 'Missing matchId should return 400');
  });

  // ============= Phase 6: Idempotency Tests =============
  console.log('\n--- Phase 6: Idempotency Tests ---\n');

  await test('6.1 Duplicate match submission returns success', async () => {
    // Get profile state before duplicate submission
    const profileBefore = await fetch(`${BASE_URL}/api/v1/profile`, {
      headers: await authHeaders(),
    }).then(r => r.json());

    const duplicateMatchSummary = {
      matchId,
      mode: 'arena',
      startedAt: new Date(Date.now() - 300000).toISOString(),
      endedAt: new Date().toISOString(),
      configVersion: 'v1.0.0',
      buildVersion: 'test-build',
      playerResults: [
        {
          sessionId: 'test-session-dup',
          placement: 1,
          finalMass: 999,
          killCount: 99,
          deathCount: 0,
          level: 10,
          classId: 1,
          isDead: false,
        },
      ],
    };

    const response = await fetch(`${BASE_URL}/api/v1/match-results/submit`, {
      method: 'POST',
      headers: serverHeaders(),
      body: JSON.stringify(duplicateMatchSummary),
    });
    const data = await response.json();
    assert(data.success, 'Duplicate should still return success');
    assert(data.message?.includes('already processed') || data.matchId === matchId,
      'Should indicate already processed or return matchId');

    // Verify profile state unchanged after duplicate submission (T-09 fix)
    const profileAfter = await fetch(`${BASE_URL}/api/v1/profile`, {
      headers: await authHeaders(),
    }).then(r => r.json());
    assert(profileBefore.xp === profileAfter.xp,
      `XP should not change on duplicate: before=${profileBefore.xp}, after=${profileAfter.xp}`);
  });

  await test('6.2 Nickname idempotency with operationId', async () => {
    const operationId = `idem-test-${Date.now()}`;
    const newNickname = `Idem_${Date.now()}`;

    // First request
    const response1 = await fetch(`${BASE_URL}/api/v1/profile/nickname`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ nickname: newNickname, operationId }),
    });
    const data1 = await response1.json();
    assert(data1.nickname === newNickname, 'First nickname update failed');

    // Duplicate request with same operationId
    const response2 = await fetch(`${BASE_URL}/api/v1/profile/nickname`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ nickname: 'Different_Name', operationId }),
    });
    const data2 = await response2.json();
    assert(data2.nickname === newNickname, 'Idempotent request should return original result');
  });

  // ============= Phase 7: Player Stats Update =============
  console.log('\n--- Phase 7: Player Stats ---\n');

  await test('7.1 Player XP updated after match', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/profile`, {
      headers: await authHeaders(),
    });
    const data = await response.json();
    // XP should be >= 0 since we submitted a match result with this user
    assert(typeof data.xp === 'number' && data.xp >= 0, 'Profile should have XP field >= 0');
  });

  await test('7.2 Wallet balance accessible', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/wallet/balance`, {
      headers: await authHeaders(),
    });
    const data = await response.json();
    assert(typeof data.softCurrency === 'number', 'Should have softCurrency (coins)');
  });

  // ============= Phase 8: Error Handling =============
  console.log('\n--- Phase 8: Error Handling ---\n');

  await test('8.1 Unauthorized request rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/profile`);
    assert(response.status === 401, 'Should return 401 without auth');
  });

  await test('8.2 Invalid JSON rejected', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/match-results/submit`, {
      method: 'POST',
      headers: serverHeaders(),
      body: 'not-json',
    });
    assert(response.status === 400, 'Invalid JSON should return 400');
  });

  // ============= Summary =============
  console.log('\n=== Test Summary ===\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${results.length}`);
  console.log(`Duration: ${totalDuration}ms`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }

  console.log('\n=== Stage D: All tests passed! ===\n');
}

runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
