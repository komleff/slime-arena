# Progress
Отслеживание статуса задач.

## Контроль изменений
- **last_checked_commit**: main @ 12 января 2026
- **Текущая ветка**: `feat/ui-arena-improvements`
- **Релиз игрового прототипа:** v0.4.0
- **Soft Launch Status**: ✅ READY (6/6 критериев выполнено)
- **GDD версия**: v3.3.2

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
