# Progress
Отслеживание статуса задач.

## Контроль изменений
- **last_checked_commit**: main @ 4 февраля 2026 (v0.7.8 production)
- **Текущая ветка**: `main` 
- **Релиз:** v0.7.8 ✅ (production deployed)
- **v0.8.0 (Admin):** ✅ Phase 1 тестирование завершено, Phase 2 → Sprint 19
- **GDD версия**: v3.3.2

---

## Sprint MON (2026-02-04) — ✅ ЗАВЕРШЁН

**Цель:** Admin Dashboard v0.8.0 (Phase 1)
**Статус:** Тестирование завершено, Phase 2 отложена на Sprint 19

### Результаты тестирования (локально)

✅ **Базовая функциональность**
- Admin auth (JWT + refresh cookies)
- TOTP 2FA setup
- Audit log (все действия логируются)

✅ **Игровая логика (неизменена)**
- Guest auth работает
- Яндекс OAuth работает
- Leaderboard обновляется
- Статистика матчей сохраняется

⚠️ **Admin Phase 2 (backlog)**
- Метрики CPU/RAM (placeholder)
- Список комнат (placeholder)
- Рестарт сервиса (требует watchdog)

### Выявленные проблемы

| Проблема | Решение | Критичность |
|----------|---------|-------------|
| audit_log schema (actor_user_id vs user_id) | Пересоздать таблицу | P2 |
| Миграция 009 не в образе | Требуется rebuild | P2 |
| Админка на React вместо Preact | Рефакторинг Sprint 19 | P3 |

### Вывод

**v0.8.0 НЕ ГОТОВА для production.** Оставить на v0.7.8 до Sprint 19.

---

## Server Maintenance Log (2026-02-03/04)

### Настроен SSH доступ
- Сгенерирован SSH ключ: `ssh-keygen -t ed25519`
- Добавлен в панель управления хостинга
- Подключение: `ssh -i ~/.ssh/id_ed25519 root@147.45.147.175`

### Исправлено на сервере
| Проблема | Решение | Статус |
|----------|---------|--------|
| Redis RDB Permission denied | Перезапуск контейнера | ✅ |
| Telemetry logs EACCES | `chmod 777 /app/server/dist/server/logs` | ✅ |
| Memory overcommit warning | `sysctl vm.overcommit_memory=1` | ✅ |
| Container unhealthy | Restart + права | ✅ Healthy |

### Анализ логов — обнаружено
| Метрика | Значение |
|---------|----------|
| Всего тиков | 34669 |
| [PERF] warnings | 351 (1%) |
| Пиковая задержка | 118ms (бюджет 33.3ms) |
| "Не удалось разместить зон" | 303 раза |
| 404 на старые endpoints | Несколько |

### Созданные issues
- #126: UI фаза 'connecting' не рендерится
- #127: Оптимизировать tick=2700 (конец матча)
- #128: "Не удалось разместить зон" при создании комнаты
- #129: Устаревшие API endpoints → 404
- #130: Docker директория логов телеметрии

---

## Sprint 13 Progress — 27 января 2026

### Фаза 1: База данных и инфраструктура ✅ ЗАВЕРШЕНА

**Завершено 23 января:**
- [x] Задача 1.1: Migration 007 — новые таблицы (leaderboard_total_mass, leaderboard_best_mass, rating_awards, oauth_links)
- [x] Задача 1.2: Migration 008 — изменение существующих таблиц (users: is_anonymous + регистрация, match_results: guest_subject_id + claim_consumed_at)
- [x] Задача 1.3: Модели данных — TypeScript интерфейсы (Leaderboard, Rating, OAuth)
- [x] Задача 1.4: Генераторы — skinGenerator + nicknameValidator + config/skins.json

### Фаза 2: API и серверная логика ✅ ЗАВЕРШЕНА (PR #109)

**Завершено 27 января:**

- [x] Задача 2.1: JWT utilities — jwtUtils.ts (accessToken, guestToken, claimToken)
- [x] Задача 2.2: POST /auth/guest — гостевая авторизация
- [x] Задача 2.3: POST /auth/telegram — Telegram-авторизация с is_anonymous
- [x] Задача 2.4: POST /auth/oauth — OAuth для Google/Yandex
- [x] Задача 2.5: POST /match-results/claim — получение claimToken
- [x] Задача 2.6: POST /auth/upgrade — convert_guest + complete_profile
- [x] Задача 2.7: RatingService.awardRating — начисление после матча
- [x] Задача 2.8: RatingService.initializeRating — при регистрации
- [x] Задача 2.9: GET /leaderboard — лидерборд total/best

**Ревью (10 итераций):**

- Codex 5.2: APPROVED ✅
- Opus 4.5: APPROVED ✅
- Исправлены P1 баги: guestSubjectId в matchmaking, guest claim flow

**Ожидает merge:** PR #109 → main (человек-оператор)

**Прогресс:**
- Фаза 1: [████] 4/4 задач (100%) ✅
- Фаза 2: [████] 9/9 задач (100%) ✅
- Фаза 3: [░░░░] 0/9 задач (0%)
- **Всего:** [████░] 13/22 задач (59%)

**Следующий шаг:**

- Merge PR #109 (человек-оператор)
- Начать Фазу 3: Клиентская интеграция

---

## Последние изменения (20 января 2026)
- **Sprint 12 COMPLETED:** Декомпозиция God Objects (ArenaRoom.ts, main.ts)
- **v0.6.0 Released:** 8 модулей извлечено, 2043 LOC рефакторено, все тесты пройдены
- **Результат:** ArenaRoom −34%, main.ts −19%, детерминизм ✅, тесты ✅

## Открытые PR
- **PR #91:** fix(hud): correct level progress bar formula — устаревший (работа завершена в PR #93)

## Последние изменения (dev config)
- client/vite.config.ts: HMR host/protocol теперь задаются через `VITE_HMR_HOST` и `VITE_HMR_PROTOCOL` для корректной работы по локальной сети.
- Используется `loadEnv()` из Vite для поддержки `.env.local` файлов (исправлено по замечанию Codex P2).
- README.md обновлён: порт 5173 → 5174, добавлена документация HMR env vars.

## Последние изменения (main)
- PR #61-66: Ads Documentation Improvements — MERGED
- Sprint 11.2: TalentSystem Integration (PR #57) — MERGED
- Sprint 11: Tech Debt Refactoring (PR #56) — MERGED
- Sprint 10: Pre-Launch Fixes (PR #54) — MERGED
- Sprint 8: joinToken JWT Validation (PR #52) — MERGED
- Sprint 7: Legacy DOM Cleanup (PR #50) — MERGED

## PR #74: Env-based HMR config (В РАБОТЕ)

### Изменения
- [x] vite.config.ts: функциональный конфиг с `loadEnv()` для чтения из `.env.local`
- [x] README.md: порт 5173 → 5174 во всех упоминаниях
- [x] README.md: добавлен раздел "Доступ с мобильных устройств (локальная сеть)"
- [x] activeContext.md: добавлен раздел "Локальная сеть (dev)"
- [x] progress.md: добавлен раздел "Последние изменения (dev config)"
- [x] Resolve.alias сохранены (Preact compat, @slime-arena/shared)
- [x] allowedHosts: ['*.overmobile.space'] сохранён

### Review Fixes
- [x] **Codex P2**: `process.env` → `loadEnv(mode, process.cwd(), 'VITE_')` для поддержки `.env.local`
- [x] **Copilot**: Порт 5173 → 5174 в README.md

### Конфликты (разрешены)
- [x] client/vite.config.ts — merged: env-based HMR + aliases
- [x] .memory_bank/activeContext.md — merged: main content + LAN dev section
- [x] .memory_bank/progress.md — merged: main content + dev config section

---

*Полная история предыдущих спринтов доступна в Git history*
