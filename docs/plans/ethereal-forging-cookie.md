# План исправления OAuth Upgrade Flow

**Дата:** 2026-01-31
**Спринт:** 16 (OAuth для Standalone)
**Приоритет:** P0

---

## Обнаруженные баги

### P0-1: skinId гостя не сохраняется при upgrade
**Симптом:** Гость играл со скином `slime-pumpkin`, после OAuth upgrade в БД `slime_green`
**Причина:** В `matchResults.ts:344-354` условие `!isGuest && subjectId` никогда не выполняется для гостей, используется hardcoded `'slime_green'`
**Результат:** Все гости теряют выбранный скин

### P0-2: Рейтинг не инициализируется из claimToken.finalMass
**Симптом:** После upgrade Total Mass = 0, Best Mass = 0
**Ожидание по ТЗ:** `claimToken.finalMass` должен инициализировать рейтинги (ТЗ 6.5)
**Результат:** Гостевой прогресс теряется

### P0-3: Рейтинг не начисляется после матча зарегистрированного пользователя
**Симптом:** Сыграл матч под авторизованным аккаунтом, Total/Best Mass по-прежнему 0
**Возможные причины:**
- `is_anonymous` всё ещё `true`?
- `awardRating()` не вызывается?
- Ошибка в асинхронном начислении?

### P1-4: Пользователю не предлагается выбрать никнейм
**Симптом:** Имя из OAuth ("Дмитрий Комлев") установлено автоматически без подтверждения
**Ожидание по ТЗ:** Показать имя из OAuth как дефолт, но дать возможность изменить (ТЗ 6.5: "никнейм — выбранный при завершении профиля")

---

## Требования по ТЗ (TZ-MetaGameplay-v1.9-Core.md)

### Раздел 6.5 — Завершение профиля (Standalone)
```
1. Выбор провайдера (Google / Яндекс).
2. OAuth-флоу → code.
3. POST /auth/upgrade режим convert_guest:
   - authPayload = OAuth-код
   - claimToken
   - nickname  ← ПОЛЬЗОВАТЕЛЬ УКАЗЫВАЕТ
4. Сервер создаёт users с is_anonymous = false.
5. Инициализация рейтингов из claimToken.finalMass.
```

### Раздел 3.3 — Зарегистрированный игрок
```
| Никнейм | Выбранный при завершении профиля |
| Скин | Закреплённый при завершении профиля |
```

---

## План исправлений

### Этап 1: Передача skinId гостя в claimToken

**Файл:** `server/src/meta/routes/matchResults.ts`

**Проблема (строки 344-354):**
```typescript
let skinId = 'slime_green';
if (!isGuest && subjectId) {  // ← Никогда не true для гостей
  // получаем skinId из profiles
}
```

**Решение:** Клиент должен передавать `skinId` в запросе `/match-results/claim`

```typescript
// Новая сигнатура:
POST /api/v1/match-results/claim
{
  matchId: string,
  skinId?: string  // Для гостей — из localStorage
}
```

**Изменения:**
1. `matchResults.ts` — принимать `skinId` из body для гостей
2. `client/src/services/matchResultsService.ts` — передавать `guest_skin_id`

### Этап 2: Подтверждение никнейма при OAuth

**Файл:** `client/src/ui/components/RegistrationPromptModal.tsx`

**Текущее поведение:** OAuth provider возвращает своё имя, которое сразу записывается в БД без подтверждения

**Требуемое поведение (ТЗ 6.5: "никнейм — выбранный при завершении профиля"):**
1. После возврата с OAuth показать модалку подтверждения никнейма
2. Дефолт = имя из OAuth провайдера (например, "Дмитрий Комлев")
3. Пользователь может изменить на любое другое (2–20 символов)
4. Передать в `/auth/upgrade` выбранный/подтверждённый никнейм

**Изменения:**
1. `main.ts` (OAuth callback) — после успешного OAuth показать NicknameConfirmModal
2. Создать `NicknameConfirmModal.tsx` — поле ввода с дефолтом из OAuth + кнопка "Сохранить"
3. `OAuthRedirectHandler.ts` — не вызывать finishUpgrade сразу, а вернуть данные для модалки (включая OAuth displayName)
4. `auth.ts` — использовать никнейм из запроса клиента

### Этап 3: Инициализация рейтинга из claimToken

**Файл:** `server/src/meta/routes/auth.ts`

**Проверить:** Вызывается ли `ratingService.initializeRating()` и с какими данными

**Ожидание:**
```typescript
// При convert_guest (auth.ts)
const ratingResult = await ratingService.initializeRating(
  user.id,
  claimPayload,     // содержит finalMass
  playersInMatch,
  client
);
```

### Этап 4: Проверка начисления рейтинга после матча

**Файлы:**
- `server/src/meta/routes/matchResults.ts`
- `server/src/meta/services/RatingService.ts`

**Диагностика:**
1. Проверить логи: вызывается ли `awardRating()`
2. Проверить `is_anonymous` пользователя в БД
3. Проверить наличие записи в `rating_awards`

---

## Критические файлы

| Файл | Изменения |
|------|-----------|
| `server/src/meta/routes/matchResults.ts` | Принимать skinId из body для гостей |
| `server/src/meta/routes/auth.ts` | Использовать никнейм из запроса клиента |
| `client/src/services/matchResultsService.ts` | Передавать guest_skin_id в /claim |
| `client/src/main.ts` | После OAuth callback показать NicknameConfirmModal |
| `client/src/ui/components/NicknameConfirmModal.tsx` | НОВЫЙ: модалка подтверждения никнейма |
| `client/src/oauth/OAuthRedirectHandler.ts` | Вернуть OAuth displayName для модалки |

---

## Порядок реализации

1. **P0-1: skinId** — сначала, самое простое
2. **P0-2/P0-3: Рейтинг** — диагностика и фикс
3. **P1-4: Никнейм** — новая модалка, более сложно

---

## Верификация

### Тест 1: Скин сохраняется
1. Создать гостя, выбрать скин `slime-pumpkin`
2. Сыграть матч, нажать "Сохранить прогресс"
3. OAuth через Yandex
4. Проверить в БД: `registration_skin_id = 'slime-pumpkin'`

### Тест 2: Никнейм предлагается подтвердить/изменить
1. Гость проходит OAuth через Yandex (имя в Yandex: "Дмитрий Комлев")
2. После возврата показать модалку с полем, дефолт = "Дмитрий Комлев"
3. Пользователь может оставить или изменить на "Первый Слайм"
4. Проверить в БД: nickname = выбранный пользователем

### Тест 3: Рейтинг инициализируется
1. Гость набирает массу 500 в матче
2. OAuth upgrade
3. Проверить: Total Mass = 500, Best Mass = 500

### Тест 4: Рейтинг начисляется после матча
1. Зарегистрированный игрок (is_anonymous = false)
2. Сыграть матч, набрать массу 300
3. Проверить: Total Mass += 300

---

## Уточнённые требования

1. **Никнейм при upgrade:** Показывать модалку ПОСЛЕ возврата с OAuth
2. **Дефолт никнейма:** Имя из OAuth провайдера (не гостевой никнейм)
