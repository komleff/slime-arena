# Progress
Отслеживание статуса задач.

## Контроль изменений
- **last_checked_commit**: sprint-13/meta-gameplay @ 23 января 2026 (919299c)
- **Текущая ветка**: `sprint-13/meta-gameplay` (worktree: d:/slime-arena-meta/)
- **Релиз:** v0.6.0 ✅ → **Целевой релиз:** v0.7.0 (Sprint 13)
- **Soft Launch Status**: ✅ READY (6/6 критериев выполнено)
- **GDD версия**: v3.3.2

## Sprint 13 Progress — 23 января 2026

### Фаза 1: База данных и инфраструктура ✅ ЗАВЕРШЕНА

**Завершено сегодня:**
- [x] Задача 1.1: Migration 007 — новые таблицы (leaderboard_total_mass, leaderboard_best_mass, rating_awards, oauth_links)
- [x] Задача 1.2: Migration 008 — изменение существующих таблиц (users: is_anonymous + регистрация, match_results: guest_subject_id + claim_consumed_at)
- [x] Задача 1.3: Модели данных — TypeScript интерфейсы (Leaderboard, Rating, OAuth)
- [x] Задача 1.4: Генераторы — skinGenerator + nicknameValidator + config/skins.json

**Коммиты (sprint-13/meta-gameplay):**
- `aa03142` feat(db): add migration 007 for meta-gameplay tables
- `cf04c4d` feat(db): add migration 008 for meta-gameplay columns
- `11e17d0` feat(utils): add skinGenerator and nicknameValidator
- `919299c` feat(meta): add data models for meta-gameplay

**Прогресс:**
- Фаза 1: [████] 4/4 задач (100%) ✅
- Фаза 2: [░░░░] 0/9 задач (0%)
- Фаза 3: [░░░░] 0/9 задач (0%)
- **Всего:** [██░░] 4/25 задач (16%)

**Следующий шаг:**
- Начать Фазу 2: API и серверная логика
- Первые задачи: JWT utilities (2.1), POST /auth/guest (2.2), POST /auth/telegram (2.3)

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
