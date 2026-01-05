# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**База:** main (5 января 2026)
**Релиз:** v0.2.2
**GDD версия:** 3.3.2
**Текущая ветка:** `docs/soft-launch-prep`

### Фокус сессии

- **[ЗАВЕРШЕНО] Stage C - Monetization & LiveOps (5 января 2026):**

  **RuntimeConfig Management (расширение ConfigService):**
  - `listConfigs(state?)` — Список всех версий конфигов
  - `updateConfig(version, payload)` — Обновление draft-конфига
  - `archiveConfig(version)` — Архивация версии
  - `deleteConfig(version)` — Удаление draft-конфига
  - `cloneConfig(source, target)` — Клонирование версии
  - `validateConfig(payload)` — Валидация структуры

  **A/B Testing (5 новых файлов):**
  - `server/src/meta/services/ABTestService.ts` — Полный lifecycle A/B тестов
    - createTest, getTest, listTests, updateTestState
    - getAssignment (детерминистичный по userId+testId)
    - trackConversion, getTestStats, deleteTest
  - `server/src/meta/routes/abtest.ts` — HTTP API для A/B тестов
    - GET /assignments, /assignment/:testId
    - POST /conversion
    - Admin: GET /admin/list, /admin/:testId, /admin/:testId/stats
    - Admin: POST /admin/create, PUT /admin/:testId/state, DELETE /admin/:testId

  **Payment Providers (4 новых файла):**
  - `server/src/meta/payment/IPaymentProvider.ts` — Интерфейс платёжного провайдера
  - `server/src/meta/payment/TelegramStarsProvider.ts` — Telegram Stars (XTR)
    - createInvoice, verifyPayment, answerPreCheckoutQuery, refundPayment
  - `server/src/meta/payment/YandexPayProvider.ts` — Yandex.Checkout
    - createInvoice, verifyPayment, handleWebhook, refundPayment
  - `server/src/meta/payment/PaymentProviderFactory.ts` — Фабрика провайдеров

  **Analytics (2 новых файла):**
  - `server/src/meta/services/AnalyticsService.ts` — Аналитика с буферизацией
    - track, trackBatch, flush (auto 30s / size 100)
    - queryEvents, getStats (для админов)
    - EventTypes: 25+ предопределённых типов событий
  - `server/src/meta/routes/analytics.ts` — HTTP API для аналитики
    - POST /track, /batch
    - GET /event-types
    - Admin: GET /admin/query, /admin/stats, POST /admin/flush

  **HTTP Routes Stage C (3 новых роута):**
  - `server/src/meta/routes/configAdmin.ts` — Admin API для RuntimeConfig
  - `server/src/meta/routes/payment.ts` — Payment webhooks и verifications
    - POST /create-invoice, /verify
    - GET /providers, /status/:invoiceId
    - Webhooks: POST /webhook/telegram, /webhook/yandex

  **Database (1 новая миграция):**
  - `server/src/db/migrations/002_stage_c_monetization.sql`
    - ab_tests: test definitions (variants JSONB, weights INT[], state)
    - ab_test_conversions: event tracking with variant_id
    - analytics_events: event_id, event_type, properties JSONB
    - purchase_receipts: updated structure for payment providers

  **Инфраструктура:**
  - `server/src/db/redis.ts` — Re-export Redis client
  - `server/src/meta/middleware/auth.ts` — Добавлен requireAdmin middleware
  - `server/src/meta/server.ts` — Зарегистрированы все новые роуты

  **Smoke Tests:**
  - `server/tests/meta-stage-c.test.ts` — 15+ тестов для Stage C endpoints

  **Файлы Stage C:**
  - Создано 12 новых файлов
  - Изменено 4 файла (ConfigService.ts, auth.ts, server.ts, pool.ts)

- **[ЗАВЕРШЕНО] Stage B - Core Services (5 января 2025):**
  
  **Platform Adapters (5 новых файлов):**
  - `server/src/meta/platform/IAuthProvider.ts` — Интерфейс платформенных провайдеров
  - `server/src/meta/platform/DevAuthProvider.ts` — Dev-режим авторизации  
  - `server/src/meta/platform/TelegramAuthProvider.ts` — Telegram Mini App (HMAC-SHA256)
  - `server/src/meta/platform/YandexAuthProvider.ts` — Yandex Games SDK (JWT)
  - `server/src/meta/platform/PokiAuthProvider.ts` — Poki SDK
  - `server/src/meta/platform/AuthProviderFactory.ts` — Фабрика провайдеров

  **Core Services (4 новых сервиса):**
  - `server/src/meta/services/MatchmakingService.ts` — Redis queue, FIFO matchmaking, 60s timeout, 2-8 игроков
  - `server/src/meta/services/WalletService.ts` — Транзакции с idempotency, audit trail
  - `server/src/meta/services/ShopService.ts` — Офферы из RuntimeConfig, unlocking items
  - `server/src/meta/services/AdsService.ts` — grantId-based rewards, 5-min TTL

  **HTTP Routes (4 новых роута):**
  - `server/src/meta/routes/matchmaking.ts` — POST /join, /cancel, GET /status
  - `server/src/meta/routes/wallet.ts` — GET /balance, /transactions
  - `server/src/meta/routes/shop.ts` — GET /offers, /unlocked, POST /purchase
  - `server/src/meta/routes/ads.ts` — POST /grant, /claim, GET /grant/:id

  **Интеграции:**
  - AuthService обновлён для использования platform adapters
  - MetaServer инициализирует AuthProviderFactory при старте
  - Все новые роуты добавлены в server.ts

  **Smoke Tests:**
  - Обновлён run-smoke-tests.ps1: 11 тестов (wallet, matchmaking, shop)
  - Тесты покрывают join/cancel queue, balance check, shop offers

  **Ключевые особенности:**
  - **Platform abstraction**: Dev, Telegram, Yandex, Poki готовы
  - **Matchmaking**: Redis-based FIFO queue, processQueue() для создания матчей
  - **Wallet**: Idempotent add/deduct, защита от insufficient balance
  - **Shop**: Интеграция с RuntimeConfig, unlocking skins/currency/battlepass
  - **Ads**: Grant → Show ad → Claim reward workflow

  **Файлы:**
  - Создано 17 новых файлов
  - Изменено 3 файла (AuthService.ts, server.ts, run-smoke-tests.ps1)

- **[ЗАВЕРШЕНО] Stage A - MetaServer Infrastructure (5 января 2025):**
  
  **Создано 13 новых файлов:**
  - `server/src/db/pool.ts` — PostgreSQL и Redis connection pooling
  - `server/src/db/migrate.ts` — Runner для миграций
  - `server/src/db/migrations/001_initial_schema.sql` — Полная схема БД (18 таблиц)
  - `server/src/meta/server.ts` — Главный entry point MetaServer
  - `server/src/meta/services/ConfigService.ts` — Управление RuntimeConfig
  - `server/src/meta/services/AuthService.ts` — Аутентификация (opaque tokens)
  - `server/src/meta/services/PlayerService.ts` — Профили и прогрессия
  - `server/src/meta/middleware/auth.ts` — Middleware для защищенных роутов
  - `server/src/meta/routes/auth.ts` — POST /verify, POST /logout
  - `server/src/meta/routes/config.ts` — GET /runtime
  - `server/src/meta/routes/profile.ts` — GET /, POST /nickname
  - `server/src/meta/README.md` — Quick start guide для разработчиков
  - `tests/smoke/run-smoke-tests.ps1` — Автоматизированные smoke-тесты
  
  **Изменено 2 файла:**
  - `docker/docker-compose.yml` — Добавлены PostgreSQL 16 и Redis 7 с health checks
  - `server/package.json` — Зависимости pg, redis; скрипты dev:meta, db:migrate

  **Ключевые решения:**
  - Opaque tokens вместо JWT (32-byte random, SHA-256 hash, 30-day sessions)
  - Platform-agnostic auth — готов к Telegram/Yandex адаптерам
  - Idempotency через UNIQUE constraints на уровне БД
  - Default RuntimeConfig v1.0.0 с `paymentsEnabled: false`
  
  **Инфраструктура:**
  - Docker: PostgreSQL 16-alpine, Redis 7-alpine с health checks
  - Database: 18 таблиц (users, sessions, profiles, wallets, transactions, player_ratings, battlepass_progress, mission_progress, achievements, daily_rewards, purchase_receipts, social_invites, ab_tests, configs, audit_log, unlocked_items, match_results)
  - API endpoints: /health, /api/v1/auth/*, /api/v1/config/*, /api/v1/profile/*
  - Connection pooling: max 20 connections, 30s idle timeout
  
  **Готово для запуска:**
  ```bash
  docker-compose up postgres redis
  npm run db:migrate
  npm run dev:meta
  ./tests/smoke/run-smoke-tests.ps1
  ```

- **[ЗАВЕРШЕНО] Реорганизация документации Soft Launch:**
  - **Создана структура:** docs/soft-launch/ (9 файлов активной документации v1.5.6)
  - **Архивировано:** docs/archive/ (21 файл устаревших версий)
  - **Добавлены инструкции:** 3 файла в корне для ИИ-агентов (архитектор, кодер, тестировщик)
  - **Пакет документов:** Архитектура v4.2.5 (части 1-4), ТЗ v1.4.7, План v1.0.5, Шаблоны v1.0.1, AI Guides v1.0.1
- **План реализации Soft Launch составлен:** 5 этапов, 40-55 рабочих дней
  - Stage A: Подготовка окружений (PostgreSQL, Redis, MetaServer) — **ЗАВЕРШЕНО (5 января)**
  - Stage B: Функциональный минимум (авторизация, матчмейкинг, экономика) — **ЗАВЕРШЕНО (5 января)**
  - Stage C: Монетизация и LiveOps (конфиги, магазин, реклама, A/B тесты) — **Следующий этап**
  - UI Refactoring: Preact миграция, ScreenManager, HUD оптимизация — 10-12 дней
  - Stage D: Тестирование (smoke, нагрузка, идемпотентность) — 5-7 дней

### Предыдущие работы (v0.2.2)

- **[ИСПРАВЛЕНО ПОЛНОСТЬЮ] Залипание джойстика на мобильных:**
  - **Корневая причина:** `onMouseMove`/`onMouseLeave` обрабатывали compatibility mouse events от браузера на touch-устройствах
  - **Решение:** добавлен `if (isCoarsePointer) return;` в обе функции (строки 4876, 4890)
  - **Backup:** `forceResetJoystickForAbility` теперь сбрасывает `mouseState.active = false` (строка 4912)
- **Мобильный ввод:** блокировка масштабирования (maximum/minimum-scale, user-scalable=no) на время матча; защита от масштабирования жестами.
- **Джойстик (адаптивный):** вынесен в `client/src/input/joystick.ts`, логи по флагу `?debugJoystick=1`.
- **Шаг 1 выполнен:** Собиратель получил `pull` как стартовое умение, `slow` перенесено в общий пул.
- **Шаг 2 выполнен:** Притяжение орбов к пасти (1.9 радиуса от центра), визуализация магнитного поля смещена.
- **Шаг 3 выполнен:** Мышь не активирует джойстик. Управление мышью: курсор задаёт направление движения.
- **Шаг 4 выполнен:** Клик мышью по карточкам умений/талантов, добавлены подсказки.
- **Шаг 5 выполнен:** Баланс движения обновлён: тяга вперёд +1.5x, боковая/ретро и угловая тяга -1.5x.
- **Шаг 6 выполнен:** Награды сундуков - вспышка и всплывающий текст при открытии.
- **Награды сундуков уточнены:** всплывающий текст показывает конкретный талант/усиление.
- **Награды сундуков расширены:** для талантов показывается карточка рядом с описанием и редкостью на пару секунд.
- **Фикс ПК-клика по таланту:** выбор карточки не теряется при частых input-пакетах.
- **Карточки талантов/умений переработаны:** боковые панели без перекрытия центра, выбор не мешает управлению и работает кликом на ПК.
- **Карточки выбора защищены от мелких потерь массы:** скрываются только при крупном уроне.
- **Параметры классов приведены к GDD:** `classes.collector.eatingPowerMult` = 1.25, `classes.collector.radiusMult` = 1, `classes.warrior.biteResistPct` = 0.
- **Замечания ревью учтены:** согласована минимальная масса scatter-орбов, уточнена визуализация пасти и описание тяги.
- **Замечания проверки учтены:** выбор карточек убран из `input`, сброс `pendingLavaScatterMass` при респауне, очищаются `pendingChestRewards`.
- **Исправления интерфейса:** ограничение размера `pendingChestRewards`, вынесены константы визуализации шипов и цветов, общая функция редкости талантов, `chests.onRemove` использует позицию из `chest`, `.claude/` добавлена в `.gitignore`.
- **Отключены неработающие таланты:** `sense`, `regeneration`, `momentum`, `berserk`, `symbiosis`; `turnTorqueNm` = 24000 для всех `slimeConfigs`.
- **Known Issues 11.1-11.4 исправлены:** Сетка ярче + major-линии, поле обзора x2, шипастые препятствия визуально отличаются, мелкие scatter-орбы объединяются (min 5 кг).
- **Все UX улучшения завершены!**
- **Документация синхронизирована:** GDD обновлен до версии 3.3.2.
- **Релиз v0.2 опубликован:** релиз создан, контейнеры отправлены в GHCR.
- **Релиз v0.2.2 опубликован:** контейнеры и release notes обновлены, автоматизация публикации контейнеров включена.
- **Публикация контейнеров v0.2.2:** workflow `Publish Docker Containers` завершился ошибкой 403 при push в GHCR (нужны права на пакеты).

### Документация Soft Launch

- **Активная версия:** v1.5.6 в docs/soft-launch/ (единый источник правды)
- **Архитектура v4.2.5:**
  - Part 1: Клиент, MatchServer, границы модулей (15,066 строк)
  - Part 2: MetaServer, платформенная абстракция, сервисы (9,638 строк)
  - Part 3: События, A/B тесты, безопасность, мониторинг (13,278 строк)
  - Part 4: Приложения A-F — контракты БД, HTTP API, конфигов (34,997 строк)
- **ТЗ:** TZ-SoftLaunch v1.4.7 (15,587 строк)
- **План:** SlimeArena-SoftLaunch-Plan v1.0.5 (11,080 строк)
- **Шаблоны:** Docs-Templates v1.0.1 (5,848 строк)
- **Инструкции для агентов:** AI-Agent-Guides v1.0.1 (6,944 строк)

### Документация игрового прототипа

- **План рефакторинга архитектуры:** `docs/Refactoring-Plan-Claude-Opus-4.5.md` — анализ God Objects и пошаговый план декомпозиции.
- **Выявлены критические проблемы:**
  - `ArenaRoom.ts` — 4,026 строк, 126+ методов
  - `main.ts` — 4,958 строк, смешаны UI/рендеринг/сеть/ввод
  - `config.ts` — 2,982 строки (81% shared-кода)
- **Оценка рефакторинга:** 18-29 рабочих дней, 3 фазы.

### Следующие шаги

1. **Stage A реализации (5-7 дней):**
   - Поднять PostgreSQL и Redis в Docker Compose
   - Создать миграции БД (схема из Архитектуры Part 4, Приложение B)
   - Реализовать MetaServer HTTP API (минимум: auth, config, profile)
   - Настроить smoke-тесты для stage окружения
2. **Открытые вопросы перед началом:**
   - Prisma vs pg для PostgreSQL?
   - JWT vs opaque tokens для сессий?
   - Хранение конфигов: Git файлы vs configs таблица?
3. **Публикация контейнеров v0.2.2:** выдать права `packages: write` для `GITHUB_TOKEN` (если потребуется).
4. **Рефакторинг прототипа (Фаза 0):** типизация систем сервера, удаление дублирования mathUtils.
