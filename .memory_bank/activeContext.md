# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние (7 февраля 2026)

**База:** main → **v0.8.5**
**GDD версия:** 3.3.2
**Production:** v0.8.5 — split-архитектура (db + app), Admin Dashboard, Watchdog
**Домен:** https://slime-arena.overmobile.space
**GitHub Release:** v0.8.5 (latest)

**Docker images (ghcr.io):**

- `ghcr.io/komleff/slime-arena-app:0.8.5` ✅
- `ghcr.io/komleff/slime-arena-db:0.8.5` ✅

---

## Production v0.8.5 (развёрнут 7 февраля 2026)

### Инфраструктура

| Компонент | Описание |
|-----------|----------|
| `slime-arena-db` | PostgreSQL 16 + Redis (docker-compose) |
| `slime-arena-app` | MetaServer + MatchServer + Client + Admin Dashboard |
| Nginx | Reverse proxy + SSL (Let's Encrypt via acme.sh) |
| Watchdog | systemd-сервис: health monitoring + restart handler |
| Бэкапы | Cron каждые 6 часов, ротация 7 дней |

### Администраторы

| Логин | Роль |
|-------|------|
| admin | Суперадмин |
| Komleff | Разработчик |
| Viktor | Оператор |
| Ironman | Оператор |
| Taskmgr | Оператор |

Все пароли уникальные, выданы индивидуально.

### Admin Dashboard (https://slime-arena.overmobile.space/admin/)

- **Dashboard** — метрики сервера (CPU, RAM, uptime, онлайн)
- **Rooms** — активные игровые комнаты
- **Audit** — журнал действий администраторов
- **Settings** — 2FA, смена пароля
- **Restart** — перезапуск с 2FA подтверждением и уведомлением игроков

### Документация

| Документ | Описание |
|----------|----------|
| [SERVER_SETUP.md](docs/operations/SERVER_SETUP.md) | Установка с нуля |
| [SERVER_UPDATE.md](docs/operations/SERVER_UPDATE.md) | Обновление сервера |
| [AI_AGENT_GUIDE.md](docs/operations/AI_AGENT_GUIDE.md) | Гайд для ИИ-агентов |
| [v0.8.5 Release Notes](docs/releases/v0.8.5.md) | Релиз-ноутс |

---

## Оператор в отпуске (8-22 февраля 2026)

Сервер v0.8.5 работает автономно. Watchdog автоматически перезапускает при сбоях.

---

## Следующие шаги (после отпуска)

### P1 критичные

- **#121** — Скин не сохраняется при OAuth upgrade
- **PlayersPage** — Страница управления игроками в Admin Dashboard (TECH_DEBT.md)
- **PKCE валидация** — на сервере для OAuth

### P2 важные

- **AdminUsersPage** — Страница управления администраторами в Admin Dashboard
- **normalizeNickname()** — защита от null/undefined
- **Cron-бэкап** — ✅ настроен на сервере (каждые 6 часов)

### P3 средние

- UI: фаза 'connecting' не рендерится (#126)
- Оптимизация tick=2700 (#127)
- Устаревшие API endpoints (#129)

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
