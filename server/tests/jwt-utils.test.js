/**
 * Unit tests for jwtUtils
 */

const path = require('path');

// Set up environment
process.env.JWT_SECRET = 'test-secret-for-jwt-utils';

const serverRoot = path.resolve(__dirname, '..');
process.chdir(serverRoot);

const {
  generateAccessToken,
  generateGuestToken,
  generateClaimToken,
  verifyToken,
  verifyAccessToken,
  verifyGuestToken,
  verifyClaimToken,
  getTokenType,
  calculateExpiresAt,
} = require(path.resolve(__dirname, '../dist/server/src/meta/utils/jwtUtils.js'));

// Helper to decode token without verification (for testing payloads)
function decodePayload(token) {
  const [, payloadBase64] = token.split('.');
  return JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());
}

// ============================================================================
// Tests
// ============================================================================

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[OK] ${name}`);
    passed++;
  } catch (error) {
    console.error(`[FAIL] ${name}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || 'Expected true');
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected non-null value');
  }
}

function assertNull(value, message) {
  if (value !== null) {
    throw new Error(message || `Expected null, got ${JSON.stringify(value)}`);
  }
}

// ============================================================================
// generateAccessToken tests
// ============================================================================

test('generateAccessToken creates valid JWT', () => {
  const token = generateAccessToken('user-123', false);
  assertNotNull(token);
  assertTrue(token.split('.').length === 3, 'Token should have 3 parts');
});

test('generateAccessToken includes correct payload', () => {
  const token = generateAccessToken('user-123', false);
  const payload = decodePayload(token);
  assertEqual(payload.sub, 'user-123');
  assertEqual(payload.type, 'user');
  assertEqual(payload.isAnonymous, false);
});

test('generateAccessToken handles isAnonymous true', () => {
  const token = generateAccessToken('user-456', true);
  const payload = decodePayload(token);
  assertEqual(payload.isAnonymous, true);
});

// ============================================================================
// generateGuestToken tests
// ============================================================================

test('generateGuestToken creates valid JWT', () => {
  const token = generateGuestToken('guest-abc');
  assertNotNull(token);
  assertTrue(token.split('.').length === 3);
});

test('generateGuestToken includes correct payload', () => {
  const token = generateGuestToken('guest-abc');
  const payload = decodePayload(token);
  assertEqual(payload.sub, 'guest-abc');
  assertEqual(payload.type, 'guest');
});

// ============================================================================
// generateClaimToken tests
// ============================================================================

test('generateClaimToken creates valid JWT', () => {
  const token = generateClaimToken({
    matchId: 'match-123',
    subjectId: 'user-123',
    finalMass: 5000,
    skinId: 'basic_green',
  });
  assertNotNull(token);
  assertTrue(token.split('.').length === 3);
});

test('generateClaimToken includes correct payload', () => {
  const token = generateClaimToken({
    matchId: 'match-123',
    subjectId: 'user-123',
    finalMass: 5000,
    skinId: 'basic_green',
  });
  const payload = decodePayload(token);
  assertEqual(payload.matchId, 'match-123');
  assertEqual(payload.subjectId, 'user-123');
  assertEqual(payload.finalMass, 5000);
  assertEqual(payload.skinId, 'basic_green');
});

// ============================================================================
// verifyToken tests
// ============================================================================

test('verifyToken validates accessToken', () => {
  const token = generateAccessToken('user-123', false);
  const result = verifyToken(token);
  assertTrue(result.valid);
  assertEqual(result.payload.sub, 'user-123');
});

test('verifyToken validates guestToken', () => {
  const token = generateGuestToken('guest-abc');
  const result = verifyToken(token);
  assertTrue(result.valid);
  assertEqual(result.payload.sub, 'guest-abc');
});

test('verifyToken rejects invalid token', () => {
  const result = verifyToken('invalid.token.here');
  assertTrue(!result.valid);
  assertEqual(result.error, 'invalid');
});

test('verifyToken rejects malformed token', () => {
  const result = verifyToken('not-a-jwt');
  assertTrue(!result.valid);
});

// ============================================================================
// Type-specific verify functions
// ============================================================================

test('verifyAccessToken returns payload for valid token', () => {
  const token = generateAccessToken('user-123', true);
  const payload = verifyAccessToken(token);
  assertNotNull(payload);
  assertEqual(payload.sub, 'user-123');
  assertEqual(payload.isAnonymous, true);
});

test('verifyAccessToken returns null for guest token', () => {
  const token = generateGuestToken('guest-abc');
  const payload = verifyAccessToken(token);
  assertNull(payload, 'Should return null for guest token');
});

test('verifyGuestToken returns payload for valid token', () => {
  const token = generateGuestToken('guest-abc');
  const payload = verifyGuestToken(token);
  assertNotNull(payload);
  assertEqual(payload.sub, 'guest-abc');
});

test('verifyGuestToken returns null for access token', () => {
  const token = generateAccessToken('user-123', false);
  const payload = verifyGuestToken(token);
  assertNull(payload, 'Should return null for access token');
});

test('verifyClaimToken returns payload for valid token', () => {
  const token = generateClaimToken({
    matchId: 'match-123',
    subjectId: 'user-123',
    finalMass: 5000,
    skinId: 'basic_green',
  });
  const payload = verifyClaimToken(token);
  assertNotNull(payload);
  assertEqual(payload.matchId, 'match-123');
  assertEqual(payload.finalMass, 5000);
});

// ============================================================================
// getTokenType tests
// ============================================================================

test('getTokenType identifies access token', () => {
  const token = generateAccessToken('user-123', false);
  assertEqual(getTokenType(token), 'user');
});

test('getTokenType identifies guest token', () => {
  const token = generateGuestToken('guest-abc');
  assertEqual(getTokenType(token), 'guest');
});

test('getTokenType identifies claim token', () => {
  const token = generateClaimToken({
    matchId: 'match-123',
    subjectId: 'user-123',
    finalMass: 5000,
    skinId: 'basic_green',
  });
  assertEqual(getTokenType(token), 'claim');
});

test('getTokenType returns null for invalid token', () => {
  assertNull(getTokenType('invalid-token'));
});

// ============================================================================
// calculateExpiresAt tests
// ============================================================================

test('calculateExpiresAt handles 24 hours in seconds', () => {
  const now = Date.now();
  const expiresAt = calculateExpiresAt(24 * 60 * 60); // 24 hours in seconds
  const diff = expiresAt.getTime() - now;
  // Allow 1 second tolerance
  assertTrue(Math.abs(diff - 24 * 60 * 60 * 1000) < 1000, 'Should be ~24 hours');
});

test('calculateExpiresAt handles 7 days in seconds', () => {
  const now = Date.now();
  const expiresAt = calculateExpiresAt(7 * 24 * 60 * 60); // 7 days in seconds
  const diff = expiresAt.getTime() - now;
  assertTrue(Math.abs(diff - 7 * 24 * 60 * 60 * 1000) < 1000, 'Should be ~7 days');
});

test('calculateExpiresAt handles 60 minutes in seconds', () => {
  const now = Date.now();
  const expiresAt = calculateExpiresAt(60 * 60); // 60 minutes in seconds
  const diff = expiresAt.getTime() - now;
  assertTrue(Math.abs(diff - 60 * 60 * 1000) < 1000, 'Should be ~60 minutes');
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n========================================');
console.log(`JWT Utils tests: ${passed} passed, ${failed} failed`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
}

console.log('All JWT Utils tests passed!');
process.exit(0);
