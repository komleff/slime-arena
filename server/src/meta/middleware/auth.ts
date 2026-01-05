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
