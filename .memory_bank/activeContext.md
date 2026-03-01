# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние (1 марта 2026)

**База:** main → **v0.8.5**, ветка `sprint-21/bugfix-tech-debt` → **v0.8.6** (PR #150, ожидает merge)
**GDD версия:** 3.3.2
**Sprint 21 Status:** Код готов, ревью пройдено, ожидает merge оператором
**Production:** v0.8.5 (split-архитектура, два контейнера, два домена)

---

## Sprint 21 — Багфиксы, тех долг, спрайтовая система (v0.8.6)

**Цель:** Стабилизация + редизайн спрайтовой системы. Исправление P1/P2 багов.
**Ветка:** `sprint-21/bugfix-tech-debt` (21 коммит)
**PR:** #150

### Фаза 1: Багфиксы (9 задач) — done

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

### Фаза 2: Спрайтовая система — done

| Коммит | Описание |
|--------|----------|
| `03de755` | Замена цветных скинов на спрайтовую систему (21 спрайт) |
| `8878de3` | spriteId в generateFallbackToken |
| `e1aad77` | Исправления по ревью спрайтов (итерация 1) |
| `396425c` | Исправления по ревью спрайтов (итерация 2): leaderboard, matchmaking, дедупликация |
| `885392d` | Создание аккаунта при новом OAuth (вместо 404) |
| `a2c7f91` | intent="login" на MainScreen OAuth (P0 fix) |

### Открытая задача из Sprint 21

- `slime-arena-vk4m` (P1, open) — Спрайтовая система: сквозной flow выбора и сохранения (4 корневых причины)

---

## Production (v0.8.5)

**Docker images (ghcr.io):** `slime-arena-app:0.8.5` + `slime-arena-db:0.8.5`

| Домен | Статус | SSL |
|-------|--------|-----|
| https://slime-arena.overmobile.space | работает | Let's Encrypt (ECC) |
| https://slime-arena.u2game.space | работает | Let's Encrypt (ECC) |

**Инфраструктура:** db + app контейнеры, Nginx, Watchdog (systemd), cron-бэкапы (6ч)
**Документация:** SERVER_SETUP.md, SERVER_UPDATE.md, AI_AGENT_GUIDE.md

---

## Следующие шаги

### P1
- `slime-arena-vk4m` — Спрайтовый flow: клиент не передаёт skinId в matchmaking, clearGuestData() удаляет guest_skin_id, нет API для смены скина
- `slime-arena-b1b` — PKCE валидация на сервере
- `slime-arena-5tp` — UNKNOWN регион: отключить Google OAuth

### P2
- `slime-arena-74gx` — Merge anonymous match into existing account
- `slime-arena-bfce` — Admin: N+1 remoteRoomCall

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

# Production
SSH="ssh -i ~/.ssh/deploy_key root@147.45.147.175"
$SSH 'cd /root/slime-arena && docker compose ps'
curl -s https://slime-arena.overmobile.space/health | jq .
```
