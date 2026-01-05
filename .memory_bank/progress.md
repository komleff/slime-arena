# Progress
Отслеживание статуса задач.

## Контроль изменений
- **last_checked_commit**: 75dc235 (feature/ui-refactoring) @ 5 января 2026
- **Текущая ветка**: feature/ui-refactoring
- **Релиз игрового прототипа:** v0.2.2
- **GDD версия**: v3.3.2
- **Документация Soft Launch**: v1.5.6
- **Stage A+B+C MetaServer**: ЗАВЕРШЕНО, merged to main (PR #31)
- **UI Refactoring**: Phase 1 (Components) + все Copilot Review Fixes завершены
- **Резюме**: PR #32 готов к merge. Phase 2 (Integration with main.ts) — следующий этап.

## Последние изменения (5 января 2026)

### UI Refactoring — All Copilot Review Fixes (PR #32)

**Исправлено (все 14 комментариев Copilot):**

1. ✅ vite.config.ts: удалён конфликтующий esbuild.jsx* конфиг
2. ✅ ScreenManager.tsx: replaceState вместо pushState (fix history accumulation)
3. ✅ ScreenManager.tsx: Safe Area CSS с max() fallbacks
4. ✅ DRY: создана утилита `utils/injectStyles.ts`, обновлены 6 компонентов
5. ✅ gameState.ts: memory leak fix (cleanup function)
6. ✅ UIBridge.tsx: null-safe checks для sync functions
7. ✅ **CRITICAL: FLAG_IS_DEAD = 16 (1<<4), не 4** — исправлен баг
8. ✅ parseFloat вместо parseInt для safe-area-inset (High DPI)
9. ✅ useMemo для cooldown вычислений в AbilityButtons
10. ✅ DRY: CLASSES_DATA вынесены в `data/classes.ts`
11. ✅ CSS variables для динамических цветов классов
12. ✅ Проверка e.target instanceof HTMLInputElement в MainMenu
13. ✅ Math.ceil для последней секунды в таймере способности

**Новые файлы:**

- `client/src/ui/utils/injectStyles.ts` — DRY утилита для CSS
- `client/src/ui/data/classes.ts` — централизованные данные классов (DRY)

### UI Refactoring — Phase 1: Components (ЗАВЕРШЕНО)

**Установлено:**
- `preact` (10.x) — минималистичный React-совместимый фреймворк
- `@preact/signals` — реактивное состояние без Redux

**Созданные файлы (8):**
1. `client/src/ui/signals/gameState.ts` (~280 строк)
   - Глобальное состояние через Preact Signals
   - gamePhase, localPlayer, leaderboard, matchTimer, talentChoices
   - abilityCooldowns, activeBoost, matchResults
   - Actions: setGamePhase, updateLocalPlayer, setTalentChoices и др.

2. `client/src/ui/screens/ScreenManager.tsx` (~300 строк)
   - Stack-based navigation с CSS-анимациями
   - Modal overlay с backdrop blur
   - Hardware back button (popstate) support
   - registerScreen, navigateTo, showModal API

3. `client/src/ui/components/GameHUD.tsx` (~260 строк)
   - Throttled updates 10 Hz (vs 60 Hz canvas)
   - Player stats, leaderboard mini-table
   - Boost panel, death overlay

4. `client/src/ui/components/AbilityButtons.tsx` (~250 строк)
   - SVG cooldown progress circles
   - Pulse animation when ready
   - Touch-friendly sizing

5. `client/src/ui/components/TalentModal.tsx` (~200 строк)
   - Talent cards with rarity colors
   - Timer display, keyboard hints
   - Queue indicator

6. `client/src/ui/components/ResultsScreen.tsx` (~280 строк)
   - Final leaderboard, personal stats
   - Class selection for next match
   - Play again / exit buttons

7. `client/src/ui/components/MainMenu.tsx` (~260 строк)
   - Name input (localStorage persistence)
   - Class selection grid
   - Connection status indicator

8. `client/src/ui/UIBridge.tsx` (~200 строк)
   - Bridge between Canvas game and Preact UI
   - sync* functions for state updates
   - UICallbacks interface for events

9. `client/src/ui/index.ts` — central exports

**Изменённые файлы (3):**
- `client/package.json` — dependencies: preact, @preact/signals
- `client/vite.config.ts` — esbuild JSX config (jsxFactory: 'h')
- `client/tsconfig.json` — jsx: "react-jsx", jsxImportSource: "preact"

**Статус:**
- ✅ Сборка: `npm run build` проходит
- ✅ Коммит: 2019135
- ⏳ Следующий шаг: Интеграция UIBridge с main.ts

---

## Предыдущие изменения (5 января 2026)

### Stage A+B+C — MetaServer Infrastructure (MERGED)

**RuntimeConfig Management (расширение ConfigService):**
- Полный CRUD для config versions (draft → active → archived)
- listConfigs, updateConfig, archiveConfig, deleteConfig, cloneConfig
- validateConfig с детальными ошибками валидации
- Admin HTTP API: /api/v1/config/admin/*

**A/B Testing Infrastructure (2 файла):**
- ABTestService (300+ строк):
  - createTest с variants и weights validation
  - Deterministic assignment по SHA-256(userId:testId)
  - trackConversion с event_type и event_value
  - getTestStats с conversion rates per variant
  - Test lifecycle: draft → active → paused → completed
- abtest.ts routes:
  - User: GET /assignments, /assignment/:testId, POST /conversion
  - Admin: list, create, update state, stats, delete

**Payment Providers (4 файла):**
- IPaymentProvider interface:
  - createInvoice, verifyPayment, refundPayment, getPaymentStatus
- TelegramStarsProvider (Telegram Bot Payments API):
  - XTR currency (Telegram Stars)
  - Pre-checkout query handling
  - refundStarPayment support
- YandexPayProvider (YooKassa API):
  - RUB currency
  - Webhook handling (payment.succeeded, payment.canceled)
  - Idempotence-Key для безопасности
- PaymentProviderFactory:
  - Auto-init по env vars (TELEGRAM_BOT_TOKEN, YANDEX_SHOP_ID)
  - getAvailableProviders() для UI

**Analytics Service (2 файла):**
- AnalyticsService (250+ строк):
  - Buffer-based tracking (flush каждые 30s или 100 events)
  - 25+ предопределённых EventTypes
  - queryEvents с фильтрацией
  - getStats с группировкой (hour/day/week)
  - Graceful shutdown с финальным flush
- analytics.ts routes:
  - User: POST /track, /batch, GET /event-types
  - Admin: GET /admin/query, /admin/stats, POST /admin/flush

**HTTP Routes Stage C (3 роута):**
- configAdmin.ts: 9 endpoints для config management
- payment.ts: 6 endpoints + 2 webhooks
- analytics.ts: 6 endpoints

**Database Migration:**
- 002_stage_c_monetization.sql:
  - ab_tests: полная структура с variants JSONB
  - ab_test_conversions: трекинг конверсий
  - analytics_events: события с properties JSONB
  - purchase_receipts: обновлённая структура

**Smoke Tests:**
- meta-stage-c.test.ts: 15+ тестов покрывающих все Stage C endpoints

**Файлы Stage C:**
- Создано: 12 новых файлов
- Изменено: 4 файла

**Оценка vs факт:** Stage C оценён в 8-10 дней, реализован за 1 сессию.

### Stage B - Core Services (ЗАВЕРШЕНО)

**Platform Adapters (6 файлов):**
- IAuthProvider: Интерфейс для платформенной авторизации
- DevAuthProvider: Dev-режим (userId:nickname формат)
- TelegramAuthProvider: Telegram Mini App (HMAC-SHA256 signature validation)
- YandexAuthProvider: Yandex Games SDK (JWT parsing, placeholder signature check)
- PokiAuthProvider: Poki SDK (player_id based)
- AuthProviderFactory: Фабрика провайдеров с автоинициализацией

**Core Services (4 сервиса):**
- MatchmakingService (228 строк):
  - Redis ZSET-based queue (sorted by timestamp)
  - FIFO matchmaking: 2-8 игроков per match
  - 60-second timeout для requests
  - processQueue() для создания матчей
  - Match assignment: roomId, roomHost, roomPort, matchId
- WalletService (256 строк):
  - Idempotent add/deduct currency (soft/hard)
  - Balance checks перед deduct
  - Transaction history (50 items limit)
  - Audit trail для всех операций
- ShopService (166 строк):
  - Offers из RuntimeConfig.shop.offers
  - Purchase: deduct currency → unlock item/grant currency/enable battlepass
  - Idempotency через transactions table
  - getUnlockedItems() по типу
- AdsService (133 строки):
  - generateGrant() перед показом рекламы
  - grantId TTL: 5 минут (Redis)
  - claimReward() после просмотра (idempotent)
  - Rewards: soft/hard currency или items

**HTTP Routes (4 роута):**
- /api/v1/matchmaking:
  - POST /join — добавить в очередь
  - POST /cancel — покинуть очередь
  - GET /status — статус и позиция в очереди
- /api/v1/wallet:
  - GET /balance — текущий баланс
  - GET /transactions — история транзакций
- /api/v1/shop:
  - GET /offers — доступные офферы
  - POST /purchase — купить за валюту
  - GET /unlocked — разблокированные items
- /api/v1/ads:
  - POST /grant — создать grant перед показом
  - POST /claim — claim reward после просмотра
  - GET /grant/:grantId — статус grant

**Интеграции:**
- AuthService.verifyAndCreateSession() использует IAuthProvider.verifyToken()
- MetaServer инициализирует AuthProviderFactory при старте
- Environment variables: TELEGRAM_BOT_TOKEN, YANDEX_APP_ID

**Smoke Tests (обновлено до 11 тестов):**
- Wallet balance check
- Matchmaking: join → status → cancel
- Shop offers list
- Сохранены Stage A тесты: health, config, auth, profile, idempotency

**Технические решения:**
- **Platform abstraction**: Провайдеры выбираются по platformType (dev/telegram/yandex/poki)
- **Matchmaking**: Redis ZSET для FIFO, match assignments хранятся 5 минут
- **Wallet**: PostgreSQL transactions для atomicity, idempotency ключ: (user_id, operation_id)
- **Shop**: Офферы из RuntimeConfig → гибкость для LiveOps
- **Ads**: Grant-based flow предотвращает reward farming

**Файлы:**
- Создано 17 новых файлов
- Изменено 3 файла (AuthService.ts, server.ts, run-smoke-tests.ps1)

**Оценка vs факт:** Stage B оценен в 12-15 дней, реализован за 1 сессию (вместе с Stage A).

### Stage A - MetaServer Infrastructure (ЗАВЕРШЕНО)

**Инфраструктура и БД:**
- Docker Compose: PostgreSQL 16-alpine, Redis 7-alpine с health checks и persistent volumes
- Database schema: 18 таблиц согласно Architecture v4.2.5 Part 4 Appendix B
  - Core: users, sessions, profiles, wallets
  - Economy: transactions (с idempotency через UNIQUE constraints), unlocked_items
  - Progression: battlepass_progress, mission_progress, achievements, daily_rewards
  - Ratings: player_ratings (Glicko-2: rating, rd, sigma)
  - Monetization: purchase_receipts
  - Social: social_invites, ab_tests
  - System: configs (RuntimeConfig versions), audit_log, match_results
- Миграционная система: runner с поддержкой .sql файлов
- Connection pooling: PostgreSQL (max 20), Redis client

**MetaServer HTTP API:**
- Express.js 4.18 + CORS
- Endpoints:
  - GET /health — health check
  - POST /api/v1/auth/verify — платформенная аутентификация
  - POST /api/v1/auth/logout — revoke сессии
  - GET /api/v1/config/runtime — получить активную RuntimeConfig
  - GET /api/v1/profile — профиль игрока (требует auth)
  - POST /api/v1/profile/nickname — обновить никнейм (idempotent)
- Auth middleware: Bearer token validation
- Graceful shutdown handlers

**Сервисы:**
- ConfigService: Управление версиями RuntimeConfig, atomic activation
- AuthService: Opaque token auth (32-byte random, SHA-256 hash, 30-day sessions), platform-agnostic
- PlayerService: Profile management, nickname updates, XP progression

**Технические решения:**
- **Opaque tokens** вместо JWT: проще, revocable, соответствует Architecture
- **Platform abstraction**: готово к адаптерам Telegram, Yandex, Poki
- **Idempotency**: UNIQUE constraints на (user_id, operation_id) в transactions
- **Default RuntimeConfig**: v1.0.0 с paymentsEnabled: false

**Тестирование:**
- PowerShell smoke tests: 6 test cases (health, config, auth, profile, nickname update, idempotency)
- Bash-версия smoke tests

**Документация:**
- server/src/meta/README.md — Quick start guide (Docker, migrations, API, development workflow)
- tests/smoke/README.md — Manual test instructions + curl examples

**Файлы:**
- Создано 13 новых файлов
- Изменено 2 файла (docker-compose.yml, server/package.json)

**Готово для запуска:**
```bash
docker-compose up postgres redis
npm run db:migrate
npm run dev:meta
./tests/smoke/run-smoke-tests.ps1
```

**Оценка vs факт:** Stage A оценен в 5-7 дней, реализован за 1 сессию.

### Реорганизация документации Soft Launch

- **Создана структура docs/soft-launch/:** 9 файлов активной документации пакета v1.5.6
  - Архитектура v4.2.5 (части 1-4): 72,979 строк суммарно
  - ТЗ v1.4.7: 15,587 строк
  - План v1.0.5: 11,080 строк
  - Шаблоны v1.0.1: 5,848 строк
  - AI Agent Guides v1.0.1: 6,944 строк
  - Индекс v1.5.6: 2,448 строк
- **Архивированы устаревшие версии:** 21 файл перемещен в docs/archive/
  - TZ-SoftLaunch v1.0 (25,981 строк — оригинальная версия)
  - Старые архитектуры: v1.4, v1.5, v3.3
  - Старые GDD: v2.3, v2.4, v2.5
  - Устаревшие планы: v1.7, v1.8, v3.3
  - Специализированные документы: AlbumDB, Flight TZ, UI Screens
- **Добавлены инструкции для ИИ-агентов:** 3 файла в корне проекта
  - Инструкция для ИИ-агента-архитектора.md (6,653 строк)
  - Инструкция для ИИ-агента-кодера.md (11,760 строк)
  - Инструкция для ИИ-агента-тестировщика.md (14,198 строк)

### План реализации Soft Launch (составлен)

- **Общая оценка:** 40-55 рабочих дней, 5 этапов
- **Stage A — Подготовка окружений (P0, 5-7 дней):**
  - Docker Compose: PostgreSQL, Redis
  - Миграции БД
  - MetaServer (минимальный HTTP API)
  - Smoke-тесты для stage
- **Stage B — Функциональный минимум (P0, 12-15 дней):**
  - Платформенная абстракция (IAuthProvider, IAdsProvider, IPaymentProvider)
  - Авторизация и профиль
  - Матчмейкинг (очередь, назначение, подключение)
  - Завершение матча и экономика
- **Stage C — Монетизация & LiveOps (P1, 8-10 дней):**
  - Система конфигураций (RuntimeConfig с версионированием)
  - Магазин (офферы, покупки за валюту)
  - Реклама с наградой (grantId-based)
  - A/B тесты (детерминированное назначение вариантов)
- **UI Refactoring (P0 частично, 10-12 дней):**
  - Preact миграция
  - ScreenManager (стек экранов, модальные окна)
  - HUD оптимизация (обновления 5-10 Hz)
  - Safe-area и кнопка "назад"
- **Stage D — Тестирование (P0, 5-7 дней):**
  - Smoke-тесты критических путей
  - Идемпотентность операций экономики
  - Нагрузочные тесты (targetCCU=500, RPS=100)

### Ключевые решения

- **Рейтинг:** Glicko-2 (initialRating=1500, initialRD=350, initialSigma=0.06)
- **Матчмейкинг:** Боты разрешены (botsPerMatch=1, botRatingStrategy=median, botsAffectRating=false)
- **Реальные платежи:** Отключены на этапе софт-лонча (features.json → paymentsEnabled=false)
- **Устойчивость:** reconnectWindowMs=15000, summaryTTL=86400000
- **Целевая нагрузка:** CCU=500, playersPerRoom=10, targetRooms=60

### Предыдущие изменения (v0.2.2)

- **Выпуск v0.2.2:** полная история изменений добавлена в README (с v0.2), исправления мобильного управления и CI/CD, контейнеры готовы к публикации в GHCR через GitHub Actions.
- **[P0 FIX] Залипание джойстика при активации умений (ПОЛНОЕ ИСПРАВЛЕНИЕ):** Корневая причина - браузеры генерируют compatibility mouse events на touch-устройствах, активируя `mouseState`. Решение: добавлен `if (isCoarsePointer) return;` в `onMouseMove` и `onMouseLeave`; `forceResetJoystickForAbility` теперь сбрасывает `mouseState.active = false`.
- **Улучшение управления (Counter-acceleration):** Реализована система контр-ускорения для джойстика, добавлены TypeScript-типы (PR #30).
- **Исправления мобильного управления (PR #29):** P0 Fix залипания кнопок умений, игнорирование mouse-событий на touch-устройствах, защита от сенсорного ввода, модульный джойстик.
- **Автоматизация Docker:** добавлены workflow для сборки и публикации образов в GHCR, плюс ручной перевод пакетов в public.
- **План рефакторинга архитектуры (Claude Opus 4.5):** Проведён анализ God Objects, создан `docs/Refactoring-Plan-Claude-Opus-4.5.md`. Выявлены критические проблемы: `ArenaRoom.ts` (4,026 строк), `main.ts` (4,958 строк), `config.ts` (2,982 строки). Оценка: 18-29 рабочих дней, 3 фазы.
- **Мобильный ввод:** блокировка масштабирования (maximum/minimum-scale, user-scalable=no) на время матча; защита от масштабирования жестами; защита от сенсорного ввода для кнопок умений.
- **Диагностика мобильного джойстика:** добавлены отладочные логи pointer/resize/visibility и кликов умений (флаг `?debugJoystick=1`).
- **Релиз v0.2:** публикация релиза и контейнеров в GHCR, ссылки добавлены в README.
- **Шаг 1:** Собиратель получил `pull` как стартовое умение, `slow` перенесено в общий пул карточек.
- **Шаг 2:** Притяжение орбов к пасти (getMouthPoint: 1.9 радиуса), визуализация смещена.
- **Шаг 3:** Мышь не активирует джойстик. Управление ПК: курсор задаёт направление.
- **Шаг 4:** Клик мышью по карточкам умений/талантов, добавлены подсказки.
- **Шаг 5:** Баланс движения обновлён: тяга вперёд +1.5x, боковая/ретро и угловая тяга -1.5x.
- **Шаг 6:** Награды сундуков - вспышка и всплывающий текст (с названием награды/таланта).
- **Награды сундуков:** при таланте показывается карточка рядом с описанием и редкостью на пару секунд.
- **Фикс ПК-клика по таланту:** выбор карточки не теряется при частых input-пакетах.
- **Карточки талантов/умений:** выбор вынесен в боковые панели и не мешает управлению; клик мышью на ПК работает.
- **Карточки выбора:** скрываются только при крупной потере массы, мелкие потери не сворачивают.
- **Параметры классов:** приведены к GDD (collector: `eatingPowerMult` = 1.25, `radiusMult` = 1; warrior: `biteResistPct` = 0).
- **Замечания ревью:** минимальная масса scatter-орбов согласована, исправлена визуализация точки притяжения.
- **Замечания проверки:** выбор карточек убран из `input`, сбрасывается `pendingLavaScatterMass`, очищаются `pendingChestRewards`.
- **Интерфейс и эффекты:** ограничение размера `pendingChestRewards`, вынесены константы шипов и цветов, общая функция редкости талантов, `chests.onRemove` использует позицию из `chest`, `.claude/` добавлена в `.gitignore`.
- **Баланс:** отключены неработающие таланты `sense`, `regeneration`, `momentum`, `berserk`, `symbiosis`; `turnTorqueNm` = 24000 для всех `slimeConfigs`.
- **Known Issues 11.1-11.4:** Сетка ярче, поле обзора x2, шипастые препятствия с шипами и ⚠, scatter-орбы min 5 кг.
- **Документация:** GDD обновлен до версии 3.3.2 (все документы синхронизированы).

## Открытые задачи (feat/ux-improvements)
- [x] Шаг 1: Собиратель — смена умения.
- [x] Шаг 2: Притяжение орбов к пасти.
- [x] Шаг 3: Отключение джойстика для мыши.
- [x] Шаг 4: Клик мышкой по карточкам.
- [x] Шаг 5: Базовая тяга и угловой момент x2.
- [x] Шаг 6: Награды сундуков.
- [x] Known Issue 11.1: Сетка ярче + major-линии.
- [x] Known Issue 11.2: Поле обзора x2.
- [x] Known Issue 11.3: Шипастые препятствия с визуальными шипами.
- [x] Known Issue 11.4: Scatter-орбы min 5 кг.

**Все UX-улучшения и Known Issues завершены!**

## Открытые задачи (Soft Launch — Stage A)

- [x] Поднять PostgreSQL и Redis в Docker Compose
- [x] Создать миграции БД (схема из Архитектуры v4.2.5 Part 4, Appendix B)
- [x] Реализовать MetaServer структуру (routes, services, db)
- [x] Реализовать минимальные маршруты HTTP API (auth/verify, config/runtime, profile)
- [x] Настроить резервное копирование PostgreSQL для stage (через volume persistence)
- [x] Написать smoke-тесты для критических маршрутов
- [x] **Решить открытые вопросы:**
  - [x] Prisma vs pg для PostgreSQL? (Выбрано: pg)
  - [x] JWT vs opaque tokens для сессий? (Выбрано: opaque tokens)
  - [x] Хранение конфигов: Git файлы vs configs таблица? (Выбрано: configs table + versioning)

## Открытые задачи (Soft Launch — Stage B)

- [x] Платформенная абстракция (IAuthProvider)
- [x] Реализация провайдеров (Dev, Telegram, Yandex, Poki)
- [x] Сервис матчмейкинга (Redis queue)
- [x] Сервис кошелька и транзакций
- [x] Сервис магазина и инвентаря
- [x] Сервис рекламы (Grants)

## Открытые задачи (Soft Launch — Stage C)

- [x] Управление конфигурациями (RuntimeConfig CRUD)
- [x] A/B тестирование (Service + API)
- [x] Платёжные провайдеры (Telegram Stars, Yandex Pay)
- [x] Аналитика (Service + API)
- [x] Admin API для управления

## Открытые задачи (UI Refactoring)

- [x] Настройка Preact + Vite
- [x] ScreenManager implementation
- [x] HUD Refactoring
- [x] Main Menu Refactoring
- [ ] Интеграция UIBridge в main.ts
- [ ] Удаление устаревшего DOM-кода
- [ ] Тестирование на мобильных устройствах

## Открытые задачи (рефакторинг игрового прототипа)

- [ ] Фаза 0.1: Типизация систем сервера (`room: any` → интерфейс)
- [ ] Фаза 0.2: Удаление дублирования mathUtils
- [ ] Фаза 1.1: Извлечение UI-компонентов из main.ts
- [ ] Фаза 1.2: Централизация стилей
- [ ] Фаза 2.1: Извлечение AbilityManager из ArenaRoom
- [ ] Фаза 2.2: Извлечение CombatManager из ArenaRoom
- [ ] Фаза 3.1: Разделение config.ts на модули
