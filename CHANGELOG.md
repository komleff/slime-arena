# Журнал изменений

## v0.8.5-hotfix — Redis MISCONF + Новый домен (8 февраля 2026)

Экстренное исправление падения production-сервера и настройка второго домена.

### Исправлено

- **Redis RDB MISCONF (P0):**
  - Redis не мог записать RDB-снапшот в корень контейнера → `stop-writes-on-bgsave-error` блокировал все записи
  - Health-check MetaServer возвращал 503 → nginx отдавал 502 Bad Gateway
  - Яндекс OAuth `/oauth/resolve` не мог сохранить токен → 503
  - Добавлены флаги `--save ""` и `--stop-writes-on-bgsave-error no` в supervisord-db.conf и supervisord.conf

### Инфраструктура

- **Новый домен:** https://slime-arena.u2game.space
  - DNS A-запись → 147.45.147.175
  - SSL-сертификат Let's Encrypt (ECC) через acme.sh
  - Полный nginx-конфиг (API, WebSocket, клиент, admin)
  - Яндекс OAuth redirect URI добавлен

### Статистика

- **PR #148:** 2 файла конфигурации + документация
- **Downtime:** ~22 часа (watchdog рестартовал контейнер, но Redis блокировал запись)

---

## v0.8.5 — Admin Dashboard & Production Launch (7 февраля 2026)

Полнофункциональная панель администратора на production-сервере. Админка — важнейший шаг к запуску: операторы получили инструменты мониторинга, управления пользователями и перезапуска сервера без SSH.

### Добавлено

- **Admin Dashboard на production** — полноценная панель управления по адресу `/admin/`
- **Кнопка перезапуска** в Admin Dashboard с уведомлением игроков (обратный отсчёт 30 сек)
- **Баннер отключения** — игроки видят предупреждение о скором рестарте в матче
- **Watchdog-сервис** (`systemd`) — мониторинг здоровья, автоматический перезапуск, Telegram-уведомления
- **Docker shared volume** для коммуникации Admin Dashboard ↔ Watchdog (outbox-паттерн)

### Исправлено

- **Admin API_BASE** — исправлен с абсолютного `hostname:3000` на относительный `/api/v1/admin` (ERR_SSL_PROTOCOL_ERROR)
- **serve.json** — убрано поле `"public"`, конфликтовавшее с позиционным аргументом `serve dir` (404 на всё)
- **Nginx admin block** — добавлен `^~` prefix и trailing slash в `proxy_pass` для корректного стрипа `/admin/`
- **2FA status display** — корректное отображение статуса двухфакторной аутентификации в Settings
- **HUD auth link** — исправлено вертикальное выравнивание ссылки входа

### Улучшено

- **Guest UI** — улучшения интерфейса для гостевых пользователей, обновлён favicon
- **Nginx WebSocket regex** — добавлены `_-` в processId/roomId (`^/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$`)

### Документация

- **SERVER_SETUP.md** — полная процедура установки на новый сервер (9 шагов)
- **SERVER_UPDATE.md** — процедура обновления действующего сервера
- **Watchdog** — документация по установке и настройке

### Архитектура

Production v0.8.5 на VPS Timeweb (147.45.147.175):

| Компонент | Описание |
| --------- | -------- |
| `slime-arena-db` | PostgreSQL 16 + Redis |
| `slime-arena-app` | MetaServer + MatchServer + Client + Admin Dashboard |
| `slime-arena-shared` | Docker volume для watchdog outbox |
| `slime-arena-watchdog` | systemd-сервис мониторинга |
| Nginx | Reverse proxy + SSL (acme.sh) |

---

## v0.8.4 — Split Architecture Release (7 февраля 2026)

Переход production на split-архитектуру (db + app). Исправлен CI/CD, обновлена документация для ИИ-деплоеров.

### Исправлено

- **app.Dockerfile** — добавлен `COPY scripts/ scripts/` (CI падал из-за отсутствия sync-version.js)

### Изменено

- **AI_AGENT_GUIDE.md** — полная переработка под split-архитектуру (docker-compose, запреты P0, протокол обновления)
- **SERVER_SETUP.md** — добавлена секция split-архитектуры, docker-compose команды
- Все версии обновлены: version.json, package.json, Dockerfiles, docker-compose файлы

### Архитектура

- **Production:** `slime-arena-db` + `slime-arena-app` через docker-compose
- **Монолит (`monolith-full`)** помечен как deprecated
- Обновление app: `docker compose pull app && docker compose up -d app` (~5 секунд простоя)
- Секреты хранятся в `/root/slime-arena/.env` (не теряются при обновлении)

---

## v0.8.3 — Infrastructure & Auth UX (7 февраля 2026)

Инфраструктурное обновление: бэкапы, кнопка перезапуска в админке, кнопка входа для гостей.

### Добавлено

- **Кнопка «Войти» для гостей** в лобби — ссылка в панели профиля для возвращающихся игроков
- **RestartPage** в Admin Dashboard — перезапуск сервера с 2FA подтверждением
- **scripts/backup-remote.sh** — удалённый бэкап PostgreSQL (SSH + pg_dump + ротация 7 дней)
- **Протокол бэкапов** в AI_AGENT_GUIDE.md — P0 правило: pg_dump обязателен перед обновлением

### Изменено

- **app.Dockerfile** обновлён до v0.8.3 — добавлен admin-dashboard, порт 5175
- **db.Dockerfile** обновлён до v0.8.3
- **docker-compose.app-db.yml** обновлён до v0.8.3 — добавлены JWT_SECRET, ADMIN_ENCRYPTION_KEY, OAuth переменные
- **RegistrationPromptModal** — добавлен prop `intent` (`login` / `convert_guest`)
- **Nginx** — добавлен location `/admin/` для Admin Dashboard в SERVER_SETUP.md

### Документация

- CHANGELOG.md дополнен записями v0.7.5 — v0.8.2 (были пропущены)

---

## v0.8.2 — Admin Dashboard Phase 2 (5 февраля 2026)

Полноценная панель администратора: метрики сервера, управление комнатами, аудит действий.

### Добавлено

- **DashboardPage** — метрики сервера (CPU, RAM, uptime, игроки) с real-time polling
- **RoomsPage** — список активных комнат с деталями
- **AuditPage** — журнал действий администратора
- **systemMetrics service** — сбор метрик ОС и процессов
- **POST /api/v1/admin/restart** — перезапуск сервера с 2FA подтверждением
- **GET /api/v1/admin/stats** — метрики для дашборда
- **GET /api/v1/admin/rooms** — список комнат
- **watchdog.py** — мониторинг процессов и auto-restart на хосте

### Исправлено

- Конфликт схемы audit_log в миграции 009 (PR #137)

### Статистика

- **PR #136:** Sprint 19, +2300 строк (backend + frontend + ops)
- **PR #137:** Hotfix миграции

---

## v0.8.0 — Server Monitoring Dashboard (4 февраля 2026)

Первый релиз Admin Dashboard: аутентификация, двухфакторная авторизация, базовый UI.

### Добавлено

- **Admin Auth:** login, refresh, logout с JWT + HttpOnly cookie
- **2FA (TOTP):** setup/verify с AES-256-GCM шифрованием секрета
- **Middleware:** requireAdminAuth, require2FA для защищённых эндпоинтов
- **Audit Service:** логирование действий администратора в БД
- **Rate limiting:** 5 req/min для admin login
- **Admin Dashboard UI:** Preact SPA с login-экраном и Settings-страницей
- **Миграции:** admin_users, admin_sessions, audit_log (009_admin_tables.sql)

### Документация

- AI_AGENT_GUIDE.md — инструкции по управлению production-сервером
- SERVER_SETUP.md — Nginx конфигурация и деплой

### Статистика

- **PR #133:** Backend Sprint 1, 4 файла (+1500 строк)
- **PR #134:** Frontend Sprint 1

---

## v0.7.8 — Reverse Proxy Support (2 февраля 2026)

Поддержка работы за Nginx reverse proxy.

### Исправлено

- Определение URL мета-сервера при работе за reverse proxy (PR #124)
- Передача переменных окружения в MetaServer через supervisord

---

## v0.7.7 — Docker Env Hotfix (2 февраля 2026)

### Исправлено

- Передача переменных окружения в Docker-контейнере для v0.7.6 (PR #122)

---

## v0.7.6 — Client URL Auto-Detect (2 февраля 2026)

### Исправлено

- Автоопределение URL мета-сервера при доступе через IP-адрес (PR #120)

---

## v0.7.5 — Tech Debt Reduction + DX (1 февраля 2026)

Sprint 18: устранение технического долга, улучшение безопасности и опыта разработки.

### Добавлено

- **Vite proxy** для тестирования на мобильных устройствах в LAN (PR #118)
- **Rate limiting** /auth/* — 10 req/min auth, 5 req/min OAuth
- **Nickname validation** — validateAndNormalize() в /auth/upgrade, /join-token
- **Auth caching** — cachedJoinToken signal вместо прямого чтения localStorage
- **Локальные данные БД** включены в Docker-образ для быстрого старта (PR #119)

### Исправлено

- Дрейф джойстика в adaptive режиме — база фиксируется в точке активации
- Сохранение скина после OAuth upgrade (guest_skin_id → selected_skin_id)
- Стабилизация Play Again — добавлен setPhase("menu") при выходе из Results

### Изменено

- REWARDS_CONFIG перенесён в balance.json (секция rating)
- Results UI — логика buttonText вынесена в отдельную переменную

### Статистика

- **PR #117:** Sprint 18, 8 задач
- **PR #118:** Vite proxy + DX
- **PR #119:** Docker seed data

---

## v0.7.4 — OAuth Hotfix + LeaderboardScreen (1 февраля 2026)

Критические исправления OAuth авторизации и полная реализация экрана лидеров.

### ✨ Добавлено

- **LeaderboardScreen v1.6:**
  - Переключатель «Накопительный» / «Рекордный» режим
  - Гибридная плашка игрока (sticky top/bottom с IntersectionObserver)
  - Миниатюра скина (цветной круг по skinId)
  - Плашка гостя с кнопкой «Сохранить прогресс»
  - Автозакрытие при нахождении матча
  - matchesPlayed и skinId в API entries
  - Вторичная сортировка по updated_at DESC

### 🐛 Исправлено

- **OAuth Flow (8 P0/P1 fixes):**
  - dotenv загрузка в MatchServer
  - Восстановление guest_token без вызова login()
  - Блокировка OAuth-кнопок без токена
  - Очистка claim токенов после upgrade
  - setOnUnauthorized после восстановления сессии
  - ProfileSummary в createDefaultProfile
  - Сохранение access_token в localStorage
  - fetchProfile после finishUpgrade

### 📦 Статистика

- **PR #116:** 35+ файлов, 5 AI-ревьюверов
- **Ревью:** Claude Opus 4.5, Gemini, Codex, Lingma — APPROVED

---

## v0.7.3 — Platform Adapters & OAuth (1 февраля 2026)

Полная поддержка игровых платформ и OAuth авторизация для Standalone.

### ✨ Добавлено

- **Platform Adapters** (Sprint 15):
  - YandexAdapter — Yandex Games SDK
  - PokiAdapter — Poki SDK
  - CrazyGamesAdapter + AdsProvider
  - GameDistributionAdapter + AdsProvider
  - PlatformManager v2 с приоритетами платформ
  - Server Auth Providers (CrazyGames, Poki, Yandex)

- **OAuth для Standalone** (Sprint 16):
  - Google OAuth Provider (недоступен в РФ)
  - Yandex OAuth Provider
  - OAuthProviderFactory с региональными ограничениями
  - GeoIP Service для определения региона
  - NicknameConfirmModal — подтверждение никнейма
  - AccountConflictModal — разрешение 409 конфликтов

- **Rating System**:
  - Инициализация рейтинга из claimToken.finalMass
  - Накопление массы после матчей
  - Обновление рекорда (best_mass)
  - Идемпотентность через rating_awards

- **Docker Build Scripts**:
  - `docker/build.sh` — Linux/macOS
  - `docker/build.ps1` — Windows PowerShell
  - `docker/seed-data.sql` — начальные данные

### 🐛 Исправлено

- skinId гостя не сохранялся при OAuth upgrade
- Рейтинг не инициализировался из claimToken
- awardRating() не начислял массу
- SPA routing: redirect_uri изменён на root "/"
- 409 handling: различение claim_already_consumed vs OAuth conflict
- Math.round для integer колонок в БД

### 📦 Статистика

- **PR #112:** Sprint 15, 42 файла (+3500/-200)
- **PR #115:** Sprint 16, 47 файлов (+5194/-1001)
- **Ревью:** 5 AI-ревьюверов, 11+ итераций

---

## v0.5.2 — PvP Balance & Combat Fixes (18 января 2026)

Исправления механики боя (укуса в PvP), стабильность "Play Again" и документация по талантам.

### 🐛 Исправлено

- **PvP bite formula** (PR #94, slime-arena-8q9):
  - Пересчёт формулы: `attackerGain = attacker.mass × 10% × modifiers` (вместо victim.mass)
  - `scatterMass = defender.mass × 10% × modifiers` (вместо жёсткого процента)
  - Балансировка наград через `actualLoss` при наличии Last Breath
  - Обновлена документация GDD-Combat.md

- **Level progress bar** (PR #93):
  - Исправлены комментарии в коде (правильные пороги уровней)
  - Используется `minSlimeMass` для корректного расчёта прогресса

- **Play Again race condition** (PR #92):
  - Защита от повторного входа во время Results фазы
  - Правильное управление таймером ожидания арены
  - Предотвращение попадания в готовую арену

- **Arena wait timer leak** (slime-arena-hp5):
  - Очистка интервала при смене фаз
  - Корректный выход из Results через goToLobby

### 📚 Документация

- Добавлены 2 задачи в TECH_DEBT.md по нерабочим талантам:
  - `sense` (Чутьё) — не применяются эффекты `chestSense`
  - `regeneration` (Регенерация) — не применяются эффекты `outOfCombatRegen`

### 🧪 Тестирование

- ✅ Все тесты детерминизма проходят
- ✅ Build успешен (shared → server → client)
- ✅ 3 PR прошли ревью и одобрены

### 📦 Файлы

**Изменённые (6):**

- `server/src/rooms/ArenaRoom.ts` — новая формула укуса в PvP
- `docs/gdd/GDD-Combat.md` — обновлена боевая механика
- `client/src/ui/components/GameHUD.tsx` — исправлены комментарии
- `config/balance.json` — удалены устаревшие параметры
- `shared/src/config.ts` — удаление неиспользуемых типов
- `TECH_DEBT.md` — добавлены задачи по талантам

---

## v0.5.1 — Level Progress Bar & Results Screen (13 января 2026)

**Примечание:** Версия не была опубликована публично.

Восстановление прогресс-бара уровня, исправления экрана результатов и оптимизация ассетов.

### ✨ Добавлено

- **Level badge** в HUD с визуализацией прогресса до следующего уровня
- **Inline Boot Screen** (CSS + HTML в index.html до загрузки JS bundle)
- **Правильная последовательность загрузки:** HTML → CSS → JS

### 🛠 Изменено

- **Asset optimization** (PR #90):
  - WebP конвертация: 73MB → 1.9MB
  - Спрайты слаймов, фоны, иконки оптимизированы
  - assets-dist структура для production builds

- **Results Screen**:
  - Таймер ожидания "Play Again" работает на клиенте
  - Игрок может смотреть результаты без повторного входа

- **Skin selection**:
  - Детерминированный выбор по имени игрока
  - Одинаковые скины на всех клиентах
  - Убрано debug логирование

### 🐛 Исправлено

- Предотвращение race condition при нажатии "Play Again"
- Правильный выход из завершённых матчей
- Обновление спрайта при получении имени от сервера

### ⚙️ Инфраструктура

- Docker образы обновлены до 0.5.1
- assets-dist копируется в контейнер при сборке

---

## v0.5.0 — UI Polish & Performance (13 января 2026)

---

## v0.4.0 — Multi-Platform Docker (9 января 2026)

Docker-контейнеры теперь поддерживают ARM64 (Apple Silicon) и AMD64.

### ✨ Добавлено

- **Multi-platform build** — образы собираются для `linux/amd64` и `linux/arm64`
- **Apple Silicon support** — нативная работа на M1/M2/M3/M4
- **AWS Graviton support** — ARM64 cloud instances

### 🛠 Изменено

- **Node.js 18 → 20** — обновление до LTS версии
- **3 образа вместо 5** — удалены legacy `server` и `client`
  - `slime-arena-app` — MetaServer + MatchServer + Client
  - `slime-arena-db` — PostgreSQL + Redis
  - `slime-arena-monolith-full` — всё в одном

### ⚙️ Инфраструктура

- QEMU для кросс-компиляции в GitHub Actions
- `JOIN_TOKEN_SECRET` добавлен в docker-compose

---

## v0.3.6 — TalentSystem Integration (9 января 2026)

Интеграция TalentSystem модуля в ArenaRoom с удалением дублирующего кода.

### 🛠 Изменено

- **ArenaRoom.ts** (slime-arena-eg7):
  - `recalculateTalentModifiers()` → делегация в модуль (~220 строк удалено)
  - `generateTalentCard()` → делегация в модуль (~220 строк удалено)
  - Добавлен адаптер `getTalentBalanceConfig()`
  - Удалены дубли: `getTalentConfig`, `buildAbilityUpgradeId`, `parseAbilityUpgradeId`

### 📊 Метрики

- **ArenaRoom.ts:** 4132 → 3714 строк (−418)
- **Тесты:** determinism, orb-bite, arena-generation ✅

### 📦 Файлы

**Изменённые (1):**

- `server/src/rooms/ArenaRoom.ts` — интеграция TalentSystem модуля

---

## v0.3.5 — Tech Debt Refactoring (9 января 2026)

Извлечение модулей InputManager и TalentSystem, оптимизация HUD.

### ✨ Добавлено

- **InputManager** (`client/src/input/InputManager.ts`, 558 строк):
  - Централизованное управление вводом (keyboard, pointer, mouse)
  - Dependency Injection через интерфейсы
  - Debug режим через URL параметр `?debugJoystick=1`

- **TalentSystem** (`server/src/rooms/systems/talent/`):
  - `TalentModifierCalculator.ts` — пересчёт модификаторов игрока
  - `TalentGenerator.ts` — генерация карточек талантов
  - Детерминизм через Rng injection

### 🛠 Исправлено

- **HUD frequency sync** (slime-arena-foh):
  - Удалён избыточный forceUpdate/setInterval
  - Preact Signals обеспечивают реактивность

### ⚙️ Инфраструктура

- **Beads daemon** (slime-arena-dm5):
  - Включены auto-commit и auto-push
  - `.beads/config.yaml` обновлён

### 📦 Файлы

**Новые (4):**

- `client/src/input/InputManager.ts`
- `server/src/rooms/systems/talent/TalentGenerator.ts`
- `server/src/rooms/systems/talent/TalentModifierCalculator.ts`
- `server/src/rooms/systems/talent/index.ts`

**Изменённые (4):**

- `client/src/input/index.ts` — экспорт InputManager
- `client/src/ui/components/GameHUD.tsx` — убран forceUpdate
- `client/src/main.ts` — комментарий о InputManager
- `.beads/config.yaml` — auto-commit, auto-push

---

## v0.3.4 — Legacy DOM Cleanup (8 января 2026)

Масштабный рефакторинг клиента: удалён legacy DOM код, заменённый Preact компонентами.

### 🧹 Удалено (−1119 строк)

- **HUD elements:** boostPanel, topCenterHud, matchTimer, killCounter → GameHUD.tsx
- **Level indicator:** levelIndicator, updateLevelIndicator → GameHUD.tsx
- **Empty stubs:** updateSlot1Button, updateSlot2Button
- **Local variable:** selectedClassId (заменён на signal)

### ✨ Улучшено

- **BoostPanel:** Отображает заряды (×N) для guard/greed, секунды для остальных
- **MainMenu:** Auto-select random class при первом mount
- **selectedClassId:** Унифицирован на -1 (signal + local sync)
- **syncBoost:** Добавлено поле isChargeBased

### 📦 Файлы

**Изменённые (6):**

- `client/src/main.ts` — −1060 строк legacy DOM
- `client/src/ui/signals/gameState.ts` — selectedClassId = -1, BoostState.isChargeBased
- `client/src/ui/components/GameHUD.tsx` — charge-based boost display
- `client/src/ui/components/MainMenu.tsx` — auto-select random class
- `.memory_bank/activeContext.md` — sprint context
- `.memory_bank/progress.md` — sprint progress

---

## v0.3.3 — Production-Ready Monolith (7 января 2026)

Финальный релиз монолитного контейнера для Soft Launch. Исправлены критические ошибки сборки и runtime, выявленные при локальном тестировании.

### 🚀 Docker Monolith

**Образ:** `ghcr.io/komleff/slime-arena-monolith:v0.3.3`

Один контейнер, три сервиса:

| Сервис      | Порт | Описание                    |
| ----------- | ---- | --------------------------- |
| MetaServer  | 3000 | HTTP API (auth, profiles)   |
| MatchServer | 2567 | WebSocket (Colyseus)        |
| Client      | 5174 | Static files (Vite build)   |

### 🛠 Исправления (9 issues)

#### P0 — Критические

- **D-01:** Рассинхронизация версий package.json → синхронизированы до 0.3.3
- **D-02:** Монолит не публикуется в CI/CD → добавлен в workflow
- **D-07:** ESM/CommonJS module mismatch → `shared/tsconfig.json` переключен на CommonJS
- **D-08:** Неверные пути entry points → исправлены на `server/dist/server/src/...`
- **D-09:** Config не найден → добавлено копирование в `server/dist/config`

#### P1 — Важные

- **D-03:** Отсутствует `.dockerignore` → создан с исключениями
- **D-04:** Dockerfile в dev mode → multi-stage production build

#### P2 — Улучшения

- **D-05:** Нет HEALTHCHECK → добавлен для MetaServer
- **D-06:** Отсутствует EXPOSE 3000 → исправлено в monolith

### 📦 Файлы

**Новые (2):**

- `.dockerignore` — исключения для Docker build
- `client/src/vite-env.d.ts` — Vite environment types

**Изменённые (10):**

- `package.json`, `client/package.json`, `server/package.json`, `shared/package.json` — version 0.3.3
- `shared/tsconfig.json` — module: ESNext → CommonJS
- `docker/monolith.Dockerfile` — multi-stage build, paths fix, config copy
- `docker/docker-compose.monolith.yml` — production config
- `.github/workflows/publish-containers.yml` — +monolith image
- `client/src/api/metaServerClient.ts` — removed @ts-expect-error
- `client/src/ui/components/MainMenu.tsx` — version display v0.3.3

### 🚢 Удалённое развёртывание

Клиент автоматически определяет адрес сервера из URL страницы. Никаких дополнительных настроек не требуется:

```bash
# На любом сервере
docker-compose -f docker/docker-compose.monolith.yml up -d

# Доступ: http://<IP>:5174
```

### ✅ Результат тестирования

```text
NAMES                  STATUS                        PORTS
slime-arena-monolith   Up About a minute (healthy)   3000, 2567, 5174
```

- MetaServer: `{"status":"ok","database":"connected","redis":"connected"}`
- MatchServer: Colyseus listening
- Client: HTML served

---

### v0.3.2 — Монолит и Hotfix (7 января 2026)

> **Отозван:** содержал ошибки runtime — ESM/CommonJS mismatch, неверные пути

Попытка внедрить монолитный контейнер, не прошедшая локальное тестирование.

---

### v0.3.1 — Инфраструктура и стабильность (7 января 2026)

> **Отозван:** содержал ошибку отсутствия файла конфигурации

Этот релиз фокусируется на стабилизации серверной инфраструктуры, внедрении системы сохранения результатов матчей и обеспечении надежности данных через систему резервного копирования.

#### 🛠 Инфраструктура и Docker (Стабилизация релиза)
- **Разделение уровней сервера:** Сервер разделен на два независимых сервиса в Docker Compose: `meta-server` (логика профилей, API) и `match-server` (игровая симуляция Colyseus).
- **Сетевая доступность в LAN:** Реализовано динамическое определение IP-адреса хоста в клиенте. Теперь игра доступна по локальной сети (Wi-Fi) для мобильных устройств без правки конфигурации.
- **Оптимизация сборки:** Устранена проблема разрешения модулей `@slime-arena/shared` в Docker. Внедрена предварительная компиляция общей библиотеки перед запуском основных сервисов.
- **Контейнеризация:** Стандартизированы имена контейнеров (`slime-arena-client`, `slime-arena-match-server`, `slime-arena-meta-server`) и зафиксированы порты (3000, 2567, 5174).

#### 💾 Система сохранения и База Данных (PR #36, #45, #47)
- **Persistence Layer:** Реализован `MatchResultService` на стороне MatchServer для надежной передачи итогов матча на MetaServer.
- **Механика устойчивости:** Внедрена очередь отправки с экспоненциальной задержкой (Backoff) и ограничением количества попыток в случае недоступности MetaServer.
- **Идемпотентность:** Гарантирована защита от дублирования результатов матча на уровне базы данных через UUID-ключи.
- **Бэкапы (Stage D):** Создана полноценная система резервного копирования PostgreSQL с автоматизированными скриптами для Windows (`.ps1`) и Linux (`.sh`).
- **Миграции:** Скрипты инициализации схемы БД (`001_initial_schema.sql`, `002_stage_c_monetization.sql`) переведены в идемпотентный режим (стабильный перезапуск контейнеров).

#### 🎮 Игровой процесс и Управление (PR #39)
- **Flight Assist (Помощник пилотирования):** Проведен тонкий тюнинг параметров инерции и торможения для всех четырех классов персонажей (Tank, Speedster, Damage, Support).
- **Virtual Joystick:** Оптимизированы зоны мертвой чувствительности (deadzone) и скорость следования стика за пальцем для уменьшения задержки ввода.
- **Multi-touch:** Исправлена логика обработки касаний, позволяющая одновременно совершать микродвижения и активировать способности без конфликтов.

#### 🖥 Интерфейс и UX (PR #37)
- **Исправление 15 Known Issues:** Устранены дефекты интерфейса, выявленные в версии v0.3.0.
- **HUD:** Активация способностей переведена с события `click` на `pointerdown`, что сократило задержку реакции на 200-300мс.
- **Results Screen:** Исправлена сортировка игроков по весу/убийствам и отображение соответствующих иконок классов.
- **Main Menu:** Улучшена синхронизация скинов при смене ника и исправлено отображение версии билда.

#### 🔧 Технические исправления
- **Strict TypeScript:** Исправлено более 40 ошибок типизации в `ArenaRoom.ts` (strict mode), повышена стабильность игрового цикла.
- **Race conditions:** Исправлена ошибка, при которой данные игрока могли не сохраниться, если он покидал матч за миллисекунды до финала.

---

## Глоссарий (v0.3+)

- **ArenaRoom**: Основной программный класс, управляющий логикой игрового матча на сервере.
- **Docker**: Система контейнеризации, обеспечивающая запуск игры в изолированной среде.
- **Flight Assist**: Система программной помощи игроку при управлении движением слайма (помощник пилотирования).
- **MatchServer**: Игровой сервер, отвечающий за симуляцию сражения в реальном времени.
- **MetaServer**: Сервер управления пользователями, профилями и статистикой.
- **PostgreSQL**: Система управления базами данных, используемая для хранения профилей игроков.
- **Shared**: Общий программный модуль, содержащий типы и логику, общую для сервера и клиента.
- **TypeScript**: Язык программирования, обеспечивающий проверку типов данных для повышения стабильности кода.

### v0.3.0 — Технологическая перестройка и новый UI (7 января 2026)
- **Полная миграция UI на Preact:** Интерфейс полностью переписан с использованием Preact и @preact/signals. Это позволило уйти от императивного управления DOM и перейти к декларативному, компонентному подходу.
- **Внедрение UIBridge:** Создан новый мост (`UIBridge`) для двунаправленного общения между игровым рендером на Canvas и интерфейсом на Preact.
- **Система управления экранами:** Реализован `ScreenManager` для управления жизненным циклом экранов (Главное меню, HUD, модальные окна).
- **Архитектурные улучшения:** Проведена полная реструктуризация проекта с использованием npm-воркспейсов (`client`, `server`, `shared`), что упростило управление зависимостями и общим кодом.
- **Оптимизация рендеринга HUD:** Частота обновления игрового интерфейса (HUD) снижена до 10 Гц для уменьшения нагрузки на CPU.
- **Критические исправления:** Устранены ошибки типа "race condition" при переподключении к серверу, а также проблема с "призрачными" игроками, которые оставались на арене после дисконнекта.

### v0.2.2 — Mobile & CI/CD (5 января 2026)
- **Mobile Input:** Исправлено залипание управления на тач-устройствах.
- **CI/CD:** Автоматизирована сборка и публикация Docker-образов через GitHub Actions.
