# Reverse: Client Services, OAuth, Platform Manager
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

---

## 1. Обзор

Клиентская часть Slime Arena построена на паттерне **Service Layer + Platform Abstraction**. Все HTTP-взаимодействия с MetaServer проходят через единый `MetaServerClient` (синглтон). Поверх него работают бизнес-сервисы: AuthService, MatchmakingService, ConfigService, LeaderboardService, MatchResultsService, AdsService. Каждый сервис -- синглтон-экспорт.

Платформенные различия инкапсулированы в `PlatformManager`, который определяет текущую платформу и создает соответствующие адаптеры авторизации (`IAuthAdapter`) и рекламы (`IAdsProvider`).

OAuth (Standalone/Web) -- отдельный модуль `client/src/oauth/`, реализующий Authorization Code Flow для Google и Yandex с CSRF-protection (state) и опциональным PKCE.

Все сервисы используют Preact signals (`@preact/signals`) для реактивного обновления UI.

---

## 2. Исходные файлы

| Файл | Назначение | Строк |
|------|-----------|-------|
| `client/src/api/metaServerClient.ts` | HTTP-клиент для MetaServer API | ~388 |
| `client/src/services/authService.ts` | Управление авторизацией | ~745 |
| `client/src/services/matchmakingService.ts` | Matchmaking queue + polling | ~217 |
| `client/src/services/configService.ts` | RuntimeConfig загрузка/кеш | ~317 |
| `client/src/services/leaderboardService.ts` | Глобальный лидерборд | ~198 |
| `client/src/services/matchResultsService.ts` | Claim rewards, claimToken | ~197 |
| `client/src/services/adsService.ts` | Rewarded ads orchestration | ~219 |
| `client/src/services/defaultRuntimeConfig.ts` | Fallback RuntimeConfig | ~51 |
| `client/src/oauth/types.ts` | OAuth типы, localStorage keys | ~82 |
| `client/src/oauth/IOAuthClient.ts` | Интерфейс OAuth клиента | ~27 |
| `client/src/oauth/OAuthService.ts` | Управление OAuth flow | ~173 |
| `client/src/oauth/OAuthRedirectHandler.ts` | Обработка callback + server exchange | ~430 |
| `client/src/oauth/GoogleOAuthClient.ts` | Google OAuth 2.0 клиент | ~83 |
| `client/src/oauth/YandexOAuthClient.ts` | Yandex ID OAuth клиент | ~81 |
| `client/src/oauth/index.ts` | Re-exports | ~39 |
| `client/src/platform/PlatformManager.ts` | Определение платформы, адаптеры | ~301 |
| `client/src/platform/IAuthAdapter.ts` | Интерфейс авторизации | ~43 |
| `client/src/platform/IAdsProvider.ts` | Интерфейс рекламы | ~58 |
| `client/src/platform/StandaloneAdapter.ts` | Standalone (dev) адаптер | ~117 |
| `client/src/platform/TelegramAdapter.ts` | Telegram Mini App адаптер | ~142 |
| `client/src/platform/YandexAdapter.ts` | Yandex Games адаптер | ~133 |
| `client/src/platform/CrazyGamesAdapter.ts` | CrazyGames адаптер | ~189 |
| `client/src/platform/PokiAdapter.ts` | Poki адаптер | ~144 |
| `client/src/platform/GameDistributionAdapter.ts` | GameDistribution адаптер | ~122 |
| `client/src/platform/MockAdsProvider.ts` | Заглушка рекламы для dev | ~48 |

---

## 3. MetaServerClient (`api/metaServerClient.ts`)

### 3.1. Класс и экспорт

```typescript
class MetaServerClient { ... }
export const metaServerClient = new MetaServerClient();
export type { ApiError };
```

Синглтон. Все сервисы импортируют один экземпляр.

### 3.2. Определение Base URL

Логика `getMetaServerUrl()`:

1. Если задана env-переменная `VITE_META_SERVER_URL` -- используется она.
2. DEV-режим (`import.meta.env?.DEV`) -- пустая строка (Vite proxy).
3. Production + IP-адрес или localhost -- тот же хост, порт 3000.
4. Production + домен -- пустая строка (Nginx reverse proxy проксирует `/api/*`).
5. SSR/неизвестный контекст -- пустая строка.

`IS_PROXY_MODE` определяется отдельно: `true` если DEV или production + домен (не IP).

При пустом `META_SERVER_URL` и `IS_PROXY_MODE=false` все запросы кидают `ApiError('MetaServer недоступен', 0, 'NO_META_SERVER')`.

### 3.3. Авторизация

- Токен хранится в памяти (`this.token`) и дублируется в `localStorage['authToken']`.
- `setToken(token)` -- устанавливает в память + localStorage.
- `clearToken()` -- очищает оба.
- `getToken()` -- lazy load из localStorage если в памяти null.
- Каждый запрос добавляет `Authorization: Bearer <token>` если токен есть.

### 3.4. Публичные методы

| Метод | Описание |
|-------|----------|
| `get<T>(path)` | GET с авторизацией, retry, parse |
| `post<T>(path, body?)` | POST с авторизацией, retry, parse |
| `postIdempotent<T>(path, body?)` | POST с автогенерацией `operationId` (UUID v4) |
| `postRaw(path, body?, options?)` | POST, возвращает raw `Response` (для OAuth) |
| `getRaw(path)` | GET, возвращает raw `Response` |
| `setOnUnauthorized(cb)` | Callback при 401 (обычно `authService.logout()`) |

### 3.5. Retry логика

- **Таймаут:** 10 000 мс (`AbortController`).
- **Максимум retry:** 3 попытки.
- **Что ретраится:** 5xx ошибки, AbortError (таймаут), TypeError (сеть).
- **Backoff:** exponential -- `1000 * 2^retryCount` мс (1с, 2с, 4с).
- **Что НЕ ретраится:** 4xx ошибки, включая 401.

### 3.6. Обработка 401

При получении 401:
1. `clearToken()` -- очищает токен.
2. Если путь не содержит `/logout` и есть `onUnauthorized` callback -- вызывает его.
3. Бросает `ApiError`.

### 3.7. ApiError

```typescript
class ApiError extends Error {
  status: number;
  code?: string;
}
```

### 3.8. UUID генерация

`generateUUID()` -- `crypto.randomUUID()` с fallback на ручную генерацию для non-secure context (HTTP без HTTPS).

### 3.9. IP-адрес определение

`isIPAddress(hostname)` -- проверяет IPv4 (4 октета 0-255) и IPv6 (содержит `:`). Используется для выбора режима proxy/direct.

---

## 4. AuthService

**Файл:** `client/src/services/authService.ts`

### 4.1. Архитектура

Синглтон `authService`. Управляет полным lifecycle авторизации: инициализация, вход, восстановление сессии, logout, guest upgrade.

### 4.2. Типы ответов сервера

| Интерфейс | Endpoint | Поля |
|-----------|----------|------|
| `GuestAuthResponse` | `POST /api/v1/auth/guest` | `guestToken`, `expiresAt` |
| `TelegramAuthResponse` | `POST /api/v1/auth/telegram` | `accessToken`, `userId`, `profile{nickname, locale?}`, `isNewUser`, `isAnonymous` |
| `PlatformAuthResponse` | `POST /api/v1/auth/verify` | `accessToken`, `userId`, `profile{nickname, locale?}` |
| `ProfileSummary` | `GET /api/v1/profile` | `userId`, `nickname`, `level`, `xp`, `selectedSkinId?`, `gamesPlayed?`, `totalKills?`, `highestMass?`, `wallet{coins, gems}` |

### 4.3. Инициализация (`initialize()`)

Promise memoization (P1-3) предотвращает race condition при параллельных вызовах.

Порядок `doInitialize()`:
1. `platformManager.initialize()` -- определение платформы.
2. Проверка `access_token` в localStorage:
   - Если есть: `metaServerClient.setToken()`, `fetchProfile()`, восстановление `User` + `Profile`, установка `onUnauthorized`.
   - При 401: удаляется **только** `access_token`, НЕ вызывается `logout()` (FIX-006 -- предотвращает Auth Loop).
3. Проверка `guest_token`:
   - Проверка expiration через `token_expires_at`.
   - Если не истёк: восстановление гостевой сессии из localStorage (nickname, skinId), установка `onUnauthorized`.
   - Если истёк: очистка guest_token, переход к шагу 4.
4. Нет токенов -- запуск `login()`.

**Критически важно:** `onUnauthorized` устанавливается ПОСЛЕ успешного восстановления сессии (FIX-006).

### 4.4. Login flow

```
login() → switch(platformType):
  'telegram'      → loginViaTelegram()
  'yandex'|'poki'|'crazygames'|'gamedistribution' → loginViaPlatform(type)
  default         → loginAsGuest()
```

### 4.5. loginAsGuest()

1. POST `/api/v1/auth/guest` → получает `guestToken`, `expiresAt`.
2. Сохраняет в localStorage: `guest_token`, `token_expires_at`.
3. Генерирует `guest_nickname` (константа `GUEST_DEFAULT_NICKNAME` из shared).
4. Генерирует `guest_skin_id` (случайный из `SPRITE_NAMES`).
5. Создает User с `id='guest'`, устанавливает `metaServerClient.setToken()`.

### 4.6. loginViaTelegram()

1. Получает `initData` через `platformManager.getAdapter().getCredentials()`.
2. POST `/api/v1/auth/telegram` с `{ initData }`.
3. Очищает guest данные (`clearGuestData()`).
4. Сохраняет: `access_token`, `user_id`, `user_nickname`, `is_anonymous`.

### 4.7. loginViaPlatform() (Yandex, Poki, CrazyGames, GameDistribution)

1. Получает credentials от адаптера: `{ platformType, platformData }`.
2. Если нет credentials -- fallback на `loginAsGuest()`.
3. POST `/api/v1/auth/verify` с `{ platformType, platformAuthToken: credentials.platformData }`.
4. При ошибке -- fallback на `loginAsGuest()`.
5. Сохраняет: `access_token`, `user_id`, `user_nickname`, `is_anonymous='false'`.

### 4.8. Token storage (localStorage)

| Ключ | Назначение | Когда устанавливается |
|------|------------|----------------------|
| `access_token` | JWT зарегистрированного пользователя | loginViaTelegram, loginViaPlatform, finishUpgrade |
| `guest_token` | JWT гостя (7 дней TTL) | loginAsGuest |
| `token_expires_at` | ISO дата истечения guest_token | loginAsGuest |
| `user_id` | ID пользователя | loginViaTelegram, loginViaPlatform |
| `user_nickname` | Никнейм зарегистрированного | loginViaTelegram, loginViaPlatform, updateNickname |
| `is_anonymous` | Флаг анонимности ('true'/'false') | loginViaTelegram, finishUpgrade |
| `guest_nickname` | Никнейм гостя | loginAsGuest |
| `guest_skin_id` | Спрайт гостя | loginAsGuest |
| `selected_skin_id` | Выбранный скин (persistent) | finishUpgrade (copy from guest_skin_id) |
| `registration_claim_token` | Claim token для upgrade | matchResultsService |
| `pending_claim_token` | Pending claim token | matchResultsService |
| `authToken` | Дублирует токен в metaServerClient | metaServerClient.setToken() |

### 4.9. isAnonymous() логика

```
if (access_token exists):
  return is_anonymous === 'true'   // Telegram может быть анонимным
else if (guest_token exists):
  return true                      // Гость всегда анонимный
else:
  return false                     // Нет токена = не авторизован
```

### 4.10. cachedJoinToken

Preact signal `cachedJoinToken` кеширует текущий действующий токен (`access_token || guest_token`). Проверяет `token_expires_at` -- истёкшие токены очищаются. Обновляется при каждом изменении токенов.

### 4.11. getRoomJoinToken(nickname)

POST `/api/v1/auth/join-token` с `{ nickname, skinId }`. Возвращает `{ joinToken, expiresIn }`. Используется для подключения к игровой комнате Colyseus.

### 4.12. finishUpgrade(accessToken, nickname?)

Вызывается из `RegistrationPromptModal` после успешного OAuth upgrade:
1. Копирует `guest_skin_id` в `selected_skin_id` (сохранение выбора).
2. `clearGuestData()`.
3. Сохраняет `access_token`, устанавливает `is_anonymous='false'`.
4. Загружает профиль с сервера (`fetchProfile()`).
5. Fallback: если fetchProfile не удался -- использует переданные данные.

### 4.13. updateNickname(nickname)

POST `/api/v1/profile/nickname` (idempotent). Обновляет UI-состояние и вызывает `standaloneAdapter.setNickname()` если на Standalone.

### 4.14. logout()

1. POST `/api/v1/auth/logout` (fire and forget).
2. `metaServerClient.clearToken()`.
3. `clearAllAuthData()` -- удаляет все ключи из localStorage.
4. `clearAuthState()` -- сбрасывает Preact signals.

---

## 5. MatchmakingService

**Файл:** `client/src/services/matchmakingService.ts`

### 5.1. Константы

| Константа | Значение | Описание |
|-----------|----------|----------|
| `POLL_INTERVAL` | 2000 мс | Интервал polling статуса очереди |
| `MAX_QUEUE_TIME` | 60000 мс | Максимальное время ожидания в очереди |

### 5.2. Типы

```typescript
interface JoinQueueRequest { classId: number; nickname?: string; }
interface JoinQueueResponse { status: 'queued' | 'matched'; position?: number; assignment?: MatchAssignment; }
interface QueueStatusResponse { status: 'waiting' | 'matched' | 'expired'; position?: number; assignment?: MatchAssignment; }
```

`MatchAssignment` импортируется из `ui/signals/gameState` (содержит `matchId`, `roomId`, `matchServerUrl`, `joinToken`).

### 5.3. Flow

1. `joinQueue(classId, nickname?)` -- POST `/api/v1/matchmaking/join`.
   - Если `status === 'matched'` -- мгновенный матч, вызов `handleMatchFound()`.
   - Если `status === 'queued'` -- запуск polling через `setInterval`.
2. Polling: GET `/api/v1/matchmaking/status` каждые 2 секунды.
   - `'matched'` -- останов polling, вызов callback `onMatchFound`.
   - `'waiting'` -- обновление позиции в UI.
   - `'expired'` -- останов polling, показ ошибки.
3. Клиентский таймаут: если `Date.now() - queueStartTime > 60000` -- останов polling + ошибка.
4. `cancelQueue()` -- POST `/api/v1/matchmaking/cancel`, сброс состояния.

### 5.4. API сервиса

| Метод | Описание |
|-------|----------|
| `joinQueue(classId, nickname?)` | Присоединиться к очереди |
| `cancelQueue()` | Отменить поиск |
| `setOnMatchFound(cb)` | Callback при найденном матче |
| `getAssignment()` | Текущее назначение (из signal) |
| `isSearching()` | Проверка статуса |
| `setConnecting()` | Пометить как "подключение" |
| `reset()` | Сброс после завершения матча |

---

## 6. ConfigService

**Файл:** `client/src/services/configService.ts`

### 6.1. Типы RuntimeConfig

```typescript
interface RuntimeConfig {
  configVersion: string;
  economy: EconomyConfig;       // softCurrency, hardCurrency, matchRewards
  shop?: ShopConfig;            // offers[]
  ads?: AdsConfig;              // rewards: Record<placement, AdRewardConfig>
  battlepass?: unknown;         // Заглушка
  achievements?: unknown;       // Заглушка
  leaderboards?: unknown;       // Заглушка
  matchmaking?: MatchmakingConfig;  // allowBots, botsPerMatch, minPlayers, maxPlayers, etc.
  resilience?: ResilienceConfig;    // reconnectWindowMs, summaryTTL
  features: FeaturesConfig;     // paymentsEnabled, adsRewardEnabled, matchmakingEnabled
  abtests?: ABTestConfig[];     // A/B тесты
}
```

### 6.2. Константы

| Константа | Значение | Описание |
|-----------|----------|----------|
| `CONFIG_CACHE_KEY` | `'runtime_config'` | Ключ localStorage |
| `CONFIG_CACHE_TTL` | 300 000 мс (5 мин) | TTL кеша |
| `CONFIG_POLL_INTERVAL` | 300 000 мс (5 мин) | Интервал polling |

### 6.3. Flow загрузки

1. `loadConfig()`:
   - Если `VITE_META_SERVER_URL` не задан -- сразу `DEFAULT_RUNTIME_CONFIG`.
   - Проверка кеша в localStorage (JSON с `timestamp`). Если свежий -- применить, фоново обновить.
   - GET `/api/v1/config/runtime`.
   - При ошибке -- fallback на `DEFAULT_RUNTIME_CONFIG`.
2. Кеширование: `{ config, timestamp }` в `localStorage['runtime_config']`.
3. Polling: `startPolling()` запускает `setInterval` на 5 мин для фонового обновления.

### 6.4. DEFAULT_RUNTIME_CONFIG

**Файл:** `client/src/services/defaultRuntimeConfig.ts`

- `configVersion: '0.0.0-local'`
- `features.paymentsEnabled: false`
- `features.adsRewardEnabled: false`
- `features.matchmakingEnabled: true`
- `matchmaking.allowBots: true`, `botsPerMatch: 3`, `maxPlayers: 10`
- `resilience.reconnectWindowMs: 30000`, `summaryTTL: 3600`

### 6.5. Signals

```typescript
export const runtimeConfig = signal<RuntimeConfig>(DEFAULT_RUNTIME_CONFIG);
export const configLoading = signal(false);
export const configError = signal<string | null>(null);
```

### 6.6. Callback

`setOnConfigApplied(callback)` -- вызывается при применении нового конфига. Интеграция с `applyBalanceConfig` в `main.ts`.

---

## 7. LeaderboardService

**Файл:** `client/src/services/leaderboardService.ts`

### 7.1. Типы

```typescript
type LeaderboardMode = 'total' | 'best';

interface GlobalLeaderboardEntry {
  place: number; nickname: string; userId: string; score: number;
  skinId?: string; gamesPlayed?: number; matchesPlayed?: number; level?: number;
}
```

Серверный ответ использует `position`/`value`, маппится на `place`/`score`.

### 7.2. Endpoint

GET `/api/v1/leaderboard?mode={total|best}` -> `ServerLeaderboardResponse`:
- `entries[]` -- топ записи.
- `myPosition?`, `myValue?`, `myMatchesPlayed?` -- позиция текущего пользователя.

### 7.3. Кеширование

Клиентский кеш: 30 секунд по `(mode, lastFetchTime)`. При `forceRefresh=true` кеш игнорируется.

### 7.4. Signals

```typescript
export const leaderboardMode = signal<LeaderboardMode>('total');
export const leaderboardEntries = signal<GlobalLeaderboardEntry[]>([]);
export const leaderboardUserEntry = signal<GlobalLeaderboardEntry | null>(null);
export const leaderboardLoadStatus = signal<LeaderboardLoadStatus>('idle');
export const leaderboardError = signal<string | null>(null);
export const leaderboardUpdatedAt = signal<string | null>(null);
```

### 7.5. Особенности

- Для гостей `userEntry` не показывается (проверка `hasValidUser`).
- `gamesPlayed` маппится из `matchesPlayed` для обратной совместимости (LB-007).

---

## 8. MatchResultsService

**Файл:** `client/src/services/matchResultsService.ts`

### 8.1. Архитектура наград

**Серверные награды** начисляются автоматически при завершении матча через `/match-results/submit` (вызывается MatchServer). Клиент **не ждёт** серверного подтверждения -- вычисляет награды **локально** для мгновенного отображения в UI.

### 8.2. Формулы наград (локальный расчёт)

Загружаются из `config/balance.json` -> `REWARDS_CONFIG`:

```
XP = base + placement_bonus + kills * perKill
Coins = base + placement_bonus + kills * perKill
Rating = base + placement_bonus + kills * perKill
```

Placement бонусы: `'1'`, `'2'`, `'3'`, `top5`.

Fallback значения при отсутствии `rewards` в balance.json:
- XP: base=10, 1st=50, perKill=5
- Coins: base=5, 1st=25, perKill=2
- Rating: base=5, 1st=15, perKill=2

### 8.3. ClaimToken flow

POST `/api/v1/match-results/claim` с `{ matchId, skinId }` -> `{ claimToken, expiresAt }`.

- `claimToken` сохраняется в `localStorage['registration_claim_token']` для guest upgrade flow.
- Дедупликация: `pendingClaims: Set<string>` предотвращает параллельные запросы на один matchId.

### 8.4. Signals

```typescript
export const claimStatus = signal<ClaimStatus>('idle');   // 'idle' | 'claiming' | 'success' | 'error'
export const claimError = signal<string | null>(null);
export const claimRewards = signal<MatchRewards | null>(null);
export const claimToken = signal<string | null>(null);
```

---

## 9. AdsService

**Файл:** `client/src/services/adsService.ts`

### 9.1. Трёхфазный цикл

```
grant → show → claim

1. POST /api/v1/ads/grant  { adPlacement } → { grantId }
2. provider.showRewardedAd(placement) → AdResult { status, providerPayload? }
3. POST /api/v1/ads/claim  { grantId, providerPayload? } → ClaimResponse
```

### 9.2. State machine

```typescript
type AdsFlowState = 'idle' | 'requesting_grant' | 'showing_ad' | 'claiming_reward';
```

Переходы: `idle -> requesting_grant -> showing_ad -> claiming_reward -> idle`.
При ошибке на любом шаге -- сброс в `idle`.

### 9.3. Проверки доступности

- `isEnabled()` -- проверяет `configService.isAdsRewardEnabled()`.
- `isAvailable()` -- `isEnabled() && platformManager.isAdsAvailable()`.
- `isReady(placement)` -- асинхронная проверка через `provider.isAdReady(placement)`.

### 9.4. Обработка результатов показа

| `AdResult.status` | Реакция |
|-------------------|---------|
| `'completed'` | Переход к claim |
| `'skipped'` | Возврат ошибки "Реклама пропущена" |
| `'not_available'` | Возврат ошибки "Реклама временно недоступна" |
| `'error'` | Возврат `errorMessage` |

### 9.5. Idempotent claim

`POST /api/v1/ads/claim` использует `postIdempotent` с автогенерацией `operationId`.

### 9.6. AdPlacement

```typescript
type AdPlacement = 'match_end' | 'daily_bonus' | 'double_reward' | 'extra_life';
```

---

## 10. OAuth

### 10.1. OAuthService (управление потоком)

**Файл:** `client/src/oauth/OAuthService.ts`

Синглтон `oauthService`. Управляет OAuth flow для Standalone платформы.

**Загрузка конфигурации:**
GET `/api/v1/auth/config` (через `metaServerClient.getRaw`) -> `AuthConfigResponse`:
```typescript
{ region: 'RU' | 'CIS' | 'GLOBAL' | 'UNKNOWN'; providers: OAuthProviderConfig[] }
```
Каждый provider: `{ name, clientId, priority, requiresPKCE }`.

Конфигурация загружается lazily с мемоизацией Promise.

**Инициализация клиентов:** по провайдерам из конфига создаются `GoogleOAuthClient` или `YandexOAuthClient`. VK -- заглушка ("будет добавлен в P1").

**Запуск OAuth:**
```typescript
async startOAuth(provider, intent, gameState?)
```
1. Генерирует state (CSRF).
2. Генерирует PKCE (если `requiresPKCE`).
3. Сохраняет состояние в localStorage через `saveOAuthState()`.
4. Формирует URL через `client.buildAuthUrl(state, codeChallenge)`.
5. `window.location.href = authUrl` -- полный редирект.

### 10.2. OAuthRedirectHandler (обработка callback)

**Файл:** `client/src/oauth/OAuthRedirectHandler.ts`

**Определение callback:**
`isOAuthCallback()` -- `pathname === '/'` + наличие `code=` и `state=` в search + `oauth_state` в localStorage.

**Обработка:** `handleOAuthCallback(params, guestToken?, claimToken?)`

1. Проверка ошибки от провайдера.
2. Восстановление сохранённого state из localStorage.
3. CSRF-проверка: `savedState !== params.state` -> ошибка.
4. Таймаут проверка: 10 минут (`OAUTH_STATE_TIMEOUT_MS`).
5. Выбор flow по `intent`:

**intent='login':**
- POST `/api/v1/auth/oauth` с `{ provider, code, redirectUri }`.
- 404 -> `'account_not_found'` (новый пользователь).
- Успех -> `OAuthResult { accessToken, userId, profile, isAnonymous }`.

**intent='convert_guest':**
- POST `/api/v1/auth/oauth/prepare-upgrade` с `{ provider, code, redirectUri, claimToken? }`, Bearer guestToken.
- 409 с `error='claim_already_consumed'` -> ошибка "Результат матча уже сохранён".
- 409 с `error='oauth_already_linked'` -> `OAuthConflictResponse { pendingAuthToken, existingAccount }`.
- 410 -> claim token expired.
- Успех -> `OAuthPrepareResponse { displayName, avatarUrl?, prepareToken }`.

**Завершение upgrade:**
```typescript
completeOAuthUpgrade(prepareToken, nickname, guestToken)
```
- POST `/api/v1/auth/upgrade` с `{ prepareToken, nickname }`, Bearer guestToken.
- 409 -> конфликт OAuth или claim_already_consumed.
- 410 -> prepareToken expired.
- Успех -> `OAuthResult`.

**Разрешение конфликта:**
```typescript
resolveOAuthConflict(pendingAuthToken)
```
- POST `/api/v1/auth/oauth/resolve` с `{ pendingAuthToken }`.
- 410 -> token already used.
- Успех -> `OAuthResult`.

### 10.3. GoogleOAuthClient

**Файл:** `client/src/oauth/GoogleOAuthClient.ts`

- **Auth URL:** `https://accounts.google.com/o/oauth2/v2/auth`
- **Scopes:** `openid email profile`
- **PKCE:** не используется (P0), `generatePKCE()` -> `null`
- **Redirect URI:** `${window.location.origin}/` (корень SPA)
- **State:** 32 байта из `crypto.getRandomValues()`, hex-encoded (64 символа)
- **Кнопка:** `{ label: 'Google', backgroundColor: '#ffffff', textColor: '#757575' }`
- Не используют `access_type=offline` или `prompt=consent` (P0)

### 10.4. YandexOAuthClient

**Файл:** `client/src/oauth/YandexOAuthClient.ts`

- **Auth URL:** `https://oauth.yandex.ru/authorize`
- **Scopes:** `login:info login:email login:avatar`
- **PKCE:** не используется, `generatePKCE()` -> `null`
- **Redirect URI:** `${window.location.origin}/` (корень SPA)
- **State:** аналогично Google (32 байта, hex)
- **Дополнительно:** `force_confirm: 'yes'` -- всегда показывать экран подтверждения
- **Кнопка:** `{ label: 'Яндекс', backgroundColor: '#ffcc00', textColor: '#000000' }`

### 10.5. OAuth localStorage ключи

```typescript
const OAUTH_STORAGE_KEYS = {
  STATE: 'oauth_state',
  CODE_VERIFIER: 'oauth_code_verifier',
  PROVIDER: 'oauth_provider',
  INTENT: 'oauth_intent',
  SAVED_GAME_STATE: 'oauth_saved_game_state',
  TIMESTAMP: 'oauth_timestamp',
};
```

Все ключи очищаются через `clearOAuthState()` после обработки callback (и при успехе, и при ошибке).

### 10.6. OAuthIntent

```typescript
type OAuthIntent = 'login' | 'convert_guest';
```
- `'login'` -- вход в существующий аккаунт. Не требует claimToken.
- `'convert_guest'` -- конвертация гостевого аккаунта. Требует guestToken, claimToken опционален.

---

## 11. PlatformManager

**Файл:** `client/src/platform/PlatformManager.ts`

### 11.1. Приоритет определения платформы

```
1. Telegram Mini App   (window.Telegram.WebApp.initData)
2. CrazyGames          (window.CrazyGames.SDK)
3. GameDistribution    (window.gdsdk || window.GD_OPTIONS)
4. Yandex Games        (window.ysdk)
5. Poki                (window.PokiSDK)
6. Standalone (dev)    (всегда доступен -- fallback)
```

Каждый адаптер проверяется через `isAvailable()`. Первый доступный -- выбирается.

### 11.2. PlatformType

```typescript
type PlatformType = 'telegram' | 'dev' | 'yandex' | 'poki' | 'crazygames' | 'gamedistribution';
```

### 11.3. IAuthAdapter интерфейс

```typescript
interface IAuthAdapter {
  getPlatformType(): PlatformType;
  isAvailable(): boolean;
  getCredentials(): Promise<PlatformCredentials>;
  getNickname(): string | null;
  requestAuth?(): Promise<boolean>;   // Опциональный
}

interface PlatformCredentials {
  platformType: PlatformType;
  platformData: string;   // Данные для верификации на сервере
  nickname?: string;
}
```

### 11.4. Адаптеры -- сводка

| Адаптер | platformData формат | requestAuth | Особенности |
|---------|-------------------|-------------|-------------|
| **StandaloneAdapter** | `"userId:nickname"` | нет | userId из localStorage (`standalone_<ts>_<rand>`) |
| **TelegramAdapter** | `initData` (raw string) | `false` | Вызывает `WebApp.ready()`, `expand()` |
| **YandexAdapter** | `"playerId:playerName"` | `true` (scopes) | Async init, `getPlayer({scopes, signed})` |
| **CrazyGamesAdapter** | JWT token | `true` (showAuthPrompt) | Async SDK init, gameplay events |
| **PokiAdapter** | `"userId:nickname"` | `false` | Аналог Standalone, `gameLoadingFinished()` |
| **GameDistributionAdapter** | `"userId:nickname"` | `false` | Аналог Standalone |

### 11.5. IAdsProvider интерфейс

```typescript
interface IAdsProvider {
  getPlatformType(): PlatformType;
  isAvailable(): boolean;
  isAdReady(placement: AdPlacement): Promise<boolean>;
  showRewardedAd(placement: AdPlacement): Promise<AdResult>;
}

type AdResultStatus = 'completed' | 'skipped' | 'error' | 'not_available';
type AdPlacement = 'match_end' | 'daily_bonus' | 'double_reward' | 'extra_life';
```

### 11.6. Ads провайдеры

| Платформа | Провайдер | Особенности |
|-----------|-----------|-------------|
| dev | `MockAdsProvider` | Всегда доступен, симулирует 1.5с задержку, настраиваемый success/skip |
| telegram | `TelegramAdsProvider` | Telegram Ads SDK |
| yandex | `YandexAdsProvider` | Yandex Games Ads SDK |
| crazygames | `CrazyGamesAdsProvider` | CrazyGames `ad.requestAd('rewarded')` |
| poki | `PokiAdsProvider` | `PokiSDK.rewardedBreak()` |
| gamedistribution | `GameDistributionAdsProvider` | `gdsdk.showAd('rewarded')` |

### 11.7. Typed getters

PlatformManager предоставляет типизированные getter'ы для доступа к платформо-специфичным методам:
- `getTelegramAdapter()` -- доступ к `BackButton`, `showBackButton()/hideBackButton()`
- `getStandaloneAdapter()` -- доступ к `setNickname()`
- `getYandexAdapter()` -- доступ к `getPlayerId()`, `getPlayerMode()`
- `getPokiAdapter()` -- доступ к `happyTime()`, `notifyGameLoaded()`
- `getCrazyGamesAdapter()` -- доступ к `gameplayStart()/Stop()`, `happyTime()`
- `getGameDistributionAdapter()` -- доступ к `setNickname()`

---

## 12. Захардкоженные значения

| Значение | Где | Описание |
|----------|-----|----------|
| `10000` мс | metaServerClient `DEFAULT_TIMEOUT` | Таймаут HTTP-запроса |
| `3` | metaServerClient `MAX_RETRIES` | Максимум retry-попыток |
| `1000` мс | metaServerClient `RETRY_BASE_DELAY` | Базовая задержка backoff |
| `2000` мс | matchmakingService `POLL_INTERVAL` | Интервал polling очереди |
| `60000` мс | matchmakingService `MAX_QUEUE_TIME` | Таймаут очереди |
| `300000` мс | configService `CONFIG_CACHE_TTL` | TTL кеша конфига |
| `300000` мс | configService `CONFIG_POLL_INTERVAL` | Интервал polling конфига |
| `30000` мс | leaderboardService `cacheTimeMs` | TTL кеша лидерборда |
| `600000` мс | OAuthRedirectHandler `OAUTH_STATE_TIMEOUT_MS` | Таймаут OAuth сессии |
| `1500` мс | MockAdsProvider `simulateDelay` | Задержка mock рекламы |
| `'0.0.0-local'` | defaultRuntimeConfig `configVersion` | Версия fallback конфига |
| `3000` | metaServerClient | Порт MetaServer для прямого подключения по IP |
| `'Player'` | StandaloneAdapter `DEFAULT_NICKNAME` | Дефолтный никнейм standalone |
| `'CrazyPlayer'` | CrazyGamesAdapter | Дефолтный никнейм CrazyGames |
| `'PokiPlayer'` | PokiAdapter | Дефолтный никнейм Poki |
| `'GDPlayer'` | GameDistributionAdapter | Дефолтный никнейм GameDistribution |
| `'openid email profile'` | GoogleOAuthClient `GOOGLE_SCOPES` | Скоупы Google OAuth |
| `'login:info login:email login:avatar'` | YandexOAuthClient `YANDEX_SCOPES` | Скоупы Yandex OAuth |
| `'#ffffff'` / `'#757575'` | GoogleOAuthClient | Цвета кнопки Google |
| `'#ffcc00'` / `'#000000'` | YandexOAuthClient | Цвета кнопки Yandex |

---

## 13. Расхождения с документацией

### Architecture v4.2.5 Part 1 (клиент)

| Аспект | Документация | Реализация | Расхождение |
|--------|-------------|------------|-------------|
| Слои клиента | `platform/*`, `services/*`, `state/*`, `events/*`, `ui/*`, `battle/*`, `input/*`, `network/*`, `rendering/*`, `net/smoothing.ts` | Присутствуют `platform/*`, `services/*`, `ui/*`, `api/*`, `oauth/*`. Нет отдельных `state/*`, `events/*` -- реализованы через Preact signals в `ui/signals/` | `AppState` и `AppEvents` заменены на signals-паттерн |
| Интерфейсы | `IAuthProvider`, `IAdsProvider`, `IPaymentProvider`, `ISocialProvider` | Реализованы `IAuthAdapter`, `IAdsProvider`. Нет `IPaymentProvider`, `ISocialProvider` | Payment и Social не реализованы для soft-launch |
| Методы адаптера | `initialize`, `isAvailable`, `getUser`/`getAuthToken` | `isAvailable`, `getCredentials()`, `getNickname()`. Нет `initialize` (инициализация в конструкторе) | Имена методов отличаются от спецификации |
| `UIFacade` | Единственная точка доступа UI к сервисам | Не реализован, сервисы импортируются напрямую | Архитектурное упрощение |
| `ScreenManager` | Навигация по экранам и стек модальных окон | Не реализован отдельно, управляется Preact signals | Архитектурное упрощение |

### Architecture v4.2.5 Part 2 (MetaServer/платформы)

| Аспект | Документация | Реализация | Расхождение |
|--------|-------------|------------|-------------|
| `PlatformManager` | Определяет платформу, подключает `*Adapter`, экспортирует `I*Provider` | Реализован, определяет 6 платформ (Telegram, CrazyGames, GameDistribution, Yandex, Poki, Standalone) | Документация не перечисляет CrazyGames, GameDistribution, Poki |
| Приоритет платформ | Не определён в документации | Telegram > CrazyGames > GameDistribution > Yandex > Poki > Standalone | Реализация расширяет документацию |
| Matchmaking | `QueueTicket` с `ticketId`, `mode`, `createdAt`, `expiresAt` | Клиент не хранит `QueueTicket`, использует polling по `/status` | Упрощённый клиентский API |
| `MatchAssignment` | `roomId`, `matchServerUrl`, `joinToken`, `expiresAt` | Импортируется из signals, содержит `matchId` дополнительно | Минимальное расхождение |
| RuntimeConfig polling | "при смене версии (по событию или по таймеру)" | Только по таймеру (5 мин), нет event-based обновления | Event-based не реализован |
| Идемпотентность | По `operationId` | Реализован `postIdempotent()` с UUID v4 | Соответствует |

### Отсутствующие функции (заглушки в RuntimeConfig)

- `battlepass?: unknown` -- тип не определён
- `achievements?: unknown` -- тип не определён
- `leaderboards?: unknown` -- тип не определён

---

## 14. Технический долг

1. **VK OAuth не реализован.** В `OAuthService.initializeClients()` есть комментарий "VK будет добавлен в P1", но код отсутствует. `OAuthProviderName` уже включает `'vk'`.

2. **IPaymentProvider и ISocialProvider отсутствуют.** Документация требует эти интерфейсы, но они не реализованы.

3. **UIFacade не реализован.** Сервисы импортируются напрямую из UI-компонентов, нарушая архитектурный контракт.

4. **PKCE не используется.** Оба OAuth клиента (Google, Yandex) возвращают `generatePKCE() -> null`. Интерфейс `IOAuthClient` поддерживает PKCE, но ни один провайдер его не реализует. Для безопасности рекомендуется включить.

5. **Двойное хранение токена.** `authService` хранит токены в `access_token`/`guest_token`, а `metaServerClient` дублирует в `authToken`. При logout очищаются все три, но при восстановлении сессии они могут рассинхронизироваться.

6. **ConfigService: нет event-based обновления.** Только polling каждые 5 минут. Документация предусматривает обновление по событию.

7. **MatchmakingService: нет WebSocket polling.** Используется HTTP polling каждые 2 секунды. Для масштабирования стоит рассмотреть Server-Sent Events или WebSocket.

8. **LeaderboardService: жёсткий кеш 30с.** Значение не конфигурируемо, не загружается из RuntimeConfig.

9. **AdsService: grant без проверки UID.** `requestGrant()` не передаёт userId -- серверу надо извлекать из токена. Это корректно, но неявно.

10. **RuntimeConfig типы: заглушки `unknown`.** `battlepass`, `achievements`, `leaderboards` -- не типизированы.

11. **Standalone адаптер userId:** формат `standalone_<timestamp>_<random>` использует `Math.random()`, не криптографически безопасен. Для идентификации это приемлемо, но стоит отметить.

12. **GoogleOAuthClient/YandexOAuthClient: иконки пустые.** `iconUrl: ''` -- иконки inline в `OAuthProviderSelector.tsx`, но интерфейс `OAuthButtonConfig` имеет поле `iconUrl`.

---

## 15. Заметки для форка BonkRace

### Что переиспользуется без изменений

- **MetaServerClient** -- полностью. Retry, backoff, авторизация, proxy mode -- всё универсально.
- **AuthService** -- 95%. Guest flow, token storage, восстановление сессии, logout -- идентичны. Нужно только заменить `GUEST_DEFAULT_NICKNAME` и `SPRITE_NAMES`.
- **ConfigService** -- полностью. Структура RuntimeConfig может расширяться.
- **LeaderboardService** -- полностью. Типы `LeaderboardMode`, маппинг `position->place` -- универсальны.
- **OAuth модуль** -- полностью. Google + Yandex клиенты, redirect handler, conflict resolution -- без изменений.
- **PlatformManager** -- полностью. Все адаптеры, определение платформы, ads provider selection.

### Что потребует адаптации

- **MatchmakingService** -- `classId` заменить на race-специфичные параметры (трасса, режим). Endpoints остаются те же.
- **MatchResultsService** -- формулы наград в `calculateLocalRewards()` нужно пересчитать для BonkRace (позиция в гонке вместо kills/mass). ClaimToken flow -- без изменений.
- **AdsService** -- без изменений. `AdPlacement` может расшириться ('race_end' вместо 'match_end').
- **defaultRuntimeConfig** -- обновить `matchRewards` и `matchmaking` параметры.
- **balance.json** -- полностью пересмотреть формулы наград.

### Что не нужно

- Standalone `SPRITE_NAMES` -- заменить на BonkRace спрайты.
- `ProfileSummary.highestMass` -- заменить на BonkRace-специфичную статистику.
