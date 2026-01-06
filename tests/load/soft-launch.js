/**
 * k6 Load Test for Slime Arena Soft Launch
 *
 * Target metrics:
 * - CCU: 500 concurrent users
 * - p99 latency: < 2000ms
 * - Error rate: < 1%
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 * Run: k6 run tests/load/soft-launch.js
 *
 * Environment variables:
 * - BASE_URL: MetaServer URL (default: http://localhost:3000)
 * - SERVER_TOKEN: MATCH_SERVER_TOKEN for server-to-server auth
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const authLatency = new Trend('auth_latency', true);
const configLatency = new Trend('config_latency', true);
const matchmakingLatency = new Trend('matchmaking_latency', true);
const matchResultsLatency = new Trend('match_results_latency', true);
const errorRate = new Rate('errors');
const successfulAuths = new Counter('successful_auths');
const successfulMatchResults = new Counter('successful_match_results');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SERVER_TOKEN = __ENV.SERVER_TOKEN || 'test-server-token';

// Load test stages
export const options = {
  stages: [
    // Ramp up to 100 users over 1 minute
    { duration: '1m', target: 100 },
    // Ramp up to 300 users over 2 minutes
    { duration: '2m', target: 300 },
    // Ramp up to 500 users (target CCU) over 2 minutes
    { duration: '2m', target: 500 },
    // Stay at 500 users for 5 minutes (steady state)
    { duration: '5m', target: 500 },
    // Ramp down over 1 minute
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    // 99th percentile response time must be < 2000ms
    http_req_duration: ['p(99)<2000'],
    // Error rate must be < 1%
    errors: ['rate<0.01'],
    // Custom latency thresholds
    auth_latency: ['p(95)<1500'],
    config_latency: ['p(95)<500'],
    matchmaking_latency: ['p(95)<1000'],
    match_results_latency: ['p(95)<1500'],
  },
};

// Generate unique ID for match results (k6 doesn't have crypto.randomUUID)
// T-03 fix: Use deterministic unique ID instead of Math.random()
function generateUniqueId(vuId, iteration) {
  return `${Date.now()}-${vuId}-${iteration}`;
}

// Test user context (persists between iterations for a VU)
let authToken = null;
let userId = null;

export default function () {
  const vuId = __VU;
  const iteration = __ITER;

  group('1. Health Check', function () {
    const response = http.get(`${BASE_URL}/health`);
    const success = check(response, {
      'health status is 200': (r) => r.status === 200,
      'health body contains ok': (r) => r.json('status') === 'ok',
    });
    errorRate.add(!success);
  });

  // T-02 fix: Authenticate once per VU, not every iteration
  group('2. Authentication', function () {
    // Skip if already authenticated
    if (authToken) {
      return;
    }

    const payload = JSON.stringify({
      platformType: 'dev',
      platformAuthToken: `loadtest_vu${vuId}:LoadTester${vuId}`,
    });

    const params = {
      headers: { 'Content-Type': 'application/json' },
    };

    const start = Date.now();
    const response = http.post(`${BASE_URL}/api/v1/auth/verify`, payload, params);
    authLatency.add(Date.now() - start);

    const success = check(response, {
      'auth status is 200': (r) => r.status === 200,
      'auth has accessToken': (r) => r.json('accessToken') !== undefined,
    });

    if (success) {
      authToken = response.json('accessToken');
      userId = response.json('userId');
      successfulAuths.add(1);
    } else {
      // T-04 fix: Reset tokens on auth failure
      authToken = null;
      userId = null;
    }
    errorRate.add(!success);
  });

  sleep(0.5);

  if (!authToken) {
    console.log(`VU ${vuId}: Auth failed, skipping remaining tests`);
    return;
  }

  group('3. Get Config', function () {
    const start = Date.now();
    const response = http.get(`${BASE_URL}/api/v1/config/runtime`);
    configLatency.add(Date.now() - start);

    const success = check(response, {
      'config status is 200': (r) => r.status === 200,
      'config has version': (r) => r.json('configVersion') !== undefined,
    });
    errorRate.add(!success);
  });

  group('4. Get Profile', function () {
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    };

    const response = http.get(`${BASE_URL}/api/v1/profile`, params);
    const success = check(response, {
      'profile status is 200': (r) => r.status === 200,
      'profile has nickname': (r) => r.json('nickname') !== undefined,
    });
    errorRate.add(!success);
  });

  sleep(0.3);

  group('5. Matchmaking Flow', function () {
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    };

    // Join queue
    const joinPayload = JSON.stringify({ rating: 1500 });
    const start = Date.now();
    const joinResponse = http.post(`${BASE_URL}/api/v1/matchmaking/join`, joinPayload, params);
    matchmakingLatency.add(Date.now() - start);

    const joinSuccess = check(joinResponse, {
      'join queue status is 200': (r) => r.status === 200,
      'join queue success': (r) => r.json('success') === true,
    });
    errorRate.add(!joinSuccess);

    sleep(0.2);

    // Check status
    const statusResponse = http.get(`${BASE_URL}/api/v1/matchmaking/status`, params);
    check(statusResponse, {
      'status check is 200': (r) => r.status === 200,
    });

    // Cancel queue
    const cancelResponse = http.post(`${BASE_URL}/api/v1/matchmaking/cancel`, null, params);
    check(cancelResponse, {
      'cancel queue is 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // Simulate match completion (every 5th iteration to reduce load)
  if (iteration % 5 === 0) {
    group('6. Submit Match Results', function () {
      const matchId = generateUniqueId(vuId, iteration);
      const matchSummary = {
        matchId: matchId,
        mode: 'arena',
        startedAt: new Date(Date.now() - 300000).toISOString(),
        endedAt: new Date().toISOString(),
        configVersion: 'v1.0.0',
        buildVersion: 'loadtest',
        playerResults: [
          {
            userId: userId,
            sessionId: `loadtest-session-${vuId}`,
            placement: Math.floor(Math.random() * 10) + 1,
            finalMass: Math.floor(Math.random() * 500) + 100,
            killCount: Math.floor(Math.random() * 10),
            deathCount: Math.floor(Math.random() * 5),
            level: Math.floor(Math.random() * 5) + 1,
            classId: Math.floor(Math.random() * 4) + 1,
            isDead: Math.random() > 0.5,
          },
        ],
      };

      const params = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `ServerToken ${SERVER_TOKEN}`,
        },
      };

      const start = Date.now();
      const response = http.post(
        `${BASE_URL}/api/v1/match-results/submit`,
        JSON.stringify(matchSummary),
        params
      );
      matchResultsLatency.add(Date.now() - start);

      const success = check(response, {
        'match results status is 200': (r) => r.status === 200,
        'match results success': (r) => r.json('success') === true,
      });

      if (success) {
        successfulMatchResults.add(1);
      }
      errorRate.add(!success);
    });
  }

  group('7. Wallet Balance', function () {
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    };

    const response = http.get(`${BASE_URL}/api/v1/wallet/balance`, params);
    check(response, {
      'wallet status is 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}

// Setup function - runs once before the test
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  console.log('Target: 500 CCU, p99 < 2000ms, errors < 1%');

  // Verify server is up
  const response = http.get(`${BASE_URL}/health`);
  if (response.status !== 200) {
    throw new Error(`Server health check failed: ${response.status}`);
  }

  return { startTime: Date.now() };
}

// Teardown function - runs once after the test
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\nLoad test completed in ${duration.toFixed(2)} seconds`);
}

// Handle summary
// T-08 fix: Add optional chaining for metrics that may be missing
export function handleSummary(data) {
  const errorRate = data.metrics?.errors?.values?.rate ?? 1;
  const p99Latency = data.metrics?.http_req_duration?.values?.['p(99)'] ?? Infinity;
  const passed = errorRate < 0.01 && p99Latency < 2000;

  console.log('\n=== Load Test Summary ===');
  console.log(`Status: ${passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Total requests: ${data.metrics?.http_reqs?.values?.count ?? 0}`);
  console.log(`Error rate: ${(errorRate * 100).toFixed(2)}%`);
  console.log(`p99 latency: ${p99Latency === Infinity ? 'N/A' : p99Latency.toFixed(0) + 'ms'}`);

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'tests/load/results.json': JSON.stringify(data, null, 2),
  };
}

// Text summary helper
// T-08 fix: Add optional chaining for metrics that may be missing
function textSummary(data, options) {
  let output = '\n=== k6 Load Test Results ===\n\n';

  output += 'Thresholds:\n';
  for (const [name, threshold] of Object.entries(data.metrics || {})) {
    if (threshold?.thresholds) {
      const passed = Object.values(threshold.thresholds).every(t => t?.ok);
      output += `  ${passed ? '\u2713' : '\u2717'} ${name}\n`;
    }
  }

  const p99 = data.metrics?.http_req_duration?.values?.['p(99)'];
  const errRate = data.metrics?.errors?.values?.rate;

  output += '\nKey Metrics:\n';
  output += `  http_req_duration p99: ${p99 != null ? p99.toFixed(0) + 'ms' : 'N/A'}\n`;
  output += `  errors rate: ${errRate != null ? (errRate * 100).toFixed(2) + '%' : 'N/A'}\n`;
  output += `  successful_auths: ${data.metrics?.successful_auths?.values?.count ?? 0}\n`;
  output += `  successful_match_results: ${data.metrics?.successful_match_results?.values?.count ?? 0}\n`;

  return output;
}
