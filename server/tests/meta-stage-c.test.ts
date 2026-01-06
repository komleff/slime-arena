/**
 * Smoke test for MetaServer Stage C endpoints
 * Run with: npx tsx server/tests/meta-stage-c.test.ts
 */

const BASE_URL = process.env.META_URL || 'http://localhost:3000';

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
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: message, duration: Date.now() - start });
    console.log(`✗ ${name}: ${message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// Auth helper
let authToken: string | null = null;

async function authenticate(): Promise<string> {
  if (authToken) return authToken;

  const response = await fetch(`${BASE_URL}/api/v1/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platformType: 'dev',
      platformAuthToken: 'test_user_001:TestAdmin',
    }),
  });

  const data = await response.json();
  assert(data.accessToken, 'Auth failed - no accessToken');
  authToken = data.accessToken;
  return authToken!;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await authenticate();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// ============= Tests =============

async function runTests() {
  console.log('\n=== MetaServer Stage C Smoke Tests ===\n');
  console.log(`Target: ${BASE_URL}\n`);

  // Health check
  await test('Health check', async () => {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    assert(data.status === 'ok', 'Health check failed');
  });

  // Auth
  await test('Dev authentication', async () => {
    await authenticate();
    assert(authToken !== null, 'No auth token received');
  });

  // ============= Config Admin =============
  
  await test('List configs', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/config/admin/list`, {
      headers: await authHeaders(),
    });
    const data = await response.json();
    assert(data.success, 'Failed to list configs');
    assert(Array.isArray(data.configs), 'configs should be array');
  });

  await test('Validate config payload', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/config/admin/validate`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        payload: {
          features: {
            paymentsEnabled: false,
            adsRewardEnabled: true,
            matchmakingEnabled: true,
          },
        },
      }),
    });
    const data = await response.json();
    assert(data.success, 'Validation request failed');
    assert(data.valid === true, 'Valid config marked as invalid');
  });

  await test('Validate invalid config', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/config/admin/validate`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        payload: {
          // missing features
        },
      }),
    });
    const data = await response.json();
    assert(data.success, 'Validation request failed');
    assert(data.valid === false, 'Invalid config marked as valid');
    assert(data.errors.length > 0, 'No validation errors returned');
  });

  // ============= A/B Tests =============

  await test('List A/B tests', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/abtest/admin/list`, {
      headers: await authHeaders(),
    });
    const data = await response.json();
    assert(data.success, 'Failed to list tests');
    assert(Array.isArray(data.tests), 'tests should be array');
  });

  const testId = `test_${Date.now()}`;

  await test('Create A/B test', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/abtest/admin/create`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        testId,
        name: 'Test AB Test',
        variants: [
          { id: 'control', name: 'Control', config: { feature: false } },
          { id: 'treatment', name: 'Treatment', config: { feature: true } },
        ],
        weights: [50, 50],
      }),
    });
    const data = await response.json();
    assert(data.success, `Failed to create test: ${data.error}`);
    assert(data.test.testId === testId, 'Test ID mismatch');
  });

  await test('Activate A/B test', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/abtest/admin/${testId}/state`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ state: 'active' }),
    });
    const data = await response.json();
    assert(data.success, 'Failed to activate test');
  });

  await test('Get A/B test assignment', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/abtest/assignment/${testId}`, {
      headers: await authHeaders(),
    });
    const data = await response.json();
    assert(data.success, 'Failed to get assignment');
    assert(data.assignment, 'No assignment returned');
    assert(['control', 'treatment'].includes(data.assignment.variantId), 'Invalid variant');
  });

  await test('Track A/B test conversion', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/abtest/conversion`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        testId,
        eventType: 'button_click',
        eventValue: 1,
      }),
    });
    const data = await response.json();
    assert(data.success, 'Failed to track conversion');
  });

  await test('Get A/B test stats', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/abtest/admin/${testId}/stats`, {
      headers: await authHeaders(),
    });
    const data = await response.json();
    assert(data.success, 'Failed to get stats');
    assert(data.stats.testId === testId, 'Test ID mismatch');
  });

  // Cleanup: pause the test
  await test('Complete A/B test', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/abtest/admin/${testId}/state`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ state: 'completed' }),
    });
    const data = await response.json();
    assert(data.success, 'Failed to complete test');
  });

  // ============= Analytics =============

  await test('Track analytics event', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/analytics/track`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        eventType: 'screen_view',
        properties: { screen: 'main_menu' },
        sessionId: 'test_session_001',
      }),
    });
    const data = await response.json();
    assert(data.success, 'Failed to track event');
  });

  await test('Track analytics batch', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/analytics/batch`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        sessionId: 'test_session_001',
        events: [
          { eventType: 'button_click', properties: { button: 'play' } },
          { eventType: 'match_search_start', properties: {} },
        ],
      }),
    });
    const data = await response.json();
    assert(data.success, 'Failed to track batch');
    assert(data.accepted === 2, 'Not all events accepted');
  });

  await test('Get event types', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/analytics/event-types`);
    const data = await response.json();
    assert(data.success, 'Failed to get event types');
    assert(Array.isArray(data.eventTypes), 'eventTypes should be array');
    assert(data.eventTypes.includes('match_start'), 'Missing match_start event type');
  });

  await test('Query analytics (admin)', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/analytics/admin/query?eventType=screen_view&limit=10`, {
      headers: await authHeaders(),
    });
    const data = await response.json();
    assert(data.success, 'Failed to query events');
    assert(Array.isArray(data.events), 'events should be array');
    assert(typeof data.total === 'number', 'total should be number');
  });

  // ============= Payment Providers =============

  await test('Get available payment providers', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/payment/providers`);
    const data = await response.json();
    assert(data.success, 'Failed to get providers');
    assert(Array.isArray(data.providers), 'providers should be array');
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
}

runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
