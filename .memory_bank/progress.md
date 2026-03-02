# Progress

Отслеживание статуса задач.

## Контроль изменений

- **last_checked_commit**: main @ 2 марта 2026 (`59fd607` — chore: bump version to v0.8.7)
- **Текущая ветка**: `main`
- **Production:** v0.8.6 (развёрнут 1 марта 2026)
- **Main:** v0.8.7 (тег создан, Docker CI собирает образ)
- **GDD версия**: v3.3.2

---

## Sprint 22 (2026-03-02) — v0.8.7 Hotfix — ЗАВЕРШЕНО

**Цель:** Исправление P1 багов после деплоя v0.8.6
**PR:** #153 — merged

- [x] slime-arena-t8pp (P1) — Таймер «Перед боем» зависает (arenaWaitInterval: remaining -= 1 → Date.now())
- [x] slime-arena-o7v5 (P1) — matchId cycling на ResultsScreen → мигание наград
- [x] slime-arena-boea (P1) — Гостевой токен истёк → 401 → logout → isAnonymous()=false
- [x] slime-arena-gikx (P1) — «Сохранить прогресс» не показывается (следствие boea, закрыт вместе с ним)

**Ревью:** Opus ✅ + Gemini ✅ + Codex ✅

---

## Post-Sprint 21 Hotfixes (2026-03-01) — ЗАВЕРШЕНО

Прямые коммиты в main после merge PR #150:

- [x] `d87a253` — Leaderboard: fallback на slime-base.webp (цветной круг вместо спрайта)
- [x] `a29b475` — CI: GITHUB_TOKEN вместо CR_PAT (истёк, publish-containers упал)
- [x] Деплой v0.8.6 на production (1 марта 2026)

---

## Sprint 21 (2026-02-28 — 2026-03-01) — v0.8.6 Bugfix & Tech Debt — ЗАВЕРШЕНО

**Цель:** Стабилизация + редизайн спрайтовой системы
**PR:** #150 — merged

### Фаза 1: Багфиксы (9/9)

- [x] slime-arena-b7z6 (P1) — Зависание экрана выбора класса
- [x] slime-arena-hfww (P2) — Таймер Chrome mobile (ResultsScreen)
- [x] slime-arena-3v3o (P2) — ConnectingScreen
- [x] slime-arena-vsn5 (P1) — skinId при OAuth upgrade
- [x] slime-arena-n17m (P2) — normalizeNickname null guard
- [x] slime-arena-mtw (P2) — Симметричные модификаторы укуса
- [x] slime-arena-4xh (P2) — Вампир по GDD
- [x] slime-arena-y2z2 (P2) — Гость: реактивный isAnonymous
- [x] slime-arena-vpti (P2) — generateRandomBasicSkin в meta/

### Фаза 2: Спрайтовая система

- [x] Замена цветных скинов (4 цвета) на 21 спрайт
- [x] shared/src/sprites.ts: SPRITE_NAMES, pickSpriteByName, isValidSprite
- [x] Player.spriteId в Colyseus schema → JoinTokenPayload → ArenaRoom → клиент
- [x] spriteId в matchmaking flow + leaderboard валидация
- [x] Удалён config/skins.json (ошибочный артефакт)

### Открытая задача из Sprint 21

- slime-arena-vk4m (P1, open) — Спрайтовый flow: сквозной (клиент не передаёт skinId, clearGuestData удаляет guest_skin_id, нет API смены скина)

---

## Sprint 20 (2026-02-07) — v0.8.4/v0.8.5 — ЗАВЕРШЕНО

Split-архитектура, Admin Dashboard на production, UI фиксы гостя.
PRs: #139-#146. Развёрнут на production 7 фев 2026.

## Server Maintenance (2026-02-08) — ЗАВЕРШЕНО

Redis MISCONF → 502 + OAuth 503. PR #148. Новый домен u2game.space.

---

*Полная история предыдущих спринтов доступна в Git history*
