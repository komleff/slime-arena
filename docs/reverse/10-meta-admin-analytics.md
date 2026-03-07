# Reverse: MetaServer Admin, Analytics, A/B, Config
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

---

## 1. Обзор

Модуль охватывает серверные подсистемы MetaServer, отвечающие за:
- **Admin API** -- авторизация администраторов (отдельная от игроков), TOTP 2FA, управление комнатами, системные метрики, перезагрузка сервера через watchdog
- **A/B Testing** -- создание экспериментов, детерминированное назначение вариантов по SHA-256 хешу, трекинг конверсий, статистика
- **Analytics** -- сбор событий (single/batch), буферизация в памяти с flush в PostgreSQL, Redis-буфер для real-time, агрегация для дашборда
- **Config Service** -- runtime-конфигурация с версионированием (draft/active/archived), атомарная активация через транзакцию, валидация payload, клонирование версий
- **GeoIP** -- определение региона для фильтрации OAuth провайдеров, in-memory кеш, fallback по Accept-Language
- **System Metrics** -- CPU/RAM/Uptime с приоритетом cgroup v2 > v1 > /proc > os module
- **Audit Service** -- журнал действий администраторов в таблице audit_log
- **Rate Limiter** -- in-memory rate limiting по IP и по user ID, с поддержкой X-Forwarded-For при TRUST_PROXY=true
- **AdsService** -- grantId-based rewarded ads с идемпотентностью, хранение в Redis с TTL

Два слоя авторизации:
1. **Admin auth** (`middleware/adminAuth.ts`) -- таблица `admin_users`, JWT HS256, refresh token в httpOnly cookie, TOTP через AES-256-GCM шифрование
2. **Player auth** (`middleware/auth.ts`) -- `requireAuth`, `requireAdmin` для пользовательских маршрутов (A/B, analytics, config)

---

## 2. Исходные файлы

| Файл | Строк | Назначение |
|------|-------|------------|
| `server/src/meta/routes/admin.ts` | ~860 | Admin dashboard API: login/logout/refresh, TOTP, rooms, stats, restart |
| `server/src/meta/routes/abtest.ts` | ~247 | A/B test routes: assignments, conversion, admin CRUD |
| `server/src/meta/routes/analytics.ts` | ~199 | Analytics routes: track, batch, query, stats, flush |
| `server/src/meta/routes/config.ts` | ~43 | Public config routes: runtime, version |
| `server/src/meta/routes/configAdmin.ts` | ~261 | Config admin routes: list, CRUD, activate, archive, clone, validate |
| `server/src/meta/services/ABTestService.ts` | ~389 | A/B test business logic: create, assign, track, stats |
| `server/src/meta/services/AnalyticsService.ts` | ~371 | Analytics buffer, flush, query, stats |
| `server/src/meta/services/ConfigService.ts` | ~356 | Config CRUD, versioning, activation, validation |
| `server/src/meta/services/AdsService.ts` | ~165 | Rewarded ads grantId system |
| `server/src/meta/services/GeoIPService.ts` | ~347 | Geo region detection by IP |
| `server/src/meta/services/auditService.ts` | ~141 | Audit log read/write |
| `server/src/meta/services/systemMetrics.ts` | ~427 | CPU/RAM/Uptime collection |
| `server/src/meta/middleware/rateLimiter.ts` | ~213 | Rate limiting middleware |
| `server/src/meta/middleware/adminAuth.ts` | ~383 | Admin JWT + TOTP middleware |
| `server/src/meta/server.ts` | ~211 | Express app bootstrap |
| `server/src/meta/models/index.ts` | ~9 | Model exports |
| `server/src/meta/models/OAuth.ts` | ~23 | OAuthLink interface |
| `server/src/meta/models/Rating.ts` | ~15 | RatingAward interface |
| `server/src/meta/models/Leaderboard.ts` | ~43 | Leaderboard interfaces |

---

## 3. Admin API

Маршруты монтируются на `/api/v1/admin`.

### 3.1. Аутентификация (отдельная от игроков)

Админы хранятся в таблице `admin_users` (не `users`). Сессии -- в `admin_sessions`.

| Эндпоинт | Метод | Auth | Rate Limit | Описание |
|----------|-------|------|------------|----------|
| `/login` | POST | нет | 5 req/min per IP | Вход: username+password, bcrypt compare |
| `/refresh` | POST | нет | 10 req/min per IP | Обновление access token по refresh cookie |
| `/logout` | POST | JWT | 10 req/min per user | Удаление сессии, очистка cookie |

**Механизм токенов:**
- Access token: JWT HS256, TTL 15 минут, payload `{ sub, type: 'admin', role, username }`
- Refresh token: 32 random bytes hex, хранится как SHA-256 hash в БД
- Refresh cookie: `refresh_token`, httpOnly, secure (prod), sameSite=strict, path=/api/v1/admin, maxAge=7 дней

**Защита от timing attack:** при отсутствии пользователя используется dummy bcrypt hash для сохранения одинакового времени ответа.

**Защита от enumeration:** единый ответ `Invalid credentials` для обоих случаев (нет пользователя / неверный пароль).

### 3.2. TOTP (двухфакторная аутентификация)

| Эндпоинт | Метод | Auth | Rate Limit | Описание |
|----------|-------|------|------------|----------|
| `/totp/setup` | POST | JWT | 3 req/min per IP | Генерация TOTP секрета, QR-код (data URL) |
| `/totp/verify` | POST | JWT | 3 req/min per IP | Верификация и активация TOTP |

**Криптография TOTP:**
- Секрет: 20 random bytes (160 bit), hex-encoded
- Шифрование хранения: AES-256-GCM, ключ из ADMIN_ENCRYPTION_KEY (base64, 32 bytes)
- Формат шифрования: `base64(iv[12] || ciphertext || authTag[16])`
- QR-код: генерируется серверной библиотекой `qrcode` (не Google Charts API), формат data URL
- TOTP параметры: issuer="SlimeArena Admin", SHA1, 6 digits, period=30s, window=1

### 3.3. Управление комнатами

| Эндпоинт | Метод | Auth | Rate Limit | Описание |
|----------|-------|------|------------|----------|
| `/rooms` | GET | JWT | 60 req/min per user | Список активных игровых комнат |

Данные получаются HTTP-запросом к MatchServer:
- URL: `http://{MATCH_SERVER_HOST}:{MATCH_SERVER_PORT}/api/internal/rooms`
- Авторизация: `Bearer {MATCH_SERVER_TOKEN}`
- Таймаут: 5 секунд (AbortController)
- При недоступности: пустой массив + заголовок `X-MatchServer-Available: false`

Интерфейс RoomStats:
```typescript
interface RoomStats {
  roomId: string;
  playerCount: number;
  maxPlayers: number;
  state: 'spawning' | 'playing' | 'ending';
  phase: string;
  duration: number;
  tick: { avg: number; max: number };
}
```

### 3.4. Системные метрики

| Эндпоинт | Метод | Auth | Rate Limit | Описание |
|----------|-------|------|------------|----------|
| `/stats` | GET | JWT | 60 req/min per user | CPU, RAM, uptime, rooms, players, tick |

Ответ:
```json
{
  "cpu": 15,
  "memory": { "used": 256, "total": 512, "percent": 50 },
  "uptime": 86400,
  "rooms": 3,
  "players": 18,
  "tick": { "avg": 16.5, "max": 22 },
  "timestamp": "2026-03-07T12:00:00.000Z"
}
```

rooms/players/tick могут быть `null` если MatchServer недоступен.

### 3.5. Перезагрузка сервера

| Эндпоинт | Метод | Auth | Rate Limit | Описание |
|----------|-------|------|------------|----------|
| `/restart` | POST | JWT + 2FA | 2 req/min per user | Рестарт через watchdog |

**Механизм:**
1. Проверка 2FA (заголовок X-2FA-Code) через middleware `require2FA`
2. Проверка существования файлов `restart-requested` / `restart-processing` в SHARED_DIR
3. Уведомление MatchServer через `POST /api/internal/shutdown-notify` с `{ shutdownAt }` (fire-and-forget)
4. Атомарная запись outbox-файла `restart-requested` (через tmp file + rename, O_EXCL)
5. Возврат 202 Accepted с auditId

**Координация с watchdog:**
- SHARED_DIR: по умолчанию `/shared`, переопределяется env var
- Файлы-флаги: `restart-requested`, `restart-processing`
- SHUTDOWN_DELAY_SEC = 30 (захардкожено)

### 3.6. Аудит-лог (чтение)

| Эндпоинт | Метод | Auth | Rate Limit | Описание |
|----------|-------|------|------------|----------|
| `/audit` | GET | JWT | 60 req/min per user | Журнал действий с пагинацией |

Query params: `limit` (max 100), `offset`, `userId`, `action`.

---

## 4. A/B Testing

Маршруты монтируются на `/api/v1/abtest`.

### 4.1. Пользовательские эндпоинты

| Эндпоинт | Метод | Auth | Описание |
|----------|-------|------|----------|
| `/assignments` | GET | requireAuth | Все назначения активных тестов для текущего пользователя |
| `/assignment/:testId` | GET | requireAuth | Назначение для конкретного теста |
| `/conversion` | POST | requireAuth | Трекинг конверсии: `{ testId, eventType, eventValue? }` |

### 4.2. Админские эндпоинты

| Эндпоинт | Метод | Auth | Описание |
|----------|-------|------|----------|
| `/admin/list` | GET | requireAuth + requireAdmin | Список тестов, фильтр по `state` |
| `/admin/:testId` | GET | requireAuth + requireAdmin | Детали теста |
| `/admin/create` | POST | requireAuth + requireAdmin | Создание: `{ testId, name, variants, weights?, description?, startDate?, endDate? }` |
| `/admin/:testId/state` | PUT | requireAuth + requireAdmin | Смена состояния: draft/active/paused/completed |
| `/admin/:testId/stats` | GET | requireAuth + requireAdmin | Статистика по вариантам |
| `/admin/:testId` | DELETE | requireAuth + requireAdmin | Удаление (только draft) |

### 4.3. Состояния теста (state machine)

```
draft -> active -> paused -> completed
                -> completed
```

Допустимые значения: `'draft' | 'active' | 'paused' | 'completed'`.
Валидация перехода отсутствует -- любой переход разрешён через `updateTestState`.

### 4.4. Назначение вариантов (детерминированное)

Алгоритм `selectVariant`:
1. SHA-256 hash от `"{userId}:{testId}"`
2. Первые 4 байта -> UInt32BE (0..4294967295)
3. Нормализация: `(hashNum / 0xFFFFFFFF) * 100` -> percentage (0..100)
4. Кумулятивное распределение по weights

**Кеширование:** Redis, ключ `abtest:assignment:{userId}:{testId}`, TTL = 86400 (24 часа).

### 4.5. Таблицы БД

- `ab_tests` -- определения тестов (test_id PK, name, description, variants JSONB, weights INT[], state, start_date, end_date)
- `ab_test_conversions` -- конверсии (test_id, variant_id, user_id, event_type, event_value, timestamp)

### 4.6. Статистика

`getTestStats` возвращает для каждого варианта:
- assignments (уникальные пользователи из conversions)
- conversions по event_type
- conversionRate = totalConversions / assignments

---

## 5. Analytics

Маршруты монтируются на `/api/v1/analytics`.

### 5.1. Сбор событий

| Эндпоинт | Метод | Auth | Описание |
|----------|-------|------|----------|
| `/track` | POST | requireAuth | Одно событие: `{ eventType, properties?, sessionId? }` |
| `/batch` | POST | requireAuth | Массив событий |
| `/event-types` | GET | нет | Список предопределённых типов (публичный!) |

Дополнительные метаданные из заголовков:
- `X-Platform` -> platform
- `X-Client-Version` -> clientVersion

### 5.2. Предопределённые типы событий (EventTypes)

| Категория | События |
|-----------|---------|
| Session | `session_start`, `session_end` |
| Match | `match_search_start`, `match_search_cancel`, `match_found`, `match_start`, `match_end`, `match_leave` |
| Economy | `currency_earn`, `currency_spend`, `purchase_start`, `purchase_complete`, `purchase_fail` |
| Ads | `ad_request`, `ad_show`, `ad_complete`, `ad_skip`, `ad_reward_claim` |
| Progression | `level_up`, `achievement_unlock`, `item_unlock` |
| UI | `screen_view`, `button_click` |
| Error | `client_error`, `server_error` |

### 5.3. Буферизация

- In-memory буфер: `AnalyticsEvent[]`
- BATCH_SIZE: env `ANALYTICS_BATCH_SIZE` или 100 (по умолчанию)
- FLUSH_INTERVAL: 30 секунд (захардкожено)
- Auto-flush при достижении BATCH_SIZE
- При ошибке flush: события возвращаются в буфер (с лимитом BATCH_SIZE * 2)
- Graceful shutdown: flush перед выходом

### 5.4. Хранение

**PostgreSQL** -- таблица `analytics_events`:
- event_id, event_type, user_id, session_id, timestamp, properties (JSONB), platform, client_version
- Batch INSERT для эффективности

**Redis** -- метод `trackToRedis` (не используется в routes, доступен программно):
- Ключ: `analytics:buffer`
- LPUSH + LTRIM (max 10000 записей)

### 5.5. Админские эндпоинты

| Эндпоинт | Метод | Auth | Описание |
|----------|-------|------|----------|
| `/admin/query` | GET | requireAuth + requireAdmin | Поиск событий: eventType, userId, startDate, endDate, limit, offset |
| `/admin/stats` | GET | requireAuth + requireAdmin | Агрегация: eventType, groupBy (hour/day/week), startDate, endDate |
| `/admin/flush` | POST | requireAuth + requireAdmin | Принудительный flush буфера |

---

## 6. Config Service

### 6.1. Публичные маршруты (`/api/v1/config`)

| Эндпоинт | Метод | Auth | Описание |
|----------|-------|------|----------|
| `/runtime` | GET | нет | Активная runtime-конфигурация |
| `/:version` | GET | нет | Конфигурация по версии (для отладки) |

**Важно:** оба эндпоинта публичные (нет auth middleware).

### 6.2. Admin маршруты (`/api/v1/config`)

Маршруты из `configAdmin.ts` монтируются на тот же prefix `/api/v1/config` (см. server.ts строки 104-105).

| Эндпоинт | Метод | Auth | Описание |
|----------|-------|------|----------|
| `/admin/list` | GET | requireAuth + requireAdmin | Список версий, фильтр по state |
| `/admin/:version` | GET | requireAuth + requireAdmin | Детали версии |
| `/admin/create` | POST | requireAuth + requireAdmin | Создание: `{ version, payload }` |
| `/admin/:version` | PUT | requireAuth + requireAdmin | Обновление (только draft) |
| `/admin/:version/activate` | POST | requireAuth + requireAdmin | Активация (архивирует текущую) |
| `/admin/:version/archive` | POST | requireAuth + requireAdmin | Архивация |
| `/admin/:version` | DELETE | requireAuth + requireAdmin | Удаление (только draft) |
| `/admin/:version/clone` | POST | requireAuth + requireAdmin | Клонирование: `{ newVersion }` |
| `/admin/validate` | POST | requireAuth + requireAdmin | Валидация payload без сохранения |

### 6.3. Состояния конфигурации

```
draft -> active -> archived
      -> deleted
```

### 6.4. Атомарная активация

Метод `activateConfig` использует транзакцию:
1. BEGIN
2. Проверка: конфиг существует, не active
3. Архивация текущего active: `UPDATE configs SET state='archived' WHERE state='active'`
4. Активация нового: `UPDATE configs SET state='active', activated_at=NOW()`
5. COMMIT

### 6.5. Checksum

SHA-256 от JSON.stringify(payload), первые 16 символов hex.

### 6.6. RuntimeConfig interface

```typescript
interface RuntimeConfig {
  configVersion: string;
  economy: any;
  shop?: { offers?: ShopOffer[] };
  ads?: { rewards?: Record<string, AdRewardConfig> };
  battlepass?: any;
  achievements?: any;
  leaderboards?: any;
  matchmaking?: any;
  resilience?: any;
  features: {
    paymentsEnabled: boolean;
    adsRewardEnabled: boolean;
    matchmakingEnabled: boolean;
  };
  abtests?: ABTestConfig[];
}
```

### 6.7. Валидация

Метод `validateConfig` проверяет:
- `features` обязателен, все три флага должны быть boolean
- `shop.offers[]`: id, type, price.amount обязательны
- `abtests[]`: testId обязателен, >= 2 вариантов, allocation суммируется в 100

---

## 7. GeoIP

### 7.1. Назначение

Определение региона (OAuthRegion) для фильтрации OAuth провайдеров. Google недоступен для RU и UNKNOWN.

### 7.2. Типы регионов

```typescript
type OAuthRegion = 'RU' | 'CIS' | 'GLOBAL' | 'UNKNOWN';
```

### 7.3. Приоритет определения

1. GeoIP по IP (основной) -- внешний API ip-api.com
2. Accept-Language (fallback, только если strict=false)
3. Fallback: UNKNOWN (strict) или GLOBAL (non-strict)

### 7.4. Конфигурация (env vars)

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `OAUTH_REGION_DETECTION_STRICT` | `'true'` (строгий режим) | Локальные IP -> UNKNOWN, GeoIP fail -> UNKNOWN |
| `GEOIP_API_URL` | `http://ip-api.com/json` | Внешний GeoIP API |
| `GEOIP_TIMEOUT_MS` | `3000` | Таймаут запроса |

### 7.5. Кеширование

- In-memory Map, TTL = 1 час для GeoIP результатов
- TTL = 10 минут для fallback результатов
- Очистка: каждые 100 записей (по size % 100 === 0)

### 7.6. Список стран СНГ

BY, KZ, UZ, UA, AM, AZ, GE, KG, MD, TJ, TM (без России).

### 7.7. Защита

- Локальные адреса в strict mode -> UNKNOWN (защита от SSRF через X-Forwarded-For)
- IPv4: 127.0.0.0/8, 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12
- IPv6: ::1, fc00::/7 (ULA), fe80::/10 (link-local)

### 7.8. Паттерн: lazy singleton

```typescript
let instance: GeoIPService | null = null;
export function getGeoIPService(): GeoIPService { ... }
```

---

## 8. System Metrics

### 8.1. CPU

Приоритет источников:
1. cgroup v2: `/sys/fs/cgroup/cpu.stat` (usage_usec)
2. cgroup v1: `/sys/fs/cgroup/cpu/cpuacct.usage` и альтернативные пути
3. /proc/stat: суммарно по всем ядрам (user+nice+system+irq+softirq+steal / total)
4. Fallback: `os.cpus()` (моментальный снимок с момента старта)

Расчёт: дельта между двумя замерами. Минимальный интервал -- 500 мс.
Кеширование: `cachedCpuPercent`, обновляется при каждом вызове getCpuUsage().

### 8.2. RAM

Приоритет источников:
1. cgroup v2: `memory.current` / `memory.max`
2. cgroup v1: `memory.usage_in_bytes` / `memory.limit_in_bytes`
3. /proc/meminfo: MemTotal - MemFree - Buffers - Cached
4. Fallback: `os.totalmem() - os.freemem()`

Формат: `{ used: MB, total: MB, percent: 0-100 }`.

### 8.3. Uptime

`Math.floor((Date.now() - processStartTime) / 1000)` -- время работы процесса в секундах.

### 8.4. Экспортируемые функции

- `getCpuUsage(): number` -- 0-100%
- `getRamUsage(): RamUsage`
- `getUptime(): number`
- `getSystemMetrics(): SystemMetrics` (агрегация всех трёх)

---

## 9. Audit Service

### 9.1. Запись

Функция `logAction(params)`:
```typescript
interface LogActionParams {
  userId: string | null;
  action: string;
  target?: string;
  ip?: string;
  details?: Record<string, unknown>;
}
```

INSERT в `audit_log` (user_id, action, target, ip, details_json). Возвращает id записи.

### 9.2. Чтение

Функция `getAuditLogs(params)`:
- Пагинация: limit (max 100), offset
- Фильтры: userId, action
- JOIN с `admin_users` для получения username
- Сортировка: timestamp DESC

### 9.3. Формат записи

```typescript
interface AuditLogEntry {
  id: number;
  userId: string | null;
  username?: string;
  action: string;
  target: string | null;
  ip: string | null;
  timestamp: Date;
  details: Record<string, unknown> | null;
}
```

### 9.4. Логируемые действия

| action | Контекст |
|--------|----------|
| `login` | Успешный вход админа |
| `login_failed` | Неудачный вход (reason: invalid_password / user_not_found) |
| `logout` | Выход |
| `totp_setup_initiated` | Начало настройки TOTP |
| `totp_verify_failed` | Неудачная верификация TOTP |
| `totp_enabled` | TOTP активирован |
| `server_restart_requested` | Запрос перезагрузки (auditId, requestedBy, shutdownAt) |

---

## 10. Rate Limiter

### 10.1. Архитектура

In-memory Map (`Map<string, RateLimitRecord>`). Единый экземпляр для всех rate limiter'ов.

### 10.2. Типы лимитеров

**По IP** (`rateLimit`):
- Ключ: `{prefix}:{ip}`
- IP определяется через `getClientIP(req)` с учётом TRUST_PROXY

**По User ID** (`userRateLimit`):
- Ключ: `{prefix}:user:{adminUser.id}`
- Fallback на IP если adminUser отсутствует

### 10.3. Предустановленные лимитеры

| Экспорт | Тип | Window | Max | Используется |
|---------|-----|--------|-----|-------------|
| `authRateLimiter` | IP | 60s | 10 | Auth endpoints |
| `oauthRateLimiter` | IP | 60s | 5 | OAuth endpoints |
| `totpRateLimiter` | IP | 60s | 3 | TOTP endpoints |
| `adminPostRateLimiter` | User | 60s | 10 | Admin POST |
| `adminGetRateLimiter` | User | 60s | 60 | Admin GET |
| `restartRateLimiter` | User | 60s | 3 | Restart endpoint |

В admin.ts дополнительно определены:
- `loginRateLimiter`: IP, 60s, 5 req, prefix='admin_login'
- `refreshRateLimiter`: IP, 60s, 10 req, prefix='admin_refresh'
- `adminPostRateLimiter` (local): User, 60s, 10 req, prefix='admin_post'
- `adminGetRateLimiter` (local): User, 60s, 60 req, prefix='admin_get'
- `logoutRateLimiter`: User, 60s, 10 req, prefix='admin_logout'
- `restartRateLimiter` (local): User, 60s, 2 req, prefix='admin_restart'

### 10.4. X-Forwarded-For

Доверяется только при `TRUST_PROXY=true`. Берётся первый IP из списка.

### 10.5. Очистка

Интервал `setInterval` каждые 5 минут. Удаляются записи с `resetAt < Date.now()`.

### 10.6. Response headers

Все лимитеры устанавливают:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (Unix timestamp)
- `Retry-After` (при 429)

---

## 11. MetaServer Bootstrap

### 11.1. Файл server.ts

Точка входа Express-приложения MetaServer.

### 11.2. Конфигурация

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `META_PORT` | 3000 | Порт сервера |
| `META_HOST` | 0.0.0.0 | Хост привязки |
| `NODE_ENV` | development | Окружение |

Env-файл: `server/.env.local` (загружается через dotenv).

### 11.3. Middleware chain

1. CORS -- origin: localhost:5173/5174/5175/3000 + same-origin, credentials=true
2. `express.json()` -- парсинг JSON body
3. `cookieParser()` -- парсинг cookies (для refresh token)
4. Request logging -- `[MetaServer] METHOD /path - STATUS (Xms)`
5. Route handlers
6. 404 handler -- `{ error: 'not_found', message: 'Endpoint not found' }`
7. Error handler -- JSON parse errors -> 400, остальное -> 500 (message только в dev)

### 11.4. Route mounting

```
/api/v1/auth          -> authRoutes
/api/v1/config        -> configRoutes        (public)
/api/v1/config        -> configAdminRoutes   (admin, тот же prefix!)
/api/v1/profile       -> profileRoutes
/api/v1/matchmaking   -> matchmakingRoutes
/api/v1/wallet        -> walletRoutes
/api/v1/shop          -> shopRoutes
/api/v1/ads           -> adsRoutes
/api/v1/abtest        -> abtestRoutes
/api/v1/payment       -> paymentRoutes
/api/v1/analytics     -> analyticsRoutes
/api/v1/match-results -> matchResultsRoutes
/api/v1/leaderboard   -> leaderboardRoutes
/api/v1/admin         -> adminRoutes
```

### 11.5. Health check

```
GET /health -> { status, database, redis, timestamp, service }
```

Проверяет PostgreSQL (`SELECT 1`) и Redis (`PING`). Код 200 или 503.

### 11.6. Инициализация

1. PostgreSQL pool
2. Redis client
3. AuthProviderFactory.initialize()
4. PaymentProviderFactory.initialize()
5. `app.listen(port, host)`

### 11.7. Graceful shutdown

SIGINT/SIGTERM -> `closePostgres()` + `closeRedis()` + `process.exit(0)`.

### 11.8. Обработка фатальных ошибок

`uncaughtException` и `unhandledRejection` логируются, через 1 секунду `process.exit(1)` (supervisord перезапустит).

---

## 12. Models

Модели из `server/src/meta/models/` -- TypeScript interfaces, без ORM.

### 12.1. OAuthLink

```typescript
type AuthProvider = 'telegram' | 'google' | 'yandex';

interface OAuthLink {
  id: string;
  userId: string;
  authProvider: AuthProvider;
  providerUserId: string;
  createdAt: Date;
}
```

Привязка нескольких OAuth провайдеров к одному пользователю.

### 12.2. RatingAward

```typescript
interface RatingAward {
  userId: string;
  matchId: string;
  awardedAt: Date;
}
```

Идемпотентность начисления рейтинга за матч.

### 12.3. Leaderboard

```typescript
interface LeaderboardTotalMass {
  userId: string;
  totalMass: number;
  matchesPlayed: number;
  updatedAt: Date;
}

interface LeaderboardBestMass {
  userId: string;
  bestMass: number;
  bestMatchId: string | null;
  playersInMatch: number;
  achievedAt: Date;
  updatedAt: Date;
}

interface LeaderboardEntry {
  position: number;
  userId: string;
  nickname: string;
  skinId: string;
  value: number;
  matchesPlayed?: number; // только для mode=total
}
```

---

## 13. Захардкоженные значения

| Значение | Где | Описание |
|----------|-----|----------|
| `15 * 60` (900s) | adminAuth.ts | TTL access token (15 минут) |
| `7 * 24 * 60 * 60` (604800s) | admin.ts | TTL refresh cookie (7 дней) |
| `'slime-arena-dev-jwt-secret'` | adminAuth.ts | Dev default JWT secret |
| `'slime-arena-dev-encryption-key!!'` | adminAuth.ts | Dev default TOTP encryption key (32 bytes) |
| `5000` (ms) | admin.ts | Таймаут запросов к MatchServer |
| `30` (сек) | admin.ts | SHUTDOWN_DELAY_SEC -- задержка перед рестартом |
| `'/shared'` | admin.ts | Default SHARED_DIR для watchdog outbox |
| `86400` (24h) | ABTestService.ts | ASSIGNMENT_CACHE_TTL (Redis) |
| `100` | AnalyticsService.ts | BATCH_SIZE по умолчанию |
| `30000` (30s) | AnalyticsService.ts | FLUSH_INTERVAL_MS |
| `10000` | AnalyticsService.ts | Max events в Redis LTRIM |
| `16` символов | ConfigService.ts | Длина checksum (SHA-256 truncated) |
| `300` (5 мин) | AdsService.ts | GRANT_TTL_SECONDS |
| `60 * 60 * 1000` (1h) | GeoIPService.ts | CACHE_TTL_MS для GeoIP |
| `10 * 60 * 1000` (10 мин) | GeoIPService.ts | TTL для fallback кеша |
| `3000` | GeoIPService.ts | Default GEOIP_TIMEOUT_MS |
| `500` (ms) | systemMetrics.ts | Минимальный интервал CPU замеров |
| `5 * 60 * 1000` (5 мин) | rateLimiter.ts | Интервал очистки rate limiter записей |
| `3000` | server.ts | Default META_PORT |
| `'0.0.0.0'` | server.ts | Default META_HOST |
| `1000` (1s) | server.ts | Задержка перед exit при uncaught error |

---

## 14. Расхождения с документацией

### 14.1. A/B Testing: расхождения с TZ-ABTesting-ClaudeOpus-v1.3.md

| Аспект | Документация (ТЗ) | Реализация (код) | Критичность |
|--------|-------------------|-----------------|-------------|
| **Хеш-алгоритм** | `salt + ":" + experimentId + ":" + userId` | `"{userId}:{testId}"` (без salt!) | ВЫСОКАЯ: нет соли -- распределения не независимы между тестами |
| **Bucket** | `hash % 10000` (0-9999, 10K buckets) | `(hash / 0xFFFFFFFF) * 100` (процент 0-100) | СРЕДНЯЯ: другая гранулярность (100 vs 10000) |
| **Хранение назначений** | Таблица `user_experiment_assignments` (user_id, experiment_id, variant_id, bucket) | Redis кеш `abtest:assignment:{userId}:{testId}` с TTL 24h, PostgreSQL таблица `ab_tests` | СРЕДНЯЯ: нет персистентного хранения назначений, только кеш + определения |
| **Overrides (переопределения)** | Таблица `experiment_overrides`, API для создания | Не реализовано | НИЗКАЯ (Фаза 2) |
| **Guardrails** | Пороговые метрики с автоматической остановкой | Не реализовано | НИЗКАЯ (Фаза 2) |
| **MutexGroup** | Взаимоисключение экспериментов | Не реализовано | НИЗКАЯ |
| **ConfigLayer** | profile/session/match с разделением очередей матчмейкера | Не реализовано | СРЕДНЯЯ |
| **Матчмейкинг** | matchConfigKey для разделения очередей | Не реализовано | СРЕДНЯЯ |
| **Источник правды** | `config/abtests.json` (файл) | Таблица `ab_tests` в PostgreSQL | СРЕДНЯЯ: архитектурное отличие |
| **Audit log** | Отдельная таблица `experiment_audit_log` | Общий `audit_log` | НИЗКАЯ |
| **Аналитика** | experiments[] в каждом событии, ab_exposure event | Отдельный трекинг через `/conversion` | СРЕДНЯЯ |
| **Валидация weights** | tolerance 0.01 | tolerance 0.01 (совпадает) | -- |
| **priority** | Для разрешения конфликтов overlay | Отсутствует | НИЗКАЯ |
| **salt** | Обязательное поле для независимости | Отсутствует | ВЫСОКАЯ |

### 14.2. Config Service: расхождения с Architecture Part 4

| Аспект | Документация | Реализация | Критичность |
|--------|-------------|------------|-------------|
| **Структура хранения** | Отдельные файлы (economy.json, shop.json, ...) | Единый JSONB payload в таблице `configs` | СРЕДНЯЯ: проще но менее гранулярно |
| **schemaVersion, generatedAt** | Обязательные поля в каждом файле конфига | Отсутствуют | НИЗКАЯ |
| **Таблица configs** | Документирована (B.17) | Реализована, совпадает | -- |

### 14.3. Analytics: расхождения с Architecture Part 3/4

| Аспект | Документация | Реализация | Критичность |
|--------|-------------|------------|-------------|
| **Обязательные поля** | eventName, ts, userId, platformType, buildVersion, configVersion, payload | eventType, userId?, sessionId?, timestamp, properties, platform?, clientVersion? | СРЕДНЯЯ: buildVersion=clientVersion, нет configVersion |
| **Prometheus** | Метрики совместимы с Prometheus | Нет Prometheus экспорта | СРЕДНЯЯ |
| **Grafana** | Дашборды | Нет интеграции | СРЕДНЯЯ |
| **Sentry** | Агрегация ошибок | Нет интеграции | СРЕДНЯЯ |
| **Централизованные логи** | Loki/Elastic | Только console.log | СРЕДНЯЯ |
| **Алерты** | Доставка в мессенджер/вебхук | Не реализовано | СРЕДНЯЯ |

### 14.4. Admin API: расхождения с Architecture Part 4 (C.12)

| Аспект | Документация | Реализация | Критичность |
|--------|-------------|------------|-------------|
| **Audit log** | Таблица B.18: id UUID, actor_user_id, action, target, payload JSONB, ip, created_at | Реализация: id SERIAL, user_id, action, target, ip, details_json, timestamp | НИЗКАЯ: minor naming |
| **Admin routes** | "Конкретные права задаются конфигурацией и окружением" | Единая роль, нет RBAC | НИЗКАЯ |

### 14.5. AdsService: расхождения

| Аспект | Документация (C.7) | Реализация | Критичность |
|--------|-------------------|------------|-------------|
| **grantId** | ID правила из economy.json | ID сгенерированного гранта в Redis | СРЕДНЯЯ: семантика отличается |
| **Лимиты** | Проверяются по economy.json | Не проверяются | СРЕДНЯЯ |
| **Маршрут** | `/api/v1/ads/reward/claim` | Отдельный AdsService с generateGrant+claimReward | -- |

---

## 15. Технический долг

### P0 (критичный)

1. **A/B: отсутствует salt** -- хеш `userId:testId` без соли означает коррелированные распределения между тестами. Пользователь попавший в вариант B в одном тесте будет более вероятно в B в другом.

2. **Analytics: нет configVersion в событиях** -- невозможно отфильтровать события по версии конфигурации, как требует архитектура.

3. **Config public routes без auth** -- `/api/v1/config/runtime` и `/api/v1/config/:version` доступны без авторизации. Содержимое RuntimeConfig может включать чувствительные данные (A/B тесты, параметры экономики).

### P1 (важный)

4. **A/B: назначения не персистируются** -- Redis кеш с TTL 24h означает что после истечения TTL пользователь будет повторно назначен (детерминированно, но без записи в БД). Нет таблицы user_experiment_assignments.

5. **A/B: нет state machine валидации** -- `updateTestState` позволяет произвольные переходы (например, completed -> draft).

6. **Rate limiter in-memory** -- не работает при нескольких инстансах MetaServer. Документировано как P2 (TODO в коде).

7. **Analytics: trackToRedis не используется** -- метод существует но не вызывается из routes. Real-time аналитика недоступна.

8. **AdsService: item reward не реализован** -- `TODO: Grant item (e.g., unlock skin, give booster)` в коде.

9. **Два разных rate limiter системы** -- admin routes определяют свои rate limiters (rateLimiter.ts + inline в admin.ts), потенциальные конфликты с экспортированными из rateLimiter.ts.

### P2 (улучшение)

10. **GeoIP: кеш без max size** -- Map растёт неограниченно, очистка только каждые 100 записей по модулю size, не гарантирует ограничение.

11. **AnalyticsService: один инстанс** -- создаётся `new AnalyticsService()` при импорте routes, нет синглтона. Если routes импортируются повторно -- несколько таймеров и буферов.

12. **Config/ABTest: нет аудита действий** -- операции с конфигами и A/B тестами не логируются в audit_log (только admin auth действия).

13. **CORS: фактически разрешает всё** -- callback всегда вызывает `callback(null, true)` после проверки localhost.

14. **SystemMetrics: не агрегирует tick из MatchServer** -- tick latency доступен только через `/stats`, не через getSystemMetrics().

---

## 16. Заметки для форка BonkRace

### Переиспользуется целиком

- **Admin API** -- login/logout/refresh/TOTP/audit работают независимо от игровой логики. Заменить `SlimeArena Admin` в TOTP issuer.

- **Rate Limiter** -- полностью переносим, параметры через конструктор.

- **System Metrics** -- универсальные метрики CPU/RAM/Uptime, не зависят от игры.

- **Audit Service** -- универсальный, зависит только от таблицы `audit_log`.

- **Config Service** -- RuntimeConfig interface требует адаптации (features, shop, ads, battlepass, achievements, leaderboards, matchmaking, resilience), но механизм версионирования/активации универсален.

### Переиспользуется с изменениями

- **A/B Testing** -- универсальная механика, но:
  - Добавить salt в хеш-алгоритм (исправление бага)
  - Пересмотреть variants/config под BonkRace геймплей
  - Интегрировать с матчмейкером если нужны match-level тесты

- **Analytics** -- EventTypes нужно пересмотреть под BonkRace (session/match events переиспользуются, economy/progression/ads -- зависят от монетизации).

- **AdsService** -- если BonkRace использует rewarded ads, сервис переносим. Нужно реализовать item rewards.

### Переиспользуется без изменений

- **GeoIP** -- определение региона по IP не зависит от игры. CIS_COUNTRIES и RU_LOCALES можно расширить.

### Требует внимания

- Таблицы БД: `admin_users`, `admin_sessions`, `audit_log`, `ab_tests`, `ab_test_conversions`, `analytics_events`, `configs` -- нужна своя миграция.
- Env vars: JWT_SECRET, ADMIN_ENCRYPTION_KEY, MATCH_SERVER_HOST/PORT/TOKEN, SHARED_DIR, TRUST_PROXY, GEOIP_API_URL, ANALYTICS_BATCH_SIZE -- все нужно настроить.
- Две системы auth (admin vs player) используют разные middleware и таблицы -- обе нужны.
