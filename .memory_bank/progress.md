# Progress

Отслеживание статуса задач.

## Контроль изменений

- **last_checked_commit**: sprint-21/bugfix-tech-debt @ 1 марта 2026 (a2c7f91)
- **Текущая ветка**: `sprint-21/bugfix-tech-debt` (PR #150)
- **Релиз:** v0.8.6 (ожидает merge)
- **Production:** v0.8.5 ✅ (split-архитектура, развёрнут 7 фев 2026, hotfix Redis 8 фев 2026)
- **GDD версия**: v3.3.2

---

## Sprint 21 (2026-02-28 — 2026-03-01) — v0.8.6 Bugfix & Tech Debt

**Цель:** Стабилизация + редизайн спрайтовой системы
**Ветка:** `sprint-21/bugfix-tech-debt` (21 коммит)
**PR:** #150

### Фаза 1: Багфиксы (9/9) — ✅ ЗАВЕРШЕНО

- [x] slime-arena-b7z6 (P1) — Зависание экрана выбора класса
- [x] slime-arena-hfww (P2) — Таймер Chrome mobile
- [x] slime-arena-3v3o (P2) — ConnectingScreen
- [x] slime-arena-vsn5 (P1) — skinId при OAuth upgrade
- [x] slime-arena-n17m (P2) — normalizeNickname null guard
- [x] slime-arena-mtw (P2) — Симметричные модификаторы укуса
- [x] slime-arena-4xh (P2) — Вампир по GDD
- [x] slime-arena-y2z2 (P2) — Гость: реактивный isAnonymous
- [x] slime-arena-vpti (P2) — generateRandomBasicSkin в meta/

### Фаза 2: Спрайтовая система — ✅ ЗАВЕРШЕНО

- [x] Замена цветных скинов (4 цвета) на 21 спрайт
- [x] shared/src/sprites.ts: SPRITE_NAMES, pickSpriteByName, isValidSprite
- [x] Player.spriteId в Colyseus schema
- [x] spriteId в JoinTokenPayload → ArenaRoom → клиент
- [x] spriteId в matchmaking flow
- [x] leaderboard: isValidSprite валидация
- [x] Удалён config/skins.json (ошибочный артефакт)

### Фаза 3: Ревью + исправления — ✅ ЗАВЕРШЕНО

- [x] 504a6e6 — формула боя, visibilitychange, skinId валидация
- [x] 63163ae — whitelist через getBasicSkins()
- [x] a48add7 — .js extension fix (CommonJS)
- [x] e1aad77 — ревью спрайтов (итерация 1)
- [x] 396425c — ревью спрайтов (итерация 2): leaderboard, matchmaking, дедупликация
- [x] 885392d — создание аккаунта при новом OAuth
- [x] a2c7f91 — intent="login" на MainScreen (P0 fix)

### Открытая задача

- slime-arena-vk4m (P1) — Спрайтовый flow: 4 корневых причины (отложено)

---

## Sprint 20 (2026-02-07) — v0.8.4/v0.8.5 — ✅ ЗАВЕРШЕНО

Split-архитектура, Admin Dashboard на production, UI фиксы гостя.
PRs: #139-#146. Развёрнут на production 7 фев 2026.

## Server Maintenance (2026-02-08) — ✅ ЗАВЕРШЕНО

Redis MISCONF → 502 + OAuth 503. PR #148. Новый домен u2game.space.

---

*Полная история предыдущих спринтов доступна в Git history*
