/**
 * Admin Authentication Middleware
 *
 * Separate from player auth - uses admin_users table.
 * Required by REQ-MON-041, REQ-MON-042, REQ-MON-044.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as OTPAuth from 'otpauth';
import { getPostgresPool } from '../../db/pool';

// ============================================================================
// Types
// ============================================================================

export interface AdminUser {
  id: string;
  username: string;
  role: string;
  totpEnabled: boolean;
}

export interface AdminTokenPayload {
  sub: string;
  type: 'admin';
  role: string;
  username: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request type for admin
declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminUser;
    }
  }
}

// ============================================================================
// Configuration
// ============================================================================

const ADMIN_ACCESS_TOKEN_EXPIRES_SECONDS = 15 * 60; // 15 minutes

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProduction) {
      throw new Error('[AdminAuth] FATAL: JWT_SECRET must be set in production!');
    }
    console.warn('[AdminAuth] WARNING: JWT_SECRET not set, using development default');
    return 'slime-arena-dev-jwt-secret';
  }

  return secret;
}

function getEncryptionKey(): Buffer {
  const keyBase64 = process.env.ADMIN_ENCRYPTION_KEY;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!keyBase64) {
    if (isProduction) {
      throw new Error('[AdminAuth] FATAL: ADMIN_ENCRYPTION_KEY must be set in production!');
    }
    console.warn('[AdminAuth] WARNING: ADMIN_ENCRYPTION_KEY not set, using development default');
    // 32 bytes for AES-256
    return Buffer.from('slime-arena-dev-encryption-key!!');
  }

  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('[AdminAuth] FATAL: ADMIN_ENCRYPTION_KEY must be 32 bytes (base64 encoded)');
  }

  return key;
}

// ============================================================================
// Token Functions
// ============================================================================

/**
 * Generate admin access token (15 min TTL)
 */
export function generateAdminAccessToken(user: AdminUser): string {
  const payload: Omit<AdminTokenPayload, 'iat' | 'exp'> = {
    sub: user.id,
    type: 'admin',
    role: user.role,
    username: user.username,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: ADMIN_ACCESS_TOKEN_EXPIRES_SECONDS,
    algorithm: 'HS256',
  });
}

/**
 * Verify admin access token
 */
export function verifyAdminAccessToken(token: string): AdminTokenPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    }) as AdminTokenPayload;

    if (payload.type !== 'admin') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate refresh token (random string, stored hashed)
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash refresh token for storage (SHA256)
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ============================================================================
// TOTP Encryption (AES-256-GCM)
// ============================================================================

/**
 * Encrypt TOTP secret for storage
 * Format: base64(iv || ciphertext || authTag)
 */
export function encryptTotpSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 12 bytes for GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Concatenate: iv || ciphertext || authTag
  const combined = Buffer.concat([iv, ciphertext, authTag]);
  return combined.toString('base64');
}

/**
 * Decrypt TOTP secret from storage
 */
export function decryptTotpSecret(encrypted: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encrypted, 'base64');

  // Extract parts: iv (12 bytes) || ciphertext || authTag (16 bytes)
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(12, combined.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// ============================================================================
// TOTP Functions
// ============================================================================

/**
 * Generate new TOTP secret
 * Returns hex-encoded 20 bytes (160 bits, standard for TOTP)
 */
export function generateTotpSecret(): string {
  // Generate 20 bytes = 160 bits, standard for TOTP
  // Store as hex for easy conversion to Uint8Array
  return crypto.randomBytes(20).toString('hex');
}

/**
 * Create TOTP instance
 * @param secret - hex-encoded secret
 */
function createTotp(secret: string, username: string): OTPAuth.TOTP {
  // Convert hex to Uint8Array
  const secretBuffer = Buffer.from(secret, 'hex');
  // Convert Buffer to ArrayBuffer for otpauth
  const arrayBuffer = secretBuffer.buffer.slice(
    secretBuffer.byteOffset,
    secretBuffer.byteOffset + secretBuffer.byteLength
  );

  return new OTPAuth.TOTP({
    issuer: 'SlimeArena Admin',
    label: username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ buffer: arrayBuffer }),
  });
}

/**
 * Generate TOTP URI for QR code
 */
export function generateTotpUri(secret: string, username: string): string {
  const totp = createTotp(secret, username);
  return totp.toString();
}

/**
 * Verify TOTP code
 */
export function verifyTotpCode(secret: string, code: string, username: string): boolean {
  const totp = createTotp(secret, username);

  // Allow 1 window drift (30 seconds before/after)
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Require admin authentication
 * Verifies JWT access token and loads admin user
 */
export async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyAdminAccessToken(token);

    if (!payload) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
      return;
    }

    // Load admin user from DB to verify they still exist and get current role
    const pool = getPostgresPool();
    const result = await pool.query<{
      id: string;
      username: string;
      role: string;
      totp_enabled: boolean;
    }>(
      `SELECT id, username, role, totp_enabled FROM admin_users WHERE id = $1`,
      [payload.sub]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Admin user not found',
      });
      return;
    }

    const row = result.rows[0];
    req.adminUser = {
      id: row.id,
      username: row.username,
      role: row.role,
      totpEnabled: row.totp_enabled,
    };

    next();
  } catch (error) {
    console.error('[AdminAuth] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication verification failed',
    });
  }
}

/**
 * Require 2FA verification for sensitive actions
 * Must be used after requireAdminAuth
 * Reads X-2FA-Code header
 */
export async function require2FA(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const adminUser = req.adminUser;

    if (!adminUser) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
      return;
    }

    if (!adminUser.totpEnabled) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: '2FA must be enabled for this action',
      });
      return;
    }

    const totpCode = req.get('X-2FA-Code');

    if (!totpCode) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Missing X-2FA-Code header',
      });
      return;
    }

    // Get encrypted TOTP secret from DB
    const pool = getPostgresPool();
    const result = await pool.query<{ totp_secret_encrypted: string }>(
      `SELECT totp_secret_encrypted FROM admin_users WHERE id = $1`,
      [adminUser.id]
    );

    if (result.rows.length === 0 || !result.rows[0].totp_secret_encrypted) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'TOTP not configured',
      });
      return;
    }

    // Decrypt and verify
    const secret = decryptTotpSecret(result.rows[0].totp_secret_encrypted);
    const isValid = verifyTotpCode(secret, totpCode, adminUser.username);

    if (!isValid) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Invalid 2FA code',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[AdminAuth] 2FA Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: '2FA verification failed',
    });
  }
}
