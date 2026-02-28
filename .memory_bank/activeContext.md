# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние (28 февраля 2026)

**База:** main → **v0.8.5**, ветка `sprint-21/bugfix-tech-debt` → **v0.8.6** (PR #150, ожидает merge)
**GDD версия:** 3.3.2
**Sprint 21 Status:** ✅ Код готов, ревью пройдено, ожидает merge оператором
**Production:** v0.8.5 (app-db деплой, два контейнера)

---

## Sprint 21 — Багфиксы и технический долг v0.8.6 (2026-02-28)

**Цель:** Стабилизация — исправление P1/P2 багов + точечный тех долг. Новых фич нет.
**Ветка:** `sprint-21/bugfix-tech-debt` (14 коммитов, 12 файлов, +516/-86 строк)
**PR:** #150
**Коммиты:** `ba1af70`..`a48add7`

### Ревью-консенсус PR #150

| Ревьювер | Статус |
|----------|--------|
| Claude Sonnet 4.6 | ✅ APPROVED |
| ChatGPT (ручной) | ⚠️ REQUEST_CHANGES → исправлено в `504a6e6` |
| Codex GPT-5 | ⚠️ REQUEST_CHANGES → исправлено в `63163ae` |
| GitHub Copilot | ⚠️ COMMENTED → 1 принято (`a48add7`), остальные отклонены |
| ChatGPT Codex | ⚠️ P1/P2 inline → закрыты в `504a6e6` |

**Консенсус: все критические замечания устранены, 1 APPROVED.**

### Выполненные задачи (9/9)

| # | Beads ID | P | Задача | Коммит |
|---|----------|---|--------|--------|
| 1 | slime-arena-b7z6 | P1 | Зависание экрана выбора класса при рестарте | `ceb5b6e` |
| 2 | slime-arena-hfww | P2 | Таймер зависает (Chrome mobile) | `efe9960` |
| 3 | slime-arena-3v3o | P2 | Фаза 'connecting' мелькает главным экраном | `b2869e6` |
| 4 | slime-arena-vsn5 | P1 | Скин не сохраняется при OAuth upgrade | `ba1af70` |
| 5 | slime-arena-n17m | P2 | normalizeNickname() падает на null | `6075177` |
| 6 | slime-arena-mtw | P2 | Модификаторы укуса несимметричны | `1ecd828` |
| 7 | slime-arena-4xh | P2 | Талант Вампир не по GDD | `e55dbe7` |
| 8 | slime-arena-y2z2 | P2 | Гость видит PLAYER после матча | `69de6d9` |
| 9 | slime-arena-vpti | P2 | Изолировать generateRandomBasicSkin() | `56c002e` |

### Исправления по итогам ревью

| Коммит | Описание |
|--------|----------|
| `504a6e6` | Формула боя: раздельные базы mass, visibilitychange cleanup, skinId валидация |
| `63163ae` | skinId: whitelist через getBasicSkins() вместо skinExists() |
| `a48add7` | Убрать .js из import (CommonJS) |

### Новая задача из ревью

- `slime-arena-ef98` (P3) — Уточнить GDD: Вампир — attackerGain от attacker.mass или defender.mass?

---

## Предыдущее состояние (8 февраля 2026)

**Production:** v0.8.5 (app-db деплой, два контейнера)

**Docker images (на ghcr.io):**

- `ghcr.io/komleff/slime-arena-app:0.8.5` ✅
- `ghcr.io/komleff/slime-arena-db:0.8.5` ✅

### Домены
| Домен | Статус | SSL |
|-------|--------|-----|
| https://slime-arena.overmobile.space | ✅ Работает | Let's Encrypt (ECC) |
| https://slime-arena.u2game.space | ✅ Работает (с 2026-02-08) | Let's Encrypt (ECC) |

---

## 🔧 Server Maintenance (2026-02-08)

### Инцидент: 502 Bad Gateway + Яндекс OAuth 503

**Причина:** Redis не мог записать RDB-снапшот → `stop-writes-on-bgsave-error yes` блокировал все записи → health-check 503 → nginx 502. OAuth `/oauth/resolve` тоже не мог записать токен → 503 на iPad Safari из Таиланда.

**Решение (runtime):** `CONFIG SET stop-writes-on-bgsave-error no` + `CONFIG SET save ''`
**Решение (код, PR #148):** `--save "" --stop-writes-on-bgsave-error no` в supervisord-db.conf и supervisord.conf

### Новый домен: slime-arena.u2game.space

Настроено: DNS → 147.45.147.175, SSL (acme.sh), nginx-конфиг, Яндекс OAuth redirect URI.

---

## Sprint 20 — Infrastructure v0.8.4 + UI Fixes v0.8.5 (2026-02-07)

**Цель:** Split-архитектура, бэкапы, безопасное обновление, UX авторизации, UI фиксы гостя
**PRs:** #139-#141 (v0.8.4), #142 (2FA fix), #143 (shutdown notification), #144 (v0.8.5 UI), #145 (margin fix)
**Версии:** v0.8.4 → v0.8.5

### v0.8.4 — Infrastructure

| Задача | Описание | Статус |
|--------|----------|--------|
| A1 | scripts/backup-remote.sh + протокол бэкапов | done |
| A2 | RestartPage в Admin Dashboard (2FA) | done |
| A3 | Dockerfiles, compose для split-архитектуры | done |
| A4 | CHANGELOG.md v0.7.5 — v0.8.4 | done |
| A5 | Версионирование всех файлов → 0.8.4 | done |
| A6 | AI_AGENT_GUIDE.md — полная переработка | done |
| A7 | SERVER_SETUP.md — docker-compose секция | done |
| B | Кнопка «Войти» для гостей в лобби | done |
| CI | Dockerfile fix + CI/CD → Docker images | done |

### v0.8.5 — UI Fixes (PR #144, #145)

| Задача | Описание | Статус |
|--------|----------|--------|
| C1 | generateGuestNickname() → GUEST_DEFAULT_NICKNAME | done |
| C2 | MainMenu: случайное имя вместо «Гость» | done |
| C3 | .hud-auth-link: jelly pill-кнопка | done |
| C4 | Favicon из slime-arena-icon.png | done |
| C5 | GUEST_DEFAULT_NICKNAME → shared/constants | done |
| C6 | PR review fixes: hit-area 44x44, focus-visible, isAnonymous guard | done |
| C7 | margin-top alignment | done (PR #145 merged) |
| A8 | Деплой на production | ⏳ оператор |

---

### Результаты тестирования v0.8.2 (2026-02-05)

| Категория | Результат |
|-----------|-----------|
| Smoke Tests (health, DB, Redis) | ✅ PASS |
| Guest Auth + Client | ✅ PASS |
| Admin Dashboard /admin/ | ✅ PASS |
| Admin Login + Stats + Rooms | ✅ PASS |
| Audit Log API + UI | ✅ PASS |
| CORS cross-origin | ✅ PASS |

**Исправления в v0.8.2:**
- P0-1: Миграция 009 — audit_log schema fix
- P0-2: Admin таблицы создаются корректно
- P0-3: Admin Dashboard добавлен в Docker (порт 5175)
- P0-4: CORS настроен для credentials
- P0-5: AuditPage — items vs entries fix
- P0-6: API_BASE для production (hostname:3000)

**Отчёт:** `docs/releases/v0.8.1-test-report.md`
**Hotfix PR:** https://github.com/komleff/slime-arena/pull/137

---

## ✅ Sprint MON — Admin Dashboard Phase 1 (2026-02-04)

**Цель:** Базовая админка для мониторинга
**Версия:** 0.8.0
**Статус:** Phase 1 ✅ ЗАВЕРШЕНА, Phase 2 ⏳ (backlog для Sprint 19)

### Что работает (Phase 1)

✅ **Авторизация администраторов**
- JWT access token (15 мин) + refresh token cookie (7 дней)
- Bcrypt password hashing (cost=10)
- Rate limiting: 5 req/min на login

✅ **2FA TOTP**
- AES-256-GCM encryption для секретов
- QR генерируется локально (не утекает)
- Enable/disable по требованию

✅ **Audit Log**
- Все admin действия логируются
- Таблица `audit_log` (id, user_id, action, target, timestamp, details_json)
- GET /api/v1/admin/audit доступен для admin

✅ **Игровая логика (неизменена)**
- Guest auth → guestToken выдаётся
- Яндекс OAuth работает полностью
- Результаты матчей сохраняются
- Leaderboard обновляется

### ✅ Phase 2 (Sprint 19) — ЗАВЕРШЕНА

✅ **Метрики сервера**
- CPU/RAM из cgroup v2/v1 → /proc → os fallback
- Tick latency (avgMs, maxMs из ArenaRoom)
- Список активных комнат с players/tick stats

✅ **Рестарт сервиса**
- Outbox pattern: restart-requested → watchdog → docker restart
- Idempotency по auditId, COOLDOWN после рестарта
- Telegram уведомления

✅ **Audit Log UI**
- Пагинация, мобильная/десктопная вёрстка
- Human-readable action labels
- Требуется TOTP для выполнения

⏳ **Рефакторинг на Preact** (ТЗ requirement)
- Текущее: React + TypeScript
- Требуется: Preact + @preact/signals (как в клиенте)

### Тестирование (локально 2026-02-04)

| Сценарий | Результат |
|----------|-----------|
| Login test_admin/Admin123 | ✅ OK — JWT токен получен |
| Refresh token | ✅ OK — новый accessToken выдан |
| Logout | ✅ OK — очистка сессии |
| Audit log GET | ✅ OK — логин зафиксирован |
| Guest auth | ✅ OK — guestToken выдан |
| Яндекс OAuth | ✅ OK — upgrade в существующий аккаунт |
| Leaderboard | ✅ OK — 3 записи загружены |
| Match play (guest) | ✅ OK — результат сохранён |

### Выявленные баги и решения

| Проблема | Решение | Статус |
|----------|---------|--------|
| audit_log schema mismatch (actor_user_id в БД, user_id в коде) | Пересоздать таблицу | ✅ Фиксировано вручную |
| Миграция 009 не в образе 0.8.0 | Таблицы созданы в контейнере | ⚠️ Требуется rebuild образа |
| supervisord требует CLAIM_TOKEN_TTL_MINUTES | Добавлено в docker run | ✅ |
| localStorage содержал старый гостевой токен | Очистить localStorage перед тестом | ✅ |
| Chrome расширение FILE_ERROR_NO_SPACE | Очистить Chrome cache | ✅ (не игры) |

### Рекомендация для production

**НЕ РЕКОМЕНДУЕТСЯ заливать v0.8.0 на боевой сервер:**
- Phase 2 не завершена (метрики, комнаты, рестарт — placeholder)
- Требуется пересборка образа (фиксы миграций)
- Админка на React вместо Preact

**План:** Оставить v0.7.8 в production, v0.8.0 → Sprint 19 Phase 2.

---

## ✅ Sprint 19 — Admin Dashboard Phase 2 (2026-02-05)

**Цель:** Завершить Admin Dashboard Phase 2
**Версия:** 0.8.1
**PR:** #136 (sprint-19/admin-dashboard-phase2)
**Статус:** ✅ ГОТОВ К MERGE — консенсус 3/3 APPROVED

### Что реализовано (Phase 2)

✅ **Метрики сервера** (`systemMetrics.ts`)
- CPU/RAM из cgroup v2 → v1 → /proc → os module (fallback chain)
- Tick latency буфер в ArenaRoom
- GET /api/v1/admin/stats endpoint

✅ **Список комнат** (`RoomsPage.tsx`)
- GET /api/v1/admin/rooms endpoint
- Real-time polling каждые 5 сек
- Карточки с фазой, игроками, tick latency

✅ **Аудит-лог** (`AuditPage.tsx`)
- GET /api/v1/admin/audit с пагинацией
- Мобильная и десктопная версия
- Локализация action names

✅ **Рестарт сервиса** (`watchdog.py`)
- POST /api/v1/admin/restart (требует 2FA)
- Outbox pattern с атомарными операциями
- Recovery при старте watchdog
- Telegram уведомления
- systemd service файл

✅ **Версионирование** (`sync-version.js`)
- Централизованная версия в version.json
- Синхронизация 8 файлов (package.json + docker)

### Ревью (2026-02-05)

| Агент | Статус | Замечаний |
|-------|--------|-----------|
| Security Agent | ✅ APPROVED | 2 P1, 2 P2 |
| Code Quality Agent | ✅ APPROVED | 5 P2, 10 P3 |
| Architecture Agent | ✅ APPROVED | 5 P2, 3 P3 |
| GitHub Copilot | ✅ COMMENTED | 7 |

**Консенсус:** ✅ ДОСТИГНУТ (3/3 APPROVED)

### Закрытые задачи

- ✅ `slime-arena-wld1` — Версия 0.8.1 синхронизирована
- ✅ `slime-arena-mon1` — React → Preact (PR#136)
- ✅ `slime-arena-mon2` — Server Metrics (PR#136)
- ✅ `slime-arena-mon3` — Active Rooms List (PR#136)
- ✅ `slime-arena-mon4` — Audit Log UI (PR#136)

### Tech Debt (из логов production)

- #126: UI фаза 'connecting' не рендерится
- #127: Оптимизация tick=2700 (просадки до 118ms)
- #128: "Не удалось разместить зон" (303 события)
- #129: Устаревшие endpoints → 404
- #130: Docker logs директория permissions

**Цель:** Административная панель мониторинга сервера
**PR Backend:** #133 (sprint-mon/backend-ops) → main ✅ MERGED
**PR Frontend:** #134 (sprint-mon/frontend) → main ✅ MERGED
**Релиз:** v0.8.0 ✅ https://github.com/komleff/slime-arena/releases/tag/v0.8.0
**Docker:** `ghcr.io/komleff/slime-arena-monolith-full:0.8.0` ✅

### Backend (PR #133)

| Компонент | Описание | Статус |
|-----------|----------|--------|
| Admin Auth | JWT access + refresh tokens, httpOnly cookies | ✅ |
| TOTP 2FA | AES-256-GCM encryption, QR генерация локально | ✅ |
| Rate Limiting | IP-based (login) + per-user (authenticated) | ✅ |
| Audit Service | Логирование всех действий администратора | ✅ |
| DB Migration | 009_admin_tables.sql | ✅ |

**Безопасность:**
- ✅ Timing attack protection (bcrypt с dummy hash)
- ✅ QR генерируется локально (не утекает на внешние API)
- ✅ TOTP rate limit 3 req/min
- ✅ Индекс на refresh_token_hash

### Frontend (PR #134)

| Компонент | Описание | Статус |
|-----------|----------|--------|
| Login Page | Форма входа с rate limit handling | ✅ |
| Settings Page | TOTP setup flow с QR-кодом | ✅ |
| API Client | 401 interceptor + refresh queue | ✅ |
| Auth Signals | Access token в памяти (не localStorage) | ✅ |

**Стек:** Preact + @preact/signals + Vite

### Review Summary

| Агент | PR #133 | PR #134 |
|-------|---------|---------|
| Security Agent | ✅ | ✅ |
| Code Quality Agent | ✅ | ✅ |
| Architecture Agent | ✅ | ✅ |
| GPT-5.2-Codex | ✅ | ✅ |
| Copilot | ✅ | ✅ |

### Tech Debt (Backlog)

| ID | Priority | Description |
|----|----------|-------------|
| TD-MON-1 | P3 | In-memory rate limiter → Redis при масштабировании |
| TD-MON-2 | P3 | TODO без issue-id в заглушках Phase 2 |
| TD-MON-3 | P3 | Emoji → SVG иконки в Phase 2 |

---

## ✅ Sprint 18 — Tech Debt + Production Deploy (2026-02-01/03)

**Цель:** Стабильность + безопасность + первый production deploy
**Версия:** 0.7.4 → 0.7.8
**Ветка:** `sprint-18/tech-debt-reduction` → main
**Деплой:** VPS Timeweb (Docker monolith)

### Phase 1: Tech Debt (v0.7.5)

| ID | Тип | Описание | Статус |
|----|-----|----------|--------|
| `slime-arena-zmf` | P1 bug | Джойстик смещает базу | ✅ |
| `slime-arena-k8w` | P2 bug | Скин после OAuth | ✅ |
| `slime-arena-hp5` | P2 | Play Again нестабилен | ✅ |
| `slime-arena-3ed` | P1 security | Rate limiting /auth/* | ✅ |
| `slime-arena-2q0` | P1 security | Nickname validation | ✅ |
| `slime-arena-0v2` | P2 | REWARDS_CONFIG → balance.json | ✅ |
| `slime-arena-yij` | P2 | Auth signals cache | ✅ |
| `slime-arena-xta` | P2 | Results UI разделение | ✅ |

### Phase 2: Production Deploy (v0.7.6-0.7.8)

| Версия | Описание | Статус |
|--------|----------|--------|
| 0.7.6 | Docker env vars fix | ✅ |
| 0.7.7 | Client IP detection for reverse proxy | ✅ |
| 0.7.8 | supervisord env vars passthrough | ✅ |

### Ключевые изменения

**PR #117-#118 (Tech Debt):**

- **Rate limiting:** самописный middleware (0 зависимостей) — 10 req/min для auth, 5 req/min для OAuth
- **Nickname validation:** `validateAndNormalize()` в /auth/upgrade, /join-token
- **REWARDS_CONFIG:** перенесён в balance.json с секцией rating

**PR #124 (Reverse Proxy Fix):**

- **metaServerClient.ts:** `isIPAddress()` для определения режима работы
- **Логика:** IP-адрес → порт 3000, домен → относительные пути через прокси

**Commit 9bfb415 (supervisord fix):**

- **supervisord.conf:** `%(ENV_...)s` синтаксис для передачи env vars в MetaServer
- **Критично:** без этого MetaServer не получал JWT_SECRET и падал в crash loop

### Production Environment

- **VPS:** Timeweb Cloud (Москва)
- **IP:** 147.45.147.175
- **SSH:** `ssh -i ~/.ssh/id_ed25519 root@147.45.147.175`
- **Container:** `ghcr.io/komleff/slime-arena-monolith-full:0.7.8`
- **Volumes:** `slime-arena-pgdata`, `slime-arena-redisdata` (персистентные)
- **Порты:** 3000 (API), 2567 (WebSocket), 5173 (Client)
- **SSL:** Отложен (доступ по IP)

### Server Maintenance (2026-02-03)

**Исправлено на сервере:**
- ✅ Redis RDB Permission denied → перезапуск контейнера
- ✅ Права на `/app/server/dist/server/logs` для телеметрии
- ✅ `vm.overcommit_memory=1` для Redis

**Обнаруженные проблемы (issues созданы):**
- #126: UI фаза 'connecting' не рендерится (мелькает main-menu)
- #127: Оптимизация tick=2700 (просадки до 118ms)
- #128: "Не удалось разместить зон" — 303 предупреждения
- #129: Устаревшие API endpoints → 404
- #130: Docker директория логов телеметрии

### Domain Setup (2026-02-03)

**Домен:** https://slime-arena.overmobile.space ✅ РАБОТАЕТ

**Nginx конфигурация:** `/etc/nginx/sites-available/slime-arena.overmobile.space`

| Location | Proxy Target | Описание |
|----------|--------------|----------|
| `/api/` | :3000 | MetaServer API |
| `/auth/` | :3000 | Legacy auth |
| `/matchmake/` | :2567 | Colyseus matchmake |
| `^/[a-zA-Z0-9]+/[a-zA-Z0-9]+$` | :2567 | WebSocket rooms |
| `/.well-known/colyseus` | :2567 | Colyseus discovery |
| `/` | :5173 | Client (fallback) |

**SSL:** acme.sh (Let's Encrypt) — `/root/.acme.sh/slime-arena.overmobile.space_ecc/`

**Ключевой момент:** Colyseus WebSocket использует пути `/{processId}/{roomId}` — требуется отдельный location с regex.

**Полезные команды:**
```bash
# Проверить статус
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 "docker ps && docker inspect slime-arena --format='{{.State.Health.Status}}'"

# Логи
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 "docker logs --tail 50 slime-arena"

# Перезапуск
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 "docker restart slime-arena"

# Redis ping
ssh -i ~/.ssh/id_ed25519 root@147.45.147.175 "docker exec slime-arena redis-cli ping"
```

### Beads закрыты

- ✅ `slime-arena-ejlb` — Базовая настройка сервера
- ✅ `slime-arena-tfty` — Деплой Docker-контейнера

---

## ✅ Sprint 17 — ЗАВЕРШЁН (2026-02-01)

**Релиз:** v0.7.4 OAuth Hotfix + LeaderboardScreen
**PR:** #116 (merged)

### OAuth Hotfix — все исправлено

| FIX | Описание | Статус |
|-----|----------|--------|
| FIX-000 | dotenv в MatchServer | ✅ |
| FIX-001 | Восстановление guest_token без login() | ✅ |
| FIX-002 | Блокировка OAuth без токена | ✅ |
| FIX-005 | Очистка claim токенов | ✅ |
| FIX-006 | setOnUnauthorized после восстановления | ✅ |
| FIX-007 | ProfileSummary в createDefaultProfile | ✅ |
| FIX-009 | Сохранение access_token в localStorage | ✅ |
| FIX-010 | fetchProfile после finishUpgrade | ✅ |

### LeaderboardScreen v1.6 — реализован

| Компонент | Статус |
|-----------|--------|
| LeaderboardScreen базовый | ✅ |
| Переключатель total/best | ✅ |
| API с myPosition/myValue | ✅ |
| Гибридная плашка игрока | ✅ |
| Миниатюра скина | ✅ |
| Автозакрытие при матче | ✅ |

### Review Status (PR #116)

| Reviewer | Verdict |
|----------|---------|
| Claude Opus 4.5 | ✅ APPROVED |
| Gemini Code Assist | ✅ APPROVED |
| GPT-5 Codex | ✅ APPROVED |
| Lingma | ✅ APPROVED |

---

## 🎯 Следующие шаги

### P2 Backlog (Sprint 18)

- FIX-003: base64url нормализация в decodeClaimToken
- FIX-004: Проверка exp токена в гостевой плашке

---

## 📋 Tech Debt

| Issue | Priority | Description |
|-------|----------|-------------|
| #126 | P3 | UI: фаза 'connecting' не рендерится |
| #127 | P2 | Performance: tick=2700 просадки до 118ms |
| #128 | P3 | Server: "Не удалось разместить зон" |
| #129 | P3 | API: устаревшие endpoints → 404 |
| #130 | P3 | Docker: директория логов телеметрии |

| Beads ID | Priority | Description |
|----------|----------|-------------|
| slime-arena-74gx | P2 | Merge anonymous match into existing account |
| slime-arena-9zu | P2 | GeoIP: HTTPS вместо HTTP |
| slime-arena-b1b | P1 | PKCE валидация на сервере |
| slime-arena-5tp | P1 | UNKNOWN регион: отключить Google |
| slime-arena-b48 | P1 | Accessibility: Escape + focus trap |

*Sprint 18 закрыты: slime-arena-3ed, slime-arena-2q0, slime-arena-k8w, slime-arena-yij, slime-arena-zmf*

---

## 🎯 Sprint 16 — OAuth для Standalone (ЗАВЕРШЁН)

**Ветка:** sprint-16/oauth-standalone → main
**PR:** #115 (merged)
**Версия:** 0.7.3
**Цель:** Google/Yandex OAuth авторизация для Standalone платформы

---

## 📋 Готово для следующей сессии (After Vacation)

### PRs на внимание
```
#141  chore: release v0.8.4 ✅ MERGED —  tag pushed, Docker images built
#140  fix(docker): COPY scripts/ ✅ MERGED
#139  Sprint 20 infra ✅ MERGED  
#138  (если были открыты) — проверить статус в GitHub
```

### Активные задачи в Beads (готовые к работе)

**P1 критичные:**

- slime-arena-vsn5 [P1 bug] — Скин не сохраняется при OAuth upgrade (#121)

**P2 высокий:**

- slime-arena-n17m [P2] — normalizeNickname() падает на null/undefined
- slime-arena-a5h0 [P2 ops] — Настроить cron-бэкап PostgreSQL (после деплоя)

**P3 средний (из PR #144 ревью):**

- slime-arena-0jns [P3] — Вынести NICKNAME_MIN/MAX_LENGTH в balance.json
- slime-arena-90h9 [P3] — Защита от отправки «Гость» как имени в матч
- slime-arena-r6v5 [P3] — Устаревшие API endpoints

**P4 бэклог:**

- slime-arena-i5mz [P4] — Вынести BANNED_WORDS в отдельный JSON

**Запуск:** `bd ready --limit 20` для полного списка

### Production Deployment ⏳
**Текущая версия в production:** v0.7.8
**Готова к деплою:** v0.8.4 (Docker images в ghcr.io)
**Ответственный:** Оператор (требует вручную`)
**После деплоя:** Настроить cron-бэкап (task slime-arena-a5h0)

### Важные пути
- Config: [config/balance.json](config/balance.json) — все параметры игры
- Tech debt: [TECH_DEBT.md](TECH_DEBT.md) — актуальные проблемы (обновлено 7 фев)
- Server setup: [docs/operations/SERVER_SETUP.md](docs/operations/SERVER_SETUP.md)
- AI Guide: [docs/operations/AI_AGENT_GUIDE.md](docs/operations/AI_AGENT_GUIDE.md)

---

## Команды

```bash
# Разработка
npm run dev:server      # ws://localhost:2567
npm run dev:client      # http://localhost:5174

# Тесты и сборка
npm run test
npm run build

# Beads
bd ready                 # Доступные задачи
bd list --status open    # Все открытые

# Git
git pull --rebase       # Перед работой
git push                # После завершения
bd sync                 # Синхронизировать Beads
```

