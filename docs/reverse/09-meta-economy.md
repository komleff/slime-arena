# Reverse: MetaServer Economy & Progression
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

## 1. Обзор

MetaServer реализует полный цикл экономики и прогрессии игрока: от завершения матча до покупки скинов за реальные деньги. Архитектура построена вокруг нескольких ключевых подсистем:

- **Match Results** — сохранение результатов матча, расчёт XP и монет, генерация claimToken
- **Matchmaking** — FIFO-очередь на Redis, группировка игроков в матчи, генерация joinToken
- **Rating System** — рейтинг по mass (total/best), без ELO/Glicko-2, UPSERT в leaderboard-таблицы
- **Leaderboard** — два режима (total mass / best mass), пагинация, позиция текущего игрока
- **Wallet** — двухвалютная система (coins/gems = soft/hard), идемпотентные транзакции с audit_log
- **Shop** — покупка скинов и валюты за soft/hard currency через RuntimeConfig, запись в unlocked_items
- **Payments** — Telegram Stars + Yandex Pay (YooKassa), invoice/verify/webhook flow
- **Ads** — grant-based rewarded ads: сервер создаёт grant до показа рекламы, клиент клеймит после
- **Profile** — агрегированный профиль (users + profiles + wallets), смена никнейма

Все операции экономики используют `operationId` для идемпотентности. Аудит записывается в таблицу `audit_log`.

## 2. Исходные файлы

### Routes (HTTP API)
| Файл | Назначение |
|------|-----------|
| `server/src/meta/routes/matchResults.ts` | POST /submit (от MatchServer), POST /claim (claimToken) |
| `server/src/meta/routes/matchmaking.ts` | POST /join, /cancel, /joined; GET /status |
| `server/src/meta/routes/leaderboard.ts` | GET / (mode=total\|best) |
| `server/src/meta/routes/payment.ts` | GET /providers; POST /create-invoice, /verify; GET /status/:id; webhooks |
| `server/src/meta/routes/shop.ts` | GET /offers; POST /purchase; GET /unlocked |
| `server/src/meta/routes/wallet.ts` | GET /balance, /transactions |
| `server/src/meta/routes/ads.ts` | POST /grant, /claim; GET /grant/:grantId |
| `server/src/meta/routes/profile.ts` | GET /; POST /nickname |

### Services (бизнес-логика)
| Файл | Назначение |
|------|-----------|
| `server/src/meta/services/MatchmakingService.ts` | Redis-очередь, создание матча, joinToken |
| `server/src/meta/services/RatingService.ts` | awardRating, initializeRating, leaderboard UPSERT |
| `server/src/meta/services/WalletService.ts` | addCurrency, deductCurrency, getTransactionHistory |
| `server/src/meta/services/ShopService.ts` | getOffers (из RuntimeConfig), purchase, getUnlockedItems |
| `server/src/meta/services/PlayerService.ts` | getProfile, updateNickname, addXP, updateSelectedSkin |
| `server/src/meta/services/JoinTokenService.ts` | JWT генерация/верификация для входа в матч |
| `server/src/meta/services/AdsService.ts` | generateGrant, claimReward (rewarded ads) |

### Payment Providers
| Файл | Назначение |
|------|-----------|
| `server/src/meta/payment/IPaymentProvider.ts` | Интерфейс провайдера платежей |
| `server/src/meta/payment/PaymentProviderFactory.ts` | Фабрика: Telegram Stars + Yandex Pay |
| `server/src/meta/payment/TelegramStarsProvider.ts` | Telegram Bot Payments API (XTR) |
| `server/src/meta/payment/YandexPayProvider.ts` | YooKassa API (RUB) |

### Модели и типы
| Файл | Назначение |
|------|-----------|
| `server/src/meta/models/Leaderboard.ts` | LeaderboardTotalMass, LeaderboardBestMass, LeaderboardEntry |
| `shared/src/types.ts` | PlayerResult, MatchSummary, MatchStats |
| `config/balance.json` | rewards.xp, rewards.coins, rewards.rating (конфиг наград) |

## 3. Match Results

### 3.1 Submit Flow (MatchServer -> MetaServer)

**Endpoint:** `POST /api/v1/match-results/submit`
**Auth:** `requireServerToken` (inter-service, не пользовательский)

Поток:
1. MatchServer отправляет `MatchSummary` с `playerResults[]`
2. `INSERT INTO match_results ... ON CONFLICT (match_id) DO NOTHING` — идемпотентность на уровне БД
3. Для каждого `playerResult` с `userId` (зарегистрированные):
   - `updatePlayerStats()` — начисление XP и coins в одной транзакции
   - `ratingService.awardRating()` — обновление leaderboard (после commit, non-blocking)
4. Если `rowCount === 0` — матч уже обработан, возвращается success

### 3.2 Расчёт XP

Формула из `config/balance.json` -> `rewards.xp`:

```
xp = base + placement_bonus + (killCount * perKill)
```

| Параметр | Значение |
|----------|----------|
| `base` | 10 |
| `placement['1']` | 50 |
| `placement['2']` | 30 |
| `placement['3']` | 20 |
| `placement.top5` | 10 (placement <= 5) |
| `perKill` | 5 |

**Диапазон:** 10 (участие без убийств, place > 5) .. 60+ (1 место + убийства)

Fallback: если `loadBalanceConfig()` бросает ошибку, используется `DEFAULT_REWARDS` (те же значения захардкожены в коде).

### 3.3 Расчёт монет (coins / soft currency)

Формула из `config/balance.json` -> `rewards.coins`:

```
coins = base + placement_bonus + (killCount * perKill)
```

| Параметр | Значение |
|----------|----------|
| `base` | 5 |
| `placement['1']` | 25 |
| `placement['2']` | 15 |
| `placement['3']` | 10 |
| `placement.top5` | 5 |
| `perKill` | 2 |

**Диапазон:** 5 .. 30+ монет за матч.

### 3.4 Claim Flow (claimToken)

**Endpoint:** `POST /api/v1/match-results/claim`
**Auth:** Bearer (accessToken или guestToken)

Поток:
1. Клиент запрашивает `claimToken` для `matchId`
2. Сервер проверяет ownership:
   - Зарегистрированный: `playerResult.userId === sub`
   - Гость: `playerResult.guestSubjectId === sub` (fallback: `match.guest_subject_id`)
3. Проверка `claim_consumed_at` — одноразовость
4. Определение `skinId`:
   - Зарегистрированный: из `profiles.selected_skin_id`
   - Гость: из `req.body.skinId` (валидация через `isValidSprite`)
   - Fallback: `pickSpriteByName(subjectId)` — детерминированный хеш
5. Генерация `claimToken` JWT с `{matchId, subjectId, finalMass, skinId}`
6. TTL: `TOKEN_EXPIRATION.CLAIM_TOKEN`

**Назначение claimToken:** используется в auth/upgrade flow для привязки результата матча к новому аккаунту.

### 3.5 Схема БД: match_results

| Колонка | Тип | Примечание |
|---------|-----|-----------|
| `match_id` | PK | UUID |
| `mode` | VARCHAR | Режим матча |
| `started_at` | TIMESTAMP | |
| `ended_at` | TIMESTAMP | |
| `config_version` | VARCHAR | |
| `build_version` | VARCHAR | |
| `summary` | JSONB | `{playerResults[], matchStats}` |
| `guest_subject_id` | VARCHAR | Legacy: UUID гостя |
| `claim_consumed_at` | TIMESTAMP | Одноразовость claim |

## 4. Matchmaking

### 4.1 Алгоритм подбора

**Тип:** простой FIFO (без рейтингового окна). Для Soft Launch рейтинговый подбор не реализован.

Поток:
1. Игрок вызывает `POST /join` с `rating` (default: 1500) и `nickname`
2. Запрос добавляется в Redis Sorted Set (`matchmaking:queue`, score = timestamp)
3. `processQueue()` вызывается периодически (каждые 2-5 сек):
   - Удаляет протухшие запросы (> 60 сек)
   - Группирует первых N игроков по FIFO
   - Создаёт матч при >= 2 игроках
4. Для каждого матча генерируются `joinToken` через `JoinTokenService`
5. Маппинг `userId -> matchId` хранится в Redis с TTL

### 4.2 Параметры

| Константа | Значение | Описание |
|-----------|----------|----------|
| `QUEUE_KEY` | `matchmaking:queue` | Redis sorted set |
| `TIMEOUT_MS` | `60000` (60 сек) | Таймаут запроса в очереди |
| `PLAYERS_PER_MATCH` | `8` | Максимум игроков в матче |
| Мин. для матча | `2` | Минимум игроков |

### 4.3 Redis-ключи

| Ключ | Тип | TTL | Содержимое |
|------|-----|-----|-----------|
| `matchmaking:queue` | Sorted Set | нет | JSON `MatchmakingRequest` |
| `matchmaking:match:{matchId}` | String | = joinToken TTL | JSON `MatchAssignment` |
| `matchmaking:match:{matchId}:tokens` | String | = joinToken TTL | JSON `{userId: joinToken}` |
| `matchmaking:user:{userId}` | String | = joinToken TTL | matchId |

### 4.4 JoinToken

JWT (`HS256`), payload:
```
{userId, matchId, roomId, nickname, spriteId?, guestSubjectId?}
```

| Параметр | Значение | Источник |
|----------|----------|---------|
| `secret` | `JOIN_TOKEN_SECRET` / `JWT_SECRET` / `'slime-arena-dev-secret'` | ENV |
| `expiresInSeconds` | `300` (5 мин, default) | ENV `JOIN_TOKEN_EXPIRES` |
| `algorithm` | HS256 | Захардкожено |

**Fail-fast:** в production (`NODE_ENV=production`) или при `JOIN_TOKEN_REQUIRED=true` без секрета — сервис не запустится.

### 4.5 Endpoints

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| POST | `/api/v1/matchmaking/join` | accessToken / guestToken | Встать в очередь |
| POST | `/api/v1/matchmaking/cancel` | accessToken / guestToken | Покинуть очередь |
| POST | `/api/v1/matchmaking/joined` | accessToken / guestToken | Подтвердить вход в комнату (очистить assignment) |
| GET | `/api/v1/matchmaking/status` | accessToken / guestToken | Статус: inQueue / matched + assignment |

## 5. Rating System

### 5.1 Модель рейтинга (фактическая)

**НЕ используется ELO/Glicko-2.** Рейтинг основан на mass:

- **total_mass** — суммарная масса за все матчи (leaderboard_total_mass)
- **best_mass** — лучший результат в одном матче (leaderboard_best_mass)

### 5.2 awardRating()

Вызывается после submit match results (non-blocking, после commit).

Поток:
1. Проверка: `users.is_anonymous = FALSE` и `is_banned = FALSE`
2. Идемпотентность: `rating_awards (user_id, match_id)` — уникальный constraint
3. `finalMass` округляется до целого (`Math.round()`)
4. UPSERT `leaderboard_total_mass`: `total_mass += mass`, `matches_played += 1`
5. Если `mass > current best_mass`: UPSERT `leaderboard_best_mass`
6. INSERT `rating_awards` для идемпотентности

### 5.3 initializeRating()

Вызывается из auth/upgrade (при регистрации через claimToken).

- Создаёт начальные записи в `leaderboard_total_mass` и `leaderboard_best_mass`
- `ON CONFLICT DO NOTHING` — безопасно при повторных вызовах
- Поддерживает внешний DB client для включения в общую транзакцию

### 5.4 Таблицы рейтинга

**leaderboard_total_mass:**
| Колонка | Описание |
|---------|----------|
| `user_id` | PK, FK -> users |
| `total_mass` | INTEGER, суммарная масса |
| `matches_played` | INTEGER |
| `updated_at` | TIMESTAMP |

**leaderboard_best_mass:**
| Колонка | Описание |
|---------|----------|
| `user_id` | PK, FK -> users |
| `best_mass` | INTEGER, лучший результат |
| `best_match_id` | UUID, в каком матче |
| `players_in_match` | INTEGER |
| `achieved_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |

**rating_awards:**
| Колонка | Описание |
|---------|----------|
| `user_id` | FK -> users |
| `match_id` | UUID |
| `awarded_at` | TIMESTAMP |
| UNIQUE | (user_id, match_id) |

## 6. Leaderboard

### 6.1 Режимы

| Mode | Таблица | Value | Описание |
|------|---------|-------|----------|
| `total` | `leaderboard_total_mass` | `total_mass` | Суммарная масса за все матчи |
| `best` | `leaderboard_best_mass` | `best_mass` | Лучший результат в одном матче |

### 6.2 Запросы

**Endpoint:** `GET /api/v1/leaderboard?mode=total|best&limit=N&offset=N`
**Auth:** опциональный Bearer (accessToken) — для позиции текущего игрока

Логика:
1. `ROW_NUMBER() OVER (ORDER BY value DESC, updated_at DESC)` — позиция
2. `INNER JOIN users` — фильтр `is_banned = FALSE`
3. `LEFT JOIN profiles` — `selected_skin_id` (fallback: `'slime-base.webp'`)
4. `isValidSprite()` — валидация skinId
5. Для `mode=total` — дополнительно `matches_played`
6. Если авторизован и `!isAnonymous` — `getUserPosition()` с подсчётом через `COUNT(*)+1`

### 6.3 Пагинация

| Параметр | Default | Max |
|----------|---------|-----|
| `limit` | 100 | 100 |
| `offset` | 0 | нет |

### 6.4 Сортировка

Первичная: `value DESC`
Вторичная: `updated_at DESC` (LB-006: стабильность при равных значениях)

### 6.5 Кеширование

**Кеширования нет.** Каждый запрос идёт напрямую в PostgreSQL. Потенциальная проблема при масштабировании.

### 6.6 Сброс

**Сезонного сброса нет.** Таблицы leaderboard не привязаны к сезонам. Данные накапливаются бессрочно.

## 7. Wallet

### 7.1 Валюты

| Валюта | Колонка БД | API-имя | Назначение |
|--------|-----------|---------|-----------|
| Coins | `wallets.coins` | `soft` / `softCurrency` | Мягкая валюта (за матчи, рекламу) |
| Gems | `wallets.gems` | `hard` / `hardCurrency` | Премиальная валюта (за реальные деньги) |

### 7.2 Операции

**addCurrency(userId, amount, currency, type, operationId, metadata?)**
1. Проверка `amount > 0`
2. Идемпотентность: `SELECT FROM transactions WHERE user_id=$1 AND operation_id=$2`
3. `UPDATE wallets SET coins|gems = coins|gems + amount`
4. `INSERT INTO transactions` — запись операции
5. `INSERT INTO audit_log` — аудит
6. Всё в одной транзакции

**deductCurrency(userId, amount, currency, type, operationId, metadata?)**
1. Аналогично, но проверка баланса перед списанием
2. `Insufficient {currency} currency balance` — ошибка при нехватке
3. В `transactions` записывается `-amount`

### 7.3 Типы транзакций (type)

| type | Источник |
|------|---------|
| `'purchase'` | Покупка за реальные деньги (payment) |
| `'shop_purchase'` | Покупка в магазине за soft/hard |
| `'shop_currency_purchase'` | Покупка валюты через магазин |
| `'ad_reward'` | Награда за рекламу |
| `'update'` | Обновление профиля (nickname) |

### 7.4 generateOperationId

```typescript
static generateOperationId(prefix: string = 'op'): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}
```

### 7.5 Endpoints

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| GET | `/api/v1/wallet/balance` | authMiddleware | `{softCurrency, hardCurrency, updatedAt}` |
| GET | `/api/v1/wallet/transactions` | authMiddleware | История, `limit` max 100, default 50 |

## 8. Shop

### 8.1 Архитектура

Офферы загружаются из `RuntimeConfig` (через `ConfigService.getActiveConfig().shop.offers`).

**Типы офферов:**
| type | Действие |
|------|---------|
| `'skin'` | Разблокировка скина -> `unlocked_items` |
| `'currency'` | Начисление валюты через `walletService.addCurrency` |
| `'battlepass'` | Активация премиума -> `battlepass_progress.has_premium = true` |
| `'hard_currency'` | Покупка gems за реальные деньги (через payment) |

### 8.2 Purchase Flow (внутриигровая валюта)

1. Получение оффера из RuntimeConfig
2. Идемпотентность: `SELECT FROM transactions WHERE operation_id`
3. `walletService.deductCurrency()` — списание цены
4. Выдача товара:
   - skin: `INSERT INTO unlocked_items ON CONFLICT DO NOTHING`
   - currency: `walletService.addCurrency()`
   - battlepass: `INSERT INTO battlepass_progress ON CONFLICT DO UPDATE`
5. `INSERT INTO purchase_receipts` (platform = `'internal'`, status = `'completed'`)
6. `INSERT INTO audit_log`

### 8.3 Endpoints

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| GET | `/api/v1/shop/offers` | authMiddleware | Список офферов из RuntimeConfig |
| POST | `/api/v1/shop/purchase` | authMiddleware | Покупка за внутриигровую валюту |
| GET | `/api/v1/shop/unlocked` | authMiddleware | Разблокированные предметы (`?itemType=skin`) |

### 8.4 ShopOffer (интерфейс)

```typescript
interface ShopOffer {
  id: string;
  type: string;           // 'skin' | 'currency' | 'battlepass' | 'hard_currency'
  itemId?: string;         // для skin
  amount?: number;         // для currency
  price: {
    currency: 'soft' | 'hard';
    amount: number;
  };
  metadata?: Record<string, unknown>;
}
```

## 9. Payments

### 9.1 Telegram Stars

**Провайдер:** `TelegramStarsProvider`
**Platform ID:** `'telegram_stars'`
**API:** Telegram Bot Payments API
**Валюта:** `XTR` (Telegram Stars)
**Env:** `TELEGRAM_BOT_TOKEN`

**Create Invoice Flow:**
1. `POST /api/v1/payment/create-invoice` с `{offerId, platform: 'telegram_stars'}`
2. Проверка: `offer.price.currency === 'hard'` (только hard currency офферы)
3. Генерация `invoiceId` (UUID)
4. Telegram API `createInvoiceLink` с payload `{invoiceId, userId, offerId, ...metadata}`
5. `INSERT INTO purchase_receipts` status=`'pending'`
6. Возврат `{invoiceId, paymentUrl}`

**Verify Flow:**
1. `POST /api/v1/payment/verify` с `{invoiceId, platform, platformPayload}`
2. Парсинг `invoice_payload` из Telegram response
3. Проверка `invoiceId` совпадения
4. `UPDATE purchase_receipts SET status='completed'` WHERE status='pending'
5. Выдача товара: `walletService.addCurrency()` или `shopService.purchase()`

**Webhook Flow:**
1. `POST /api/v1/payment/webhook/telegram`
2. `pre_checkout_query` -> `answerPreCheckoutQuery(id, true)` (всегда accept)
3. `successful_payment` -> парсинг `invoice_payload`, `verifyPayment()`, выдача товара

**Refund:**
1. Telegram API `refundStarPayment` с `{user_id, telegram_payment_charge_id}`
2. `UPDATE purchase_receipts SET status='refunded'`

### 9.2 Yandex Pay (YooKassa)

**Провайдер:** `YandexPayProvider`
**Platform ID:** `'yandex_pay'`
**API:** YooKassa API v3 (`https://api.yookassa.ru/v3`)
**Валюта:** `RUB`
**Env:** `YANDEX_SHOP_ID`, `YANDEX_SECRET_KEY`

**Create Invoice Flow:**
1. Аналогично Telegram, но с YooKassa API
2. Auth: `Basic base64(shopId:secretKey)`
3. `Idempotence-Key` header (UUID)
4. Amount: `(priceAmount / 100).toFixed(2)` — **внутренне цены хранятся в копейках**
5. `capture: true` — автоматическое подтверждение
6. `confirmation.type: 'redirect'`, `return_url` из `APP_URL` env
7. `metadata` содержит `invoice_id`, `user_id`, `offer_id`

**Verify Flow:**
1. GET `payments/{payment_id}` от YooKassa
2. Проверка `metadata.invoice_id === invoiceId`
3. Проверка `status === 'succeeded'`
4. Update receipt, выдача товара

**Webhook Flow:**
1. `POST /api/v1/payment/webhook/yandex`
2. `event: 'payment.succeeded'` -> `verifyPayment()`
3. `event: 'payment.canceled'` -> `UPDATE status='failed'`

**Refund:**
1. POST `refunds` с `{payment_id, amount}`
2. `Idempotence-Key` header

### 9.3 Общие паттерны платежей

- **IPaymentProvider** интерфейс: `createInvoice()`, `verifyPayment()`, `refundPayment()`, `getPaymentStatus()`
- **PaymentProviderFactory** — lazy init, проверка `isAvailable()` по env-переменным
- **Двойная выдача:** товар может быть выдан как через `/verify` (polling), так и через webhook. Идемпотентность через `purchase_receipts.status = 'pending'` -> `'completed'`
- **Analytics:** `EventTypes.PURCHASE_START`, `PURCHASE_COMPLETE`, `PURCHASE_FAIL`
- **operationId формат:** `payment:{receiptId}:{uuid8}` или `webhook:{platform}:{receiptId}:{uuid8}`

## 10. Ads

### 10.1 Архитектура

Двухфазная система: **grant** (до показа рекламы) -> **claim** (после просмотра).

### 10.2 Grant Flow

1. `POST /api/v1/ads/grant` с `{adPlacement}`
2. Загрузка конфигурации наград из `RuntimeConfig.ads.rewards[adPlacement]`
3. Генерация `grantId`: `grant_{timestamp}_{16hex}`
4. Хранение в Redis: `ads:grant:{grantId}`, TTL = 300 сек (5 мин)
5. Grant содержит: `{grantId, userId, rewardType, rewardAmount, rewardItemId, createdAt, expiresAt, claimed}`

### 10.3 Claim Flow

1. `POST /api/v1/ads/claim` с `{grantId, operationId?}`
2. Загрузка grant из Redis
3. Проверка `grant.userId === userId`
4. Если `claimed = true` — идемпотентный возврат
5. Выдача: `walletService.addCurrency()` (soft или hard)
6. Обновление `grant.claimed = true` в Redis

### 10.4 Типы наград

| rewardType | Действие |
|-----------|---------|
| `'soft_currency'` | `walletService.addCurrency(userId, amount, 'soft', 'ad_reward', operationId)` |
| `'hard_currency'` | `walletService.addCurrency(userId, amount, 'hard', 'ad_reward', operationId)` |
| `'item'` | **НЕ РЕАЛИЗОВАНО** — только console.log |

### 10.5 Параметры

| Константа | Значение |
|-----------|----------|
| `GRANT_TTL_SECONDS` | 300 (5 мин) |
| `GRANT_PREFIX` | `'ads:grant:'` |

### 10.6 Endpoints

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| POST | `/api/v1/ads/grant` | authMiddleware | Создать grant перед показом рекламы |
| POST | `/api/v1/ads/claim` | authMiddleware | Забрать награду после просмотра |
| GET | `/api/v1/ads/grant/:grantId` | authMiddleware | Статус grant'а |

### 10.7 Server-side Validation

**Отсутствует.** Нет проверки `providerPayload` (подтверждения от рекламного SDK). Клиент может вызвать `/claim` без реального просмотра рекламы — это уязвимость.

## 11. Profile

### 11.1 Получение профиля

**Endpoint:** `GET /api/v1/profile`
**Auth:** `requireAuth`

Агрегированный запрос:
```sql
SELECT u.nickname, u.avatar_url, p.level, p.xp, p.selected_skin_id, w.coins, w.gems
FROM users u
INNER JOIN profiles p ON p.user_id = u.id
INNER JOIN wallets w ON w.user_id = u.id
WHERE u.id = $1
```

Ответ: `ProfileSummary {userId, nickname, avatarUrl, level, xp, selectedSkinId, wallet: {coins, gems}}`

### 11.2 Смена никнейма

**Endpoint:** `POST /api/v1/profile/nickname`
**Auth:** `requireAuth`
**Body:** `{nickname, operationId}`

Валидация: 3-50 символов.
Идемпотентность: через `transactions` таблицу (`type='update'`, `source='profile'`).
Обновление: `UPDATE users SET nickname = $1`.

### 11.3 Обновление скина

`PlayerService.updateSelectedSkin(userId, skinId)` — прямой UPDATE без проверки владения.
**TODO в коде:** "Verify that user has unlocked this skin" — не реализовано.

### 11.4 Level-up логика

`PlayerService.addXP()`:
```typescript
const xpPerLevel = 1000;  // захардкожено
while (xp >= xpPerLevel) {
  xp -= xpPerLevel;
  level++;
}
```

**Замечание:** `matchResults.ts` использует прямой `UPDATE profiles SET xp = xp + $2`, а не `PlayerService.addXP()`. Поэтому level-up при начислении XP за матч **не происходит автоматически**.

## 12. API Endpoints

### Полный список /api/v1/* эндпоинтов этого модуля

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| **Match Results** | | | |
| POST | `/api/v1/match-results/submit` | ServerToken | Сохранение результатов матча |
| POST | `/api/v1/match-results/claim` | Bearer + rateLimiter | Генерация claimToken |
| **Matchmaking** | | | |
| POST | `/api/v1/matchmaking/join` | Bearer (user/guest) | Встать в очередь |
| POST | `/api/v1/matchmaking/cancel` | Bearer (user/guest) | Покинуть очередь |
| POST | `/api/v1/matchmaking/joined` | Bearer (user/guest) | Подтвердить вход в комнату |
| GET | `/api/v1/matchmaking/status` | Bearer (user/guest) | Статус очереди/назначения |
| **Leaderboard** | | | |
| GET | `/api/v1/leaderboard` | Optional Bearer | Таблица лидеров (mode=total\|best) |
| **Wallet** | | | |
| GET | `/api/v1/wallet/balance` | authMiddleware | Баланс |
| GET | `/api/v1/wallet/transactions` | authMiddleware | История транзакций |
| **Shop** | | | |
| GET | `/api/v1/shop/offers` | authMiddleware | Каталог офферов |
| POST | `/api/v1/shop/purchase` | authMiddleware | Покупка за внутриигровую валюту |
| GET | `/api/v1/shop/unlocked` | authMiddleware | Разблокированные предметы |
| **Payment** | | | |
| GET | `/api/v1/payment/providers` | нет | Список доступных провайдеров |
| POST | `/api/v1/payment/create-invoice` | requireAuth | Создать счёт |
| POST | `/api/v1/payment/verify` | requireAuth | Подтвердить оплату |
| GET | `/api/v1/payment/status/:invoiceId` | requireAuth | Статус платежа |
| POST | `/api/v1/payment/webhook/telegram` | нет | Webhook Telegram |
| POST | `/api/v1/payment/webhook/yandex` | нет | Webhook YooKassa |
| **Ads** | | | |
| POST | `/api/v1/ads/grant` | authMiddleware | Создать grant |
| POST | `/api/v1/ads/claim` | authMiddleware | Забрать награду |
| GET | `/api/v1/ads/grant/:grantId` | authMiddleware | Статус grant'а |
| **Profile** | | | |
| GET | `/api/v1/profile` | requireAuth | Получить профиль |
| POST | `/api/v1/profile/nickname` | requireAuth | Сменить никнейм |

## 13. Захардкоженные значения

| Значение | Где | Файл |
|----------|-----|------|
| `DEFAULT_REWARDS.xp.base = 10` | fallback XP | `matchResults.ts:187` |
| `DEFAULT_REWARDS.coins.base = 5` | fallback coins | `matchResults.ts:188` |
| `xpPerLevel = 1000` | level-up порог | `PlayerService.ts:144` |
| `TIMEOUT_MS = 60000` | таймаут в очереди MM | `MatchmakingService.ts:40` |
| `PLAYERS_PER_MATCH = 8` | макс. игроков в матче | `MatchmakingService.ts:41` |
| `MIN_PLAYERS = 2` | мин. для старта матча | `MatchmakingService.ts:143,160,167` |
| `GRANT_TTL_SECONDS = 300` | TTL рекламного гранта | `AdsService.ts:27` |
| `JOIN_TOKEN_EXPIRES = 300` | TTL joinToken (default) | `JoinTokenService.ts:48` |
| `'slime-arena-dev-secret'` | dev fallback secret | `JoinTokenService.ts:45` |
| `'slime-base.webp'` | fallback skinId | `leaderboard.ts:131,148` |
| `defaultRating = 1500` | начальный рейтинг | `matchmaking.ts:110` |
| `transactionsLimit = 50/100` | лимит истории транзакций | `wallet.ts:46-47` |
| `nicknameLength = 3..50` | длина никнейма | `PlayerService.ts:73` |
| Yandex return_url fallback | `'https://slime-arena.com'` | `YandexPayProvider.ts:80` |
| Amount / 100 (Yandex) | Цены в копейках -> рубли | `YandexPayProvider.ts:70,259` |

## 14. Расхождения с документацией

### 14.1 Rating System

| Аспект | Документация (Part4) | Код (v0.8.7) |
|--------|---------------------|-------------|
| Алгоритм рейтинга | Glicko-2 (`systemId: 'glicko2'`, initialRD=350, sigma=0.06) | Mass-based (total_mass / best_mass), без ELO/Glicko |
| Таблица рейтинга | `player_ratings` (user_id, mode, season_id, rating, rating_data) | `leaderboard_total_mass` + `leaderboard_best_mass` (нет player_ratings) |
| Сезоны | Рейтинг привязан к `season_id` | Сезонов нет, данные бессрочные |
| Рейтинговое окно MM | `ratingWindowStart`, `ratingWindowExpandPerSec` | Простой FIFO, без рейтингового подбора |

### 14.2 Leaderboard

| Аспект | Документация | Код |
|--------|-------------|-----|
| Endpoint | `GET /api/v1/leaderboards` (с `seasonId`, `mode`, `page`) | `GET /api/v1/leaderboard` (с `mode=total|best`, `limit`, `offset`) |
| Пагинация | `page` | `offset` + `limit` |
| Сезоны | `seasonId` параметр | Нет сезонов |

### 14.3 Matchmaking

| Аспект | Документация | Код |
|--------|-------------|-----|
| Endpoint join | Принимает `mode`, `operationId`; возвращает `ticketId`, `expiresAt` | Принимает `rating`, `nickname`; возвращает `queuePosition` |
| Endpoint cancel | Принимает `ticketId` | Не требует ticketId (по userId из токена) |
| Endpoint status | Принимает `ticketId`; state=waiting\|assigned | По userId; inQueue/matched + assignment |
| MatchAssignment | `{roomId, matchServerUrl, joinToken, expiresAt}` | `{roomId, roomHost, roomPort, matchId, players[], joinToken}` |
| Подбор по рейтингу | `ratingWindowStart`, expand per sec | FIFO без учёта рейтинга |
| Боты | `allowBots`, `botFillPolicy`, `botsPerMatch` | Не реализовано |

### 14.4 Shop

| Аспект | Документация | Код |
|--------|-------------|-----|
| Endpoint каталога | `GET /api/v1/shop/catalog` | `GET /api/v1/shop/offers` |
| Endpoint платформенной покупки | `POST /api/v1/shop/purchase/platform` | `POST /api/v1/payment/create-invoice` + `/verify` (отдельный модуль) |
| `paymentsEnabled` kill switch | MUST проверять перед покупкой | Не проверяется в коде |

### 14.5 Ads

| Аспект | Документация | Код |
|--------|-------------|-----|
| Endpoint | `POST /api/v1/ads/reward/claim` с `grantId`, `operationId`, `providerPayload` | `POST /grant` + `POST /claim` (двухфазный) |
| Server-side validation | `providerPayload` для верификации | Не реализовано |
| `adsRewardEnabled` kill switch | MUST проверять | Не проверяется |
| Лимиты выдачи | `daily_rewards.ads_watched_today` + economy.json limits | Не реализовано |

### 14.6 Transactions

| Аспект | Документация | Код |
|--------|-------------|-----|
| Структура | `type` (spend/grant/purchase), `source` (shop/battlepass/ad/admin/match), `payload` JSONB | `type` (произвольная строка), `amount`, `currency` (soft/hard), `metadata` JSONB |
| UNIQUE constraint | `(user_id, operation_id)` | Используется SELECT перед INSERT (не constraint на уровне БД в коде) |

### 14.7 Purchase Receipts

| Аспект | Документация | Код |
|--------|-------------|-----|
| Колонки | `operation_id`, `provider`, `receipt_payload`, status=pending/verified/rejected | `receipt_id`, `platform`, `platform_transaction_id`, status=pending/completed/failed/refunded |
| Статусы | pending, verified, rejected | pending, completed, failed, refunded |

### 14.8 Profile

| Аспект | Документация | Код |
|--------|-------------|-----|
| Ответ GET /profile | `{userId, nickname, level, xp, wallet}` | `{userId, nickname, avatarUrl, level, xp, selectedSkinId, wallet: {coins, gems}}` |

### 14.9 Общее

| Аспект | Документация | Код |
|--------|-------------|-----|
| Inventory endpoint | `GET /api/v1/inventory` | Не реализован как отдельный endpoint |
| BattlePass endpoints | `GET /battlepass/status`, `POST /battlepass/claim` | Не реализованы |
| Achievements endpoint | `GET /api/v1/achievements` | Не реализован |
| Daily rewards | Таблица `daily_rewards` описана | Не реализована |
| A/B tests | Описаны в Part4, Приложение E | Не реализованы |
| `configs` таблица | Описана для RuntimeConfig | `ConfigService` используется, но через отдельную логику |

## 15. Технический долг

### Критический (P0)
1. **Нет server-side validation рекламы** (`AdsService.claimReward`) — клиент может клеймить reward без реального просмотра. Нужен `providerPayload` verification.
2. **Level-up не срабатывает при получении XP за матч** — `matchResults.ts` напрямую пишет `UPDATE profiles SET xp = xp + $2`, минуя `PlayerService.addXP()` с level-up логикой.
3. **Нет проверки `paymentsEnabled` kill switch** — платежи принимаются даже если `features.paymentsEnabled = false`.

### Высокий (P1)
4. **Нет проверки `adsRewardEnabled` kill switch** — реклама работает без учёта features.json.
5. **Нет проверки владения скином** при `updateSelectedSkin()` — игрок может выбрать неразблокированный скин (TODO в коде).
6. **Нет лимитов на рекламу** — `daily_rewards.ads_watched_today` не используется. Нет cap на количество просмотров.
7. **Транзакции без DB-level UNIQUE constraint** — идемпотентность через `SELECT` перед `INSERT`, а не через `UNIQUE (user_id, operation_id)` в DDL. Race condition возможен при параллельных запросах.
8. **Webhook-и без signature verification** — Telegram и Yandex webhooks не проверяют подпись запроса. Любой может отправить поддельный webhook.
9. **pre_checkout_query всегда accept** (`answerPreCheckoutQuery(id, true)`) — нет валидации перед подтверждением.

### Средний (P2)
10. **Нет кеширования leaderboard** — каждый запрос в PostgreSQL. При большой нагрузке будет тормозить.
11. **`reward.type === 'item'` не реализован** в AdsService — только логирование.
12. **Рейтинговый подбор не реализован** — только FIFO. В документации описан Glicko-2 и рейтинговые окна.
13. **Нет сезонной системы** — leaderboard, battlepass, achievements без сезонов.
14. **Нет Inventory endpoint** — описан в документации, не реализован.
15. **YandexPayProvider.refundPayment** не возвращает новые балансы кошелька и не отзывает выданные предметы.

### Низкий (P3)
16. **Matchmaking: линейный поиск по очереди** — `isInQueue()`, `getQueuePosition()`, `leaveQueue()` итерируют весь sorted set. O(N) при больших очередях.
17. **Fallback URL для Yandex** — `'https://slime-arena.com'` захардкожен (не актуальный домен, реальный: `slime-arena.overmobile.space`).
18. **configService** создаётся как new instance в каждом сервисе (ShopService, AdsService) — не singleton.

## 16. Заметки для форка BonkRace

### Переиспользуется без изменений:
- **WalletService** — двухвалютная система (soft/hard) полностью подходит
- **ShopService** — покупка скинов/валюты, RuntimeConfig-based офферы
- **PaymentProviderFactory** + провайдеры — Telegram Stars и Yandex Pay
- **PlayerService** — профиль, никнейм, уровень, XP
- **AdsService** — grant-based rewarded ads

### Требует адаптации:
- **Match Results** -> **Race Results**: переименовать endpoints, заменить `finalMass` на `racePosition`/`raceTime`
- **Rating System** -> **Racing ELO**: заменить mass-based рейтинг на ELO/Glicko-2 по позиции в гонке. `awardRating()` должен учитывать позицию и количество участников, а не массу
- **Leaderboard** -> **Racing Leaderboard**: вместо total_mass/best_mass использовать total_wins/best_time или ELO rating
- **Reward формулы** -> **Race Rewards**: XP/coins за позицию в гонке вместо placement + killCount. Убрать `perKill`
- **Matchmaking** -> **Race Matchmaking**: добавить рейтинговое окно, т.к. в гонке баланс по уровню важнее
- **PlayerResult**: убрать `killCount`, `deathCount`, `finalMass`, `classId`; добавить `finishTime`, `lapTimes[]`, `racePosition`

### Что можно удалить:
- `combat`-related поля в PlayerResult
- Mass-based leaderboard таблицы (заменить на race-specific)
- `rating_awards` (переделать под race results)
