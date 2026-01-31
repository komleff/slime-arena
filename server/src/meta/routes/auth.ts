import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import { AuthService } from '../services/AuthService';
import { TelegramAuthProvider } from '../platform/TelegramAuthProvider';
import { getGoogleOAuthProvider } from '../platform/GoogleOAuthProvider';
import { getYandexOAuthProvider, YandexOAuthProvider } from '../platform/YandexOAuthProvider';
import { getOAuthProviderFactory } from '../platform/OAuthProviderFactory';
import { getGeoIPService } from '../services/GeoIPService';
import { AuthProvider } from '../models/OAuth';
import {
  generateGuestToken,
  generateAccessToken,
  verifyAccessToken,
  verifyGuestToken,
  verifyClaimToken,
  generatePendingAuthToken,
  verifyPendingAuthToken,
  calculateExpiresAt,
  TOKEN_EXPIRATION,
} from '../utils/jwtUtils';
import { ratingService } from '../services/RatingService';
import { getPostgresPool } from '../../db/pool';
import { getRedisClient } from '../../db/redis';

const router = express.Router();
const authService = new AuthService();

// Copilot P3: Удалена локальная обёртка getPool(), используем getPostgresPool() напрямую

/**
 * Создаёт Redis ключ для pendingAuthToken с использованием sha256 хэша
 * для предотвращения коллизий (Copilot P3)
 */
function getPendingAuthRedisKey(token: string): string {
  const hash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
  return `pending_auth:${hash}`;
}

/**
 * Get match result info for claim validation
 * Returns players count and claim_consumed_at status
 */
async function getMatchResultInfo(matchId: string): Promise<{
  playersCount: number;
  claimConsumedAt: Date | null;
} | null> {
  const pool = getPostgresPool();
  const result = await pool.query(
    `SELECT summary, claim_consumed_at FROM match_results WHERE match_id = $1`,
    [matchId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const summary = typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary;

  // Проверяем наличие playerResults - это обязательное поле для корректных матчей
  if (!summary || !Array.isArray(summary.playerResults)) {
    throw new Error(`Invalid match summary for match_id=${matchId}: playerResults is missing or invalid`);
  }

  const playersCount = summary.playerResults.length;

  return {
    playersCount,
    claimConsumedAt: row.claim_consumed_at,
  };
}

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
      message: 'Failed to create guest token',
    });
  }
});

/**
 * GET /api/v1/auth/config
 * Returns available OAuth providers for the client's region
 *
 * @see docs/meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 9.3
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    // Получаем IP клиента
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.ip
      || req.socket.remoteAddress
      || '127.0.0.1';

    const acceptLanguage = req.get('accept-language');

    // Определяем регион
    const geoService = getGeoIPService();
    const geoResult = await geoService.detectRegion(ip, acceptLanguage);

    // Получаем доступных провайдеров для региона
    const factory = getOAuthProviderFactory();
    const providers = factory.getProvidersForRegion(geoResult.region);

    console.log(`[Auth] Config: IP ${ip} → ${geoResult.region} (${geoResult.source}), providers: ${providers.map(p => p.name).join(', ') || 'none'}`);

    res.json({
      region: geoResult.region,
      providers,
    });
  } catch (error: any) {
    console.error('[Auth] Config error:', error);
    res.status(500).json({
      error: 'config_failed',
      message: 'Failed to get auth configuration',
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
      message: 'Telegram authentication failed',
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
      message: 'Authentication failed',
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

    // P1 Security: Проверка региональной доступности провайдера
    // Предотвращает обход ограничений через прямой вызов /auth/oauth
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.ip
      || req.socket.remoteAddress
      || '127.0.0.1';
    const acceptLanguage = req.get('accept-language');

    const geoService = getGeoIPService();
    const geoResult = await geoService.detectRegion(ip, acceptLanguage);

    const providerFactory = getOAuthProviderFactory();
    if (!providerFactory.isProviderAvailable(provider, geoResult.region)) {
      console.log(`[Auth] OAuth blocked: ${provider} not available in region ${geoResult.region} (IP: ${ip})`);
      return res.status(403).json({
        error: 'provider_not_available',
        message: `Provider ${provider} is not available in your region`,
      });
    }

    let providerUserId: string;

    // Exchange code for user info (только для получения providerUserId)
    if (provider === 'google') {
      try {
        const googleProvider = getGoogleOAuthProvider();
        const userInfo = await googleProvider.exchangeCode(code);
        providerUserId = userInfo.id;
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
      message: 'OAuth authentication failed',
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

    // Get match info for player count (P1-4)
    // Note: claim consumption check moved to atomic markClaimConsumed inside transaction
    const matchInfo = await getMatchResultInfo(matchId);
    if (!matchInfo) {
      return res.status(404).json({
        error: 'match_not_found',
        message: 'Match not found',
      });
    }

    // Get actual players count from match_results (P1-4)
    const playersInMatch = matchInfo.playersCount;

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

      // P1-4 Security: Проверка региональной доступности провайдера для convert_guest.
      // Предотвращает обход ограничений через прямой вызов /auth/upgrade.
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.ip
        || req.socket.remoteAddress
        || '127.0.0.1';
      const acceptLanguage = req.get('accept-language');

      const geoService = getGeoIPService();
      const geoResult = await geoService.detectRegion(ip, acceptLanguage);

      const providerFactory = getOAuthProviderFactory();
      if (!providerFactory.isProviderAvailable(provider, geoResult.region)) {
        console.log(`[Auth] Upgrade blocked: ${provider} not available in region ${geoResult.region} (IP: ${ip})`);
        return res.status(403).json({
          error: 'provider_not_available',
          message: `Provider ${provider} is not available in your region`,
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
      const existingUser = await authService.findUserByOAuthLink(provider as AuthProvider, providerUserId);
      if (existingUser) {
        // ТЗ раздел 10: OAuth уже привязан к другому аккаунту
        // Copilot P2: Проверяем Redis ДО генерации токена
        // Если Redis недоступен, нет смысла генерировать токен
        let redis;
        try {
          redis = getRedisClient();
        } catch (redisErr) {
          console.error('[Auth] Redis unavailable - returning 503:', redisErr);
          return res.status(503).json({
            error: 'service_unavailable',
            message: 'Authentication service temporarily unavailable. Please try again.',
          });
        }

        // Генерируем pendingAuthToken для возможности входа в существующий аккаунт
        const pendingAuthToken = generatePendingAuthToken({
          provider,
          providerUserId,
          existingUserId: existingUser.id,
        });

        // Сохраняем токен в Redis для одноразовости (5 минут)
        // ВАЖНО: Redis обязателен для безопасности — без него токен можно использовать многократно
        try {
          const tokenKey = getPendingAuthRedisKey(pendingAuthToken);
          await redis.set(tokenKey, 'valid', { EX: 300 }); // 5 минут
        } catch (redisErr) {
          console.error('[Auth] Redis set failed for pendingAuthToken - returning 503:', redisErr);
          return res.status(503).json({
            error: 'service_unavailable',
            message: 'Authentication service temporarily unavailable. Please try again.',
          });
        }

        // Получаем totalMass существующего пользователя из leaderboard_total_mass
        let existingTotalMass = 0;
        try {
          const pool = getPostgresPool();
          const result = await pool.query(
            'SELECT total_mass FROM leaderboard_total_mass WHERE user_id = $1',
            [existingUser.id]
          );
          if (result.rows.length > 0) {
            existingTotalMass = result.rows[0].total_mass || 0;
          }
        } catch {
          // Игнорируем ошибку получения рейтинга
        }

        console.log(`[Auth] OAuth conflict: ${provider} user ${providerUserId.slice(0, 8)}... already linked to ${existingUser.id.slice(0, 8)}...`);

        return res.status(409).json({
          error: 'oauth_already_linked',
          pendingAuthToken,
          existingAccount: {
            userId: existingUser.id,
            nickname: existingUser.nickname,
            totalMass: existingTotalMass,
            avatarUrl: existingUser.avatarUrl,
          },
        });
      }

      // RACE CONDITION PROTECTION (slime-arena-ww8):
      // All operations executed in a single DB transaction.
      // markClaimConsumed uses UPDATE ... WHERE claim_consumed_at IS NULL
      // to atomically check and set, preventing double-claim race conditions.
      const client = await authService.getClient();
      let user;
      try {
        await client.query('BEGIN');

        // Atomically mark claim as consumed first to prevent race conditions (P1-5)
        const claimConsumed = await authService.markClaimConsumed(matchId, subjectId, client);
        if (!claimConsumed) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(409).json({
            error: 'claim_already_consumed',
            message: 'This claim token has already been used',
          });
        }

        // Create registered user
        user = await authService.createUserFromGuest(
          provider as AuthProvider,
          providerUserId,
          nickname,
          avatarUrl,
          matchId,
          skinId,
          client
        );

        // Initialize ratings with actual players count from match_results (P1-4)
        await ratingService.initializeRating(user.id, claimPayload, playersInMatch, client);

        await client.query('COMMIT');
      } catch (txError) {
        await client.query('ROLLBACK');
        throw txError;
      } finally {
        client.release();
      }

      // Generate access token
      const accessTokenNew = generateAccessToken(user.id, false);

      console.log(`[Auth] Upgrade convert_guest: guest ${subjectId.slice(0, 8)}... -> user ${user.id.slice(0, 8)}... (${playersInMatch} players)`);

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

      // RACE CONDITION PROTECTION (slime-arena-ww8):
      // All operations executed in a single DB transaction.
      // markClaimConsumed uses UPDATE ... WHERE claim_consumed_at IS NULL
      // to atomically check and set, preventing double-claim race conditions.
      const client = await authService.getClient();
      let user;
      try {
        await client.query('BEGIN');

        // Atomically mark claim as consumed first to prevent race conditions (P1-5)
        const claimConsumed = await authService.markClaimConsumed(matchId, subjectId, client);
        if (!claimConsumed) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(409).json({
            error: 'claim_already_consumed',
            message: 'This claim token has already been used',
          });
        }

        // Complete profile
        user = await authService.completeAnonymousProfile(
          accessPayload.sub,
          matchId,
          skinId,
          client
        );

        // Initialize ratings with actual players count from match_results (P1-4)
        await ratingService.initializeRating(user.id, claimPayload, playersInMatch, client);

        await client.query('COMMIT');
      } catch (txError) {
        await client.query('ROLLBACK');
        throw txError;
      } finally {
        client.release();
      }

      // Generate new access token (with isAnonymous = false)
      const accessTokenNew = generateAccessToken(user.id, false);

      console.log(`[Auth] Upgrade complete_profile: user ${user.id.slice(0, 8)}... completed profile (${playersInMatch} players)`);

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
      message: 'Upgrade failed',
    });
  }
});

/**
 * POST /api/v1/auth/oauth/resolve
 * Login to existing account using pendingAuthToken (after 409 conflict)
 *
 * @see docs/meta-min/TZ-StandaloneAdapter-OAuth-v1.9.md раздел 9.4, 10
 */
router.post('/oauth/resolve', async (req: Request, res: Response) => {
  try {
    const { pendingAuthToken } = req.body;

    if (!pendingAuthToken) {
      return res.status(400).json({
        error: 'missing_parameters',
        message: 'pendingAuthToken is required',
      });
    }

    // Verify pendingAuthToken
    const payload = verifyPendingAuthToken(pendingAuthToken);
    if (!payload) {
      return res.status(400).json({
        error: 'invalid_token',
        message: 'Invalid or expired pendingAuthToken',
      });
    }

    // Check one-time use via Redis
    // ВАЖНО: Redis обязателен — без него нельзя гарантировать одноразовость токена
    let redis;
    try {
      redis = getRedisClient();
    } catch (redisErr) {
      console.error('[Auth] Redis unavailable for pendingAuthToken check - returning 503:', redisErr);
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'Authentication service temporarily unavailable. Please try again.',
      });
    }

    try {
      const tokenKey = getPendingAuthRedisKey(pendingAuthToken);
      const exists = await redis.get(tokenKey);

      if (!exists) {
        // Токен уже использован или истёк в Redis
        return res.status(410).json({
          error: 'token_already_used',
          message: 'This pendingAuthToken has already been used',
        });
      }

      // Удаляем токен из Redis (одноразовое использование)
      await redis.del(tokenKey);
    } catch (redisErr) {
      console.error('[Auth] Redis operation failed for pendingAuthToken - returning 503:', redisErr);
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'Authentication service temporarily unavailable. Please try again.',
      });
    }

    // Get existing user
    const user = await authService.getUserById(payload.existingUserId);
    if (!user) {
      return res.status(404).json({
        error: 'user_not_found',
        message: 'User no longer exists',
      });
    }

    // Update last login
    await authService.updateLastLogin(user.id);

    // Generate access token
    const accessToken = generateAccessToken(user.id, user.isAnonymous);

    console.log(`[Auth] OAuth resolve: ${payload.provider} -> user ${user.id.slice(0, 8)}...`);

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
    console.error('[Auth] OAuth resolve error:', error);
    res.status(500).json({
      error: 'resolve_failed',
      message: 'OAuth resolve failed',
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
      message: 'Logout failed',
    });
  }
});

export default router;
