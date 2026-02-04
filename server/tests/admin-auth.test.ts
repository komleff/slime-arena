/**
 * Admin Auth Integration Tests
 *
 * Тесты для Admin Dashboard auth flow согласно TZ-MON v1.6.
 *
 * Run with: npx tsx server/tests/admin-auth.test.ts
 *
 * Prerequisites:
 * - MetaServer running on http://localhost:3000
 * - PostgreSQL and Redis available
 * - Environment variables: JWT_SECRET, ADMIN_ENCRYPTION_KEY
 *
 * Acceptance Criteria:
 * - ACC-MON-001: Login success → 200 + accessToken + Set-Cookie (refresh)
 * - ACC-MON-002: Login invalid password → 401
 * - ACC-MON-003: Login rate limit (5+ req/min) → 429
 * - ACC-MON-004: GET /audit без токена → 401
 * - ACC-MON-006: Refresh с валидным cookie → 200 + новый accessToken
 * - ACC-MON-007: TOTP setup → 200 + otpauth:// URI
 * - ACC-MON-008: TOTP verify с корректным кодом → 200 + 2FA enabled
 */

import bcrypt from 'bcrypt';
import * as OTPAuth from 'otpauth';
import { Pool } from 'pg';

const BASE_URL = process.env.META_URL || 'http://localhost:3000';

// Test admin credentials
const TEST_ADMIN_USERNAME = 'test_admin_' + Date.now();
const TEST_ADMIN_PASSWORD = 'TestPassword123!';
const TEST_ADMIN_ROLE = 'admin';

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

// ============================================================================
// Database Setup (Mock or Direct)
// ============================================================================

interface TestAdminUser {
  id: string;
  username: string;
  passwordHash: string;
}

let testAdmin: TestAdminUser | null = null;
let pool: Pool | null = null;

/**
 * Setup test admin user in database
 * Uses direct PostgreSQL connection if available, otherwise skips DB-dependent tests
 */
async function setupTestAdmin(): Promise<boolean> {
  try {
    const databaseUrl = process.env.DATABASE_URL || 'postgresql://slime:slime_dev_password@localhost:5432/slime_arena';
    pool = new Pool({ connectionString: databaseUrl });

    // Test connection
    await pool.query('SELECT 1');

    // Create test admin user
    const passwordHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 10);

    // Check if user already exists
    const existing = await pool.query(
      'SELECT id FROM admin_users WHERE username = $1',
      [TEST_ADMIN_USERNAME]
    );

    if (existing.rows.length > 0) {
      testAdmin = {
        id: existing.rows[0].id,
        username: TEST_ADMIN_USERNAME,
        passwordHash,
      };
    } else {
      const result = await pool.query(
        `INSERT INTO admin_users (username, password_hash, role, totp_enabled)
         VALUES ($1, $2, $3, false)
         RETURNING id`,
        [TEST_ADMIN_USERNAME, passwordHash, TEST_ADMIN_ROLE]
      );
      testAdmin = {
        id: result.rows[0].id,
        username: TEST_ADMIN_USERNAME,
        passwordHash,
      };
    }

    console.log(`[Setup] Test admin created: ${TEST_ADMIN_USERNAME}`);
    return true;
  } catch (error) {
    console.warn('[Setup] Database not available, using mock mode:', (error as Error).message);
    return false;
  }
}

/**
 * Cleanup test admin user from database
 */
async function cleanupTestAdmin(): Promise<void> {
  if (!pool || !testAdmin) return;

  try {
    // Delete sessions first (FK constraint)
    await pool.query('DELETE FROM admin_sessions WHERE user_id = $1', [testAdmin.id]);
    // Delete audit logs
    await pool.query('DELETE FROM audit_log WHERE user_id = $1', [testAdmin.id]);
    // Delete admin user
    await pool.query('DELETE FROM admin_users WHERE id = $1', [testAdmin.id]);
    console.log(`[Cleanup] Test admin deleted: ${TEST_ADMIN_USERNAME}`);
  } catch (error) {
    console.warn('[Cleanup] Error:', (error as Error).message);
  } finally {
    await pool.end();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract cookies from response headers
 */
function parseCookies(response: Response): Record<string, string> {
  const cookies: Record<string, string> = {};
  const setCookieHeaders = response.headers.getSetCookie?.() || [];

  for (const header of setCookieHeaders) {
    const [nameValue] = header.split(';');
    const [name, value] = nameValue.split('=');
    if (name && value) {
      cookies[name.trim()] = value.trim();
    }
  }

  return cookies;
}

/**
 * Build cookie header from cookies object
 */
function buildCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

// ============================================================================
// Tests
// ============================================================================

let accessToken: string | null = null;
let refreshCookies: Record<string, string> = {};

async function runTests(): Promise<void> {
  console.log('\n=== Admin Auth Integration Tests (TZ-MON v1.6) ===\n');
  console.log(`Target: ${BASE_URL}`);

  // Setup
  const dbAvailable = await setupTestAdmin();

  if (!dbAvailable) {
    console.log('\n⚠ Database not available. Running in mock mode (limited tests).\n');
  }

  // ============= ACC-MON-001: Login success =============
  console.log('\n--- ACC-MON-001: Login success ---\n');

  if (dbAvailable) {
    await test('ACC-MON-001: POST /admin/login with valid credentials returns 200 + accessToken', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: TEST_ADMIN_USERNAME,
          password: TEST_ADMIN_PASSWORD,
        }),
      });

      assert(response.status === 200, `Expected 200, got ${response.status}`);

      const data = await response.json();
      assert(data.accessToken, 'Response should contain accessToken');
      assert(typeof data.accessToken === 'string', 'accessToken should be a string');
      assert(data.accessToken.split('.').length === 3, 'accessToken should be a valid JWT (3 parts)');

      // Store for later tests
      accessToken = data.accessToken;
    });

    await test('ACC-MON-001: Login sets refresh_token cookie (HttpOnly)', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: TEST_ADMIN_USERNAME,
          password: TEST_ADMIN_PASSWORD,
        }),
      });

      assert(response.status === 200, `Expected 200, got ${response.status}`);

      const cookies = parseCookies(response);
      assert(!!cookies['refresh_token'], 'Response should set refresh_token cookie');

      // Store for later tests
      refreshCookies = cookies;
      const data = await response.json();
      accessToken = data.accessToken;
    });
  } else {
    console.log('  (skipped - database not available)');
  }

  // ============= ACC-MON-002: Login invalid password =============
  console.log('\n--- ACC-MON-002: Login invalid password ---\n');

  if (dbAvailable) {
    await test('ACC-MON-002: POST /admin/login with wrong password returns 401', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: TEST_ADMIN_USERNAME,
          password: 'WrongPassword123!',
        }),
      });

      assert(response.status === 401, `Expected 401, got ${response.status}`);

      const data = await response.json();
      assert(data.error === 'UNAUTHORIZED', `Expected error UNAUTHORIZED, got ${data.error}`);
    });

    await test('ACC-MON-002: Login with non-existent user returns 401', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'nonexistent_user_' + Date.now(),
          password: 'SomePassword123!',
        }),
      });

      assert(response.status === 401, `Expected 401, got ${response.status}`);
    });
  } else {
    console.log('  (skipped - database not available)');
  }

  // ============= ACC-MON-003: Rate limit =============
  console.log('\n--- ACC-MON-003: Rate limit (5+ req/min) ---\n');

  await test('ACC-MON-003: POST /admin/login rate limit returns 429 after 5+ requests', async () => {
    // Send 6 rapid requests (limit is 5 per minute)
    const requests: Promise<Response>[] = [];

    for (let i = 0; i < 6; i++) {
      requests.push(
        fetch(`${BASE_URL}/api/v1/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'rate_limit_test_user',
            password: 'password',
          }),
        })
      );
    }

    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);

    // At least one should be 429 (rate limited)
    const hasRateLimited = statuses.includes(429);
    assert(hasRateLimited, `Expected at least one 429, got statuses: ${statuses.join(', ')}`);

    // Check the rate-limited response
    const rateLimitedIdx = statuses.indexOf(429);
    if (rateLimitedIdx !== -1) {
      const response = responses[rateLimitedIdx];
      const data = await response.json();
      assert(data.error === 'rate_limit_exceeded', `Expected error rate_limit_exceeded, got ${data.error}`);
      assert(typeof data.retryAfter === 'number', 'Response should contain retryAfter');
    }
  });

  // ============= ACC-MON-004: Audit without token =============
  console.log('\n--- ACC-MON-004: GET /audit without token ---\n');

  await test('ACC-MON-004: GET /admin/audit without token returns 401', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/admin/audit`);

    assert(response.status === 401, `Expected 401, got ${response.status}`);

    const data = await response.json();
    assert(data.error === 'UNAUTHORIZED', `Expected error UNAUTHORIZED, got ${data.error}`);
  });

  await test('ACC-MON-004: GET /admin/audit with invalid token returns 401', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/admin/audit`, {
      headers: {
        Authorization: 'Bearer invalid.token.here',
      },
    });

    assert(response.status === 401, `Expected 401, got ${response.status}`);
  });

  // ============= GET /audit with valid token =============
  if (dbAvailable && accessToken) {
    await test('GET /admin/audit with valid token returns 200', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/admin/audit`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      assert(response.status === 200, `Expected 200, got ${response.status}`);

      const data = await response.json();
      assert(Array.isArray(data.items), 'Response should contain items array');
      assert(typeof data.total === 'number', 'Response should contain total count');
    });
  }

  // ============= ACC-MON-006: Token refresh =============
  console.log('\n--- ACC-MON-006: Token refresh ---\n');

  if (dbAvailable && refreshCookies['refresh_token']) {
    await test('ACC-MON-006: POST /admin/refresh with valid cookie returns 200 + new accessToken', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/admin/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: buildCookieHeader(refreshCookies),
        },
      });

      assert(response.status === 200, `Expected 200, got ${response.status}`);

      const data = await response.json();
      assert(data.accessToken, 'Response should contain new accessToken');
      assert(typeof data.accessToken === 'string', 'accessToken should be a string');

      // New token should be different (new iat/exp)
      // Note: In fast tests, tokens might be the same if within same second
      accessToken = data.accessToken;
    });
  } else {
    console.log('  (skipped - no valid refresh token)');
  }

  await test('ACC-MON-006: POST /admin/refresh without cookie returns 401', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/admin/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    assert(response.status === 401, `Expected 401, got ${response.status}`);

    const data = await response.json();
    assert(data.error === 'UNAUTHORIZED', `Expected error UNAUTHORIZED, got ${data.error}`);
  });

  // ============= ACC-MON-007: TOTP setup =============
  console.log('\n--- ACC-MON-007: TOTP setup ---\n');

  let totpSecret: string | null = null;

  if (dbAvailable && accessToken) {
    await test('ACC-MON-007: POST /admin/totp/setup returns 200 + otpauth:// URI', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/admin/totp/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      assert(response.status === 200, `Expected 200, got ${response.status}`);

      const data = await response.json();
      assert(data.secret, 'Response should contain secret (otpauth:// URI)');
      assert(data.secret.startsWith('otpauth://totp/'), `Secret should be otpauth:// URI, got: ${data.secret.substring(0, 30)}...`);
      assert(data.qrCodeUrl, 'Response should contain qrCodeUrl');
      assert(data.qrCodeUrl.startsWith('data:image/png;base64,'), 'qrCodeUrl should be data URI');

      // Extract secret from URI for verification test
      const secretMatch = data.secret.match(/secret=([A-Z2-7]+)/i);
      if (secretMatch) {
        totpSecret = secretMatch[1];
      }
    });

    await test('ACC-MON-007: TOTP setup without auth returns 401', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/admin/totp/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      assert(response.status === 401, `Expected 401, got ${response.status}`);
    });
  } else {
    console.log('  (skipped - no valid access token)');
  }

  // ============= ACC-MON-008: TOTP verify =============
  console.log('\n--- ACC-MON-008: TOTP verify ---\n');

  if (dbAvailable && accessToken && totpSecret) {
    await test('ACC-MON-008: POST /admin/totp/verify with correct code returns 200', async () => {
      // Generate valid TOTP code using the secret
      const totp = new OTPAuth.TOTP({
        issuer: 'SlimeArena Admin',
        label: TEST_ADMIN_USERNAME,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(totpSecret!),
      });

      const code = totp.generate();

      const response = await fetch(`${BASE_URL}/api/v1/admin/totp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code }),
      });

      assert(response.status === 200, `Expected 200, got ${response.status}`);

      const data = await response.json();
      assert(data.message?.includes('enabled') || data.message?.includes('success'),
        `Expected success message, got: ${data.message}`);
    });

    await test('ACC-MON-008: TOTP verify with invalid code returns 401', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/admin/totp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code: '000000' }),
      });

      // May return 401 (invalid code) or 400 (already enabled after previous test)
      assert(
        response.status === 401 || response.status === 400,
        `Expected 401 or 400, got ${response.status}`
      );
    });

    await test('ACC-MON-008: TOTP verify with invalid format returns 400', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/admin/totp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code: 'abc123' }),
      });

      assert(response.status === 400, `Expected 400, got ${response.status}`);

      const data = await response.json();
      assert(data.error === 'VALIDATION_ERROR', `Expected VALIDATION_ERROR, got ${data.error}`);
    });
  } else {
    console.log('  (skipped - no TOTP secret available)');
  }

  // ============= Additional edge cases =============
  console.log('\n--- Additional Tests ---\n');

  await test('Login with missing username returns 400', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'SomePassword123!' }),
    });

    assert(response.status === 400, `Expected 400, got ${response.status}`);
  });

  await test('Login with missing password returns 400', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'some_user' }),
    });

    assert(response.status === 400, `Expected 400, got ${response.status}`);
  });

  // ============= Logout test =============
  if (dbAvailable && accessToken) {
    await test('POST /admin/logout invalidates session', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/admin/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          Cookie: buildCookieHeader(refreshCookies),
        },
      });

      assert(response.status === 200, `Expected 200, got ${response.status}`);

      // Verify refresh token is invalidated
      const refreshResponse = await fetch(`${BASE_URL}/api/v1/admin/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: buildCookieHeader(refreshCookies),
        },
      });

      assert(refreshResponse.status === 401, `Expected 401 after logout, got ${refreshResponse.status}`);
    });
  }

  // ============= Cleanup =============
  await cleanupTestAdmin();

  // ============= Summary =============
  console.log('\n=== Test Summary ===\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${results.length}`);
  console.log(`Duration: ${totalDuration}ms`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    process.exit(1);
  }

  console.log('\n=== Admin Auth Tests: All passed! ===\n');
}

runTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});
