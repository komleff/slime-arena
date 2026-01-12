# Slime Arena — Архитектура

**Версия:** 4.2.5 (часть 4/4)
**Дата:** 5 января 2026  

---

## 0. Изменения версии 4.2.3

1. Закрыт открытый вопрос по значениям по умолчанию для `Glicko-2` (см. `leaderboards.json`, таблица `player_ratings`).
2. Зафиксирована политика софт-лонча: реальные платежи выключены (`features.json` → `paymentsEnabled=false`).
3. Добавлено событие `match_aborted` в минимальный набор аналитики софт-лонча.
4. Обновлены ссылки на актуальные версии `TZ-SoftLaunch` и Плана Soft Launch.

---


## 1. Назначение приложений

Часть 4/4 — справочник для реализации и тестирования.  
Части 1–3 описывают архитектурные принципы и границы, а детали полей и маршрутов находятся здесь.

Правило обновлений:
1. Любая правка полей БД или HTTP API выполняется только в части 4/4.
2. В частях 1–3 допустимы только ссылки на приложения.

---

# Приложение A. Система конфигураций контента и монетизации

## A.1. Общие требования

1. Конфигурации хранятся версиями: `configVersion`.
2. `ConfigService` отдаёт клиенту активную версию и метаданные.
3. Перед активацией конфигурации валидируются по схеме.
4. Поддерживается откат на предыдущую версию без релиза клиента.

## A.2. Структура хранения

Рекомендуемая структура:
- `configs/<configVersion>/economy.json`
- `configs/<configVersion>/shop.json`
- `configs/<configVersion>/battlepass.json`
- `configs/<configVersion>/achievements.json`
- `configs/<configVersion>/leaderboards.json`
- `configs/<configVersion>/matchmaking.json`
- `configs/<configVersion>/resilience.json`
- `configs/<configVersion>/features.json`
- `configs/<configVersion>/abtests.json`

Каждый файл содержит:
- `schemaVersion` (строка)
- `configVersion` (строка, совпадает с папкой)
- `generatedAt` (время генерации)
- `payload` (содержимое файла)

## A.3. `economy.json`

Назначение: валюты, источники и лимиты.

`payload` содержит:
- `currencies`: список валют, каждая валюта имеет `currencyId`, `displayName`, `precision`, `isPremium`.
- `grants`: правила выдачи (например, за матч, за рекламу, за вход), каждое правило имеет `grantId`, `conditions`, `rewards`.
  - Для рекламы маршрут `/api/v1/ads/reward/claim` принимает `grantId` и выдаёт награду строго по активной конфигурации.
- `limits`: лимиты накопления и выдачи (например, дневные), каждое правило имеет `limitId`, `scope`, `maxAmount`, `resetCron`.

## A.4. `shop.json`

Назначение: витрины, офферы, цены, ротации.

`payload` содержит:
- `catalogs`: витрины (`catalogId`, `title`, `sortOrder`).
- `offers`: офферы (`offerId`), с полями:
  - `price`: `currencyId` и `amount` или `sku` (для реальных денег)
  - `rewards`: список наград (`rewardType`, `itemId`, `amount`)
  - `availability`: расписание и сегменты (`startAt`, `endAt`, `segments`)
  - `limits`: ограничения покупок (`perDay`, `perSeason`, `lifetime`)
- `skuMapping`: сопоставление `sku` ↔ `productId` конкретной платформы (если требуется).

## A.5. `battlepass.json`

Назначение: сезоны, уровни, миссии и награды.

`payload` содержит:
- `seasons`: список сезонов, каждый сезон имеет `seasonId`, `startAt`, `endAt`.
- `tiers`: список уровней с `tier`, `xpRequired`, `freeRewards`, `premiumRewards`.
- `missions`: список миссий (`missionId`, `type`, `target`, `reward`, `resetPolicy`).
- `premiumSku`: `sku` премиума (если продаётся за реальные деньги).

## A.6. `achievements.json`

Назначение: достижения, условия, награды.

`payload` содержит:
- `achievements`: список достижений (`achievementId`, `type`, `tiers`, `rewards`, `visibility`).

## A.7. `leaderboards.json`

Назначение: сезоны рейтинга, режимы, правила сброса и отображения.

`payload` содержит:
- `seasons`: (`seasonId`, `startAt`, `endAt`, `resetPolicy`).
- `modes`: (`mode`, `isRated`, `ratingConfig`, `leagueConfig`).

`ratingConfig` содержит параметры рейтинга для софт-лонча:
- `systemId`: строка, MUST быть `glicko2`.
- `initialRating`: число, по умолчанию 1500.
- `initialRD`: число, по умолчанию 350.
- `initialSigma`: число, по умолчанию 0.06.
- `inactivityDays`: целое, по умолчанию 14.
- `tau`: число, по умолчанию 0.5.

Правила:
1. `MetaServer` MUST инициализировать новые записи рейтинга значениями из `ratingConfig`.
2. `MatchmakingService` MUST использовать числовое поле `rating` как основной ключ подбора по окну рейтинга.
3. Детали алгоритма расчёта `Glicko-2` и ограничения (если добавятся) фиксируются отдельным документом дизайна рейтинга, но значения по умолчанию определены здесь для воспроизводимости.

## A.8. `matchmaking.json`

Назначение: параметры очереди и подбора.

`payload` содержит:
- `modes`: список режимов, каждый режим имеет:
  - `mode`
  - `teamSize`
  - `minPlayers`, `maxPlayers`
  - `ratingWindowStart`, `ratingWindowMax`
  - `ratingWindowExpandPerSec`
  - `maxQueueTimeSec`
  - `allowBots`, `botFillPolicy`
  - `botsPerMatch` (целое, по умолчанию 1)
  - `botRatingStrategy` (строка, по умолчанию `median`)
  - `botsAffectRating` (логическое, по умолчанию false)


## A.9. `features.json`

Назначение: переключатели возможностей и аварийные выключатели.

`payload` содержит:
- `featureFlags`: список флагов (`flagId`, `enabled`, `segments`).
- `killSwitches`: список выключателей (`switchId`, `enabled`), влияющих на критические функции.

Резервированные `switchId` (софт-лонч):
- `paymentsEnabled`: управление покупками за реальные деньги.
- `adsRewardEnabled`: управление выдачей награды за рекламу.
- `matchmakingEnabled`: управление очередью и стартом матчей.

Правила:
1. При `paymentsEnabled=false` маршрут `/api/v1/shop/purchase/platform` MUST возвращать ошибку `payments_disabled` и MUST не изменять состояние игрока.
2. При `adsRewardEnabled=false` маршрут `/api/v1/ads/reward/claim` MUST возвращать ошибку `ads_reward_disabled` и MUST не изменять состояние игрока.


## A.10. `abtests.json`

Назначение: описание A/B тестов.

Детальная схема: Приложение E.

---

# Приложение B. Схема базы данных

## B.1. Общие правила

1. Все операции экономики пишут запись в `transactions`.
2. Идемпотентность обеспечивается уникальностью (`user_id`, `operation_id`) в `transactions`.
3. Для таблиц прогресса используются составные ключи по (`user_id`, идентификатор сущности).

Типы:
- `UUID` — внутренний идентификатор.
- `TIMESTAMP` — время в UTC.
- `JSONB` — расширяемые структуры без миграций на мелкие изменения.

## B.2. Таблица `users`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | UUID | PRIMARY KEY | `userId` |
| `platform_type` | VARCHAR(50) | NOT NULL | telegram, yandex, poki, guest |
| `platform_id` | VARCHAR(255) | NOT NULL | Идентификатор на платформе |
| `nickname` | VARCHAR(50) | NOT NULL | Имя |
| `avatar_url` | VARCHAR(500) | | Аватар |
| `locale` | VARCHAR(10) | DEFAULT 'ru' | Язык |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Создание |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Обновление |
| `last_login_at` | TIMESTAMP | | Последний вход |
| `is_banned` | BOOLEAN | DEFAULT FALSE | Бан |
| `ban_reason` | VARCHAR(255) | | Причина |
| `ban_until` | TIMESTAMP | | До какого времени |

Индексы:
- UNIQUE (`platform_type`, `platform_id`) — запрет дублей и быстрый поиск аккаунта по данным платформы

## B.3. Таблица `sessions`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | UUID | PRIMARY KEY | Идентификатор |
| `user_id` | UUID | FK → users.id | Игрок |
| `token_hash` | VARCHAR(255) | NOT NULL | Хэш токена |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Создание |
| `expires_at` | TIMESTAMP | NOT NULL | Истечение |
| `revoked_at` | TIMESTAMP | | Отзыв |
| `ip` | VARCHAR(64) | | IP |
| `user_agent` | VARCHAR(255) | | UA |

Индексы:
- INDEX (`user_id`, `created_at` DESC) — быстрый список по игроку и очистка по времени

## B.4. Таблица `profiles`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `user_id` | UUID | PRIMARY KEY, FK → users.id | Игрок |
| `level` | INT | DEFAULT 1 | Уровень |
| `xp` | INT | DEFAULT 0 | Опыт |
| `selected_skin_id` | VARCHAR(100) | | Скин |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Создание |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Обновление |

## B.5. Таблица `wallets`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `user_id` | UUID | PRIMARY KEY, FK → users.id | Игрок |
| `coins` | BIGINT | DEFAULT 0 | Мягкая валюта |
| `gems` | BIGINT | DEFAULT 0 | Премиальная валюта |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Обновление |

## B.6. Таблица `unlocked_items`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | UUID | PRIMARY KEY | Идентификатор |
| `user_id` | UUID | FK → users.id | Игрок |
| `item_id` | VARCHAR(100) | NOT NULL | Предмет |
| `item_type` | VARCHAR(50) | NOT NULL | skin, emote, title, frame |
| `unlocked_at` | TIMESTAMP | DEFAULT NOW() | Получение |
| `source` | VARCHAR(50) | NOT NULL | shop, battlepass, achievement, admin |
| `source_details` | JSONB | | Детали |

Индексы:
- UNIQUE (`user_id`, `item_id`) — запрет повторной выдачи предмета
- INDEX (`user_id`, `item_type`) — выборка предметов игрока по типу

## B.7. Таблица `player_ratings`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `user_id` | UUID | FK → users.id | Игрок |
| `mode` | VARCHAR(50) | NOT NULL | Режим |
| `season_id` | VARCHAR(50) | NOT NULL | Сезон |
| `rating` | INT | DEFAULT 1500 | Рейтинг |
| `rating_data` | JSONB | | Доп. параметры алгоритма |
| `games_played` | INT | DEFAULT 0 | Матчей |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Обновление |

Ключи и индексы:
- PRIMARY KEY (`user_id`, `mode`, `season_id`)
- INDEX (`season_id`, `mode`, `rating` DESC) — построение лидерборда по сезону и режиму

Правила хранения `rating_data` (для `Glicko-2`):
- `rd`: число, по умолчанию 350
- `sigma`: число, по умолчанию 0.06
- `lastRatedAt`: `TIMESTAMP` в UTC (последний матч, повлиявший на рейтинг)

`MetaServer` MUST обновлять `rating` и `rating_data` только на основе серверных результатов матча.

## B.8. Таблица `match_results`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `match_id` | UUID | PRIMARY KEY | Матч |
| `mode` | VARCHAR(50) | NOT NULL | Режим |
| `started_at` | TIMESTAMP | NOT NULL | Начало |
| `ended_at` | TIMESTAMP | NOT NULL | Конец |
| `config_version` | VARCHAR(50) | NOT NULL | Конфиги |
| `build_version` | VARCHAR(50) | NOT NULL | Сборка |
| `summary` | JSONB | NOT NULL | Итоги (игроки, позиции, награды) |

Индексы:
- INDEX (`started_at` DESC) — аналитика матчей по времени

## B.9. Таблица `battlepass_progress`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `user_id` | UUID | FK → users.id | Игрок |
| `season_id` | VARCHAR(50) | NOT NULL | Сезон |
| `level` | INT | DEFAULT 0 | Уровень |
| `xp` | INT | DEFAULT 0 | Опыт |
| `premium` | BOOLEAN | DEFAULT FALSE | Премиум |
| `state` | JSONB | | Служебное состояние (полученные награды) |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Обновление |

Ключи:
- PRIMARY KEY (`user_id`, `season_id`)

## B.10. Таблица `mission_progress`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `user_id` | UUID | FK → users.id | Игрок |
| `season_id` | VARCHAR(50) | NOT NULL | Сезон |
| `mission_id` | VARCHAR(100) | NOT NULL | Миссия |
| `progress` | INT | DEFAULT 0 | Прогресс |
| `state` | VARCHAR(20) | DEFAULT 'active' | active, completed, claimed |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Обновление |

Ключи:
- PRIMARY KEY (`user_id`, `season_id`, `mission_id`)

## B.11. Таблица `achievements`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `user_id` | UUID | FK → users.id | Игрок |
| `achievement_id` | VARCHAR(100) | NOT NULL | Достижение |
| `state` | VARCHAR(20) | DEFAULT 'locked' | locked, unlocked, claimed |
| `progress` | INT | DEFAULT 0 | Прогресс |
| `unlocked_at` | TIMESTAMP | | Разблокировано |
| `claimed_at` | TIMESTAMP | | Получено |

Ключи:
- PRIMARY KEY (`user_id`, `achievement_id`)

## B.12. Таблица `daily_rewards`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `user_id` | UUID | PRIMARY KEY, FK → users.id | Игрок |
| `streak` | INT | DEFAULT 0 | Серия |
| `last_claimed_at` | TIMESTAMP | | Последнее получение |
| `ads_watched_today` | INT | DEFAULT 0 | Реклама сегодня |
| `ads_reset_at` | TIMESTAMP | | Сброс |

## B.13. Таблица `transactions`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | UUID | PRIMARY KEY | Идентификатор |
| `user_id` | UUID | FK → users.id | Игрок |
| `operation_id` | VARCHAR(100) | NOT NULL | Идемпотентный ключ |
| `type` | VARCHAR(50) | NOT NULL | spend, grant, purchase |
| `source` | VARCHAR(50) | NOT NULL | shop, battlepass, ad, admin, match |
| `payload` | JSONB | NOT NULL | Детали операции |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Дата |

Индексы:
- UNIQUE (`user_id`, `operation_id`) — идемпотентность операций экономики
- INDEX (`user_id`, `created_at` DESC) — быстрый список по игроку и очистка по времени

## B.14. Таблица `purchase_receipts`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | UUID | PRIMARY KEY | Идентификатор |
| `user_id` | UUID | FK → users.id | Игрок |
| `operation_id` | VARCHAR(100) | NOT NULL | Ключ операции |
| `provider` | VARCHAR(50) | NOT NULL | telegram, yandex, other |
| `receipt_id` | VARCHAR(255) | | Идентификатор платформы |
| `receipt_payload` | JSONB | NOT NULL | Данные подтверждения |
| `status` | VARCHAR(20) | NOT NULL | pending, verified, rejected |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Создание |
| `verified_at` | TIMESTAMP | | Верификация |

Индексы:
- UNIQUE (`user_id`, `operation_id`) — идемпотентность операций экономики

## B.15. Таблица `social_invites`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | UUID | PRIMARY KEY | Идентификатор |
| `user_id` | UUID | FK → users.id | Кто пригласил |
| `platform` | VARCHAR(50) | NOT NULL | Платформа |
| `invite_code` | VARCHAR(50) | NOT NULL | Код |
| `state` | VARCHAR(20) | DEFAULT 'created' | created, opened, joined |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Дата |

Индексы:
- UNIQUE (`platform`, `invite_code`) — запрет дублей и быстрый поиск приглашения

## B.16. Таблица `ab_tests`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `user_id` | UUID | FK → users.id | Игрок |
| `test_id` | VARCHAR(100) | NOT NULL | Тест |
| `variant_id` | VARCHAR(100) | NOT NULL | Вариант |
| `assigned_at` | TIMESTAMP | DEFAULT NOW() | Назначение |

Ключи:
- PRIMARY KEY (`user_id`, `test_id`)

## B.17. Таблица `configs`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `config_version` | VARCHAR(50) | PRIMARY KEY | Версия |
| `state` | VARCHAR(20) | NOT NULL | draft, active, archived |
| `checksum` | VARCHAR(100) | NOT NULL | Контрольная сумма |
| `payload` | JSONB | NOT NULL | Набор конфигов или ссылки |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Создание |
| `activated_at` | TIMESTAMP | | Активация |

## B.18. Таблица `audit_log`

| Поле | Тип | Ограничения | Описание |
|------|-----|-------------|----------|
| `id` | UUID | PRIMARY KEY | Идентификатор |
| `actor_user_id` | UUID | | Кто выполнил (если есть) |
| `action` | VARCHAR(100) | NOT NULL | Действие |
| `target` | VARCHAR(100) | | Цель |
| `payload` | JSONB | | Детали |
| `ip` | VARCHAR(64) | | IP |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Дата |

---

# Приложение C. HTTP API

## C.1. Общие правила

1. Формат данных: JSON.
2. Версионирование: `/api/v1/`.
3. Авторизация: `Authorization: Bearer <accessToken>`.
4. Ошибка имеет поля: `error`, `message`.
5. Все операции экономики принимают `operationId`.


## C.1.1. Общие объекты

### Объект `Wallet`

| Поле | Тип | Описание |
|------|-----|----------|
| `coins` | number | Мягкая валюта |
| `gems` | number | Премиальная валюта |

### Элемент массива `granted`

| Поле | Тип | Описание |
|------|-----|----------|
| `itemType` | string | currency, skin, emote, title |
| `itemId` | string | Идентификатор предмета или валюты |
| `amount` | number | Количество (для currency) |

### Объект `ProfileSummary`

| Поле | Тип | Описание |
|------|-----|----------|
| `level` | number | Уровень профиля |
| `xp` | number | Опыт |
| `selectedSkinId` | string | Активный скин |
| `wallet` | Wallet | Балансы валют |

### Объект `MatchAssignment`

| Поле | Тип | Описание |
|------|-----|----------|
| `roomId` | string | Идентификатор комнаты |
| `matchServerUrl` | string | URL сервера матча |
| `joinToken` | string | Токен входа |
| `expiresAt` | string | Время истечения |

## C.2. Авторизация

### POST `/api/v1/auth/verify`

Назначение: верификация входа платформы и получение `accessToken`.

Запрос:
| Поле | Тип | Описание |
|------|-----|----------|
| `platformType` | string | telegram, yandex, poki, guest, dev |
| `platformAuthToken` | string | Токен/данные платформы |

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `accessToken` | string | Токен API |
| `userId` | string | UUID |
| `profile` | ProfileSummary | Сводные данные профиля |
| `configVersion` | string | Активная версия конфигов |

## C.3. Конфигурации

### GET `/api/v1/config/runtime`

Назначение: получить `RuntimeConfig` для клиента.

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `configVersion` | string | Версия |
| `runtimeConfig` | object | Набор конфигов для клиента |

## C.4. Профиль

### GET `/api/v1/profile`

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `userId` | string | UUID |
| `nickname` | string | Имя |
| `level` | number | Уровень |
| `xp` | number | Опыт |
| `wallet` | Wallet | Балансы |

### POST `/api/v1/profile/nickname`

Запрос:
| Поле | Тип | Описание |
|------|-----|----------|
| `nickname` | string | Новое имя |
| `operationId` | string | Ключ операции |

Ответ: как `GET /profile`.

## C.5. Инвентарь

### GET `/api/v1/inventory`

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `wallet` | Wallet | Балансы |
| `unlockedItems` | array | Список предметов |
| `selected` | object | Выбранная косметика |

## C.6. Магазин

### GET `/api/v1/shop/catalog`

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `catalogs` | array | Витрины |
| `offers` | array | Офферы |
| `configVersion` | string | Версия конфигов |

### POST `/api/v1/shop/purchase`

Покупка за валюту.

Запрос:
| Поле | Тип | Описание |
|------|-----|----------|
| `offerId` | string | Оффер |
| `operationId` | string | Ключ операции |

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `wallet` | Wallet | Балансы |
| `granted` | array | Выданные награды |

### POST `/api/v1/shop/purchase/platform`

Покупка за реальные деньги.

Запрос:
| Поле | Тип | Описание |
|------|-----|----------|
| `offerId` | string | Оффер |
| `receipt` | object | Подтверждение платформы |
| `operationId` | string | Ключ операции |

Правила:
1. Если `features.json` содержит `paymentsEnabled=false`, сервер MUST вернуть ошибку `payments_disabled` и MUST не создавать запись в `transactions`.
2. Сервер MUST проверить `receipt` через `IPaymentProvider` для текущей платформы.
3. Сервер MUST обеспечить идемпотентность по (`userId`, `operationId`) для успешных покупок.

Ответ: как `/shop/purchase`.

## C.7. Реклама с наградой

### POST `/api/v1/ads/reward/claim`

Назначение: выдача награды за подтверждённый просмотр рекламы.

Запрос:
| Поле | Тип | Описание |
|------|-----|----------|
| `grantId` | string | Идентификатор правила выдачи из `economy.json` (`payload.grants[].grantId`) |
| `operationId` | string | Ключ операции |
| `providerPayload` | object | Подтверждение провайдера (если применяется на платформе) |

Правила:
1. Награда определяется сервером по `grantId` и активной `configVersion`.
2. Клиент не передаёт количество награды.
3. Сервер проверяет лимиты и условия выдачи из `economy.json`.
4. Идемпотентность обеспечивается по (`userId`, `operationId`).

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `wallet` | Wallet | Балансы |
| `granted` | array | Выданные награды |

## C.8. Боевой пропуск

### GET `/api/v1/battlepass/status`

Запрос:
| Поле | Тип | Описание |
|------|-----|----------|
| `seasonId` | string | Сезон |

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `progress` | object | Прогресс |
| `missions` | array | Миссии |
| `rewards` | object | Награды сезона |

### POST `/api/v1/battlepass/claim`

Запрос:
| Поле | Тип | Описание |
|------|-----|----------|
| `seasonId` | string | Сезон |
| `tier` | number | Уровень |
| `track` | string | free или premium |
| `operationId` | string | Ключ операции |

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `wallet` | Wallet | Балансы |
| `granted` | array | Выданные награды |

## C.9. Достижения

### GET `/api/v1/achievements`

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `achievements` | array | Состояние достижений |

## C.10. Лидерборды

### GET `/api/v1/leaderboards`

Запрос:
| Поле | Тип | Описание |
|------|-----|----------|
| `seasonId` | string | Сезон |
| `mode` | string | Режим |
| `page` | number | Страница |

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `entries` | array | Записи |
| `self` | object | Позиция игрока |

## C.11. Матчмейкинг

### POST `/api/v1/matchmaking/join`

Запрос:
| Поле | Тип | Описание |
|------|-----|----------|
| `mode` | string | Режим |
| `operationId` | string | Ключ операции (для повторов клиента) |

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `ticketId` | string | Билет |
| `expiresAt` | string | Истечение |

### POST `/api/v1/matchmaking/cancel`

Запрос:
| Поле | Тип | Описание |
|------|-----|----------|
| `ticketId` | string | Билет |

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `status` | string | cancelled |

### GET `/api/v1/matchmaking/status`

Запрос:
| Поле | Тип | Описание |
|------|-----|----------|
| `ticketId` | string | Билет |

Ответ:
| Поле | Тип | Описание |
|------|-----|----------|
| `state` | string | waiting или assigned |
| `assignment` | MatchAssignment | Только для assigned |

`assignment` содержит:
- `roomId`
- `matchServerUrl`
- `joinToken`
- `expiresAt`

## C.12. Административные маршруты

Маршруты доступны только с ролью администратора и пишут записи в `audit_log`.
Перечень и конкретные права задаются конфигурацией и окружением.

---

# Приложение D. Система событий и аналитики

## D.1. Общие требования

Любое событие содержит:
- `eventName`
- `ts`
- `userId` (если применимо)
- `platformType`
- `buildVersion`
- `configVersion`
- `payload`

## D.2. Минимальный набор событий софт-лонча

| `eventName` | Источник | Когда отправлять |
|------------|----------|-----------------|
| `session_start` | клиент | Запуск игры |
| `session_end` | клиент | Выход |
| `auth_success` | сервер | Успешный вход |
| `config_applied` | клиент/сервер | Применение конфигов |
| `matchmaking_join` | сервер | Вход в очередь |
| `matchmaking_cancel` | сервер | Отмена |
| `matchmaking_assigned` | сервер | Назначение матча |
| `match_start` | сервер | Старт матча |
| `match_end` | сервер | Завершение матча |
| `match_aborted` | сервер | Матч прерван (падение комнаты, таймаут, разрыв связи без восстановления) |
| `purchase` | сервер | Любая покупка |
| `purchase_failed` | сервер | Ошибка покупки |
| `ad_reward` | сервер | Выдача за рекламу |
| `battlepass_level` | сервер | Повышение уровня пропуска |
| `achievement_unlock` | сервер | Разблокировано достижение |
| `error` | клиент/сервер | Ошибка |

---

# Приложение E. Система A/B тестирования

## E.1. Модель теста

`abtests.json` (`payload`) содержит список тестов, каждый тест имеет:
- `testId`
- `enabled`
- `startAt`, `endAt` (опционально)
- `variants` (список вариантов)
- `allocation` (распределение пользователей по вариантам)
- `minDurationDays`
- `minUsersPerVariant`
- `alpha`
- `guardrails` (список защитных метрик и порогов)
- `overrides` (исключения по сегментам, опционально)

Вариант (`variantId`) задаёт изменения конфигураций через переопределение части `RuntimeConfig`.

## E.2. Правила назначения варианта

1. Назначение детерминировано по `userId` и `testId`.
2. Назначение сохраняется в таблице `ab_tests`.
3. При отключении теста назначение не удаляется, но перестаёт влиять на выдачу конфигов.

---

# Приложение F. Безопасность

## F.1. Входные данные и валидация

1. Любые входные данные валидируются по типам и ограничениям (длины строк, диапазоны чисел).
2. Любой запрос с отсутствующей авторизацией возвращает ошибку.
3. Поля, влияющие на экономику, проверяются по конфигурациям и состоянию игрока.

## F.2. Идемпотентность

1. Любая операция, меняющая баланс или выдающая предметы, принимает `operationId`.
2. Уникальность (`user_id`, `operation_id`) в `transactions` обязательна.
3. Повтор запроса возвращает ранее рассчитанный результат.

## F.3. Верификация платформы

1. Telegram: проверка подписи `initData` и времени жизни данных.
2. Платежи: проверка `receipt` через `IPaymentProvider` только на сервере.
3. При неуспехе верификации операция отклоняется и логируется.

## F.4. Согласия пользователя (`Consent`)

1. Согласия хранятся на стороне сервера и отдаются клиенту в профиле.
2. При отсутствии согласия запрещены персонализированные события и реклама, если это требуется платформой/законами.

## F.5. Удаление данных (`DataDeletion`)

Требования:
1. Запрос удаления инициируется пользователем через поддержку/платформу (в зависимости от платформы).
2. `MetaServer` удаляет или анонимизирует персональные данные: `platform_id`, `nickname`, `avatar_url`.
3. Технические данные (транзакции, аудит) сохраняются в обезличенном виде, если это допускается политикой хранения.
4. Операция фиксируется в `audit_log`.

## F.6. Защита матчей

1. Клиент отправляет только ввод, сервер рассчитывает результат.
2. Все награды рассчитываются на сервере, данные клиента игнорируются.