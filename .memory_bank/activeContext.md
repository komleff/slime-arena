# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**База:** main (v0.7.1-dev)
**Ветка:** sprint-16/oauth-standalone (PR #115)
**GDD версия:** 3.3.2
**Sprint 14 Status:** ✅ ЗАВЕРШЁН — v0.7.0 released
**Sprint 15 Status:** ✅ ЗАВЕРШЁН — PR#112 merged (v0.7.1-dev)
**Sprint 16 Status:** ✅ ГОТОВ К РЕЛИЗУ — OAuth для Standalone

---

## 🎯 Sprint 16 — OAuth для Standalone (ГОТОВ К РЕЛИЗУ)

**Ветка:** sprint-16/oauth-standalone
**PR:** #115 (open)
**Версия:** 0.7.3-dev
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
| NicknameConfirmModal | ✅ | P1-4: подтверждение никнейма после OAuth |
| joinToken для Quick Play | ✅ | guestSubjectId передача |
| Yandex Avatar | ✅ | Отображение OAuth аватара |
| PowerShell dev script | ✅ | dev.ps1 для .env.local |

### Исправленные баги (Ручное тестирование 2026-01-31)

| Приоритет | Описание | Файл | Статус |
|-----------|----------|------|--------|
| P0-1 | skinId гостя не сохраняется при upgrade | matchResults.ts | ✅ |
| P0-2 | Рейтинг не инициализируется из claimToken | RatingService.ts | ✅ |
| P0-3 | Рейтинг не начисляется после матча | RatingService.ts | ✅ |
| P1-4 | Никнейм не предлагается подтвердить | NicknameConfirmModal.tsx | ✅ |
| — | SPA routing: /oauth/callback → "/" | OAuthRedirectHandler.ts | ✅ |
| — | 409 handling: различение типов ошибок | OAuthRedirectHandler.ts | ✅ |
| — | Ghost OAuth state cleanup | main.ts | ✅ |
| — | Math.round для integer колонок | RatingService.ts | ✅ |

### Верификация (DB)

```
Пользователь "Дмитрий Комлев":
- is_anonymous = false
- total_mass = 2723
- matches_played = 3
- best_mass = 1227
- 3 записи в rating_awards (idempotency)
```

### TODO перед production

- [ ] Вернуть `google: false` для региона UNKNOWN
- [ ] Вернуть время матча 180 секунд
- [ ] Удалить debug console.log из OAuth обработчика
- [x] ~~Финальное тестирование OAuth upgrade~~ ✅

---

## Архитектура OAuth Upgrade Flow

```
Guest                     Client                    MetaServer
  │                          │                          │
  ├── play match ───────────►│                          │
  │◄── matchId ─────────────│                          │
  │                          │                          │
  ├── "Сохранить прогресс"──►│                          │
  │                          ├── POST /claim ──────────►│
  │                          │◄── claimToken ──────────│
  │                          │                          │
  │                          ├── OAuth redirect ───────►│ (Yandex)
  │                          │◄── code + state ────────│
  │                          │                          │
  │                          ├── POST /oauth/prepare ──►│
  │                          │◄── prepareToken ────────│
  │                          │   (displayName, avatarUrl)
  │                          │                          │
  │ [NicknameConfirmModal]   │                          │
  │◄── nickname input ──────│                          │
  │                          │                          │
  │                          ├── POST /oauth/complete ─►│
  │                          │   (prepareToken, nickname)│
  │                          │◄── accessToken ─────────│
  │                          │                          │
  │◄── Registered user ─────│                          │
```

---

## 🎯 Sprint 14 — Meta Integration (ЗАВЕРШЁН)

**Цель:** Интеграция клиента с meta-сервером (v0.7.0)

---

## 🎯 Sprint 15 — Production Readiness (ЗАВЕРШЁН)

**Цель:** Platform Adapters + Production Readiness (v0.7.1-dev)

---

## Отложенные задачи (Beads)

| ID | Приоритет | Описание |
|----|-----------|----------|
| slime-arena-0jf | P1 | AUTH-12: Тестирование Google OAuth |
| slime-arena-2j6 | P1 | Yandex JWT верификация подписи |
| slime-arena-u1r | P1 | CrazyGames JWT верификация подписи |
| slime-arena-0v2 | P2 | REWARDS_CONFIG → balance.json |
| slime-arena-isf | P2 | Server returns place in personalStats |

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
