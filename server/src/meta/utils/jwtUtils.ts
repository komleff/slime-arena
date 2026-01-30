/**
 * JWT Utilities for authentication tokens
 *
 * Token types:
 * - accessToken: JWT for registered users and Telegram-anonymous (24h)
 * - guestToken: JWT for Standalone guests (7 days), no DB record
 * - claimToken: JWT for match result claiming (60 min)
 */

import jwt from 'jsonwebtoken';

// ============================================================================
// Interfaces
// ============================================================================

/** Payload for accessToken (registered users and Telegram-anonymous) */
export interface AccessTokenPayload {
  /** User ID (UUID) */
  sub: string;
  /** Token type */
  type: 'user';
  /** Is anonymous (Telegram-anonymous before profile completion) */
  isAnonymous: boolean;
  /** Token issue time */
  iat?: number;
  /** Token expiration time */
  exp?: number;
}

/** Payload for guestToken (Standalone guests) */
export interface GuestTokenPayload {
  /** Guest subject ID (UUID) */
  sub: string;
  /** Token type */
  type: 'guest';
  /** Token issue time */
  iat?: number;
  /** Token expiration time */
  exp?: number;
}

/** Payload for claimToken (match result claiming) */
export interface ClaimTokenPayload {
  /** Token type */
  type: 'claim';
  /** Match ID (UUID) */
  matchId: string;
  /** Subject ID (userId or guestSubjectId) */
  subjectId: string;
  /** Final mass at match end */
  finalMass: number;
  /** Skin ID used in match */
  skinId: string;
  /** Token issue time */
  iat?: number;
  /** Token expiration time */
  exp?: number;
}

/**
 * Payload for pendingAuthToken (OAuth 409 conflict resolution)
 * Used when OAuth link already exists on another account
 * @see docs/meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 10
 */
export interface PendingAuthTokenPayload {
  /** Token type */
  type: 'pending_auth';
  /** OAuth provider name */
  provider: string;
  /** Provider user ID */
  providerUserId: string;
  /** Existing user ID (the one OAuth is linked to) */
  existingUserId: string;
  /** Token issue time */
  iat?: number;
  /** Token expiration time */
  exp?: number;
}

/** Union type for all token payloads */
export type TokenPayload = AccessTokenPayload | GuestTokenPayload | ClaimTokenPayload | PendingAuthTokenPayload;

// ============================================================================
// Configuration
// ============================================================================

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProduction) {
      throw new Error('[jwtUtils] FATAL: JWT_SECRET must be set in production!');
    }
    console.warn('[jwtUtils] WARNING: JWT_SECRET not set, using development default');
    return 'slime-arena-dev-jwt-secret';
  }

  return secret;
}

// Default token lifetimes (in seconds)
const ACCESS_TOKEN_EXPIRES_SECONDS = 24 * 60 * 60; // 24 hours
const GUEST_TOKEN_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // 7 days
const PENDING_AUTH_TOKEN_EXPIRES_SECONDS = 5 * 60; // 5 minutes (ТЗ раздел 10.6)

function getClaimTokenExpiresSeconds(): number {
  const ttlMinutes = process.env.CLAIM_TOKEN_TTL_MINUTES;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!ttlMinutes) {
    if (isProduction) {
      throw new Error('[jwtUtils] FATAL: CLAIM_TOKEN_TTL_MINUTES must be set in production!');
    }
    console.warn('[jwtUtils] WARNING: CLAIM_TOKEN_TTL_MINUTES not set, using default 60 minutes');
    return 60 * 60; // 60 minutes default
  }

  const parsed = parseInt(ttlMinutes, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`[jwtUtils] FATAL: Invalid CLAIM_TOKEN_TTL_MINUTES value: ${ttlMinutes}`);
  }

  return parsed * 60;
}

const CLAIM_TOKEN_EXPIRES_SECONDS = getClaimTokenExpiresSeconds();

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate access token for registered users or Telegram-anonymous
 *
 * @param userId - User ID (UUID)
 * @param isAnonymous - Is anonymous user (Telegram-anonymous)
 * @param expiresInSeconds - Token lifetime in seconds (default: 24h)
 * @returns JWT access token
 */
export function generateAccessToken(
  userId: string,
  isAnonymous: boolean,
  expiresInSeconds: number = ACCESS_TOKEN_EXPIRES_SECONDS
): string {
  const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
    sub: userId,
    type: 'user',
    isAnonymous,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: expiresInSeconds,
    algorithm: 'HS256',
  });
}

/**
 * Generate guest token for Standalone guests
 * Guest tokens do NOT create any database records
 *
 * @param guestSubjectId - Guest subject ID (UUID)
 * @param expiresInSeconds - Token lifetime in seconds (default: 7d)
 * @returns JWT guest token
 */
export function generateGuestToken(
  guestSubjectId: string,
  expiresInSeconds: number = GUEST_TOKEN_EXPIRES_SECONDS
): string {
  const payload: Omit<GuestTokenPayload, 'iat' | 'exp'> = {
    sub: guestSubjectId,
    type: 'guest',
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: expiresInSeconds,
    algorithm: 'HS256',
  });
}

/**
 * Generate claim token for match result claiming
 * Used in auth/upgrade flow to initialize ratings
 *
 * @param payload - Claim token payload
 * @param expiresInSeconds - Token lifetime in seconds (default: 60 minutes from env)
 * @returns JWT claim token
 */
export function generateClaimToken(
  payload: Omit<ClaimTokenPayload, 'type' | 'iat' | 'exp'>,
  expiresInSeconds: number = CLAIM_TOKEN_EXPIRES_SECONDS
): string {
  const fullPayload: Omit<ClaimTokenPayload, 'iat' | 'exp'> = {
    type: 'claim',
    ...payload,
  };
  return jwt.sign(fullPayload, getJwtSecret(), {
    expiresIn: expiresInSeconds,
    algorithm: 'HS256',
  });
}

/**
 * Generate pending auth token for OAuth 409 conflict resolution
 * Used when OAuth link already exists on another account
 *
 * @see docs/meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 10
 * @param payload - Pending auth token payload
 * @param expiresInSeconds - Token lifetime in seconds (default: 5 minutes)
 * @returns JWT pending auth token
 */
export function generatePendingAuthToken(
  payload: Omit<PendingAuthTokenPayload, 'type' | 'iat' | 'exp'>,
  expiresInSeconds: number = PENDING_AUTH_TOKEN_EXPIRES_SECONDS
): string {
  const fullPayload: Omit<PendingAuthTokenPayload, 'iat' | 'exp'> = {
    type: 'pending_auth',
    ...payload,
  };
  return jwt.sign(fullPayload, getJwtSecret(), {
    expiresIn: expiresInSeconds,
    algorithm: 'HS256',
  });
}

// ============================================================================
// Token Verification
// ============================================================================

/** Result of token verification */
export interface VerifyTokenResult<T extends TokenPayload> {
  valid: true;
  payload: T;
}

export interface VerifyTokenError {
  valid: false;
  error: 'expired' | 'invalid' | 'malformed';
  message: string;
}

export type VerifyResult<T extends TokenPayload> = VerifyTokenResult<T> | VerifyTokenError;

/**
 * Verify any JWT token and return payload
 *
 * @param token - JWT token to verify
 * @returns Verification result with payload or error
 */
export function verifyToken<T extends TokenPayload = TokenPayload>(
  token: string
): VerifyResult<T> {
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    }) as T;

    return { valid: true, payload };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return {
        valid: false,
        error: 'expired',
        message: 'Token has expired',
      };
    }
    if (error.name === 'JsonWebTokenError') {
      return {
        valid: false,
        error: 'invalid',
        message: error.message || 'Invalid token',
      };
    }
    return {
      valid: false,
      error: 'malformed',
      message: error.message || 'Token verification failed',
    };
  }
}

/**
 * Verify and decode access token
 *
 * @param token - Access token to verify
 * @returns AccessTokenPayload or null if invalid
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const result = verifyToken<AccessTokenPayload>(token);
  if (!result.valid) return null;
  if (result.payload.type !== 'user') return null;
  return result.payload;
}

/**
 * Verify and decode guest token
 *
 * @param token - Guest token to verify
 * @returns GuestTokenPayload or null if invalid
 */
export function verifyGuestToken(token: string): GuestTokenPayload | null {
  const result = verifyToken<GuestTokenPayload>(token);
  if (!result.valid) return null;
  if (result.payload.type !== 'guest') return null;
  return result.payload;
}

/**
 * Verify and decode claim token
 *
 * @param token - Claim token to verify
 * @returns ClaimTokenPayload or null if invalid
 */
export function verifyClaimToken(token: string): ClaimTokenPayload | null {
  const result = verifyToken<ClaimTokenPayload>(token);
  if (!result.valid) return null;
  // Verify type and required fields to prevent token confusion
  if (result.payload.type !== 'claim') return null;
  if (!result.payload.matchId || !result.payload.subjectId) return null;
  return result.payload;
}

/**
 * Verify and decode pending auth token
 * Used for OAuth 409 conflict resolution
 *
 * @param token - Pending auth token to verify
 * @returns PendingAuthTokenPayload or null if invalid
 */
export function verifyPendingAuthToken(token: string): PendingAuthTokenPayload | null {
  const result = verifyToken<PendingAuthTokenPayload>(token);
  if (!result.valid) return null;
  // Verify type and required fields
  if (result.payload.type !== 'pending_auth') return null;
  if (!result.payload.provider || !result.payload.providerUserId || !result.payload.existingUserId) return null;
  return result.payload;
}

/**
 * Determine token type from token string
 *
 * @param token - JWT token
 * @returns Token type or null if invalid
 */
export function getTokenType(token: string): 'user' | 'guest' | 'claim' | null {
  const result = verifyToken(token);
  if (!result.valid) return null;

  const payload = result.payload as any;
  if (payload.type === 'user') return 'user';
  if (payload.type === 'guest') return 'guest';
  if (payload.type === 'claim') return 'claim';
  return null;
}

/**
 * Calculate token expiration date from seconds
 *
 * @param expiresInSeconds - Token lifetime in seconds
 * @returns Expiration date
 */
export function calculateExpiresAt(expiresInSeconds: number): Date {
  return new Date(Date.now() + expiresInSeconds * 1000);
}

/**
 * Get default expiration times
 */
export const TOKEN_EXPIRATION = {
  ACCESS_TOKEN: ACCESS_TOKEN_EXPIRES_SECONDS,
  GUEST_TOKEN: GUEST_TOKEN_EXPIRES_SECONDS,
  CLAIM_TOKEN: CLAIM_TOKEN_EXPIRES_SECONDS,
  PENDING_AUTH_TOKEN: PENDING_AUTH_TOKEN_EXPIRES_SECONDS,
} as const;
