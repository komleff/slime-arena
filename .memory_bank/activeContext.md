# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**База:** main (9 января 2026)
**Релиз:** v0.4.0
**GDD версия:** 3.3.2
**Текущая ветка:** main
**Soft Launch Status:** ✅ READY (6/6 критериев выполнено)

### Фокус сессии

- **[ЗАВЕРШЕНО] PR #61-66: Ads Documentation Improvements (MERGED):**
  - ✅ PR #61: Устранить англицизм "dev-платформы" → "платформы разработки"
  - ✅ PR #62: Добавить русский перевод для parameter placement в JSDoc
  - ✅ PR #63: Добавить русский перевод для "rewarded video" → "(рекламы с вознаграждением)"
  - ✅ PR #64: Добавить русский перевод для "preload API" → "(API предварительной загрузки)"
  - ✅ PR #65: Добавить русский перевод для placement в adsService.ts
  - ✅ PR #66: Добавить русский перевод для placement в IAdsProvider/adsService

- **[ЗАВЕРШЕНО] Sprint 11.2: TalentSystem Integration (PR #57 MERGED):**
  - ✅ slime-arena-eg7 — ArenaRoom refactoring (−418 строк)
  - ✅ recalculateTalentModifiers → делегация в модуль
  - ✅ generateTalentCard → делегация в модуль
  - ✅ Удалены дубли: getTalentConfig, buildAbilityUpgradeId, parseAbilityUpgradeId

- **[ЗАВЕРШЕНО] Sprint 11: Tech Debt Refactoring (PR #56 MERGED):**
  - ✅ 11.1: slime-arena-dm5 — Daemon hooks (auto-commit, auto-push)
  - ✅ 11.2: slime-arena-foh — HUD frequency sync (убран forceUpdate)
  - ✅ 11.3: InputManager module created (558 строк)
  - ✅ 11.4: TalentSystem module created

- **[НА MERGE] Sprint 11.3: InputManager Integration (PR #58):**
  - ✅ slime-arena-38q — main.ts refactoring (−416 строк)
  - ✅ InputManager интегрирован в main.ts
  - ✅ Удалены: keyState, mouseState, hasFocus, computeMoveInput, event handlers
  - ✅ Добавлены: mouseDeadzone/mouseMaxDist в deps, resetInputState() method
  - ✅ Исправлен приоритет ввода: joystick > mouse > keyboard (agar.io style)
  - ✅ Copilot Review: 2 раунда, все замечания исправлены

- **[ЗАВЕРШЕНО] PR #55: levelThresholds fallback fix (MERGED):**
  - ✅ setLevelThresholds merge logic (сохраняет переданные + дополняет из defaults)
  - ✅ getLevelProgress защита от пустого конфига и экстраполяция
  - ✅ Сохранение массивов длиннее defaults (Copilot suggestion)

- **[ЗАВЕРШЕНО] Sprint 10: Pre-Launch Fixes (PR #54 + commit 7804a12):**
  - ✅ 10.1: slime-arena-8yz — имя обновляется при replay (CLOSED)
  - ✅ 10.2: slime-arena-6hn — LEVEL_THRESHOLDS из balance.json (CLOSED)
  - ✅ 10.3: PR #54 merged, review fixes в commit 7804a12
  - ✅ 10.4: Убраны `as any` в ArenaRoom.ts (P3)
  - ✅ 10.5: Runtime config через сигнал levelThresholds (P2)

- **[BACKLOG] A/B Testing System (Epic slime-arena-5qa):**
  - 📋 ТЗ: docs/soft-launch/TZ-ABTesting-ClaudeOpus-v1.3.md
  - 📋 Зависимые: slime-arena-4p4 (match integration), slime-arena-1wl (metrics)
  - ❌ slime-arena-g5s закрыт как дубль (покрыт в ТЗ Фаза 2)
  - Фазы: MVP → Расширение → Масштабирование

- **[ЗАВЕРШЕНО] Sprint 9: Architect Analysis (Soft Launch Readiness):**
  - ✅ Анализ SlimeArena-SoftLaunch-Plan-v1.0.5.md
  - ✅ 6/6 обязательных критериев выполнено
  - ✅ Создано 3 A/B Mobile Controls задачи для post-launch
  - ❌ Beads MCP Server (blocked: нет /plugin команд в Claude Code)

- **[ЗАВЕРШЕНО] Sprint 8: joinToken JWT Validation (PR #52):**
  - ✅ 8.1: JoinTokenService — генерация и верификация JWT токенов
  - ✅ 8.2: ArenaRoom.onAuth() — валидация joinToken перед подключением
  - ✅ 8.3: verifyTokenForRoom() — проверка соответствия roomId
  - ✅ 8.4: Fail-fast в production без секрета (JOIN_TOKEN_SECRET)
  - ✅ 8.5: TTL sync между токенами и match assignments
  - ✅ 8.6: POST /matchmaking/joined — очистка assignment после подключения
  - ✅ 8.7: maskUserId() — защита PII в логах
  - ✅ 8.8: AI Review — 4 раунда (Opus, Codex, Gemini, Copilot)
  - ✅ 8.9: Все P1/P2 замечания исправлены

- **[ЗАВЕРШЕНО] Sprint 7: Legacy DOM Cleanup (PR #50 MERGED):**
  - ✅ 7.1: Удалён Join Screen (~280 строк) — Preact MainMenu
  - ✅ 7.2: Удалён Results overlay (~100 строк) — Preact ResultsScreen
  - ✅ 7.3: Удалены legacy функции (syncClassCards, syncResultsClassButtons, updatePlayButton)
  - ✅ 7.4: Упрощён setClassSelectMode — убраны legacy DOM манипуляции
  - ✅ 7.5: Удалены boostPanel, topCenterHud, matchTimer, killCounter
  - ✅ 7.6: Удалён levelIndicator и updateLevelIndicator
  - ✅ 7.7: selectedClassId унифицирован на -1 (signal + local)
  - ✅ 7.8: syncBoost с isChargeBased для guard/greed
  - ✅ 7.9: MainMenu auto-select random class
  - ✅ 7.10: PR #50 merged (-1119 строк)

- **[ЗАВЕРШЕНО] Sprint 6: LAN Mobile Access Fix (PR #49 MERGED):**
  - ✅ 6.1: Диагностика P0 бага — мобильные устройства в LAN не подключаются
  - ✅ 6.2: Корневая причина: MetaServer не указывал host при `app.listen(PORT)`
  - ✅ 6.3: Исправлен `server/src/meta/server.ts` — добавлен `HOST = '0.0.0.0'`
  - ✅ 6.4: Обновлён README.md — добавлены переменные `META_HOST` и `HOST`

- **[ЗАВЕРШЕНО] Sprint 5: Docker Monolith Build v0.3.3:**
  - ✅ 5.1: Синхронизация версий (D-01) — все package.json обновлены до 0.3.3
  - ✅ 5.2: Создан .dockerignore для оптимизации сборки
  - ✅ 5.3: Обновлён monolith.Dockerfile (multi-stage production build, HEALTHCHECK)
  - ✅ 5.4: Обновлён docker-compose.monolith.yml (production-ready)
  - ✅ 5.5: Обновлён CI/CD workflow (publish-containers.yml + monolith)
  - ✅ 5.6: Исправлен Vite env types (vite-env.d.ts, убран @ts-expect-error)
  - ✅ 5.7: TypeScript build проходит
  - ✅ 5.8: Исправлен ESM/CommonJS module mismatch (shared → CommonJS)
  - ✅ 5.9: Исправлены пути к серверным entry points в Dockerfile
  - ✅ 5.10: Исправлен путь к config/balance.json (копия в server/dist/config)
  - ✅ 5.11: Локальное тестирование — все 3 сервиса работают, HEALTHCHECK passed
  - ⏳ 5.12: PR merge, tag v0.3.3, GHCR release

- **[ЗАВЕРШЕНО] v0.3.1: Docker Infrastructure & Stability Release:**
  - ✅ Релиз v0.3.1 опубликован на GitHub.
  - ✅ Docker-образы v0.3.1 опубликованы в GHCR.
  - ✅ Разделение MetaServer и MatchServer в Docker Compose.
  - ✅ Универсальное определение IP-адреса для доступа в локальной сети.
  - ✅ Исправление ошибок компиляции TypeScript в `ArenaRoom.ts` (strict mode).
  - ✅ Исправление путей импорта в `shared` для совместимости с CommonJS/ESM.
  - ✅ Идемпотентные миграции БД для стабильного перезапуска контейнеров.

- **[ЗАВЕРШЕНО] Sprint 4: Backup/Restore Implementation (PR #47 MERGED):**
  - ✅ 4.1: Создан `scripts/backup.ps1` — Windows backup (pg_dump)
  - ✅ 4.2: Создан `scripts/backup.sh` — Linux/macOS backup
  - ✅ 4.3: Создан `scripts/restore.ps1` — Windows restore (pg_restore)
  - ✅ 4.4: Создан `scripts/restore.sh` — Linux/macOS restore
  - ✅ 4.5: Создана документация `docs/operations/backup-restore.md`
  - ✅ 4.6: Обновлён `.gitignore` (backups/*.dump)
  - ✅ Проверка восстановления на stage: **19/19 тестов пройдены после restore**
  - ✅ Нагрузочное тестирование: **CCU 500 (87k requests, 0% errors)**

- **[ЗАВЕРШЕНО] Sprint 3: Stage D Testing (PR #43 MERGED):**
  - ✅ 3.1: Исправлен X-2 (API mismatch в тестах — platformType/platformAuthToken)
  - ✅ 3.2: Созданы Stage D smoke тесты (`server/tests/meta-stage-d.test.ts`)
  - ✅ 3.3: Созданы тесты идемпотентности (включены в Stage D)
  - ✅ 3.4: Созданы k6 load тесты (`tests/load/soft-launch.js`)
  - ✅ 3.5: AI Review Hotfix (T-01 to T-09 + UUID) — 10 дефектов исправлено
  - ✅ 3.6: Stage D Validation — 19/19 тестов пройдены

- **[ЗАВЕРШЕНО] Sprint 2: MatchServer → MetaServer Integration:**
  - ✅ Sprint 2.0: Исправлен X-1 blocker (lazy initialization для всех DB сервисов)
  - ✅ Sprint 2.1: Создан MatchResultService (`server/src/services/MatchResultService.ts`)
  - ✅ Sprint 2.2: Создан /match-results endpoint (`server/src/meta/routes/matchResults.ts`)
  - ✅ Sprint 2.3: Интегрирован в ArenaRoom.endMatch()
  - ✅ Sprint 2.4: D-01 Hotfix (schema mismatch)
  - ✅ Sprint 2.5: P1 Improvements (idempotency race, retry, timing-safe)
  - ⏳ joinToken validation — отложено

- **[ЗАВЕРШЕНО] Mobile Controls & Flight Assist Tuning (PR #39):**
  - Настроены параметры Virtual Joystick (deadzone, sensitivity, followSpeed)
  - Настроены параметры Flight Assist для всех 4 классов (yaw, counter-acceleration, angular braking)
  - Увеличен глобальный angularDragK для лучшего гашения угловых колебаний
  - **[NEW] Multitouch support:** onClick → onPointerDown + pointerId для одновременного движения и способностей
  - **[NEW] Input lag fix:** Способности активируются по pointerdown вместо click
  - Ожидаемое улучшение: -20% время выравнивания курса, -20% боковой занос

- **[В РАБОТЕ] Mobile Controls A/B Plan + Config:**
  - Обновлён план в `docs/soft-launch/Sprint-Next-Mobile-Controls-Plan.md` (A/B варианты и switching)
  - Добавлен шаблон конфигурации `config/experiments/mobile-controls-ab.json`
  - README дополнен ссылками на план и конфиг

- **Приоритет тестовых устройств:** Telegram (все платформы) > мобильные телефоны > планшеты с тач-скрином > браузеры компьютера (мышь/клавиатура) > гибридные устройства (низкий приоритет).
- **Наблюдение:** при плавном круговом движении джойстика возможны краткие провалы отклика (слейм отстаёт и пытается повернуть в другую сторону) — требуется анализ частоты опроса, порогов и логики yaw.

- **[НА ПРОВЕРКЕ] UI Known Issues v0.3.0 Fixes (PR #37):**

  **Исправлено 15 issues:**
  - ✅ P0: Кнопки умений — динамические иконки, фильтрация слотов, синхронизация кулдаунов
  - ✅ P1: ResultsScreen — кубок победителя, иконки классов в рейтинге, порядок статистики
  - ✅ P1: Тексты кнопок — "В бой" вместо "Играть снова", "Выбрать другой класс"
  - ✅ P2: HUD — удалены дубликаты Level/MaxMass, "Вы погибли" только в playing
  - ✅ P2: Legacy levelIndicator отключен
  - ✅ P2: Новый игрок не видит Results предыдущего матча
  - ✅ P3: Safari safe-area insets для iOS

  **Изменённые файлы (9):**
  - `client/src/main.ts` — syncAbilityCooldown, syncAbilitySlots, leaderboard classId
  - `client/src/ui/UIBridge.tsx` — экспорт syncAbilitySlots
  - `client/src/ui/components/AbilityButtons.tsx` — динамические иконки/слоты
  - `client/src/ui/components/GameHUD.tsx` — safe-area, удаление Level/MaxMass, isPlayerDead fix
  - `client/src/ui/components/ResultsScreen.tsx` — тексты, иконки, порядок, удаление класс-выбора
  - `client/src/ui/data/abilities.ts` — ABILITY_ICON_MAP маппинг
  - `client/src/ui/signals/gameState.ts` — abilitySlots signal, classId в LeaderboardEntry
  - `activeContext.md` — обновление контекста
  - `progress.md` — обновление прогресса

  **Статус:**
  - ✅ PR #37 создан
  - ⏳ Ожидает ревью и слияния

- **[ЗАВЕРШЕНО] Sprint 2: MatchServer → MetaServer Integration (Server Side):**

  **Что реализовано:**
  - ✅ Исправлен X-1 blocker: lazy initialization для 7 сервисов MetaServer
  - ✅ Создан MatchSummary/PlayerResult интерфейсы в shared/src/types.ts
  - ✅ Создан MatchResultService с retry + exponential backoff
  - ✅ Создан POST /api/v1/match-results/submit endpoint
  - ✅ Добавлен Server Token auth (MATCH_SERVER_TOKEN env)
  - ✅ Интегрирована отправка результатов в ArenaRoom.endMatch()
  - ⏳ joinToken validation — отложено до Stage D

  **Новые файлы (3):**
  - `server/src/services/MatchResultService.ts` — HTTP клиент для MetaServer
  - `server/src/meta/routes/matchResults.ts` — Endpoint результатов
  - `shared/src/types.ts` — MatchSummary, PlayerResult interfaces

  **Модифицированные файлы (9):**
  - `server/src/meta/services/*.ts` — lazy initialization (7 файлов)
  - `server/src/meta/middleware/auth.ts` — requireServerToken middleware
  - `server/src/meta/server.ts` — matchResults route registration
  - `server/src/index.ts` — MatchResultService initialization
  - `server/src/rooms/ArenaRoom.ts` — submitMatchResults() integration

- **[ЗАВЕРШЕНО] Sprint 1: Client ↔ MetaServer Integration (Client Side):**

  **Sprint 1.9 AI Tester Review (Текущий):**
  - ✅ MainMenu: Отображение всех ошибок через `.filter(Boolean).join(' • ')`.
  - ✅ PowerShell smoke tests: Проверено — синтаксис корректен (Codex false positive).
  - ✅ Build: TypeScript и Vite проходят.

  **Sprint 1.8 Final Polish (Commit fe73cd1):**
  - ✅ Документация синхронизирована (Architecture Part 4).
  - ✅ Устранены Magic Strings (`DEFAULT_NICKNAME`).
  - ✅ Known Issues закрыты.
  - ✅ Клиент полностью готов к интеграции.

  **Новые файлы (11):**
  - `client/src/api/metaServerClient.ts` — HTTP клиент для MetaServer с retry, timeout, auth
  - `client/src/platform/IAuthAdapter.ts` — Интерфейс платформенных адаптеров
  - `client/src/platform/TelegramAdapter.ts` — Telegram Mini App адаптер
  - `client/src/platform/StandaloneAdapter.ts` — Standalone/dev адаптер
  - `client/src/platform/PlatformManager.ts` — Менеджер детекции платформы
  - `client/src/platform/index.ts` — Экспорты модуля platform
  - `client/src/services/authService.ts` — Сервис авторизации клиента
  - `client/src/services/configService.ts` — Сервис загрузки RuntimeConfig
  - `client/src/services/matchmakingService.ts` — Сервис matchmaking очереди
  - `client/src/services/index.ts` — Экспорты модуля services

  **Модифицированные файлы (4):**
  - `client/src/ui/signals/gameState.ts` — Auth/matchmaking signals и actions
  - `client/src/ui/components/MainMenu.tsx` — Matchmaking status UI
  - `client/src/ui/UIBridge.tsx` — onCancelMatchmaking callback
  - `client/src/main.ts` — Инициализация сервисов, интеграция matchmaking

  **Ключевые решения:**
  - JWT для joinToken (stateless валидация на MatchServer)
  - Платформы: Telegram + Standalone (для production и dev соответственно)
  - Синхронное начисление наград (для MVP без очереди)

  **Статус:**
  - ✅ TypeScript build passes
  - ✅ Vite build passes
  - ⏳ Ожидает: Sprint 2 (MatchServer → MetaServer)

- **[ЗАВЕРШЕНО] Релиз v0.3.0 и закрытие Phase 2 (7 января 2026):**
  - ✅ Актуализация `README.md` и `CHANGELOG.md`.
  - ✅ Синхронизация версий во всех `package.json` (0.3.0).
  - ✅ Создание Git-тега `v0.3.0` и публикация GitHub Release.
  - ✅ Аудит и исправление технической документации (PR #33 -> PR #35).

- **[ЗАВЕРШЕНО] Документация и README (7 января 2026):**
  - ✅ Главный README.md обновлён в соответствии с ТЗ v1.4.7 и Архитектурой v4.2.5.
  - ✅ Добавлены разделы: Технологический стек (Preact/Signals), Ключевые концепции (Детерминизм, U2-сглаживание), Структура проекта.
  - ✅ Обновлены инструкции по сборке и запуску (npm workspaces).
  - ✅ Версии Docker-образов обновлены до v0.3.0.

- **[ЗАВЕРШЕНО] UI Refactoring - Phase 2.7 Final Fixes (7 января 2026):**

  **Быстрые исправления перед merge:**

  - ✅ Security: `rel="noopener noreferrer"` для внешней ссылки GitHub (MainMenu.tsx)
  - ✅ Race condition: `activeRoom = null` перемещён внутрь `.then()` в onPlayAgain (main.ts)

  **Отложены для Stage D (Soft Launch):**
  - MetaServer integration (Auth, RuntimeConfig, MatchAssignment, MatchSummary)
  - globalInputSeq reset (требует проверки серверного контракта)
  - visualViewport.onresize (nice-to-have)

- **[ЗАВЕРШЕНО] UI Refactoring - Phase 2.6 Round 2 Bug Fixes (7 января 2026):**

  **Исправлены баги из пользовательского тестирования Round 2:**

  - ✅ R4-1: "Призраки" (игроки без classId) — фильтр `player.classId < 0` в render loop
  - ✅ R4-2: Дублирование HUD — legacy HUD скрыт (`hud.style.display = "none"`)
  - ✅ R4-4: "Играть снова" — кнопка disabled до конца таймера
  - ✅ R4-5: "В меню" — корректный выход с `room.leave()`
  - ✅ R4-6+7: Логика скина — сохраняется без смены имени, меняется при смене имени
  - ✅ Ghost Movement: сброс `lastSentInput` при выходе

  **Copilot AI Review fixes:**
  - ✅ C1: `.finally()` → `.then() + .catch()` для обработки ошибок
  - ✅ C3: Упрощение проверки `room === activeRoom`
  - ✅ C4: injectStyles — корректный порядок проверки кэша и DOM
  - ✅ C7: UIRoot — кэширование signal.value в локальных переменных

  **Версия обновлена на v0.3.0**

- **[ЗАВЕРШЕНО] UI Refactoring - Phase 2.5 Post-Implementation Fixes (6 января 2026):**

  **Исправлены 2 бага из пользовательского тестирования:**

  - ✅ POST-1: Лишний экран меню после выбора класса — добавлен `setPhase("playing")` в `setClassSelectMode(false)`
  - ✅ POST-2: Призраки игроков между матчами — добавлены `visualPlayers.clear()` и `visualOrbs.clear()` при выходе из Results

  **Коммит:** c4c5c08

- **[ЗАВЕРШЕНО] UI Refactoring - Phase 2 Bug Fixes (6 января 2026):**

  **SDET Review — исправлены 9 критических багов:**

  **P0 (Critical):**
  - ✅ onPlay: selectClass vs connectToServer — между матчами отправляем selectClass
  - ✅ visualPlayers.clear race condition — проверка room === activeRoom
  - ✅ wasInResultsPhase — корректная обработка переходов фаз

  **P1 (High):**
  - ✅ Results timer — использует matchTimer signal для реактивных обновлений
  - ✅ useEffect name overwrite — проверка playerName.value вместо closure
  - ✅ onPlayAgain room.leave() — используем .finally() для последовательности
  - ✅ activateAbilityFromUI movement — сохраняем направление через lastSentInput

  **P2 (Medium):**
  - ✅ Double setPhase — унифицирована логика Results → Playing/Menu
  - ✅ ui-root missing — throw Error вместо console.warn

  **Изменённые файлы:**
  - `client/src/main.ts` — интеграция UIBridge, исправления race conditions
  - `client/src/ui/components/ResultsScreen.tsx` — matchTimer signal
  - `client/src/ui/components/MainMenu.tsx` — защита от перезаписи имени
  - `client/index.html` — добавлен `<div id="ui-root">`

- **[ЗАВЕРШЕНО] UI Refactoring - Phase 1 + Copilot Review:**

  **Компоненты (все готовы):**
  - ✅ MainMenu — главное меню с выбором класса
  - ✅ GameHUD — HUD с throttled 10 Hz обновлением
  - ✅ AbilityButtons — SVG визуализация кулдауна
  - ✅ TalentModal — выбор талантов с focus trap
  - ✅ ResultsScreen — экран результатов матча
  - ✅ ScreenManager — стек экранов с анимациями
  - ✅ UIBridge — мост Canvas ↔ Preact

  **Copilot Review (6 batch, 40+ комментариев исправлено):**
  - ✅ Batch 1-6: все замечания исправлены

### Архитектура файлов PR #32
  ```
  client/src/ui/
  ├── signals/
  │   └── gameState.ts     — глобальное состояние (Preact Signals)
  ├── screens/
  │   └── ScreenManager.tsx — стек экранов и модалок
  ├── components/
  │   ├── MainMenu.tsx
  │   ├── GameHUD.tsx
  │   ├── AbilityButtons.tsx
  │   ├── TalentModal.tsx
  │   └── ResultsScreen.tsx
  ├── UIBridge.tsx         — API интеграции с Canvas
  └── index.ts             — экспорты модуля
  ```

  **Ожидает:**
  - ⏳ Интеграция с main.ts (Canvas rendering)
  - ⏳ Safe Area CSS variables
  - ⏳ Тестирование на мобильных устройствах
  - ⏳ PR review и merge

- **[ЗАВЕРШЕНО] Stage A+B+C — MetaServer Infrastructure (5 января 2026):**
  - PR #31 merged to main
  - PostgreSQL 16, Redis 7, миграции БД
  - Auth (Telegram/Yandex/Poki adapters), Profile, Wallet, Shop services
  - A/B Testing, Analytics, Payment Providers (Telegram Stars, Yandex.Checkout)
  - RuntimeConfig management с версионированием

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
  - Изменено 5 файлов (ConfigService.ts, auth.ts, server.ts, pool.ts, ShopService.ts)

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

### Технический долг (Low Priority)

**Из AI Review Round 4 (8 января 2026):**

| ID | Приоритет | Проблема | Файл | Статус |
|----|-----------|----------|------|--------|
| R4-2 | Low | Race condition: classId может быть -1 при быстром клике Play | MainMenu.tsx:397 | Отложено |
| R4-3 | Low | progress.md не полный (отсутствуют MainMenu.tsx, GameHUD.tsx) | progress.md | Отложено |
| G-3 | P1 | HUD frequency mismatch (10Hz vs 5Hz) | GameHUD.tsx, main.ts | Отложено |
| G-4 | P1 | Hardcoded LEVEL_THRESHOLDS | GameHUD.tsx | Отложено |
| X-5 | P2 | Name change not applied при replay | main.ts, MainMenu.tsx | Отложено |

**Рекомендации:**
- R4-2: Добавить `if (classId >= 0)` в handlePlay
- G-3: Синхронизировать частоты или сделать GameHUD реактивным на signals
- G-4: Перенести LEVEL_THRESHOLDS в balance.json

### Следующие шаги

1. **Sprint 2: MatchServer → MetaServer Integration (ЗАВЕРШЕНО):**
   - [x] Исправить X-1 blocker (lazy initialization)
   - [x] Создать MatchResultService (`server/src/services/MatchResultService.ts`)
   - [x] Создать match-results endpoint (`server/src/meta/routes/matchResults.ts`)
   - [x] Интегрировать в ArenaRoom.endMatch()
   - [ ] joinToken validation в ArenaRoom (отложено)
2. **Sprint 3: Stage D Testing (2-3 дня):**
   - [ ] Smoke-тесты полного flow (auth → matchmaking → game → results)
   - [ ] Тесты идемпотентности
   - [ ] Нагрузочные тесты k6 (CCU=500)
3. **Рефакторинг прототипа (Фаза 0):**
   - Типизация систем сервера, удаление дублирования mathUtils.
