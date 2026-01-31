# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**База:** main (v0.7.1-dev)
**Ветка:** sprint-16/oauth-standalone (PR #115)
**GDD версия:** 3.3.2
**Sprint 14 Status:** ✅ ЗАВЕРШЁН — v0.7.0 released
**Sprint 15 Status:** ✅ ЗАВЕРШЁН — PR#112 merged (v0.7.1-dev)
**Sprint 16 Status:** 🔄 IN PROGRESS — OAuth для Standalone

---

## 🎯 Sprint 16 — OAuth для Standalone (IN PROGRESS)

**Ветка:** sprint-16/oauth-standalone
**PR:** #115 (open)
**Версия:** 0.7.2-dev
**Цель:** Google/Yandex OAuth авторизация для Standalone платформы

### Выполненные задачи

| Компонент | Статус | Описание |
|-----------|--------|----------|
| Google OAuth Provider | ✅ | GoogleOAuthProvider.ts |
| Yandex OAuth Provider | ✅ | YandexOAuthProvider.ts |
| OAuthProviderFactory | ✅ | Региональная доступность провайдеров |
| GeoIP Service | ✅ | Определение региона по IP |
| OAuth Upgrade Flow | ✅ | convert_guest → registered user |
| OAuth Conflict Modal | ✅ | 409 обработка, pending_auth_token |
| joinToken для Quick Play | ✅ | guestSubjectId передача |
| Yandex Avatar | ✅ | Отображение OAuth аватара |
| PowerShell dev script | ✅ | dev.ps1 для .env.local |

### Исправленные баги (Ручное тестирование)

| Приоритет | Описание | Файл |
|-----------|----------|------|
| P0 | matchId не синхронизировался в state | ArenaRoom.ts:206 |
| P0 | Клиент не читал matchId при подключении | main.ts:1600-1607 |
| P0 | guestSubjectId не передавался в quick play | auth.ts, JoinTokenService.ts |
| P2 | avatarUrl не возвращался в profile | PlayerService.ts |

### TODO перед production

- [ ] Вернуть `google: false` для региона UNKNOWN
- [ ] Вернуть время матча 180 секунд
- [ ] Удалить debug console.log из OAuth обработчика
- [ ] Финальное тестирование OAuth upgrade

### Архитектура joinToken для Quick Play

```
Client                    MetaServer                   MatchServer
  │                           │                            │
  ├── POST /auth/guest ──────►│                            │
  │◄─── guestToken ──────────│                            │
  │                           │                            │
  ├── POST /auth/join-token ─►│                            │
  │   (with guestToken)       │                            │
  │◄─── joinToken ───────────│                            │
  │     (includes guestSubjectId)                          │
  │                           │                            │
  ├── joinOrCreate("arena", {joinToken}) ─────────────────►│
  │                           │                            │
  │                           │   (extracts guestSubjectId)│
  │                           │                            │
  │◄── state.matchId ─────────────────────────────────────│
```

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

## 🎯 Sprint 15 — Production Readiness (ЗАВЕРШЁН)

**Ветка:** sprint-15/production-readiness → main
**PR:** #112 (squash merged)
**Версия:** 0.7.1-dev
**Цель:** Platform Adapters + Production Readiness

### Выполненные задачи

| Компонент | Статус | Описание |
|-----------|--------|----------|
| YandexAdapter | ✅ | client/src/platform/YandexAdapter.ts |
| PokiAdapter | ✅ | client/src/platform/PokiAdapter.ts |
| CrazyGamesAdapter | ✅ | client/src/platform/CrazyGamesAdapter.ts |
| CrazyGamesAdsProvider | ✅ | client/src/platform/CrazyGamesAdsProvider.ts |
| GameDistributionAdapter | ✅ | client/src/platform/GameDistributionAdapter.ts |
| GameDistributionAdsProvider | ✅ | client/src/platform/GameDistributionAdsProvider.ts |
| PlatformManager v2 | ✅ | Приоритет: Telegram → CrazyGames → GD → Yandex → Poki → Standalone |
| Server Auth Providers | ✅ | CrazyGames + Poki + Yandex providers |

### Исправленные замечания (6 итераций)

| Ревьювер | Приоритет | Описание | Статус |
|----------|-----------|----------|--------|
| Copilot | P0 | CrazyGames platformData format (JWT) | ✅ |
| Codex | P1 | Poki userId prefix validation | ✅ |
| Copilot | P1 | GameDistribution SDK caching | ✅ |
| Gemini | P2 | YandexAdapter trim() | ✅ |
| Copilot | P2 | Relative paths in docs | ✅ |
| Codex | P2 | GD_OPTIONS.gameId warning | ✅ |

### PR#112 Final Review Status

| Ревьювер | Статус | Итерации |
|----------|--------|----------|
| Opus | ✅ APPROVED | 2 |
| Copilot | ✅ COMMENTED (fixed) | 6 |
| Gemini | ✅ APPROVED | 3 |
| Codex | ✅ APPROVED | 3 |

### Отложенные задачи (Beads)

| ID | Приоритет | Описание |
|----|-----------|----------|
| slime-arena-2j6 | P1 | Yandex JWT верификация подписи |
| slime-arena-u1r | P1 | CrazyGames JWT верификация подписи |
| slime-arena-zmf | P1 | Фикс джойстика |

Актуальные документы:
- [План Sprint 15](../docs/plans/sprint-15-production-readiness.md)
- [TZ-PlatformAdapters](../docs/meta-min/TZ-PlatformAdapters-CrazyGames-GameDistribution-v1.0.md)

