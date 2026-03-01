# Progress

Отслеживание статуса задач.

## Контроль изменений

- **last_checked_commit**: main @ 8 февраля 2026 (PR #148 — Redis hotfix)
- **Текущая ветка**: `main`
- **Релиз:** v0.8.5 ✅ (GitHub Release latest, Docker images pushed)
- **Production:** v0.8.5 ✅ (split-архитектура, развёрнут 7 фев 2026, hotfix Redis 8 фев 2026)
- **GDD версия**: v3.3.2

---

## Production Deployment v0.8.5 (7 февраля 2026) — ✅ ЗАВЕРШЕНО

- ✅ Split-архитектура (db + app) развёрнута
- ✅ Миграции 001-010 применены
- ✅ Admin Dashboard — 5 администраторов
- ✅ Watchdog systemd-сервис установлен
- ✅ Cron-бэкап настроен (каждые 6 часов)
- ✅ Документация: SERVER_SETUP, SERVER_UPDATE, Release notes, CHANGELOG

## Server Maintenance (2026-02-08) — ✅ ЗАВЕРШЕНО

**Проблема:** 502 Bad Gateway + Яндекс OAuth 503 (iPad Safari, тайский IP)
**Причина:** Redis MISCONF — RDB-снапшот не пишется, блокировка записей
**PR:** #148 (fix/redis-rdb-snapshot-error)

- [x] Диагностика 502 → Redis MISCONF → health-check 503
- [x] Runtime-фикс: `CONFIG SET stop-writes-on-bgsave-error no` + `CONFIG SET save ''`
- [x] supervisord-db.conf и supervisord.conf: `--save "" --stop-writes-on-bgsave-error no`
- [x] Настроен домен `slime-arena.u2game.space` (DNS, SSL, nginx)
- [x] Яндекс OAuth: работает с тайского IP + iPad Safari

---

## Sprint 20 (2026-02-07) — v0.8.4 Infrastructure + v0.8.5 UI Fixes

**Цель:** Split-архитектура, бэкапы, UX авторизации, UI фиксы гостя, деплой
**PRs:** #139-#146
**Версии:** v0.8.4 → v0.8.5
**Статус:** ✅ ЗАВЕРШЁН — production развёрнут

### Результат

- Split-архитектура: db + app через docker-compose
- Admin Dashboard с 5 страницами
- Watchdog для автоматического мониторинга
- Полная документация (SERVER_SETUP, SERVER_UPDATE, AI_AGENT_GUIDE)
- 5 администраторов с 2FA

---

## Sprint MON (2026-02-04) — ✅ ЗАВЕРШЁН

**Цель:** Admin Dashboard v0.8.0 (Phase 1 + Phase 2)
**Версии:** v0.8.0 → v0.8.2
**Статус:** ✅ Завершён, развёрнут в production как часть v0.8.5

---

## Sprint 19 (2026-02-05) — ✅ ЗАВЕРШЁН

**Цель:** Admin Dashboard Phase 2
**Версия:** v0.8.1 → v0.8.2
**PR:** #136 (merged)
**Статус:** ✅ Завершён

---

## Sprint 18 (2026-02-01/03) — ✅ ЗАВЕРШЁН

**Цель:** Tech Debt + Production Deploy v0.7.8
**Версия:** v0.7.4 → v0.7.8
**Статус:** ✅ Завершён, production обновлён до v0.8.5

---

## Активные задачи (после отпуска)

### P1 критичные

| ID | Описание | Статус |
|----|----------|--------|
| #121 | Скин не сохраняется при OAuth upgrade | Открыто |
| TECH_DEBT | PlayersPage — управление игроками в Admin | Открыто |
| slime-arena-b1b | PKCE валидация на сервере | Открыто |
| slime-arena-5tp | UNKNOWN регион: отключить Google | Открыто |

### P2 важные

| ID | Описание | Статус |
|----|----------|--------|
| TECH_DEBT | AdminUsersPage — управление администраторами | Открыто |
| slime-arena-n17m | normalizeNickname() null/undefined | Открыто |
| slime-arena-74gx | Merge anonymous match into existing account | Открыто |

### P3 средние

| ID | Описание | Статус |
|----|----------|--------|
| #126 | UI фаза 'connecting' не рендерится | Открыто |
| #127 | Оптимизация tick=2700 | Открыто |
| #129 | Устаревшие API endpoints | Открыто |

---

*Полная история предыдущих спринтов доступна в Git history*
