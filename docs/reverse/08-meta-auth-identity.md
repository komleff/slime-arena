# Reverse: MetaServer Auth & Identity
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

---

## 1. Обзор

Система аутентификации MetaServer реализует многоуровневую модель идентификации пользователей, рассчитанную на мультиплатформенную игру. Поддерживается три класса пользователей:

1. **Standalone Guest** — анонимный игрок на web-платформе (без учётной записи в БД). Получает `guestToken` (JWT, 7 дней). Может играть, но не сохраняет прогресс.
2. **Telegram-anonymous** — пользователь Telegram Mini App с записью в БД (`is_anonymous=true`). Получает `accessToken` (JWT, 24 часа). Имеет oauth_link запись, но ещё не завершил регистрацию.
3. **Registered** — полноценный зарегистрированный пользователь (`is_anonymous=false`). Привязан через `oauth_links` к провайдеру (Telegram, Google, Yandex). Получает `accessToken`.

Параллельно существует **Admin Auth** — полностью изолированная подсистема для админ-панели мониторинга. Использует отдельную таблицу `admin_users`, собственные JWT (15 мин), refresh-токены в httpOnly cookie (7 дней), и опциональный 2FA через TOTP.

### Ключевые архитектурные решения

- **Два параллельных механизма сессий**: JWT-based (новый) и session-based с token_hash в БД (legacy). Middleware `requireAuth` пробует оба.
- **Все JWT подписаны HS256** с единым `JWT_SECRET` (кроме JoinToken, который может использовать отдельный `JOIN_TOKEN_SECRET`).
- **OAuth — серверный код-обмен** (Authorization Code Flow). Нет PKCE, нет state-параметра (P2 TODO).
- **Claim-based upgrade** — гость конвертируется в зарегистрированного через `claimToken`, привязывающий результат матча к новому аккаунту.
- **Regional OAuth filtering** — список доступных OAuth-провайдеров зависит от GeoIP-региона клиента.

---

## 2. Исходные файлы

| Файл | Назначение | LOC (прибл.) |
|---|---|---|
| `server/src/meta/routes/auth.ts` | Роутер `/api/v1/auth/*` — все player-facing auth endpoints | ~1380 |
| `server/src/meta/services/AuthService.ts` | CRUD пользователей, сессий, oauth_links, claim consumption | ~570 |
| `server/src/meta/middleware/auth.ts` | `requireAuth`, `requireAdmin`, `requireServerToken` middleware | ~165 |
| `server/src/meta/middleware/adminAuth.ts` | Admin JWT, refresh, TOTP (генерация, шифрование, верификация) | ~383 |
| `server/src/meta/utils/jwtUtils.ts` | JWT утилиты: generate/verify для 5 типов токенов | ~438 |
| `server/src/meta/middleware/rateLimiter.ts` | In-memory rate limiter (IP-based и per-user) | ~213 |
| `server/src/meta/models/OAuth.ts` | Типы `AuthProvider`, `OAuthLink` | ~23 |
| `server/src/meta/services/JoinTokenService.ts` | JoinToken: генерация и верификация JWT для подключения к комнате | ~150 |
| **Platform Providers:** | |
| `server/src/meta/platform/IAuthProvider.ts` | Интерфейс `IAuthProvider`, `PlatformUserData` | ~41 |
| `server/src/meta/platform/AuthProviderFactory.ts` | Фабрика для platform-level провайдеров (Telegram, Yandex SDK, Poki, etc.) | ~60 |
| `server/src/meta/platform/OAuthProviderFactory.ts` | Фабрика для OAuth-провайдеров (Google, Yandex OAuth) с региональной фильтрацией | ~274 |
| `server/src/meta/platform/TelegramAuthProvider.ts` | HMAC-SHA256 верификация Telegram initData | ~93 |
| `server/src/meta/platform/YandexAuthProvider.ts` | Yandex Games SDK: JWT decode или `playerId:playerName` | ~87 |
| `server/src/meta/platform/GoogleOAuthProvider.ts` | Google OAuth: code exchange → userinfo | ~93 |
| `server/src/meta/platform/YandexOAuthProvider.ts` | Yandex OAuth: code exchange → userinfo | ~96 |
| `server/src/meta/platform/PokiAuthProvider.ts` | Poki: парсинг `userId:nickname`, валидация `poki_` prefix | ~53 |
| `server/src/meta/platform/CrazyGamesAuthProvider.ts` | CrazyGames: JWT decode (без верификации подписи!) | ~85 |
| `server/src/meta/platform/GameDistributionAuthProvider.ts` | GameDistribution: парсинг `userId:nickname`, валидация `gd_` prefix | ~51 |
| `server/src/meta/platform/DevAuthProvider.ts` | Dev: любой `userId:nickname`, без верификации | ~34 |
| `server/src/meta/routes/admin.ts` | Admin routes: login, refresh, logout, TOTP setup/verify | ~450+ |

---

## 3. Потоки аутентификации

### 3.1 Guest Flow (анонимный вход — Standalone)

```
Клиент                          MetaServer
  |                                 |
  |-- POST /auth/guest ------------>|
  |                                 | uuidv4() → guestSubjectId
  |                                 | generateGuestToken(guestSubjectId) → JWT (7d)
  |<---- { guestToken,             |
  |        guestSubjectId,         |
  |        expiresAt } ------------|
  |                                 |
  |-- POST /auth/join-token ------->| Authorization: Bearer <guestToken>
  |    { nickname?, skinId? }       | verifyGuestToken(token)
  |                                 | validateAndNormalize(nickname)
  |                                 | joinTokenService.generateToken(...)
  |<---- { joinToken, expiresIn } --|
```

**Детали:**
- `POST /auth/guest` НЕ создаёт записей в БД. Гостевой subjectId существует только внутри JWT.
- `guestToken` payload: `{ sub: UUID, type: "guest", iat, exp }`.
- Для `join-token`: если `skinId` невалиден или не передан — fallback на `pickSpriteByName(nickname)`.
- Никнейм по умолчанию: `GUEST_DEFAULT_NICKNAME` из `@slime-arena/shared`.

### 3.2 Platform Login (Telegram, Yandex SDK, Poki, CrazyGames, GameDistribution)

```
Клиент                          MetaServer
  |                                 |
  |-- POST /auth/verify ----------->| { platformType, platformAuthToken }
  |                                 | AuthProviderFactory.getProvider(platformType)
  |                                 | provider.verifyToken(platformAuthToken)
  |                                 |   → { platformUserId, nickname, avatarUrl }
  |                                 |
  |                                 | --- Транзакция ---
  |                                 | findOrCreate user в users
  |                                 | create session (token_hash в sessions)
  |                                 | --- /Транзакция ---
  |                                 |
  |<---- { accessToken (opaque),   |
  |        userId, profile } ------|
```

**Важно:** `/auth/verify` генерирует **opaque** session token (crypto.randomBytes(32).toBase64url), НЕ JWT. Хеш (SHA256) хранится в таблице `sessions`. Это legacy-поток.

### 3.2.1 Telegram Silent Auth (отдельный endpoint)

```
Клиент (TMA)                    MetaServer
  |                                 |
  |-- POST /auth/telegram --------->| { initData }
  |                                 | TelegramAuthProvider.verifyToken(initData)
  |                                 |   → HMAC-SHA256 проверка
  |                                 |   → auth_date <= 24h
  |                                 |
  |                                 | findUserByOAuthLink('telegram', platformUserId)
  |                                 | if !found:
  |                                 |   createTelegramAnonymousUser(is_anonymous=true)
  |                                 |   + oauth_link + profile + wallet
  |                                 | else:
  |                                 |   updateLastLogin()
  |                                 |
  |                                 | generateAccessToken(userId, isAnonymous) → JWT (24h)
  |                                 |
  |<---- { accessToken (JWT),      |
  |        userId, profile,        |
  |        isNewUser, isAnonymous }|
```

**Отличие от /auth/verify:** Telegram использует JWT `accessToken` (новый поток) и `oauth_links` вместо session-based auth. Пользователь создаётся с `is_anonymous=true` до завершения профиля.

### 3.3 OAuth Login (Google, Yandex OAuth — Standalone)

```
Клиент                          MetaServer
  |                                 |
  |-- GET /auth/config ------------->| Определяет регион (GeoIP)
  |<---- { region, providers[] } ---|  Фильтрует провайдеров по региону
  |                                 |
  | (клиент открывает OAuth окно)   |
  |                                 |
  |-- POST /auth/oauth ------------->| { provider, code }
  |                                 |  oauthRateLimiter (5 req/min)
  |                                 |  GeoIP → проверка доступности провайдера
  |                                 |  exchangeCode(code) → { id, name, email, picture }
  |                                 |
  |                                 |  findUserByOAuthLink(provider, id)
  |                                 |  if found: updateLastLogin()
  |                                 |  if !found: createUserFromOAuth() → new user
  |                                 |    (race-condition: 23505 → retry findUserByOAuthLink)
  |                                 |
  |                                 |  generateAccessToken(userId, isAnonymous) → JWT
  |                                 |
  |<---- { accessToken, userId,    |
  |        profile, isAnonymous } --|
```

**Региональная матрица:**

| Регион   | Google | Yandex | VK (P1) |
|----------|--------|--------|---------|
| RU       | false  | true   | true    |
| CIS      | true   | true   | true    |
| GLOBAL   | true   | true   | false   |
| UNKNOWN  | true*  | true   | false   |

*TODO: вернуть false перед production.

### 3.4 Guest → Registered Conversion (claimToken)

Два подпотока:

#### 3.4.1 convert_guest (Standalone guest → Registered через OAuth)

```
                         Вариант A: prepareToken flow (P1-4)
Клиент                          MetaServer
  |                                 |
  | (после матча у гостя есть claimToken от ArenaRoom)
  |                                 |
  |-- POST /auth/oauth/prepare-upgrade -->| Authorization: Bearer <guestToken>
  |   { provider, code,             |    verifyGuestToken()
  |     claimToken? (опционально) } |    exchangeCode(code)
  |                                 |
  |                                 |    if OAuth link exists → 409 + pendingAuthToken
  |                                 |    else → generateUpgradePrepareToken()
  |                                 |
  |<---- { displayName, avatarUrl,  |
  |        prepareToken } ----------|
  |                                 |
  | (клиент показывает UI подтверждения ника)
  |                                 |
  |-- POST /auth/upgrade ----------->| Authorization: Bearer <guestToken>
  |   { prepareToken, nickname }    |  verifyUpgradePrepareToken()
  |                                 |  verifyGuestToken() — проверка совпадения sub
  |                                 |  verifyClaimToken() из prepareToken.claimToken
  |                                 |
  |                                 |  --- Транзакция ---
  |                                 |  markClaimConsumed(matchId) — атомарный WHERE IS NULL
  |                                 |  createUserFromGuest() — user + oauth_link + profile + wallet
  |                                 |  ratingService.initializeRating()
  |                                 |  --- /Транзакция ---
  |                                 |
  |                                 |  generateAccessToken(userId, false) → JWT
  |                                 |
  |<---- { accessToken, userId,     |
  |        profile, rating } -------|
```

**Вариант B (без prepareToken):** клиент отправляет `{ mode: "convert_guest", provider, code, claimToken }` сразу на `/auth/upgrade`. Логика аналогична, но без промежуточного шага подтверждения ника.

**Вариант C (без claimToken, slime-arena-ias0):** гость может зарегистрироваться через OAuth без матча. В этом случае `claimToken` не требуется, и rating не инициализируется. Используется `createUserFromOAuth()` вместо `createUserFromGuest()`.

#### 3.4.2 complete_profile (Telegram-anonymous → Registered)

```
Клиент (TMA)                    MetaServer
  |                                 |
  | (после матча — Telegram-анонимный пользователь)
  |                                 |
  |-- POST /auth/upgrade ----------->| Authorization: Bearer <accessToken (anonymous)>
  |   { mode: "complete_profile",   | verifyAccessToken() → isAnonymous must be true
  |     claimToken }                | verifyClaimToken() → matchId, subjectId, skinId
  |                                 | accessPayload.sub === claimPayload.subjectId
  |                                 |
  |                                 | --- Транзакция ---
  |                                 | markClaimConsumed(matchId)
  |                                 | completeAnonymousProfile() → is_anonymous=false
  |                                 |   + registration_skin_id, registration_match_id
  |                                 |   + profiles.selected_skin_id
  |                                 | ratingService.initializeRating()
  |                                 | --- /Транзакция ---
  |                                 |
  |                                 | generateAccessToken(userId, false) → новый JWT
  |                                 |
  |<---- { accessToken, userId,     |
  |        profile, isAnonymous:false,|
  |        rating } ----------------|
```

### 3.5 Account Merge / Conflict Resolution

Конфликт возникает, когда OAuth-аккаунт уже привязан к другому пользователю.

```
Клиент                          MetaServer
  |                                 |
  |-- POST /auth/upgrade            |
  |   или /auth/oauth/prepare-upgrade
  |                                 |
  |   OAuth link уже существует:    |
  |                                 | findUserByOAuthLink() → existingUser
  |                                 |
  |                                 | redis.set(pendingAuthToken, 'valid', EX:300)
  |                                 | generatePendingAuthToken({
  |                                 |   provider, providerUserId, existingUserId
  |                                 | }) → JWT (5 min)
  |                                 |
  |<---- 409 { error: "oauth_conflict"|
  |        или "oauth_already_linked",|
  |        pendingAuthToken,         |
  |        existingAccount: {        |
  |          nickname, avatarUrl,    |
  |          totalMass } } ---------|
  |                                 |
  | (клиент показывает UI: "Войти в существующий аккаунт?")
  |                                 |
  |-- POST /auth/oauth/resolve ---->| { pendingAuthToken }
  |                                 | verifyPendingAuthToken()
  |                                 | redis.get(key) — проверка одноразовости
  |                                 | redis.del(key)
  |                                 | getUserById(existingUserId)
  |                                 | generateAccessToken()
  |                                 |
  |<---- { accessToken, userId,     |
  |        profile, isAnonymous } --|
```

**Критично:** Redis обязателен для одноразовости pendingAuthToken. Без Redis — 503.

---

## 4. JWT

### 4.1 Типы токенов

| Тип | `type` field | TTL | Подпись | Хранение | Назначение |
|-----|-------------|-----|---------|----------|------------|
| `accessToken` | `"user"` | 24 часа | HS256, `JWT_SECRET` | Клиент (header) | API-запросы зарегистрированных и Telegram-anonymous |
| `guestToken` | `"guest"` | 7 дней | HS256, `JWT_SECRET` | Клиент (localStorage) | API-запросы standalone-гостей |
| `claimToken` | `"claim"` | 60 мин (env: `CLAIM_TOKEN_TTL_MINUTES`) | HS256, `JWT_SECRET` | Клиент | Привязка результата матча к upgrade |
| `pendingAuthToken` | `"pending_auth"` | 5 мин | HS256, `JWT_SECRET` | Клиент + Redis | Resolve OAuth-конфликта (одноразовый) |
| `upgradePrepareToken` | `"upgrade_prepare"` | 5 мин | HS256, `JWT_SECRET` | Клиент | Промежуточный шаг подтверждения ника при upgrade |
| `joinToken` | — (нет type) | 5 мин (env: `JOIN_TOKEN_EXPIRES`) | HS256, `JOIN_TOKEN_SECRET` или `JWT_SECRET` | Клиент → ArenaRoom.onAuth | Авторизация подключения к игровой комнате |
| `adminAccessToken` | `"admin"` | 15 мин | HS256, `JWT_SECRET` | Клиент (admin SPA) | API-запросы к админ-панели |
| `adminRefreshToken` | — (opaque) | 7 дней | — (random bytes) | httpOnly cookie + DB (hash) | Обновление adminAccessToken |

### 4.2 Структуры payload

**AccessTokenPayload:**
```typescript
{
  sub: string;        // User ID (UUID)
  type: 'user';
  isAnonymous: boolean;
  iat: number;
  exp: number;
}
```

**GuestTokenPayload:**
```typescript
{
  sub: string;        // Guest subject ID (UUID)
  type: 'guest';
  iat: number;
  exp: number;
}
```

**ClaimTokenPayload:**
```typescript
{
  type: 'claim';
  matchId: string;    // UUID
  subjectId: string;  // userId или guestSubjectId
  finalMass: number;
  skinId: string;
  iat: number;
  exp: number;
}
```

**PendingAuthTokenPayload:**
```typescript
{
  type: 'pending_auth';
  provider: string;          // 'google' | 'yandex'
  providerUserId: string;
  existingUserId: string;
  iat: number;
  exp: number;
}
```

**UpgradePrepareTokenPayload:**
```typescript
{
  type: 'upgrade_prepare';
  provider: string;
  providerUserId: string;
  displayName: string;
  avatarUrl?: string;
  guestSubjectId: string;
  claimToken: string;       // Вложенный JWT claimToken
  iat: number;
  exp: number;
}
```

**JoinTokenPayload:**
```typescript
{
  userId: string;           // UUID или '' для гостей
  matchId: string;          // UUID или '' для quick play
  roomId: string;           // или '' для quick play
  nickname: string;
  spriteId?: string;        // Имя файла спрайта
  guestSubjectId?: string;  // UUID для standalone-гостей
  iat: number;
  exp: number;
}
```

**AdminTokenPayload:**
```typescript
{
  sub: string;        // Admin user ID
  type: 'admin';
  role: string;       // 'admin' | 'viewer' | etc.
  username: string;
  iat: number;
  exp: number;
}
```

### 4.3 JWT Secret

- Переменная окружения: `JWT_SECRET`
- Dev default: `'slime-arena-dev-jwt-secret'` (WARNING выводится в консоль)
- Production: отсутствие `JWT_SECRET` → **FATAL** Error при запуске

### 4.4 Верификация

Каждый тип токена имеет dedicated verify-функцию, которая:
1. Проверяет подпись (HS256)
2. Проверяет срок действия
3. Проверяет поле `type` (защита от token confusion)
4. Проверяет обязательные поля в payload

Ошибки верификации: `expired` | `invalid` | `malformed`.

---

## 5. Platform Auth Providers

Две фабрики:
- `AuthProviderFactory` — platform-level провайдеры (для `/auth/verify`). Интерфейс `IAuthProvider`.
- `OAuthProviderFactory` — OAuth провайдеры (для `/auth/oauth`, `/auth/upgrade`). Интерфейс `IOAuthProvider`.

### 5.1 Telegram (`TelegramAuthProvider`)

- **Протокол:** HMAC-SHA256 верификация `initData` из Telegram WebApp.
- **SDK:** Telegram Mini Apps API (клиентская сторона).
- **Верификация:**
  1. Парсинг `initData` как URLSearchParams.
  2. Извлечение `hash`, сортировка оставшихся параметров по ключу.
  3. `secretKey = HMAC-SHA256("WebAppData", BOT_TOKEN)`.
  4. `calculatedHash = HMAC-SHA256(secretKey, dataCheckString)`.
  5. Сравнение `calculatedHash === hash`.
  6. Проверка `auth_date` <= 24 часа от текущего времени.
- **Env:** `TELEGRAM_BOT_TOKEN` (обязателен).
- **Возвращает:** `{ platformUserId: user.id, nickname: username || first_name || "User{id}", avatarUrl: photo_url, metadata: { firstName, lastName, languageCode, isPremium } }`.

### 5.2 Yandex Games SDK (`YandexAuthProvider`)

- **Протокол:** Два формата platformAuthToken:
  1. **JWT** (3 части через `.`) — от `getPlayer({ signed: true })` для авторизованных пользователей. Декодируется payload (base64), поле `sub` используется как userId.
  2. **`playerId:playerName`** — для неавторизованных. Парсится по первому `:`.
- **SDK:** Yandex Games SDK.
- **Env:** `YANDEX_APP_ID` (обязателен).
- **ВНИМАНИЕ:** JWT подпись НЕ верифицируется (TODO комментарий в коде).
- **Возвращает:** `{ platformUserId: sub/playerId, nickname, avatarUrl: payload.picture, metadata: { locale, country } }`.

### 5.3 Google OAuth (`GoogleOAuthProvider`)

- **Протокол:** Authorization Code Flow (серверный).
- **Шаги:**
  1. `POST https://oauth2.googleapis.com/token` с `code`, `client_id`, `client_secret`, `redirect_uri`, `grant_type=authorization_code`.
  2. `GET https://www.googleapis.com/oauth2/v2/userinfo` с `Authorization: Bearer {access_token}`.
- **Env:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (default: `http://localhost:3000/api/v1/auth/oauth/callback`).
- **Возвращает:** `{ id, email, name, picture }`.
- **Lazy singleton** через `getGoogleOAuthProvider()`.

### 5.4 Yandex OAuth (`YandexOAuthProvider`)

- **Протокол:** Authorization Code Flow (серверный).
- **Шаги:**
  1. `POST https://oauth.yandex.ru/token` с `code`, `grant_type=authorization_code`, `Authorization: Basic base64(client_id:client_secret)`.
  2. `GET https://login.yandex.ru/info?format=json` с `Authorization: OAuth {access_token}`.
- **Env:** `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`.
- **Аватар:** `https://avatars.yandex.net/get-yapic/{avatarId}/islands-200`.
- **Возвращает:** `{ id, login, display_name, default_avatar_id }`.
- **Lazy singleton** через `getYandexOAuthProvider()`.

### 5.5 Poki (`PokiAuthProvider`)

- **Протокол:** Client-trusted формат `userId:nickname`.
- **SDK:** Poki SDK (клиентская сторона).
- **Верификация:**
  - Парсинг по первому `:`.
  - `userId` должен начинаться с `poki_` и быть >= 5 символов.
- **Env:** Не требуется.
- **ВНИМАНИЕ:** Нет серверной верификации. Клиент может подделать данные.

### 5.6 CrazyGames (`CrazyGamesAuthProvider`)

- **Протокол:** JWT от `SDK.user.getUserToken()`.
- **SDK:** CrazyGames SDK.
- **Верификация:** Декодирование payload из JWT (base64). **Подпись НЕ верифицируется** (TODO: `getPublicKey()` закомментирован).
- **Публичный ключ CrazyGames:** `https://sdk.crazygames.com/publicKey.json` (не используется).
- **Env:** Не требуется.
- **Возвращает:** `{ platformUserId: userId, nickname: username || "CrazyPlayer{id}", avatarUrl: profilePictureUrl }`.

### 5.7 GameDistribution (`GameDistributionAuthProvider`)

- **Протокол:** Client-trusted формат `userId:nickname`.
- **SDK:** GameDistribution SDK (НЕ предоставляет авторизацию).
- **Верификация:**
  - Парсинг по первому `:`.
  - `userId` должен начинаться с `gd_` и быть >= 5 символов.
- **Env:** Не требуется.
- **ВНИМАНИЕ:** Полностью client-trusted. Идентификатор генерируется на клиенте (`gd_<timestamp>_<random>`).

### 5.8 Dev (`DevAuthProvider`)

- **Протокол:** Формат `userId:nickname`.
- **Верификация:** Минимальная — только проверка наличия обеих частей.
- **НЕ ИСПОЛЬЗОВАТЬ В PRODUCTION.**
- **Env:** Не требуется. Всегда зарегистрирован в `AuthProviderFactory`.

### 5.9 VK (P1 — не реализован)

- Присутствует в `OAuthProviderFactory` как `OAuthProviderName = 'vk'`.
- `getProvider('vk')` возвращает `null`.
- В региональной матрице помечен как доступный для RU и CIS.
- Env: `VK_CLIENT_ID`, `VK_CLIENT_SECRET`, `OAUTH_VK_ENABLED` (default: false).
- Требует PKCE.

---

## 6. Admin Auth

### 6.1 Архитектура

Admin auth полностью изолирован от player auth:
- Отдельная таблица: `admin_users` (id, username, password_hash, role, totp_enabled, totp_secret_encrypted).
- Отдельная таблица сессий: `admin_sessions` (user_id, refresh_token_hash, ip, user_agent, expires_at).
- Отдельный JWT: `type: 'admin'`, подписан тем же `JWT_SECRET`, но TTL 15 минут.
- Refresh token: opaque (crypto.randomBytes(32).hex), хранится как SHA256 hash в `admin_sessions`.

### 6.2 Login Flow

```
Admin SPA                       MetaServer
  |                                 |
  |-- POST /api/v1/admin/login ---->| loginRateLimiter (5 req/min per IP)
  |   { username, password }        |
  |                                 | SELECT from admin_users WHERE username=$1
  |                                 | bcrypt.compare(password, hash || dummyHash)
  |                                 |   (timing-safe: dummyHash при отсутствии user)
  |                                 |
  |                                 | generateAdminAccessToken() → JWT (15 min)
  |                                 | generateRefreshToken() → random hex (32 bytes)
  |                                 | INSERT INTO admin_sessions(refresh_token_hash, ...)
  |                                 | logAction('login')
  |                                 |
  |<---- { accessToken,            |
  |        totpRequired } ---------|
  |   + Set-Cookie: refresh_token  |
  |     (httpOnly, secure, strict, |
  |      path=/api/v1/admin,       |
  |      maxAge=7d)                |
```

### 6.3 Token Refresh

```
  |-- POST /api/v1/admin/refresh -->| refreshRateLimiter (10 req/min)
  |   Cookie: refresh_token         | hashRefreshToken() → lookup in admin_sessions
  |                                 | Check expires_at > NOW()
  |                                 | Load admin_users → generateAdminAccessToken()
  |<---- { accessToken,            |
  |        totpRequired } ---------|
```

### 6.4 TOTP (2FA)

- **Алгоритм:** SHA1, 6 цифр, 30 секунд period, window=1 (допускается +-30 сек).
- **Библиотека:** `otpauth` (OTPAuth.TOTP).
- **Хранение секрета:** AES-256-GCM шифрование с `ADMIN_ENCRYPTION_KEY` (32 bytes, base64).
  - Формат: `base64(iv[12] || ciphertext || authTag[16])`.
- **Issuer:** `"SlimeArena Admin"`.
- **QR-код:** Генерируется серверно через `qrcode` библиотеку (Data URL), **НЕ** через Google Charts API.

**Setup flow:**
1. `POST /admin/totp/setup` → генерирует секрет, шифрует, сохраняет в `admin_users.totp_secret_encrypted`, возвращает `{ secret: otpauthUri, qrCodeUrl: dataURL }`.
2. Пользователь сканирует QR и вводит код.
3. `POST /admin/totp/verify` → расшифровывает секрет, проверяет код, ставит `totp_enabled=true`.

**Защита чувствительных действий:** middleware `require2FA` проверяет заголовок `X-2FA-Code`.

### 6.5 RBAC

Роли хранятся в `admin_users.role` (строка). В текущем коде проверка ролей не гранулярная — `requireAdminAuth` только подтверждает существование admin-пользователя. `require2FA` — дополнительный уровень для чувствительных операций.

### 6.6 Security measures

- **Timing-safe bcrypt:** при отсутствии пользователя используется dummyHash для bcrypt.compare.
- **Единый ответ на login failure:** `"Invalid credentials"` — нет enumeration attack.
- **Audit logging:** все действия (login, logout, login_failed, totp_setup, totp_verify) логируются fire-and-forget.
- **Rate limiting:** отдельные лимиты для login (5/min), refresh (10/min), TOTP (3/min).

---

## 7. JoinToken

### 7.1 Назначение

JoinToken авторизует подключение клиента к игровой комнате Colyseus (ArenaRoom). Проверяется в `ArenaRoom.onAuth()`.

### 7.2 Структура

```typescript
interface JoinTokenPayload {
  userId: string;           // UUID для зарегистрированных, '' для гостей
  matchId: string;          // UUID или '' (quick play)
  roomId: string;           // Room ID или '' (quick play)
  nickname: string;
  spriteId?: string;        // 'slime-samurai.webp' etc.
  guestSubjectId?: string;  // UUID для standalone-гостей
}
```

### 7.3 Создание

- Endpoint: `POST /api/v1/auth/join-token`.
- Два потока:
  1. **Guest:** `verifyGuestToken` → `joinTokenService.generateToken(userId='', ...)` с `guestSubjectId`.
  2. **Registered:** `verifyAccessToken` → запрос `profiles.selected_skin_id` из БД → `joinTokenService.generateToken(userId=sub, ...)`.

### 7.4 Подпись и валидация

- **Secret:** `JOIN_TOKEN_SECRET` || `JWT_SECRET` || `'slime-arena-dev-secret'` (dev fallback).
- **TTL:** `JOIN_TOKEN_EXPIRES` env (default: 300 сек = 5 мин).
- **Production fail-fast:** если `JOIN_TOKEN_REQUIRED=true` или `NODE_ENV=production` и нет `JOIN_TOKEN_SECRET` → FATAL Error при старте.
- **Room validation:** `verifyTokenForRoom()` — проверяет roomId (пустой roomId принимается для quick play).

---

## 8. Middleware

### 8.1 `requireAuth` (player auth)

Двойная стратегия верификации:
1. **JWT (новый поток):** `verifyAccessToken(token)` → `getUserById(payload.sub)`.
2. **Session-based (legacy):** `authService.verifySession(token)` → lookup по `token_hash` в `sessions` + `expires_at > NOW()` + `revoked_at IS NULL` + `is_banned = FALSE`.

Header: `Authorization: Bearer <token>`.

### 8.2 `requireAdmin` (player-based admin check)

**Отличается от `requireAdminAuth`!** Это middleware для player API, проверяет `ADMIN_USER_IDS` env variable или dev-mode с `platformType=dev`.

### 8.3 `requireServerToken` (server-to-server)

Header: `Authorization: ServerToken <token>`.
Env: `MATCH_SERVER_TOKEN`.
Использует `timingSafeEqual` для сравнения.

### 8.4 `requireAdminAuth` (admin panel)

JWT верификация с `type === 'admin'`. Загружает admin user из `admin_users` (включая `totp_secret_encrypted` для N+1 оптимизации).

### 8.5 `require2FA`

Проверяет `X-2FA-Code` header. Расшифровывает TOTP секрет из `adminUser.totpSecretEncrypted` (загружен в `requireAdminAuth`), верифицирует код. Требует `totpEnabled === true`.

### 8.6 Rate Limiting

In-memory rate limiter (Map-based). Очистка устаревших записей каждые 5 минут.

| Лимитер | Лимит | Окно | По чему |
|---------|-------|------|---------|
| `authRateLimiter` | 10 req | 1 мин | IP |
| `oauthRateLimiter` | 5 req | 1 мин | IP |
| `totpRateLimiter` | 3 req | 1 мин | IP |
| `adminPostRateLimiter` | 10 req | 1 мин | userId |
| `adminGetRateLimiter` | 60 req | 1 мин | userId |
| `restartRateLimiter` | 3 req | 1 мин | userId |
| `loginRateLimiter` | 5 req | 1 мин | IP |
| `refreshRateLimiter` | 10 req | 1 мин | IP |
| `logoutRateLimiter` | 10 req | 1 мин | userId |

**IP определение:** `X-Forwarded-For` доверяется только при `TRUST_PROXY=true`.

Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` (при 429).

---

## 9. API Endpoints

### 9.1 Player Auth (`/api/v1/auth/*`)

| Метод | Endpoint | Auth | Rate Limit | Описание |
|-------|----------|------|------------|----------|
| `POST` | `/auth/guest` | Нет | 10/min (auth) | Создать guestToken (без БД) |
| `POST` | `/auth/join-token` | Bearer (guest/user) | 10/min (auth) | Создать joinToken для подключения к комнате |
| `GET` | `/auth/config` | Нет | 10/min (auth) | Получить доступных OAuth провайдеров по региону |
| `POST` | `/auth/telegram` | Нет | 10/min (auth) | Telegram silent auth (initData) |
| `POST` | `/auth/verify` | Нет | 10/min (auth) | Platform auth (legacy session-based) |
| `POST` | `/auth/oauth` | Нет | 5/min (oauth) | OAuth login (Google/Yandex) |
| `POST` | `/auth/oauth/prepare-upgrade` | Bearer (guest) | 5/min (oauth) | Подготовить upgrade: exchange code, вернуть displayName |
| `POST` | `/auth/upgrade` | Bearer (guest/user) | 10/min (auth) | Upgrade guest→registered или complete_profile |
| `POST` | `/auth/oauth/resolve` | Нет | 10/min (auth) | Войти в существующий аккаунт по pendingAuthToken |
| `POST` | `/auth/logout` | Bearer (user) | 10/min (auth) | Отозвать сессию (legacy session-based) |

### 9.2 Детали запросов/ответов

#### `POST /auth/guest`

Запрос: пустое тело.

Ответ (200):
```json
{
  "guestToken": "eyJhbGciOiJI...",
  "guestSubjectId": "uuid-v4",
  "expiresAt": "2026-03-14T12:00:00.000Z"
}
```

#### `POST /auth/join-token`

Запрос:
```json
{
  "nickname": "Игрок",      // опционально, валидируется
  "skinId": "slime-blue.webp" // опционально, валидируется через isValidSprite()
}
```

Ответ (200):
```json
{
  "joinToken": "eyJhbGciOiJI...",
  "expiresIn": 300
}
```

#### `GET /auth/config`

Ответ (200):
```json
{
  "region": "RU",
  "providers": [
    { "name": "yandex", "clientId": "xxx", "priority": 1, "requiresPKCE": false }
  ]
}
```

#### `POST /auth/telegram`

Запрос:
```json
{
  "initData": "query_id=...&user=...&auth_date=...&hash=..."
}
```

Ответ (200):
```json
{
  "accessToken": "eyJhbGciOiJI...",
  "userId": "uuid",
  "profile": { "nickname": "...", "locale": "ru" },
  "isNewUser": true,
  "isAnonymous": true
}
```

#### `POST /auth/verify`

Запрос:
```json
{
  "platformType": "telegram",
  "platformAuthToken": "..."
}
```

Ответ (200):
```json
{
  "accessToken": "opaque-base64url-token",
  "userId": "uuid",
  "profile": { "nickname": "...", "locale": "ru" }
}
```

#### `POST /auth/oauth`

Запрос:
```json
{
  "provider": "google",
  "code": "4/0AbCD..."
}
```

Ответ (200):
```json
{
  "accessToken": "eyJhbGciOiJI...",
  "userId": "uuid",
  "profile": { "nickname": "...", "locale": "ru" },
  "isAnonymous": false
}
```

Ошибки: `403 provider_not_available`, `401 oauth_failed`, `500 configuration_error`.

#### `POST /auth/oauth/prepare-upgrade`

Запрос (Authorization: Bearer guestToken):
```json
{
  "provider": "google",
  "code": "4/0AbCD...",
  "claimToken": "eyJhbGciOiJI...",   // опционально
  "redirectUri": "..."                // не используется в backend
}
```

Ответ (200):
```json
{
  "displayName": "John Doe",
  "avatarUrl": "https://...",
  "prepareToken": "eyJhbGciOiJI..."
}
```

Ответ (409 — конфликт):
```json
{
  "error": "oauth_conflict",
  "existingAccount": { "nickname": "...", "avatarUrl": "...", "totalMass": 1234 },
  "pendingAuthToken": "eyJhbGciOiJI..."
}
```

#### `POST /auth/upgrade`

Запрос (mode: convert_guest, с prepareToken):
```json
{
  "prepareToken": "eyJhbGciOiJI...",
  "nickname": "MyNick"
}
```

Запрос (mode: convert_guest, без prepareToken):
```json
{
  "mode": "convert_guest",
  "provider": "google",
  "code": "4/0AbCD...",
  "claimToken": "eyJhbGciOiJI..."
}
```

Запрос (mode: complete_profile):
```json
{
  "mode": "complete_profile",
  "claimToken": "eyJhbGciOiJI..."
}
```

Ответ (200):
```json
{
  "accessToken": "eyJhbGciOiJI...",
  "userId": "uuid",
  "profile": { "nickname": "...", "locale": "ru" },
  "isAnonymous": false,
  "rating": { "totalMass": 500, "bestMass": 500, "matchesPlayed": 1 }
}
```

Ошибки: `409 claim_already_consumed`, `409 oauth_already_linked`, `503 service_unavailable`.

#### `POST /auth/oauth/resolve`

Запрос:
```json
{
  "pendingAuthToken": "eyJhbGciOiJI..."
}
```

Ответ (200):
```json
{
  "accessToken": "eyJhbGciOiJI...",
  "userId": "uuid",
  "profile": { "nickname": "...", "locale": "ru" },
  "isAnonymous": false
}
```

Ошибки: `410 token_already_used`, `404 user_not_found`, `503 service_unavailable`.

#### `POST /auth/logout`

Запрос: пустое тело (Authorization header).

Ответ (200):
```json
{ "success": true }
```

### 9.3 Admin Auth (`/api/v1/admin/*`)

| Метод | Endpoint | Auth | Rate Limit | Описание |
|-------|----------|------|------------|----------|
| `POST` | `/admin/login` | Нет | 5/min (IP) | Login с username/password |
| `POST` | `/admin/refresh` | Cookie (refresh_token) | 10/min (IP) | Обновить accessToken |
| `POST` | `/admin/logout` | Bearer (admin JWT) | 10/min (userId) | Удалить сессию |
| `POST` | `/admin/totp/setup` | Bearer (admin JWT) | 3/min (IP) | Сгенерировать TOTP секрет |
| `POST` | `/admin/totp/verify` | Bearer (admin JWT) | 3/min (IP) | Верифицировать код и включить TOTP |

---

## 10. Захардкоженные значения

| Значение | Где | Контекст |
|----------|-----|----------|
| `'slime-arena-dev-jwt-secret'` | `jwtUtils.ts:121`, `adminAuth.ts:60` | Dev fallback для JWT_SECRET |
| `'slime-arena-dev-encryption-key!!'` | `adminAuth.ts:76` | Dev fallback для ADMIN_ENCRYPTION_KEY (32 bytes) |
| `'slime-arena-dev-secret'` | `JoinTokenService.ts:45` | Dev fallback для JOIN_TOKEN_SECRET |
| `24 * 60 * 60` (86400 сек) | `jwtUtils.ts:128` | accessToken TTL: 24 часа |
| `7 * 24 * 60 * 60` (604800 сек) | `jwtUtils.ts:129` | guestToken TTL: 7 дней |
| `5 * 60` (300 сек) | `jwtUtils.ts:130` | pendingAuthToken / upgradePrepareToken TTL: 5 мин |
| `15 * 60` (900 сек) | `adminAuth.ts:49` | adminAccessToken TTL: 15 мин |
| `7 * 24 * 60 * 60` (604800 сек) | `admin.ts:72` | Admin refresh cookie maxAge: 7 дней |
| `300` (сек) | `JoinTokenService.ts:48` | joinToken TTL default: 5 мин |
| `30` (дней) | `AuthService.ts:52` | SESSION_DURATION_DAYS default: 30 дней |
| `86400` (сек) | `TelegramAuthProvider.ts:56` | Telegram auth_date validity: 24 часа |
| `'WebAppData'` | `TelegramAuthProvider.ts:40` | Telegram HMAC key prefix |
| `'poki_'` | `PokiAuthProvider.ts:41` | Required prefix для Poki userId |
| `'gd_'` | `GameDistributionAuthProvider.ts:39` | Required prefix для GameDistribution userId |
| `5 * 60 * 1000` (мс) | `rateLimiter.ts:25` | Интервал очистки rate limit записей |
| `'$2b$10$TQ5Mt1...'` | `admin.ts:129` | Dummy bcrypt hash для timing-safe сравнения |
| `REFRESH_COOKIE_NAME = 'refresh_token'` | `admin.ts:71` | Имя cookie для admin refresh token |
| `path: '/api/v1/admin'` | `admin.ts:79` | Cookie path |

---

## 11. Расхождения с документацией

### Архитектура v4.2.5 Part 2 vs Код

| Тема | Документация (Part 2) | Код (v0.8.7) | Статус |
|------|----------------------|--------------|--------|
| **AuthService** | "выпуск accessToken, управление сессиями" | AuthService выпускает opaque session tokens (legacy). JWT accessToken генерируется в route handler напрямую через `jwtUtils.generateAccessToken()`. | Расхождение. AuthService не знает о JWT. |
| **IAuthProvider** | `getUser` / `getAuthToken` методы | Реализован метод `verifyToken(platformAuthToken): PlatformUserData`. Нет `getUser`/`getAuthToken`. | Расхождение в именовании. |
| **platform_type** в users | `telegram, yandex, poki, guest` | Реально: `telegram, yandex, poki, crazygames, gamedistribution, dev, google` | Расхождение. Добавлены платформы. |

### Архитектура v4.2.5 Part 4 vs Код

| Тема | Документация (Part 4) | Код (v0.8.7) | Статус |
|------|----------------------|--------------|--------|
| **POST /auth/verify response** | Возвращает `configVersion` | Не возвращает `configVersion` | Расхождение |
| **POST /auth/verify response** | Возвращает `ProfileSummary` с `level, xp, selectedSkinId, wallet` | Возвращает только `{ nickname, locale }` | Расхождение. Упрощённый profile в ответе. |
| **Endpoints** | Только `POST /auth/verify` | Добавлены: `/auth/guest`, `/auth/join-token`, `/auth/config`, `/auth/telegram`, `/auth/oauth`, `/auth/oauth/prepare-upgrade`, `/auth/upgrade`, `/auth/oauth/resolve`, `/auth/logout` | Значительное расширение. |
| **Таблица users** | Нет полей `is_anonymous`, `registration_skin_id`, `registration_match_id`, `nickname_set_at` | Эти поля существуют и активно используются | Расхождение. Документация не обновлена. |
| **oauth_links** | Не описана в Part 4 | Таблица существует: `(id, user_id, auth_provider, provider_user_id, created_at)` | Расхождение. |
| **Тип AuthProvider** | Не определён в документации | `'telegram' \| 'google' \| 'yandex'` в модели. В реальности шире. | Расхождение. |
| **Guest Flow** | Не описан | Полностью реализован через guestToken (JWT, без БД) | Отсутствует в документации. |
| **claimToken** | Не описан | Полностью реализован для upgrade/registration flow | Отсутствует в документации. |
| **Admin auth** | Описан как "admin routes... конкретные права задаются конфигурацией" | Полная реализация: admin_users, bcrypt, JWT, refresh, TOTP, audit | Значительно расширен. |
| **Безопасность F.3** | "Telegram: проверка подписи initData и времени жизни данных" | Реализовано корректно в TelegramAuthProvider | Соответствует |
| **CSRF OAuth state** | Не упомянут | TODO в GoogleOAuthProvider и YandexOAuthProvider | Не реализован (P2) |

---

## 12. Технический долг

### Критичный (P0-P1)

1. **Yandex Games JWT подпись НЕ верифицируется** (`YandexAuthProvider.ts:44`) — `// TODO: В production добавить верификацию подписи через Yandex API`. Позволяет подделать userId.
2. **CrazyGames JWT подпись НЕ верифицируется** (`CrazyGamesAuthProvider.ts:36-37`) — `getPublicKey()` закомментирован. Позволяет подделать userId.
3. **OAuth state parameter не реализован** (`GoogleOAuthProvider.ts:5-8`, `YandexOAuthProvider.ts:5-8`) — уязвимость для CSRF-атак при OAuth flow.

### Важный (P2)

4. **Rate limiter в памяти** (`rateLimiter.ts:7-8`) — при масштабировании на несколько инстансов лимиты не будут делиться. Комментарий предлагает Redis store.
5. **Двойная система auth** — legacy session-based (opaque token + sessions таблица) + JWT. Middleware `requireAuth` пробует оба. Надо мигрировать на единый механизм.
6. **`UNKNOWN` регион разрешает Google** (`OAuthProviderFactory.ts:53`) — `// TODO: Вернуть false перед production`.
7. **Poki и GameDistribution** — полностью client-trusted auth без серверной верификации. Подделка userId тривиальна.
8. **DevAuthProvider** всегда зарегистрирован в `AuthProviderFactory` — в production нет проверки `NODE_ENV`.

### Улучшения (P3)

9. **AuthProvider тип ограничен** (`OAuth.ts:9`) — `'telegram' | 'google' | 'yandex'`, но фактически используются `crazygames`, `gamedistribution`, `poki`, `dev`.
10. **Вложенный JWT в upgradePrepareToken** — `claimToken` хранится как строка внутри JWT payload, что увеличивает размер токена.
11. **`redirectUri` в prepare-upgrade** — принимается в body, но не используется (Google/Yandex provider берут из env).
12. **Документация архитектуры** — сильно устарела относительно фактической реализации auth (см. раздел 11).

---

## 13. Заметки для форка BonkRace

### Переиспользуется целиком

- **JWT утилиты** (`jwtUtils.ts`) — типы токенов универсальны. Переименовать `'slime-arena-dev-*'` дефолты.
- **Platform adapters** — все провайдеры можно использовать без изменений. При необходимости убрать неиспользуемые из `AuthProviderFactory.initialize()`.
- **OAuthProviderFactory** — региональная матрица и фильтрация переиспользуются. Обновить issuer в TOTP (`'SlimeArena Admin'` → `'BonkRace Admin'`).
- **Admin auth** — bcrypt + JWT + TOTP полностью generic.
- **Rate limiter** — generic, без game-specific логики.
- **Auth middleware** — `requireAuth`, `requireServerToken`, `requireAdminAuth`, `require2FA` — generic.

### Требует изменения

- **JoinToken payload** — убрать `spriteId` (game-specific). `guestSubjectId` оставить если есть claim-based flow.
- **ClaimToken** — `finalMass`, `skinId` — game-specific. Заменить на BonkRace-specific поля или сделать generic `matchData: Record<string, unknown>`.
- **AuthService** — `registrationSkinId`, `registrationMatchId` в User/DB — game-specific. Генерализовать или убрать.
- **`pickSpriteByName()`** / `isValidSprite()` — game-specific fallback для skinId в join-token route. Заменить на BonkRace-specific.
- **`completeAnonymousProfile()`** — обновляет `profiles.selected_skin_id` — game-specific.
- **`ratingService.initializeRating()`** — вызывается при upgrade, game-specific (Glicko-2 для Slime Arena).
- **`leaderboard_total_mass`** — запрос totalMass при 409 conflict — game-specific.
- **GUEST_DEFAULT_NICKNAME** — из `@slime-arena/shared`, заменить на BonkRace.
- **Dev fallback secrets** — переименовать `'slime-arena-dev-*'` на `'bonkrace-dev-*'`.
