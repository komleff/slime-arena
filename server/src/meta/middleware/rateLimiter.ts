/**
 * Rate Limiter Middleware
 *
 * Защита от брутфорса и DoS-атак на /auth/* endpoints.
 * Использует in-memory хранилище (достаточно для MVP/soft-launch).
 *
 * При масштабировании на несколько инстансов:
 * - Заменить Map на Redis store
 * - Использовать общий ключ для всех инстансов
 *
 * @see slime-arena-3ed
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Хранилище счётчиков по IP
const limits = new Map<string, RateLimitRecord>();

// Интервал очистки устаревших записей (5 минут)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Очистка устаревших записей для предотвращения утечки памяти
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of limits) {
    if (now > record.resetAt) {
      limits.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Флаг доверия к X-Forwarded-For.
 * ВАЖНО: Установите TRUST_PROXY=true ТОЛЬКО за reverse proxy (nginx, cloudflare).
 * По умолчанию false для защиты от IP spoofing.
 */
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

/**
 * Получить IP-адрес клиента с учётом прокси.
 * P2-1: X-Forwarded-For доверяем только при TRUST_PROXY=true.
 * @public Экспортируется для использования в admin.ts и других модулях
 */
export function getClientIP(req: Request): string {
  // P2-1: Доверяем X-Forwarded-For только при явном TRUST_PROXY=true
  if (TRUST_PROXY) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // X-Forwarded-For может содержать список IP: "client, proxy1, proxy2"
      const clientIP = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return clientIP.trim();
    }
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Создаёт middleware для rate limiting
 *
 * @param windowMs - Окно времени в миллисекундах (default: 60000 = 1 минута)
 * @param maxRequests - Максимум запросов за окно (default: 10)
 * @param keyPrefix - Префикс для ключа (позволяет разделить лимиты для разных endpoints)
 */
export function rateLimit(
  windowMs = 60 * 1000,
  maxRequests = 10,
  keyPrefix = 'auth'
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIP(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    const record = limits.get(key);

    // Новый клиент или окно истекло — создаём новую запись
    if (!record || now > record.resetAt) {
      limits.set(key, { count: 1, resetAt: now + windowMs });
      // Добавляем заголовки для отладки (опционально)
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      return next();
    }

    // Лимит превышен
    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

      console.warn(`[RateLimiter] Rate limit exceeded for ${ip} on ${req.path}`);

      res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Слишком много запросов. Попробуйте позже.',
        retryAfter,
      });
      return;
    }

    // Увеличиваем счётчик
    record.count++;
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    next();
  };
}

/**
 * Предустановленный rate limiter для auth endpoints
 * 10 запросов в минуту — баланс между UX и защитой
 */
export const authRateLimiter = rateLimit(60 * 1000, 10, 'auth');

/**
 * Более строгий rate limiter для OAuth endpoints
 * 5 запросов в минуту — OAuth коды одноразовые, частые запросы подозрительны
 */
export const oauthRateLimiter = rateLimit(60 * 1000, 5, 'oauth');

/**
 * Строгий rate limiter для TOTP endpoints
 * 3 запроса в минуту — защита от брутфорса 6-значных кодов
 */
export const totpRateLimiter = rateLimit(60 * 1000, 3, 'totp');

/**
 * Rate limiter для authenticated endpoints (per-user).
 * Использует user ID из req.adminUser.id вместо IP.
 * Требует requireAdminAuth middleware перед собой.
 *
 * @see TZ-MON-v1_6-Backend.md:170-172
 */
export function userRateLimit(
  windowMs = 60 * 1000,
  maxRequests = 10,
  keyPrefix = 'user'
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Используем adminUser.id (устанавливается requireAdminAuth middleware)
    const userId = (req as any).adminUser?.id;
    if (!userId) {
      // Fallback на IP если adminUser отсутствует
      return rateLimit(windowMs, maxRequests, keyPrefix)(req, res, next);
    }

    const key = `${keyPrefix}:user:${userId}`;
    const now = Date.now();

    const record = limits.get(key);

    if (!record || now > record.resetAt) {
      limits.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

      console.warn(`[RateLimiter] User rate limit exceeded for user ${userId} on ${req.path}`);

      res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'Слишком много запросов. Попробуйте позже.',
        retryAfter,
      });
      return;
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    next();
  };
}

/**
 * Per-user rate limiter для admin POST endpoints
 * 10 запросов в минуту per user (согласно ТЗ)
 */
export const adminPostRateLimiter = userRateLimit(60 * 1000, 10, 'admin-post');

/**
 * Per-user rate limiter для admin GET endpoints
 * 60 запросов в минуту per user (согласно ТЗ)
 */
export const adminGetRateLimiter = userRateLimit(60 * 1000, 60, 'admin-get');

/**
 * Per-user rate limiter для restart endpoint
 * 3 запроса в минуту per user (согласно ТЗ)
 */
export const restartRateLimiter = userRateLimit(60 * 1000, 3, 'restart');
