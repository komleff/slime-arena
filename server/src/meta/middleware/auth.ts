import { Request, Response, NextFunction } from 'express';
import { AuthService, User } from '../services/AuthService';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

const authService = new AuthService();

// Admin user IDs (from environment or hardcoded for dev)
const ADMIN_USER_IDS = new Set(
  (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean)
);

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const accessToken = authHeader.substring(7);
    const user = await authService.verifySession(accessToken);

    if (!user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid or expired session',
      });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error: any) {
    console.error('[Auth Middleware] Error:', error);
    res.status(500).json({
      error: 'auth_error',
      message: 'Authentication verification failed',
    });
  }
}

/**
 * Require admin role
 * Must be used after requireAuth
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required',
      });
    }

    // Check if user is admin
    const isAdmin = ADMIN_USER_IDS.has(req.user.id) || 
                    ADMIN_USER_IDS.has(req.user.platformId) ||
                    // Dev mode: allow all in development
                    (process.env.NODE_ENV === 'development' && req.user.platformType === 'dev');

    if (!isAdmin) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Admin access required',
      });
    }

    next();
  } catch (error: any) {
    console.error('[Admin Middleware] Error:', error);
    res.status(500).json({
      error: 'auth_error',
      message: 'Admin verification failed',
    });
  }
}

// Alias for backward compatibility
export const authMiddleware = requireAuth;

/**
 * Require Server Token auth for server-to-server communication
 * Uses shared secret from MATCH_SERVER_TOKEN environment variable
 */
export function requireServerToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.get('authorization');

    if (!authHeader || !authHeader.startsWith('ServerToken ')) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Missing or invalid server token',
      });
    }

    const token = authHeader.substring(12);
    const expectedToken = process.env.MATCH_SERVER_TOKEN;

    if (!expectedToken) {
      console.error('[ServerToken] MATCH_SERVER_TOKEN not configured');
      return res.status(500).json({
        error: 'server_error',
        message: 'Server token not configured',
      });
    }

    if (token !== expectedToken) {
      console.warn('[ServerToken] Invalid token received');
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid server token',
      });
    }

    next();
  } catch (error: any) {
    console.error('[ServerToken Middleware] Error:', error);
    res.status(500).json({
      error: 'auth_error',
      message: 'Server token verification failed',
    });
  }
}

