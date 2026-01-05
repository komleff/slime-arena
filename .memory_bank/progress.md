# Progress
Отслеживание статуса задач.

## Контроль изменений
- **last_checked_commit**: docs/soft-launch-prep @ 5 января 2026
- **Текущая ветка**: docs/soft-launch-prep
- **Релиз игрового прототипа:** v0.2.2
- **GDD версия**: v3.3.2
- **Документация Soft Launch**: v1.5.6
- **Stage A MetaServer**: ЗАВЕРШЕНО (5 января 2026)
- **Резюме**: Stage A реализован — PostgreSQL, Redis, MetaServer с базовым HTTP API.

## Последние изменения (5 января 2026)

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

- [ ] Поднять PostgreSQL и Redis в Docker Compose
- [ ] Создать миграции БД (схема из Архитектуры v4.2.5 Part 4, Appendix B)
- [ ] Реализовать MetaServer структуру (routes, services, db)
- [ ] Реализовать минимальные маршруты HTTP API (auth/verify, config/runtime, profile)
- [ ] Настроить резервное копирование PostgreSQL для stage
- [ ] Написать smoke-тесты для критических маршрутов
- [ ] **Решить открытые вопросы:**
  - [ ] Prisma vs pg для PostgreSQL?
  - [ ] JWT vs opaque tokens для сессий?
  - [ ] Хранение конфигов: Git файлы vs configs таблица?

## Открытые задачи (рефакторинг игрового прототипа)

- [ ] Фаза 0.1: Типизация систем сервера (`room: any` → интерфейс)
- [ ] Фаза 0.2: Удаление дублирования mathUtils
- [ ] Фаза 1.1: Извлечение UI-компонентов из main.ts
- [ ] Фаза 1.2: Централизация стилей
- [ ] Фаза 2.1: Извлечение AbilityManager из ArenaRoom
- [ ] Фаза 2.2: Извлечение CombatManager из ArenaRoom
- [ ] Фаза 3.1: Разделение config.ts на модули
