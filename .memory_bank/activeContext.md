# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**База:** main (v0.7.4)
**GDD версия:** 3.3.2
**Sprint 14 Status:** ✅ ЗАВЕРШЁН — v0.7.0 released
**Sprint 15 Status:** ✅ ЗАВЕРШЁН — PR#112 merged (v0.7.1-dev)
**Sprint 16 Status:** ✅ ЗАВЕРШЁН — PR#115 merged (v0.7.3)
**Sprint 17 Status:** ✅ ЗАВЕРШЁН — PR#116 merged (v0.7.4)
**Sprint 18 Status:** ✅ ЗАВЕРШЁН — PR ожидает создания

---

## ✅ Sprint 18 — Tech Debt Reduction (2026-02-01)

**Цель:** Стабильность + безопасность + консолидация tech debt
**Версия:** 0.7.4 → 0.7.5
**Ветка:** `sprint-18/tech-debt-reduction`
**План:** [docs/plans/kind-orbiting-popcorn.md](../docs/plans/kind-orbiting-popcorn.md)

### Scope (8 задач) — ВСЕ ВЫПОЛНЕНЫ

| ID | Тип | Описание | Статус |
|----|-----|----------|--------|
| `slime-arena-zmf` | P1 bug | Джойстик смещает базу | ✅ |
| `slime-arena-k8w` | P2 bug | Скин после OAuth | ✅ |
| `slime-arena-hp5` | P2 | Play Again нестабилен | ✅ |
| `slime-arena-3ed` | P1 security | Rate limiting /auth/* | ✅ |
| `slime-arena-2q0` | P1 security | Nickname validation | ✅ |
| `slime-arena-0v2` | P2 | REWARDS_CONFIG → balance.json | ✅ |
| `slime-arena-yij` | P2 | Auth signals cache | ✅ |
| `slime-arena-xta` | P2 | Results UI разделение | ✅ |

### Ключевые изменения

- **Rate limiting:** самописный middleware (0 зависимостей) — 10 req/min для auth, 5 req/min для OAuth
- **Nickname validation:** `validateAndNormalize()` в /auth/upgrade, /join-token
- **REWARDS_CONFIG:** перенесён в balance.json с секцией rating
- **Auth caching:** cachedJoinToken signal в gameState.ts
- **Results UI:** логика buttonText вынесена в отдельную переменную

### Консолидация Beads (выполнено)

- ✅ Закрыт `slime-arena-v7x8` — дубликат REWARDS_CONFIG
- ✅ Закрыт `slime-arena-07o` — дубликат REWARDS_CONFIG
- ✅ Закрыт `slime-arena-isf` — дубликат place

---

## ✅ Sprint 17 — ЗАВЕРШЁН (2026-02-01)

**Релиз:** v0.7.4 OAuth Hotfix + LeaderboardScreen
**PR:** #116 (merged)

### OAuth Hotfix — все исправлено

| FIX | Описание | Статус |
|-----|----------|--------|
| FIX-000 | dotenv в MatchServer | ✅ |
| FIX-001 | Восстановление guest_token без login() | ✅ |
| FIX-002 | Блокировка OAuth без токена | ✅ |
| FIX-005 | Очистка claim токенов | ✅ |
| FIX-006 | setOnUnauthorized после восстановления | ✅ |
| FIX-007 | ProfileSummary в createDefaultProfile | ✅ |
| FIX-009 | Сохранение access_token в localStorage | ✅ |
| FIX-010 | fetchProfile после finishUpgrade | ✅ |

### LeaderboardScreen v1.6 — реализован

| Компонент | Статус |
|-----------|--------|
| LeaderboardScreen базовый | ✅ |
| Переключатель total/best | ✅ |
| API с myPosition/myValue | ✅ |
| Гибридная плашка игрока | ✅ |
| Миниатюра скина | ✅ |
| Автозакрытие при матче | ✅ |

### Review Status (PR #116)

| Reviewer | Verdict |
|----------|---------|
| Claude Opus 4.5 | ✅ APPROVED |
| Gemini Code Assist | ✅ APPROVED |
| GPT-5 Codex | ✅ APPROVED |
| Lingma | ✅ APPROVED |

---

## 🎯 Следующие шаги

### P2 Backlog (Sprint 18)

- FIX-003: base64url нормализация в decodeClaimToken
- FIX-004: Проверка exp токена в гостевой плашке

---

## 📋 Tech Debt

| Beads ID | Priority | Description |
|----------|----------|-------------|
| slime-arena-74gx | P2 | Merge anonymous match into existing account |
| slime-arena-9zu | P2 | GeoIP: HTTPS вместо HTTP |
| slime-arena-b1b | P1 | PKCE валидация на сервере |
| slime-arena-5tp | P1 | UNKNOWN регион: отключить Google |
| slime-arena-3ed | P1 | Rate limiting на /auth/* |
| slime-arena-2q0 | P1 | Nickname validation в /auth/upgrade |
| slime-arena-b48 | P1 | Accessibility: Escape + focus trap |
| slime-arena-k8w | P2 | Скин слайма не сохраняется после OAuth |

---

## 🎯 Sprint 16 — OAuth для Standalone (ЗАВЕРШЁН)

**Ветка:** sprint-16/oauth-standalone → main
**PR:** #115 (merged)
**Версия:** 0.7.3
**Цель:** Google/Yandex OAuth авторизация для Standalone платформы

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
```
