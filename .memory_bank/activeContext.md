# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**База:** main (v0.7.8)
**GDD версия:** 3.3.2
**Sprint 14 Status:** ✅ ЗАВЕРШЁН — v0.7.0 released
**Sprint 15 Status:** ✅ ЗАВЕРШЁН — PR#112 merged (v0.7.1-dev)
**Sprint 16 Status:** ✅ ЗАВЕРШЁН — PR#115 merged (v0.7.3)
**Sprint 17 Status:** ✅ ЗАВЕРШЁН — PR#116 merged (v0.7.4)
**Sprint 18 Status:** ✅ ЗАВЕРШЁН — v0.7.8 deployed to VPS

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

| Location | Модификатор | Proxy Target | Описание |
|----------|-------------|--------------|----------|
| `/api/` | `^~` | :3000 | MetaServer API |
| `/auth/` | `^~` | :3000 | Legacy auth |
| `/matchmake/` | `^~` | :2567 | Colyseus matchmake |
| `/assets/` | `^~` | :5173 | JS/CSS бандлы |
| `/backgrounds/` | `^~` | :5173 | Фоны |
| `/hud/` | `^~` | :5173 | HUD элементы |
| `/icons/` | `^~` | :5173 | Иконки |
| `/skins/` | `^~` | :5173 | Скины |
| `/sprites/` | `^~` | :5173 | Спрайты |
| `^/[a-zA-Z0-9]+/[a-zA-Z0-9]+` | `~` | :2567 | WebSocket rooms |
| `/.well-known/colyseus` | — | :2567 | Colyseus discovery |
| `/` | — | :5173 | Client (fallback) |

**Критичные особенности:**
- `^~` — останавливает поиск regex, даёт приоритет prefix locations
- WebSocket regex БЕЗ `$` на конце — иначе не пропускает `?sessionId=...`
- Все статические директории из `client/dist` должны иметь явные locations

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
