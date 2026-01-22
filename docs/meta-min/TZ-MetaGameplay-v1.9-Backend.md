# Slime Arena — ТЗ: Минимальный мета-геймплей

## Часть: Backend

**Версия:** 1.9  
**Дата:** 23 января 2026  
**Аудитория:** Бэкенд-разработчики

**Связанные части:**
- `TZ-MetaGameplay-v1.9-Index.md` — приоритеты, критерии, глоссарий
- `TZ-MetaGameplay-v1.9-Core.md` — типы пользователей, сценарии

---

## 1. Изменения в базе данных

Все изменения требуют обновления **Architecture v4.2.5 Part4 (Приложение B)**.

### 1.1. Новые таблицы

**leaderboard_total_mass:**

| Поле | Тип | Описание |
|------|-----|----------|
| `user_id` | UUID | PRIMARY KEY, REFERENCES users |
| `total_mass` | INTEGER | Накопленная масса |
| `matches_played` | INTEGER | Количество матчей |
| `updated_at` | TIMESTAMP | Последнее обновление |

**leaderboard_best_mass:**

| Поле | Тип | Описание |
|------|-----|----------|
| `user_id` | UUID | PRIMARY KEY, REFERENCES users |
| `best_mass` | INTEGER | Лучший результат |
| `best_match_id` | UUID | Матч с лучшим результатом |
| `players_in_match` | INTEGER | Количество игроков в том матче |
| `achieved_at` | TIMESTAMP | Дата установки рекорда |
| `updated_at` | TIMESTAMP | Последнее обновление |

**rating_awards:**

| Поле | Тип | Описание |
|------|-----|----------|
| `user_id` | UUID | REFERENCES users |
| `match_id` | UUID | REFERENCES match_results |
| `awarded_at` | TIMESTAMP | Дата начисления |
| PRIMARY KEY | — | `(user_id, match_id)` |

**oauth_links:**

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | PRIMARY KEY |
| `user_id` | UUID | REFERENCES users |
| `auth_provider` | VARCHAR(20) | `telegram`, `google`, `yandex` |
| `provider_user_id` | VARCHAR(255) | ID у провайдера |
| `created_at` | TIMESTAMP | Дата привязки |
| UNIQUE | — | `(auth_provider, provider_user_id)` |

### 1.2. Изменения в users

| Поле | Тип | Описание |
|------|-----|----------|
| `is_anonymous` | BOOLEAN | `true` = профиль не завершён, рейтинг не начисляется |
| `auth_provider` | VARCHAR(20) | `telegram`, `google`, `yandex` |
| `registration_skin_id` | VARCHAR(50) | Скин при завершении профиля |
| `registration_match_id` | UUID | Матч при завершении профиля |
| `nickname_set_at` | TIMESTAMP | Дата установки никнейма |

**Примечание:** Поле `platform_type` переименовано в `auth_provider`.

### 1.3. Изменения в match_results

| Поле | Тип | Описание |
|------|-----|----------|
| `guest_subject_id` | VARCHAR(255) | Идентификатор гостя из `guestToken` |
| `claim_consumed_at` | TIMESTAMP | Дата использования `claimToken` |

---

## 2. HTTP API

Все изменения требуют обновления **Architecture v4.2.5 Part4 (Приложение C)**.

### 2.1. POST `/api/v1/auth/guest`

**Назначение:** Получение гостевого токена.

**Запрос:** Пустое тело.

**Ответ:**

| Поле | Тип | Описание |
|------|-----|----------|
| `guestToken` | string | JWT |
| `guestSubjectId` | string | Уникальный идентификатор гостя |
| `expiresAt` | string | ISO 8601 |

**Логика:**
1. Генерировать UUID для `guestSubjectId`.
2. Создать JWT с claims: `sub = guestSubjectId`, `type = guest`, `exp`.
3. **Не создавать** запись в `users`.

### 2.2. POST `/api/v1/auth/telegram`

**Назначение:** Тихая авторизация Telegram.

**Запрос:**

| Поле | Тип | Описание |
|------|-----|----------|
| `initData` | string | Данные из `Telegram.WebApp.initData` |

**Ответ:**

| Поле | Тип | Описание |
|------|-----|----------|
| `accessToken` | string | JWT |
| `userId` | string | UUID |
| `profile` | ProfileSummary | Данные профиля |
| `isNewUser` | boolean | Первая авторизация |
| `isAnonymous` | boolean | `true` если профиль не завершён |

**Логика:**
1. Валидировать подпись `initData` (HMAC-SHA256).
2. Извлечь `telegram_id` из `initData`.
3. Искать в `oauth_links` по `(telegram, telegram_id)`.
4. Если не найден:
   - Создать `users` с `is_anonymous = true`.
   - Создать `oauth_links`.
   - `isNewUser = true`.
5. Создать `accessToken` с claims: `sub = userId`, `type = user`, `is_anonymous`.

### 2.3. POST `/api/v1/auth/oauth`

**Назначение:** Вход в существующий аккаунт (Standalone).

**Запрос:**

| Поле | Тип | Описание |
|------|-----|----------|
| `provider` | string | `google`, `yandex` |
| `code` | string | OAuth-код |
| `redirectUri` | string | URI перенаправления |

**Ответ:** Аналогичен `/auth/telegram`.

**Логика:**
1. Обменять `code` на токены у провайдера.
2. Получить `provider_user_id` от провайдера.
3. Искать в `oauth_links` по `(provider, provider_user_id)`.
4. **Если не найден → вернуть 404** (создание запрещено).
5. Загрузить профиль, создать `accessToken`.

### 2.4. POST `/api/v1/auth/upgrade`

**Назначение:** Завершение профиля.

**Запрос:**

| Поле | Тип | Описание |
|------|-----|----------|
| `mode` | string | `convert_guest` или `complete_profile` |
| `provider` | string | `google`, `yandex` (только `convert_guest`) |
| `authPayload` | string | OAuth-код (только `convert_guest`) |
| `claimToken` | string | JWT с результатом матча |
| `nickname` | string | 2–20 символов |

**Ответ:**

| Поле | Тип | Описание |
|------|-----|----------|
| `accessToken` | string | JWT |
| `userId` | string | UUID |
| `profile` | ProfileSummary | Данные профиля |

**Логика режима `convert_guest`:**

Требует: `Authorization: Bearer <guestToken>`

1. Валидировать `authPayload` у провайдера → получить `provider_user_id`.
2. Проверить, что `oauth_links` **не содержит** `(provider, provider_user_id)`.
   - Если содержит → 409 Conflict.
3. Валидировать `claimToken`:
   - Подпись корректна
   - Не истёк
   - `claimToken.subjectId` = `guestSubjectId` из текущего токена
   - `claim_consumed_at IS NULL` в `match_results`
4. Создать `users` с `is_anonymous = false`.
5. Создать `oauth_links`.
6. Записать `registration_skin_id`, `registration_match_id`, `nickname_set_at`.
7. Инициализировать рейтинги (см. раздел 3.4).
8. Установить `match_results.claim_consumed_at = NOW()`.
9. Создать `accessToken`.

**Логика режима `complete_profile`:**

Требует: `Authorization: Bearer <accessToken>` (Telegram-аноним)

1. Проверить, что `users.is_anonymous = true`.
2. Валидировать `claimToken`:
   - Подпись корректна
   - Не истёк
   - `claimToken.subjectId` = `userId` из текущего токена
   - `claim_consumed_at IS NULL`
3. Обновить `users`: `is_anonymous = false`, `nickname_set_at = NOW()`.
4. Записать `registration_skin_id`, `registration_match_id`.
5. Инициализировать рейтинги.
6. Установить `claim_consumed_at = NOW()`.
7. Возвращать тот же `accessToken` (или новый с обновлённым `is_anonymous`).

### 2.5. POST `/api/v1/match-results/claim`

**Назначение:** Получение `claimToken` после матча.

**Требует:** `Authorization: Bearer <accessToken или guestToken>`

**Запрос:**

| Поле | Тип | Описание |
|------|-----|----------|
| `matchId` | string | UUID матча |

**Ответ:**

| Поле | Тип | Описание |
|------|-----|----------|
| `claimToken` | string | JWT |
| `expiresAt` | string | ISO 8601 |

**Логика:**
1. Проверить существование `matchId` в `match_results`.
2. Проверить принадлежность:
   - Для `accessToken`: `match_results.user_id` = `userId`
   - Для `guestToken`: `match_results.guest_subject_id` = `guestSubjectId`
3. Проверить `claim_consumed_at IS NULL`.
4. Генерировать JWT:
   - `matchId`: UUID
   - `subjectId`: `userId` или `guestSubjectId`
   - `finalMass`: из `match_results`
   - `skinId`: из матча
   - `exp`: 30–120 минут (из конфига)

### 2.6. GET `/api/v1/leaderboard`

**Назначение:** Таблица лидеров.

**Параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `mode` | string | `total` или `best` |
| `limit` | integer | По умолчанию 100, максимум 100 |
| `offset` | integer | По умолчанию 0 |

**Ответ:**

| Поле | Тип | Описание |
|------|-----|----------|
| `mode` | string | Запрошенный режим |
| `entries` | array | Список записей |
| `myPosition` | integer | Позиция текущего игрока (если авторизован) |
| `myValue` | integer | Значение текущего игрока |

**Логика:**
1. Выбрать из `leaderboard_total_mass` или `leaderboard_best_mass`.
2. Сортировать по массе DESC.
3. Если есть `accessToken` с `is_anonymous = false`:
   - Вычислить `myPosition` и `myValue`.

### 2.7. POST `/api/v1/profile/nickname` (P1)

**Назначение:** Изменение никнейма после регистрации.

**Требует:** `accessToken`, `is_anonymous = false`

**Запрос:**

| Поле | Тип | Описание |
|------|-----|----------|
| `nickname` | string | 2–20 символов |

**Ограничение:** Доступно один раз или через определённый период (настраивается).

---

## 3. Серверная логика

### 3.1. Генерация никнейма

Формат: `{Прилагательное}{Существительное}{Число}`

Примеры: `HappySlime42`, `GreenBlob7`, `FastJelly99`

Списки слов в `config/nicknames.json`.

### 3.2. Генерация скина

Случайный выбор из `config/skins.json` (только `tier: basic`).

### 3.3. Выдача claimToken

1. Проверить существование `matchId`.
2. Проверить принадлежность (по `user_id` или `guest_subject_id`).
3. Проверить `claim_consumed_at IS NULL`.
4. JWT claims:
   - `matchId`: UUID
   - `subjectId`: UUID или `guestSubjectId`
   - `finalMass`: INTEGER
   - `skinId`: STRING
   - `exp`: TIMESTAMP

### 3.4. Инициализация рейтингов

При завершении профиля:

1. Создать запись в `leaderboard_total_mass`:
   - `total_mass = claimToken.finalMass`
   - `matches_played = 1`
2. Создать запись в `leaderboard_best_mass`:
   - `best_mass = claimToken.finalMass`
   - `best_match_id = claimToken.matchId`
   - `players_in_match` = из `match_results`
   - `achieved_at = NOW()`
3. Создать запись в `rating_awards`.

### 3.5. Обновление рейтинга после матча

После каждого матча **зарегистрированного** (`is_anonymous = false`):

1. Проверить `rating_awards(user_id, match_id)`:
   - Если существует → прекратить (уже начислено).
2. Обновить `leaderboard_total_mass`:
   - `total_mass += finalMass`
   - `matches_played += 1`
   - `updated_at = NOW()`
3. Если `finalMass > best_mass`:
   - Обновить `leaderboard_best_mass`
   - `best_mass = finalMass`
   - `best_match_id = matchId`
   - `players_in_match` = из матча
   - `achieved_at = NOW()`
4. Создать запись в `rating_awards`.

### 3.6. Правила никнейма

- Длина: 2–20 символов
- Допустимые: `A-Z`, `a-z`, `А-Я`, `а-я`, `0-9`, пробел, `-`, `_`
- Запрещены: эмодзи, спецсимволы, HTML-теги
- Уникальность: **не требуется**

---

## 4. Безопасность

### 4.1. Токены

- `accessToken` и `guestToken` — JWT, подписанные MetaServer
- `joinToken` **всегда** = `accessToken` или `guestToken` (JWT)
- MatchServer валидирует подпись JWT в `onAuth()`
- OAuth-токены провайдеров **никогда** не хранятся на клиенте

### 4.2. Защита claimToken

- Подписан сервером (JWT)
- Срок действия: `claimTokenTtlMinutes` из конфига (30–120 мин)
- Одноразовый: после использования `claim_consumed_at != NULL`
- Привязан к `subjectId` — нельзя использовать чужой матч

### 4.3. Защита от дублей

- `rating_awards(user_id, match_id)` — UNIQUE
- `oauth_links(auth_provider, provider_user_id)` — UNIQUE

### 4.4. Валидация initData (Telegram)

1. Извлечь `hash` из `initData`.
2. Отсортировать остальные параметры.
3. Вычислить HMAC-SHA256 с ключом `HMAC_SHA256(bot_token, "WebAppData")`.
4. Сравнить с `hash`.
