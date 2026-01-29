# План Sprint-14: Meta Integration

**Дата:** 28 января 2026
**PM:** Claude Opus 4.5
**Ветка:** `sprint-14/meta-integration`
**Цель:** Завершить P0 интеграцию клиента с meta-сервером
**Worktree:** `d:\slime-arena-meta`

---

## Резюме состояния

### Бэкенд (готов по P0):
- 13 API endpoints (auth/*, profile/*, matchmaking/*, leaderboard, etc.)
- 11 сервисов (AuthService, RatingService, etc.)
- Миграции БД (leaderboards, oauth_links, rating_awards)

### Клиент (требует интеграции):
- `PlatformManager` + адаптеры — есть
- `metaServerClient` — есть
- Guest/Telegram auth flow — **не интегрирован**
- LeaderboardScreen — **не реализован**

### Критичные баги:
- `slime-arena-q90` [P0] — Math.random() в skinGenerator
- `slime-arena-d0f` — normalizeNickname() null protection
- `slime-arena-zwe` — banned words

---

## Блок 1: Критические фиксы (День 1)

| Задача | Beads ID | Файл | Действие |
|--------|----------|------|----------|
| Math.random() → Rng | `slime-arena-q90` | `server/src/utils/generators/skinGenerator.ts:72` | Заменить на Rng или выделить meta-only функцию |
| null protection | `slime-arena-d0f` | `server/src/utils/generators/nicknameValidator.ts` | Добавить проверку на null/undefined |
| banned words | `slime-arena-zwe` | `server/src/utils/generators/nicknameValidator.ts` | ✅ Убраны slime/arena (конфликт с гостевыми никами); admin, support, gm уже есть |
| race condition | `slime-arena-ww8` | — | Верифицировать, закрыть (уже защищён транзакцией) |

**Верификация:** `npm run test`

---

## Блок 2: Клиентская интеграция (Дни 2-4)

### 2.1 Guest Flow для Standalone (День 2)

**Файлы:**
- `client/src/services/authService.ts` — добавить `loginAsGuest()`
- `client/src/platform/StandaloneAdapter.ts` — хранить `guest_token`

**Логика:**
1. `POST /auth/guest` → получить `guestToken`
2. Сохранить в localStorage: `guest_token`, `guest_nickname`, `guest_skin_id`
3. Передавать `guestToken` как `joinToken` при входе в матч

### 2.2 Telegram Silent Auth (День 2)

**Файлы:**
- `client/src/services/authService.ts` — добавить `loginViaTelegram()`

**Логика:**
1. Получить `initData` через `TelegramAdapter.getCredentials()`
2. `POST /auth/telegram { initData }` → получить `accessToken`
3. Учесть `isAnonymous` флаг из ответа

### 2.3 claimToken Flow (День 3)

**Файлы:**
- `client/src/services/matchResultsService.ts` — новый сервис
- `client/src/ui/components/ResultsScreen.tsx` — интеграция

**Логика:**
1. После матча: `POST /match-results/claim { matchId }`
2. Сохранить `claimToken` в localStorage
3. Показать `RegistrationPromptModal` если:
   - Гость ИЛИ Telegram-аноним
   - `finalMass >= 200`

### 2.4 RegistrationPromptModal (День 3)

**Файл:** `client/src/ui/components/RegistrationPromptModal.tsx`

**UI:**
- Заголовок: "Отличный результат!"
- Кнопка "Сохранить прогресс" → upgrade flow
- Кнопка "Сыграть ещё" → закрыть

### 2.5 LeaderboardScreen (День 4)

**Beads ID:** `slime-arena-7cq`
**Файл:** `client/src/ui/components/LeaderboardScreen.tsx`

**UI:**
- Переключатель: "Накопительный" / "Рекордный"
- Топ-100 игроков
- Позиция текущего игрока (если зарегистрирован)

**API:** `GET /api/v1/leaderboard?mode=total|best`

---

## Блок 3: E2E тестирование (День 5)

### Сценарий A: Standalone Guest
1. Открыть в браузере → `guestToken` создан
2. Сыграть матч → `RegistrationPromptModal` появляется
3. "Сохранить прогресс" → OAuth flow (P1, можно отложить)

### Сценарий B: Telegram Anonymous
1. Открыть в Telegram → `accessToken` с `isAnonymous=true`
2. Сыграть матч → `RegistrationPromptModal` появляется
3. "Сохранить прогресс" → `complete_profile` → `is_anonymous=false`

### Сценарий C: Registered User
1. Повторный вход → автоавторизация
2. Сыграть матч → НЕ показывать `RegistrationPromptModal`
3. Рейтинг обновляется

---

## Критерии завершения

- [ ] Фиксы q90, d0f, zwe закрыты
- [ ] Guest flow работает на Standalone
- [ ] Telegram auth работает
- [ ] claimToken получается после матча
- [ ] RegistrationPromptModal показывается
- [ ] LeaderboardScreen с двумя вкладками
- [ ] `npm run test` проходит
- [ ] `npm run build` успешен

---

## Команды

```bash
# Создать ветку
cd d:\slime-arena-meta
git checkout -b sprint-14/meta-integration

# Разработка
npm run dev:server  # терминал 1
npm run dev:client  # терминал 2

# Тесты и сборка
npm run test
npm run build
```

---

## Риски

| Риск | Митигация |
|------|-----------|
| OAuth credentials не настроены | Фокус на Telegram flow, OAuth в P1 |
| Telegram SDK недоступен локально | ngrok туннель |

---

## После Sprint-14 (P1)

- OAuthModal для Google/Yandex
- NicknameEditModal
- 7 событий аналитики
- Защита от фарма рекордов
