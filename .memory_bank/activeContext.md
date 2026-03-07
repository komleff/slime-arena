# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние (7 марта 2026)

**Production:** v0.8.6 (развёрнут 1 марта 2026 после merge PR #150)
**Main:** v0.8.7 (PR #153 merged, тег создан, Docker CI собирает образ)
**GDD версия:** 3.4.0 (обновлена в PR #157, синхронизирована с balance.json)

---

## Sprint 23 — Audit + Refactor (7 марта 2026) — В РАБОТЕ

**PR:** #157 — в ревью, требуются исправления P1 (6 замечаний Codex)

### Задачи

| ID | P | Статус | Описание | Прогресс |
|----|---|--------|---------|----------|
| — | — | **DONE** | Reverse-engineering audit (18 модулей + 99-discrepancies.md) | ✅ 20 файлов, 12,684 ins |
| — | — | **DONE** | GDD синхронизация v3.3.2 → v3.4.0 (balance.json as source-of-truth) | ✅ 8 файлов, 62 ins/61 del |
| — | — | **IN PROGRESS** | Исправления замечаний в PR #157 | ⏳ p1-artifact, maxPlayers, dmg-formulas, stats-count, memory-bank |
| — | — | **PENDING** | Создание beads-эпика для BonkRace fork (MVP scope) | ⏳ After PR #157 merge |

**Замечания Codex в PR #157:**
- P1 — служебный TodoWrite артефакт в 07-chests (удалён ✅)
- P1 — maxPlayers 2–30 → 20 в GDD-Core (исправлено ✅)
- P1 — формулы урона несовпадают (бок 20%→10%, хвост 30%→15%) (исправлено ✅)
- P1 — счётчики P0/P1 не совпадают (12/27 → 15/43) (исправлено ✅)
- P2 — Memory Bank не обновлён с GDD 3.4.0 (обновляется сейчас ⏳)

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
