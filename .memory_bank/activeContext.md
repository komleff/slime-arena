# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**База:** main (v0.8.0) → **v0.8.1-pre** (pre-release)
**GDD версия:** 3.3.2
**Sprint 19 Status:** ⚠️ PARTIAL — PR#136 merged, тестирование выявило P0 баги
**Production:** v0.7.8 (v0.8.1 ожидает фиксов)

### Результаты тестирования v0.8.1-pre (2026-02-05)

| Категория | Результат |
|-----------|-----------|
| Smoke Tests (health, DB, Redis) | ✅ PASS |
| Guest Auth + Client | ✅ PASS |
| Admin Login + Stats + Rooms | ✅ PASS |
| Audit Log API | ❌ FAIL (P0) |

**P0-1:** Несовместимость audit_log — seed-data создаёт `actor_user_id`, код ожидает `user_id`
**P0-2:** Admin таблицы (`admin_users`, `admin_sessions`) не в seed-data

**Отчёт:** `docs/testing/v0.8.1-test-report.md`

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
bd list --status=open    # Все открытые
```
