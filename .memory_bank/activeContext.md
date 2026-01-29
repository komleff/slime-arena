# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**База:** main (после merge PR#111 + cleanup)
**Релиз:** v0.7.0 (pre-release)
**GDD версия:** 3.3.2
**Sprint 14 Status:** ✅ ЗАВЕРШЁН — 4/4 APPROVED, merged
**Workspace Status:** ✅ ОЧИЩЕНО — 4f142d7 (deprecated/temp files removed)

---

## 🎯 Sprint 14 — Meta Integration (ЗАВЕРШЁН)

**Цель:** Интеграция клиента с meta-сервером

### Выполненные задачи (v0.7.0)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| Guest Auth Flow | ✅ | loginAsGuest(), guest_token |
| Telegram Auth | ✅ | loginViaTelegram(), silent auth |
| claimToken Flow | ✅ | matchResultsService, getClaimToken() |
| RegistrationPromptModal | ✅ | Показ при mass >= 200, upgrade flow |
| LeaderboardScreen | ✅ | Топ-100, два режима (total/best) |
| ResultsScreen | ✅ | Награды, save progress prompt |
| matchId in state | ✅ | state.matchId для /match-results/claim |

### Исправленные баги (Sprint 14)

| ID/Источник | Описание | Коммит |
|-------------|----------|--------|
| slime-arena-q90 | Math.random() → META-SERVER ONLY | — |
| slime-arena-d0f | null protection в normalizeNickname | — |
| slime-arena-zwe | Расширен список banned words | — |
| slime-arena-0qa | Infinite logout loop на 401 | — |
| Codex P0 | TelegramAuthResponse contract | 4f0e1b4 |
| Gemini P1 | TelegramAdapter.requestAuth() | d4233ab |
| Gemini P1 | place fallback → null | 2e65633 |
| Gemini P1 | claimToken check | 3e86b83 |
| Gemini P1 | Награды для гостей | 3fb31af |
| Gemini P2 | userEntry для гостей | ba454fd |
| Codex P1 | matchId vs roomId | 201be84 |
| Copilot P2 | Date.now() для никнеймов | beb9981 |

### PR #111 Final Review Status

| Ревьювер | Статус | Итерация |
|----------|--------|----------|
| Opus | ✅ APPROVED | Final |
| Copilot | ✅ APPROVED | Final |
| Gemini | ✅ APPROVED | Final |
| Codex | ✅ APPROVED | Final |

**Консенсус: 4/4 APPROVED**

---

## Архитектура Meta-интеграции

```
Client                    MetaServer                  Database
  │                           │                           │
  ├── POST /auth/guest ──────►│                           │
  │◄─── guestToken ──────────│                           │
  │                           │                           │
  ├── POST /auth/telegram ───►│                           │
  │◄─── accessToken ─────────│                           │
  │                           │                           │
  ├── POST /match-results/claim ►│                        │
  │◄─── claimToken ──────────│                           │
  │                           │                           │
  ├── POST /auth/upgrade ────►│──── UPDATE users ───────►│
  │◄─── new accessToken ─────│◄────────────────────────│
```

---

## Отложенные задачи (Beads)

| ID | Приоритет | Описание |
|----|-----------|----------|
| slime-arena-0v2 | P2 | REWARDS_CONFIG → balance.json |
| slime-arena-isf | P2 | Server returns place in personalStats |
| NEW | P3 | Локализация UI строк |
| NEW | P3 | i18n инфраструктура |

---

## Команды

```bash
# Разработка
cd d:\slime-arena-meta
npm run dev              # meta + match + client

# Тесты и сборка
npm run test
npm run build

# Beads
bd ready                 # Доступные задачи
bd list --status=open    # Все открытые
```

---

## Следующий спринт

**Sprint 15 — MetaGameplay Continuation**

Задачи (из TZ v1.9):
- ✅ PlatformManager + адаптеры
- ✅ Гостевой режим
- ✅ Telegram silent auth
- ✅ claimToken, завершение профиля
- ✅ LeaderboardScreen (topN, positional)
- 🔄 Events analytics (7 events) — P1
- 🔄 POST /profile/nickname — P1
- 🔄 A/B-тест proposal timing — P1
- ⏭️ Anti-farm protection (`players_in_match >= N`) — P2
- ⏭️ VK/OK OAuth — P2
- ⏭️ Weekly/monthly leaderboards — P2

Актуальные документы:
- [TZ-MetaGameplay-v1.9-Index.md](../docs/meta-min/TZ-MetaGameplay-v1.9-Index.md)
- [Memory Bank Core](./)
- [Workplans](./workplans/)

