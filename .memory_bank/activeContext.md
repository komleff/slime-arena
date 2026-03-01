# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние (2 марта 2026)

**Production:** v0.8.6 (развёрнут 1 марта 2026 после merge PR #150)
**Main:** v0.8.7 (PR #153 merged, тег создан, Docker CI собирает образ)
**GDD версия:** 3.3.2

---

## Sprint 22 — Hotfix (2 марта 2026) — v0.8.7

**PR:** #153 — merged
**Ветка:** `sprint-22/bugfix-timer-auth-matchid`

### Исправления (3/3) — ЗАВЕРШЕНО

| Beads ID | P | Задача | Коммит |
|----------|---|--------|--------|
| slime-arena-t8pp | P1 | Таймер «Перед боем» зависает (arenaWaitInterval → Date.now()) | `8d811f4` |
| slime-arena-o7v5 | P1 | matchId cycling на ResultsScreen (capturedMatchIdRef) | `8d811f4` |
| slime-arena-boea | P1 | Гостевой токен истёк → 401 loop → isAnonymous()=false | `8d811f4` |
| slime-arena-gikx | P1 | «Сохранить прогресс» не показывается (следствие boea) | закрыт через boea |

**Ревью:** Opus ✅, Gemini ✅, Codex ✅ — консенсус достигнут

---

## Sprint 21 — v0.8.6 (1 марта 2026) — ЗАВЕРШЕНО

PR #150 merged. Спрайтовая система (21 спрайт), 9 багфиксов.
Задокументировано в `docs/releases/v0.8.6-release-notes.md`.

Также deployed hotfixes прямо в main:
- `d87a253` — leaderboard: fallback на slime-base.webp вместо цветного круга
- `a29b475` — CI: GITHUB_TOKEN вместо CR_PAT (истёк)

---

## Production (v0.8.6)

**Docker images:** `slime-arena-app:latest` + `slime-arena-db:latest`

| Домен | Статус |
|-------|--------|
| https://slime-arena.overmobile.space | работает |
| https://slime-arena.u2game.space | работает |

**Деплой v0.8.7** (когда Docker CI соберёт образ):
```bash
SSH="ssh -i ~/.ssh/deploy_key root@147.45.147.175"
$SSH 'mkdir -p /root/backups && docker exec slime-arena-db pg_dump -U slime slime_arena | gzip > /root/backups/pre-v087-$(date +%F-%H%M).sql.gz'
$SSH 'cd /root/slime-arena && docker compose pull app && docker compose up -d app'
curl -s https://slime-arena.overmobile.space/health | jq .
```

---

## Открытые задачи

### P1
- `slime-arena-vk4m` — Спрайтовый flow: клиент не передаёт skinId в matchmaking, clearGuestData() удаляет guest_skin_id, нет API смены скина
- `slime-arena-b1b` — PKCE валидация на сервере
- `slime-arena-5tp` — UNKNOWN регион: отключить Google OAuth

### P2
- `slime-arena-52k6` — ResultsScreen: добавить кнопку «Таблица лидеров»
- `slime-arena-bfce` — Admin: N+1 remoteRoomCall
- `slime-arena-74gx` — Merge anonymous match into existing account

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

# Production
SSH="ssh -i ~/.ssh/deploy_key root@147.45.147.175"
$SSH 'cd /root/slime-arena && docker compose ps'
curl -s https://slime-arena.overmobile.space/health | jq .
```
