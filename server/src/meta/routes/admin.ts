/**
 * Admin Routes for Monitoring Dashboard
 *
 * Endpoints:
 * - POST /login - authenticate admin
 * - POST /refresh - refresh access token
 * - POST /logout - invalidate session
 * - POST /totp/setup - generate TOTP secret
 * - POST /totp/verify - verify and enable TOTP
 *
 * All endpoints use separate admin_users table (isolated from players).
 * Required by REQ-MON-041 through REQ-MON-046.
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { getPostgresPool } from '../../db/pool';
import { rateLimit } from '../middleware/rateLimiter';
import { logAction } from '../services/auditService';
import {
  requireAdminAuth,
  generateAdminAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateTotpSecret,
  generateTotpUri,
  verifyTotpCode,
  encryptTotpSecret,
  decryptTotpSecret,
  AdminUser,
} from '../middleware/adminAuth';

const router = Router();

// ============================================================================
// Rate Limiters
// ============================================================================

// POST /login: 5 req/min per IP
const loginRateLimiter = rateLimit(60 * 1000, 5, 'admin_login');

// POST /admin/* (general): 10 req/min per IP (for now IP-based, user-based would need auth first)
const adminPostRateLimiter = rateLimit(60 * 1000, 10, 'admin_post');

// GET /admin/*: 60 req/min per IP
const adminGetRateLimiter = rateLimit(60 * 1000, 60, 'admin_get');

// ============================================================================
// Helpers
// ============================================================================

function getClientIP(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true';
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const clientIP = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return clientIP.trim();
    }
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Cookie options for refresh token
const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/admin',
    maxAge: REFRESH_COOKIE_MAX_AGE * 1000, // cookie maxAge is in ms
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/admin',
  });
}

// ============================================================================
// POST /login
// ============================================================================

router.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const ip = getClientIP(req);
    const userAgent = req.get('user-agent') || '';

    if (!username || !password) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Username and password are required',
      });
    }

    const pool = getPostgresPool();

    // Find admin user
    const userResult = await pool.query<{
      id: string;
      username: string;
      password_hash: string;
      role: string;
      totp_enabled: boolean;
    }>(
      `SELECT id, username, password_hash, role, totp_enabled
       FROM admin_users
       WHERE username = $1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      // Log failed attempt
      await logAction({
        userId: null,
        action: 'login_failed',
        target: username,
        ip,
        details: { reason: 'user_not_found' },
      });

      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      await logAction({
        userId: user.id,
        action: 'login_failed',
        target: user.username,
        ip,
        details: { reason: 'invalid_password' },
      });

      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    // Generate tokens
    const adminUser: AdminUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      totpEnabled: user.totp_enabled,
    };

    const accessToken = generateAdminAccessToken(adminUser);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);

    // Calculate expiration (7 days from now)
    const expiresAt = new Date(Date.now() + REFRESH_COOKIE_MAX_AGE * 1000);

    // Store session
    await pool.query(
      `INSERT INTO admin_sessions (user_id, refresh_token_hash, ip, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, refreshTokenHash, ip, userAgent.substring(0, 255), expiresAt]
    );

    // Log successful login
    await logAction({
      userId: user.id,
      action: 'login',
      ip,
    });

    // Set refresh token cookie
    setRefreshCookie(res, refreshToken);

    res.json({
      accessToken,
      totpRequired: user.totp_enabled,
    });
  } catch (error) {
    console.error('[Admin Login] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Login failed',
    });
  }
});

// ============================================================================
// POST /refresh
// ============================================================================

router.post('/refresh', adminPostRateLimiter, async (req: Request, res: Response) => {
  try {
    // Read refresh token from cookie
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Missing refresh token',
      });
    }

    const refreshTokenHash = hashRefreshToken(refreshToken);
    const pool = getPostgresPool();

    // Find valid session
    const sessionResult = await pool.query<{
      id: string;
      user_id: string;
      expires_at: Date;
    }>(
      `SELECT s.id, s.user_id, s.expires_at
       FROM admin_sessions s
       WHERE s.refresh_token_hash = $1 AND s.expires_at > NOW()`,
      [refreshTokenHash]
    );

    if (sessionResult.rows.length === 0) {
      clearRefreshCookie(res);
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired refresh token',
      });
    }

    const session = sessionResult.rows[0];

    // Get user data
    const userResult = await pool.query<{
      id: string;
      username: string;
      role: string;
      totp_enabled: boolean;
    }>(
      `SELECT id, username, role, totp_enabled
       FROM admin_users
       WHERE id = $1`,
      [session.user_id]
    );

    if (userResult.rows.length === 0) {
      // User deleted, invalidate session
      await pool.query(`DELETE FROM admin_sessions WHERE id = $1`, [session.id]);
      clearRefreshCookie(res);

      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];

    // Generate new access token
    const adminUser: AdminUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      totpEnabled: user.totp_enabled,
    };

    const accessToken = generateAdminAccessToken(adminUser);

    res.json({
      accessToken,
    });
  } catch (error) {
    console.error('[Admin Refresh] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Token refresh failed',
    });
  }
});

// ============================================================================
// POST /logout
// ============================================================================

router.post('/logout', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const adminUser = req.adminUser!;
    const ip = getClientIP(req);
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    const pool = getPostgresPool();

    if (refreshToken) {
      const refreshTokenHash = hashRefreshToken(refreshToken);
      // Delete the specific session
      await pool.query(
        `DELETE FROM admin_sessions WHERE user_id = $1 AND refresh_token_hash = $2`,
        [adminUser.id, refreshTokenHash]
      );
    }

    // Log logout
    await logAction({
      userId: adminUser.id,
      action: 'logout',
      ip,
    });

    // Clear cookie
    clearRefreshCookie(res);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[Admin Logout] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Logout failed',
    });
  }
});

// ============================================================================
// POST /totp/setup
// ============================================================================

router.post('/totp/setup', requireAdminAuth, adminPostRateLimiter, async (req: Request, res: Response) => {
  try {
    const adminUser = req.adminUser!;
    const ip = getClientIP(req);

    // Check if TOTP is already enabled
    if (adminUser.totpEnabled) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'TOTP is already enabled. Disable it first to set up a new secret.',
      });
    }

    // Generate new TOTP secret
    const secret = generateTotpSecret();
    const otpauthUri = generateTotpUri(secret, adminUser.username);

    // Encrypt and store temporarily (not enabled yet)
    const encryptedSecret = encryptTotpSecret(secret);

    const pool = getPostgresPool();
    await pool.query(
      `UPDATE admin_users SET totp_secret_encrypted = $1 WHERE id = $2`,
      [encryptedSecret, adminUser.id]
    );

    // Log setup initiation
    await logAction({
      userId: adminUser.id,
      action: 'totp_setup_initiated',
      ip,
    });

    // Generate QR code URL using Google Charts API (simple, no extra deps)
    const qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(otpauthUri)}`;

    res.json({
      secret: otpauthUri,
      qrCodeUrl,
    });
  } catch (error) {
    console.error('[Admin TOTP Setup] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'TOTP setup failed',
    });
  }
});

// ============================================================================
// POST /totp/verify
// ============================================================================

router.post('/totp/verify', requireAdminAuth, adminPostRateLimiter, async (req: Request, res: Response) => {
  try {
    const adminUser = req.adminUser!;
    const ip = getClientIP(req);
    const { code } = req.body;

    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid code format. Must be 6 digits.',
      });
    }

    const pool = getPostgresPool();

    // Get stored (but not yet enabled) secret
    const result = await pool.query<{ totp_secret_encrypted: string; totp_enabled: boolean }>(
      `SELECT totp_secret_encrypted, totp_enabled FROM admin_users WHERE id = $1`,
      [adminUser.id]
    );

    if (result.rows.length === 0 || !result.rows[0].totp_secret_encrypted) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'TOTP not set up. Call /totp/setup first.',
      });
    }

    // If already enabled, this is re-verification (not allowed here)
    if (result.rows[0].totp_enabled) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'TOTP is already enabled.',
      });
    }

    // Decrypt and verify
    const secret = decryptTotpSecret(result.rows[0].totp_secret_encrypted);
    const isValid = verifyTotpCode(secret, code, adminUser.username);

    if (!isValid) {
      await logAction({
        userId: adminUser.id,
        action: 'totp_verify_failed',
        ip,
      });

      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid TOTP code',
      });
    }

    // Enable TOTP
    await pool.query(
      `UPDATE admin_users SET totp_enabled = true WHERE id = $1`,
      [adminUser.id]
    );

    // Log success
    await logAction({
      userId: adminUser.id,
      action: 'totp_enabled',
      ip,
    });

    res.json({ message: 'TOTP enabled successfully' });
  } catch (error) {
    console.error('[Admin TOTP Verify] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'TOTP verification failed',
    });
  }
});

// ============================================================================
// GET /audit (for reading audit logs - future use)
// ============================================================================

router.get('/audit', requireAdminAuth, adminGetRateLimiter, async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0', userId, action } = req.query;

    const { getAuditLogs } = await import('../services/auditService');

    const result = await getAuditLogs({
      limit: Math.min(parseInt(limit as string, 10) || 50, 100),
      offset: parseInt(offset as string, 10) || 0,
      userId: userId as string | undefined,
      action: action as string | undefined,
    });

    res.json(result);
  } catch (error) {
    console.error('[Admin Audit] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to fetch audit logs',
    });
  }
});

export default router;
