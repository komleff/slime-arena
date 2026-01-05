import express, { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';

const router = express.Router();
const authService = new AuthService();

/**
 * POST /api/v1/auth/verify
 * Verify platform authentication and create session
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { platformType, platformAuthToken } = req.body;

    if (!platformType || !platformAuthToken) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'platformType and platformAuthToken are required',
      });
    }

    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');

    const { user, session } = await authService.verifyAndCreateSession(
      platformType,
      platformAuthToken,
      ip,
      userAgent
    );

    res.json({
      accessToken: session.accessToken,
      userId: user.id,
      profile: {
        nickname: user.nickname,
        locale: user.locale,
      },
    });
  } catch (error: any) {
    console.error('[Auth] Verification error:', error);
    res.status(401).json({
      error: 'auth_failed',
      message: error.message || 'Authentication failed',
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Revoke current session
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const accessToken = authHeader.substring(7);
    await authService.revokeSession(accessToken);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Auth] Logout error:', error);
    res.status(500).json({
      error: 'logout_failed',
      message: error.message || 'Logout failed',
    });
  }
});

export default router;
