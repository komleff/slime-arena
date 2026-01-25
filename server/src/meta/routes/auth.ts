import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '../services/AuthService';
import { TelegramAuthProvider } from '../platform/TelegramAuthProvider';
import { getGoogleOAuthProvider } from '../platform/GoogleOAuthProvider';
import { getYandexOAuthProvider, YandexOAuthProvider } from '../platform/YandexOAuthProvider';
import { AuthProvider } from '../models/OAuth';
import {
  generateGuestToken,
  generateAccessToken,
  verifyAccessToken,
  verifyGuestToken,
  verifyClaimToken,
  calculateExpiresAt,
  TOKEN_EXPIRATION,
} from '../utils/jwtUtils';
import { ratingService } from '../services/RatingService';

const router = express.Router();
const authService = new AuthService();

// Telegram auth provider (lazy init to avoid startup errors if not configured)
let telegramProvider: TelegramAuthProvider | null = null;
function getTelegramProvider(): TelegramAuthProvider {
  if (!telegramProvider) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
    telegramProvider = new TelegramAuthProvider(botToken);
  }
  return telegramProvider;
}

/**
 * POST /api/v1/auth/guest
 * Generate guest token for Standalone platform
 * Does NOT create any database records
 */
router.post('/guest', async (req: Request, res: Response) => {
  try {
    // Generate unique guest identifier
    const guestSubjectId = uuidv4();

    // Generate JWT guest token (7 days)
    const guestToken = generateGuestToken(guestSubjectId);

    // Calculate expiration date
    const expiresAt = calculateExpiresAt(TOKEN_EXPIRATION.GUEST_TOKEN);

    console.log(`[Auth] Guest token created for subject ${guestSubjectId.slice(0, 8)}...`);

    res.json({
      guestToken,
      guestSubjectId,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error('[Auth] Guest token error:', error);
    res.status(500).json({
      error: 'guest_token_failed',
      message: error.message || 'Failed to create guest token',
    });
  }
});

/**
 * POST /api/v1/auth/telegram
 * Telegram silent auth - creates anonymous user or returns existing
 *
 * For new users: creates user with is_anonymous=true
 * For existing users: returns existing profile
 */
router.post('/telegram', async (req: Request, res: Response) => {
  try {
    const { initData } = req.body;

    if (!initData) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'initData is required',
      });
    }

    // Verify Telegram initData
    const provider = getTelegramProvider();
    const platformUser = await provider.verifyToken(initData);
    const { platformUserId, nickname, avatarUrl, metadata } = platformUser;

    // Look up user by oauth_link
    let user = await authService.findUserByOAuthLink('telegram', platformUserId);
    let isNewUser = false;

    if (!user) {
      // Create new anonymous user
      const result = await authService.createTelegramAnonymousUser(
        platformUserId,
        nickname,
        avatarUrl,
        metadata
      );
      user = result.user;
      isNewUser = true;
      console.log(`[Auth] New Telegram user created: ${user.id.slice(0, 8)}... (anonymous)`);
    } else {
      // Update last login for existing user
      await authService.updateLastLogin(user.id);
      console.log(`[Auth] Telegram user logged in: ${user.id.slice(0, 8)}... (anonymous: ${user.isAnonymous})`);
    }

    // Generate JWT access token with isAnonymous flag
    const accessToken = generateAccessToken(user.id, user.isAnonymous);

    res.json({
      accessToken,
      userId: user.id,
      profile: {
        nickname: user.nickname,
        locale: user.locale,
      },
      isNewUser,
      isAnonymous: user.isAnonymous,
    });
  } catch (error: any) {
    console.error('[Auth] Telegram auth error:', error);

    // Specific error for misconfiguration
    if (error.message.includes('TELEGRAM_BOT_TOKEN')) {
      return res.status(500).json({
        error: 'configuration_error',
        message: 'Telegram auth not configured',
      });
    }

    res.status(401).json({
      error: 'telegram_auth_failed',
      message: error.message || 'Telegram authentication failed',
    });
  }
});

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
 * POST /api/v1/auth/oauth
 * OAuth login (Google/Yandex) - for existing accounts only
 *
 * Does NOT create new accounts. Returns 404 if account not found.
 * Account creation happens via auth/upgrade endpoint.
 */
router.post('/oauth', async (req: Request, res: Response) => {
  try {
    const { provider, code } = req.body;

    if (!provider || !code) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'provider and code are required',
      });
    }

    if (provider !== 'google' && provider !== 'yandex') {
      return res.status(400).json({
        error: 'invalid_provider',
        message: 'provider must be "google" or "yandex"',
      });
    }

    let providerUserId: string;
    let nickname: string;
    let avatarUrl: string | undefined;

    // Exchange code for user info
    if (provider === 'google') {
      try {
        const googleProvider = getGoogleOAuthProvider();
        const userInfo = await googleProvider.exchangeCode(code);
        providerUserId = userInfo.id;
        nickname = userInfo.name || userInfo.email.split('@')[0];
        avatarUrl = userInfo.picture;
      } catch (err: any) {
        if (err.message.includes('must be set')) {
          return res.status(500).json({
            error: 'configuration_error',
            message: 'Google OAuth not configured',
          });
        }
        throw err;
      }
    } else {
      try {
        const yandexProvider = getYandexOAuthProvider();
        const userInfo = await yandexProvider.exchangeCode(code);
        providerUserId = userInfo.id;
        nickname = userInfo.display_name || userInfo.login;
        avatarUrl = YandexOAuthProvider.getAvatarUrl(userInfo.default_avatar_id);
      } catch (err: any) {
        if (err.message.includes('must be set')) {
          return res.status(500).json({
            error: 'configuration_error',
            message: 'Yandex OAuth not configured',
          });
        }
        throw err;
      }
    }

    // Look up user by oauth_link
    const user = await authService.findUserByOAuthLink(provider as AuthProvider, providerUserId);

    if (!user) {
      // Account not found - return 404
      // User must use auth/upgrade to create account
      return res.status(404).json({
        error: 'account_not_found',
        message: 'No account found for this OAuth provider. Use upgrade flow to create account.',
      });
    }

    // Update last login
    await authService.updateLastLogin(user.id);

    // Generate access token
    const accessToken = generateAccessToken(user.id, user.isAnonymous);

    console.log(`[Auth] OAuth login: ${provider} user ${providerUserId.slice(0, 8)}... -> ${user.id.slice(0, 8)}...`);

    res.json({
      accessToken,
      userId: user.id,
      profile: {
        nickname: user.nickname,
        locale: user.locale,
      },
      isAnonymous: user.isAnonymous,
    });
  } catch (error: any) {
    console.error('[Auth] OAuth error:', error);
    res.status(401).json({
      error: 'oauth_failed',
      message: error.message || 'OAuth authentication failed',
    });
  }
});

/**
 * POST /api/v1/auth/upgrade
 * Upgrade guest/anonymous user to registered
 *
 * Two modes:
 * - convert_guest: guestToken + OAuth + claimToken → new registered user
 * - complete_profile: accessToken (anonymous) + claimToken → complete existing user
 */
router.post('/upgrade', async (req: Request, res: Response) => {
  try {
    const { mode, claimToken, provider, code } = req.body;

    if (!mode || !claimToken) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'mode and claimToken are required',
      });
    }

    if (mode !== 'convert_guest' && mode !== 'complete_profile') {
      return res.status(400).json({
        error: 'invalid_mode',
        message: 'mode must be "convert_guest" or "complete_profile"',
      });
    }

    // Verify claimToken
    const claimPayload = verifyClaimToken(claimToken);
    if (!claimPayload) {
      return res.status(401).json({
        error: 'invalid_claim_token',
        message: 'Invalid or expired claim token',
      });
    }

    const { matchId, subjectId, finalMass, skinId } = claimPayload;

    // Extract auth header
    const authHeader = req.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authorization header required',
      });
    }

    const token = authHeader.substring(7);

    if (mode === 'convert_guest') {
      // Mode: convert_guest
      // Auth: guestToken
      // Required: provider, code

      if (!provider || !code) {
        return res.status(400).json({
          error: 'missing_parameters',
          message: 'provider and code are required for convert_guest mode',
        });
      }

      if (provider !== 'google' && provider !== 'yandex') {
        return res.status(400).json({
          error: 'invalid_provider',
          message: 'provider must be "google" or "yandex"',
        });
      }

      // Verify guestToken
      const guestPayload = verifyGuestToken(token);
      if (!guestPayload) {
        return res.status(401).json({
          error: 'invalid_token',
          message: 'Invalid or expired guest token',
        });
      }

      // Verify claim belongs to this guest
      if (guestPayload.sub !== subjectId) {
        return res.status(403).json({
          error: 'forbidden',
          message: 'Claim token does not belong to this guest',
        });
      }

      // Exchange OAuth code
      let providerUserId: string;
      let nickname: string;
      let avatarUrl: string | undefined;

      if (provider === 'google') {
        try {
          const googleProvider = getGoogleOAuthProvider();
          const userInfo = await googleProvider.exchangeCode(code);
          providerUserId = userInfo.id;
          nickname = userInfo.name || userInfo.email.split('@')[0];
          avatarUrl = userInfo.picture;
        } catch (err: any) {
          if (err.message.includes('must be set')) {
            return res.status(500).json({
              error: 'configuration_error',
              message: 'Google OAuth not configured',
            });
          }
          throw err;
        }
      } else {
        try {
          const yandexProvider = getYandexOAuthProvider();
          const userInfo = await yandexProvider.exchangeCode(code);
          providerUserId = userInfo.id;
          nickname = userInfo.display_name || userInfo.login;
          avatarUrl = YandexOAuthProvider.getAvatarUrl(userInfo.default_avatar_id);
        } catch (err: any) {
          if (err.message.includes('must be set')) {
            return res.status(500).json({
              error: 'configuration_error',
              message: 'Yandex OAuth not configured',
            });
          }
          throw err;
        }
      }

      // Check if OAuth link already exists (conflict)
      const linkExists = await authService.oauthLinkExists(provider as AuthProvider, providerUserId);
      if (linkExists) {
        return res.status(409).json({
          error: 'oauth_conflict',
          message: 'This OAuth account is already linked to another user',
        });
      }

      // Create registered user
      const user = await authService.createUserFromGuest(
        provider as AuthProvider,
        providerUserId,
        nickname,
        avatarUrl,
        matchId,
        skinId
      );

      // Initialize ratings
      await ratingService.initializeRating(user.id, claimPayload, 1); // playersInMatch = 1 for initial

      // Mark claim as consumed
      await authService.markClaimConsumed(matchId, subjectId);

      // Generate access token
      const accessTokenNew = generateAccessToken(user.id, false);

      console.log(`[Auth] Upgrade convert_guest: guest ${subjectId.slice(0, 8)}... -> user ${user.id.slice(0, 8)}...`);

      res.json({
        accessToken: accessTokenNew,
        userId: user.id,
        profile: {
          nickname: user.nickname,
          locale: user.locale,
        },
        isAnonymous: false,
        rating: {
          totalMass: finalMass,
          bestMass: finalMass,
          matchesPlayed: 1,
        },
      });

    } else {
      // Mode: complete_profile
      // Auth: accessToken (for Telegram-anonymous user)

      // Verify accessToken
      const accessPayload = verifyAccessToken(token);
      if (!accessPayload) {
        return res.status(401).json({
          error: 'invalid_token',
          message: 'Invalid or expired access token',
        });
      }

      // Check if user is anonymous
      if (!accessPayload.isAnonymous) {
        return res.status(400).json({
          error: 'not_anonymous',
          message: 'User is already registered (not anonymous)',
        });
      }

      // Verify claim belongs to this user
      if (accessPayload.sub !== subjectId) {
        return res.status(403).json({
          error: 'forbidden',
          message: 'Claim token does not belong to this user',
        });
      }

      // Complete profile
      const user = await authService.completeAnonymousProfile(
        accessPayload.sub,
        matchId,
        skinId
      );

      // Initialize ratings
      await ratingService.initializeRating(user.id, claimPayload, 1);

      // Mark claim as consumed
      await authService.markClaimConsumed(matchId, subjectId);

      // Generate new access token (with isAnonymous = false)
      const accessTokenNew = generateAccessToken(user.id, false);

      console.log(`[Auth] Upgrade complete_profile: user ${user.id.slice(0, 8)}... completed profile`);

      res.json({
        accessToken: accessTokenNew,
        userId: user.id,
        profile: {
          nickname: user.nickname,
          locale: user.locale,
        },
        isAnonymous: false,
        rating: {
          totalMass: finalMass,
          bestMass: finalMass,
          matchesPlayed: 1,
        },
      });
    }
  } catch (error: any) {
    console.error('[Auth] Upgrade error:', error);
    res.status(500).json({
      error: 'upgrade_failed',
      message: error.message || 'Upgrade failed',
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
