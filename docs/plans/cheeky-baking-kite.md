# План Sprint 13 Phase 2 — API и серверная логика

**Дата:** 26 января 2026
**PM:** Claude Opus 4.5
**Спринт:** 13 (27.01-02.02)
**Фаза:** 2 из 3

---

## Контекст

**Завершено:**
- Фаза 1 (PR #105) — база данных и инфраструктура
  - Миграции 007, 008
  - Модели данных (Leaderboard, Rating, OAuth)
  - skinGenerator, nicknameValidator
  - Все тесты проходят

**Worktree:** `d:/slime-arena-meta/`
**Ветка:** `sprint-13/meta-gameplay`
**ТЗ:** `docs/meta-min/TZ-MetaGameplay-v1.9-Backend.md`

---

## Задачи Фазы 2 (9 задач)

### 2.1. JWT utilities и токены
**Приоритет:** P0
**Файл:** `server/src/meta/utils/jwtUtils.ts`

**Реализовать:**
- `generateAccessToken(userId, isAnonymous, expiresIn)` — JWT для зарегистрированных
- `generateGuestToken(guestSubjectId, expiresIn)` — JWT для гостей (7 дней)
- `generateClaimToken(payload, expiresIn)` — JWT для claim (60 мин)
- `verifyToken(token)` — валидация подписи и expiration

**Критерии:**
- [ ] Secret из `process.env.JWT_SECRET`
- [ ] Unit-тесты для всех типов токенов

---

### 2.2. POST /api/v1/auth/guest
**Приоритет:** P0
**Файл:** `server/src/meta/routes/authRoutes.ts`

**Логика:**
1. Генерировать UUID для `guestSubjectId`
2. Создать `guestToken` (7 дней)
3. НЕ создавать запись в БД

**Ответ:**
```json
{
  "guestToken": "...",
  "guestSubjectId": "...",
  "expiresAt": "ISO8601"
}
```

**Критерии:**
- [ ] Эндпоинт работает без авторизации
- [ ] Integration test

---

### 2.3. POST /api/v1/auth/telegram (обновление)
**Приоритет:** P0
**Файл:** `server/src/meta/routes/authRoutes.ts`

**Изменения:**
1. Искать в `oauth_links` по `(telegram, telegram_id)`
2. Если не найден:
   - Создать `users` с `is_anonymous = true`
   - Создать `oauth_links`
   - `isNewUser = true`
3. JWT payload включает `is_anonymous: true`

**Ответ:**
```json
{
  "accessToken": "...",
  "userId": "...",
  "profile": {...},
  "isNewUser": true,
  "isAnonymous": true
}
```

**Критерии:**
- [ ] При первом входе `is_anonymous = true`
- [ ] При повторном входе восстанавливает сессию
- [ ] Integration test для обоих сценариев

---

### 2.4. POST /api/v1/auth/oauth
**Приоритет:** P0
**Файл:** `server/src/meta/routes/authRoutes.ts`

**Логика:**
1. Обменять `code` на токены у провайдера
2. Получить `provider_user_id`
3. Искать в `oauth_links`
4. **Если не найден — 404** (создание запрещено)

**Провайдеры:**
- `GoogleOAuthProvider` (Google Identity API)
- `YandexOAuthProvider` (Yandex OAuth API)

**Критерии:**
- [ ] Для существующего аккаунта — вход успешен
- [ ] Для несуществующего — 404 "Account not found"
- [ ] Mock-провайдеры для тестов

---

### 2.5. POST /api/v1/match-results/claim
**Приоритет:** P0
**Файл:** `server/src/meta/routes/matchResultsRoutes.ts`

**Логика:**
1. Авторизация: `accessToken` или `guestToken`
2. Проверить `matchId` существует
3. Проверить принадлежность:
   - `accessToken` → `match_results.user_id`
   - `guestToken` → `match_results.guest_subject_id`
4. Проверить `claim_consumed_at IS NULL`
5. Генерировать `claimToken` (60 мин из конфига)

**ClaimToken payload:**
```typescript
{
  matchId: string,
  subjectId: string,
  finalMass: number,
  skinId: string,
  exp: number
}
```

**Критерии:**
- [ ] Повторный claim (до upgrade) возвращает новый токен
- [ ] После upgrade (claim_consumed_at != NULL) — ошибка
- [ ] Integration test

---

### 2.6. POST /api/v1/auth/upgrade
**Приоритет:** P0
**Файл:** `server/src/meta/routes/authRoutes.ts`

**Два режима:**

**convert_guest** (Standalone-гость → зарегистрированный):
1. Авторизация: `guestToken`
2. Валидировать OAuth → `provider_user_id`
3. Проверить `oauth_links` не содержит → иначе 409
4. Валидировать `claimToken`
5. Создать `users` (is_anonymous = false)
6. Создать `oauth_links`, `profiles`, `wallets`
7. Инициализировать рейтинги (Задача 2.8)
8. `claim_consumed_at = NOW()`

**complete_profile** (Telegram-аноним → зарегистрированный):
1. Авторизация: `accessToken`
2. Проверить `users.is_anonymous = true`
3. Валидировать `claimToken`
4. Обновить `is_anonymous = false`
5. Инициализировать рейтинги
6. `claim_consumed_at = NOW()`

**Критерии:**
- [ ] claimToken одноразовый
- [ ] 409 при конфликте OAuth
- [ ] Рейтинги инициализируются из finalMass
- [ ] Integration тесты для обоих режимов

---

### 2.7. RatingService — начисление после матча
**Приоритет:** P0
**Файл:** `server/src/meta/services/RatingService.ts`

**Метод `awardRating(userId, matchId, finalMass, playersInMatch)`:**
1. Проверить идемпотентность: `rating_awards(user_id, match_id)`
2. Проверить `is_anonymous = false`
3. UPSERT `leaderboard_total_mass`: `+= finalMass`, `matches_played += 1`
4. Если новый рекорд: обновить `leaderboard_best_mass`
5. Создать `rating_awards`

**Критерии:**
- [ ] Рейтинг НЕ начисляется для `is_anonymous = true`
- [ ] Повторное начисление невозможно
- [ ] Unit-тесты

---

### 2.8. RatingService — инициализация при регистрации
**Приоритет:** P0
**Файл:** `server/src/meta/services/RatingService.ts`

**Метод `initializeRating(userId, claimToken, playersInMatch)`:**
1. Создать `leaderboard_total_mass`: `total_mass = finalMass`, `matches_played = 1`
2. Создать `leaderboard_best_mass`: `best_mass = finalMass`, `best_match_id = matchId`
3. Создать `rating_awards`

**Вызывается из:** `POST /api/v1/auth/upgrade`

**Критерии:**
- [ ] Корректные начальные значения
- [ ] Unit-тесты

---

### 2.9. GET /api/v1/leaderboard
**Приоритет:** P0
**Файл:** `server/src/meta/routes/leaderboardRoutes.ts`

**Параметры:**
- `mode`: `total` | `best` (обязательный)
- `limit`: 1-100 (по умолчанию 100)
- `offset`: >= 0 (по умолчанию 0)

**Логика:**
1. SELECT из `leaderboard_*_mass`
2. JOIN `users` (nickname), `profiles` (skin)
3. ORDER BY mass DESC
4. Если авторизован и `is_anonymous = false`:
   - Вычислить `myPosition`, `myValue`

**Ответ:**
```json
{
  "mode": "total",
  "entries": [
    {"position": 1, "userId": "...", "nickname": "...", "skinId": "...", "value": 123456}
  ],
  "myPosition": 42,
  "myValue": 5000
}
```

**Критерии:**
- [ ] Обе вкладки работают
- [ ] Для гостя/анонима `myPosition` отсутствует
- [ ] Integration test

---

## Дополнительные задачи (P2 из review feedback)

Параллельно с основными задачами исправить замечания от ревью Фазы 1:

| Beads ID | Задача | Приоритет |
|----------|--------|-----------|
| slime-arena-ww8 | Race condition в AuthService | P2 |
| slime-arena-d0f | Runtime-валидация JSON в skinGenerator | P2 |
| slime-arena-q90 | Homoglyphs protection в nicknameValidator | P2 |
| slime-arena-zwe | Расширить banned words | P2 |

---

## План выполнения

### День 1 (27.01)
1. **Задача 2.1** — JWT utilities (фундамент для всех эндпоинтов)
2. **Задача 2.2** — auth/guest
3. **Задача 2.3** — auth/telegram (обновление)

### День 2 (28.01)
4. **Задачи 2.7, 2.8** — RatingService (оба метода)
5. **Задача 2.9** — leaderboard API
6. **P2 задачи** (по возможности)

### День 3 (29.01)
7. **Задача 2.4** — auth/oauth
8. **Задача 2.5** — match-results/claim
9. **Задача 2.6** — auth/upgrade

---

## Зависимости

```
2.1 (JWT) ─────┬──→ 2.2 (guest)
               ├──→ 2.3 (telegram)
               ├──→ 2.4 (oauth)
               ├──→ 2.5 (claim)
               └──→ 2.6 (upgrade)

1.1, 1.3 ──────┬──→ 2.7 (awardRating)
               └──→ 2.8 (initializeRating)

1.1, 1.3 ──────────→ 2.9 (leaderboard)

2.4, 2.5, 2.7, 2.8 ─→ 2.6 (upgrade использует все)
```

---

## Верификация

```bash
# После каждой задачи
npm run build
npm run test

# После завершения фазы
npm run dev:server

# Тестовые запросы
curl -X POST http://localhost:2567/api/v1/auth/guest
curl -X GET "http://localhost:2567/api/v1/leaderboard?mode=total"

# Integration тесты
npm test -- --grep "auth|leaderboard|rating"
```

---

## Критерии завершения Фазы 2

- [ ] Все 9 задач реализованы
- [ ] `npm run build` проходит
- [ ] Integration тесты проходят
- [ ] PR создан для ревью
- [ ] Архитектура (Part4 Appendix C) обновлена

---

## Workflow ревью

После завершения кодирования:
1. Создать PR #XXX sprint-13/meta-gameplay → main
2. Запустить ревьюверов параллельно:
   - Claude Opus 4.5 (через Task tool)
   - ChatGPT Codex 5.2 (через tools/external_reviewers.py)
   - Gemini 3 Pro (через tools/external_reviewers.py)
   - GitHub Copilot (автоматически)
3. Собрать замечания, исправить P0/P1
4. Повторить цикл до APPROVED от всех
