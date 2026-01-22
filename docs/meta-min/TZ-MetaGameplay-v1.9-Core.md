# Slime Arena — ТЗ: Минимальный мета-геймплей

## Часть: Core

**Версия:** 1.9  
**Дата:** 23 января 2026  
**Аудитория:** Все (бэкенд, фронтенд, QA)

**Связанные части:**
- `TZ-MetaGameplay-v1.9-Index.md` — приоритеты, критерии, глоссарий
- `TZ-MetaGameplay-v1.9-Backend.md` — БД, API, серверная логика
- `TZ-MetaGameplay-v1.9-Client.md` — клиент, конфигурации

---

## 1. Цель

Добавить минимальный мета-геймплей для удержания игроков:
- Гостевой режим для быстрого входа
- Сохранение прогресса через завершение профиля
- Профиль игрока (никнейм, скин)
- Два рейтинга массы: накопительный и рекордный
- Таблица лидеров с двумя вкладками

**Платформы:** Telegram Mini App и Standalone Web.

---

## 2. Терминология экранов

### 2.1. Канонические идентификаторы

| Технический ID | Русское название | Назначение |
|----------------|------------------|------------|
| `LobbyScreen` | Главная | Центральный хаб навигации (Профиль, Магазин, Рейтинги, Арена) |
| `MatchmakingScreen` | Подготовка | Выбор класса, ожидание матча |
| `BattleScreen` | Бой | Игровой процесс |
| `ResultsScreen` | Результаты | Итоги матча, предложение завершить профиль |
| `LeaderboardScreen` | Рейтинги | Таблица лидеров с двумя вкладками |

### 2.2. Таблица синонимов

Для понимания устаревших терминов из других документов:

| Устаревший термин | Актуальный термин |
|-------------------|-------------------|
| `MainScreen` | `LobbyScreen` (Главная) |
| «Лобби» (экран) | `LobbyScreen` (Главная) |
| «Lobby» (подготовка) | `MatchmakingScreen` (Подготовка) |

### 2.3. Формат записи в документах

- Пишем: «Игрок попадает на Главную (`LobbyScreen`)»
- Пишем: «Переход на Подготовку (`MatchmakingScreen`)»
- Термин «Лобби» для названий экранов **не используем**

### 2.4. Навигация

```
Главная → Подготовка → Бой → Результаты → Подготовка/Главная
```

Дополнительно:
- Главная → Рейтинги (кнопка «Рейтинги»)
- Главная → OAuthModal (кнопка «Войти» для Standalone-гостя)

---

## 3. Типы пользователей

### 3.1. Гость (`guest`)

Пользователь Standalone-платформы без регистрации.

| Параметр | Значение |
|----------|----------|
| Хранение | Только `localStorage` (клиент) |
| Запись в БД | **Не создаётся** |
| Токен | `guestToken` (JWT) |
| Никнейм | Случайный из списка |
| Скин | Случайный из базового набора |
| Рейтинг | **Не начисляется** |

### 3.2. Telegram-аноним (`telegram_anonymous`)

Пользователь Telegram, не завершивший профиль.

| Параметр | Значение |
|----------|----------|
| Хранение | Таблица `users` (БД) |
| Флаг | `is_anonymous = true` |
| Токен | `accessToken` (JWT) |
| Никнейм | Из Telegram или случайный |
| Скин | Случайный из базового набора |
| Рейтинг | **Не начисляется** |

**Создаётся автоматически** при первом входе через Telegram.

### 3.3. Зарегистрированный игрок (`registered`)

Пользователь с завершённым профилем.

| Параметр | Значение |
|----------|----------|
| Хранение | Таблица `users` (БД) |
| Флаг | `is_anonymous = false` |
| Токен | `accessToken` (JWT) |
| `authProvider` | `telegram`, `google`, `yandex` |
| Никнейм | Выбранный при завершении профиля |
| Скин | Закреплённый при завершении профиля |
| Рейтинг | **Начисляется** |

### 3.4. Правило начисления рейтинга

**Рейтинг начисляется только если `users.is_anonymous = false`.**

| Тип | Рейтинг |
|-----|---------|
| Гость | Нет |
| Telegram-аноним | Нет |
| Зарегистрированный | Да |

---

## 4. Разделение понятий: платформа и провайдер

### 4.1. Два измерения

| Понятие | Значения | Назначение |
|---------|----------|------------|
| `runtimePlatform` | `telegram`, `standalone` | Где запущен клиент |
| `authProvider` | `telegram`, `google`, `yandex` | Через что авторизован |

### 4.2. Примеры сочетаний

| Пользователь | `runtimePlatform` | `authProvider` |
|--------------|-------------------|----------------|
| Гость на сайте | `standalone` | — |
| Telegram-аноним | `telegram` | `telegram` |
| Зарегистрированный через Google | `standalone` | `google` |
| Зарегистрированный через Яндекс | `standalone` | `yandex` |
| Зарегистрированный в Telegram | `telegram` | `telegram` |

---

## 5. Платформенная абстракция

### 5.1. PlatformManager

Ответственность:
- Определение платформы при запуске
- Возврат активного `IPlatformAdapter`

| Платформа | Условие определения |
|-----------|---------------------|
| `telegram` | `window.Telegram?.WebApp?.initData` существует и не пустой |
| `standalone` | Все остальные случаи |

### 5.2. IPlatformAdapter

| Метод | Описание |
|-------|----------|
| `getRuntimePlatform()` | Возвращает `telegram` или `standalone` |
| `getAuthProvider()` | Возвращает `IAuthProvider` |
| `getSafeAreaInsets()` | Отступы для UI |

### 5.3. IAuthProvider

| Метод | Описание |
|-------|----------|
| `tryRestoreSession()` | Восстановить сессию по сохранённому токену |
| `trySilentAuth()` | Тихая авторизация (только Telegram) |
| `getOrCreateGuestToken()` | Получить `guestToken` (только Standalone) |
| `startLogin(provider)` | Начать OAuth-флоу (только Standalone) |
| `completeProfile(params)` | Завершить профиль с `claimToken` |

### 5.4. Провайдеры

**TelegramAuthProvider:**
- `trySilentAuth()` → `POST /auth/telegram` → `accessToken`
- Создаёт `users` с `is_anonymous = true`

**StandaloneAuthProvider:**
- `getOrCreateGuestToken()` → `POST /auth/guest` → `guestToken`
- Запись в БД **не создаётся**

### 5.5. Boot-flow

1. `PlatformManager.detect()` → определить `runtimePlatform`
2. `authProvider.tryRestoreSession()` → проверить токен
3. Если нет сессии и Telegram: `trySilentAuth()`
4. Если нет сессии и Standalone: `getOrCreateGuestToken()`
5. Переход на Главную (`LobbyScreen`)

### 5.6. Токены

| Токен | Назначение | Формат | Срок жизни |
|-------|------------|--------|------------|
| `accessToken` | API зарегистрированных и Telegram-анонимов | JWT | 24 часа |
| `guestToken` | API гостей (Standalone) | JWT | 7 дней |
| `joinToken` | Вход в матч | = `accessToken` или `guestToken` | — |
| `claimToken` | Завершение профиля | JWT | 30–120 минут |

**Критически важно:** `joinToken` **всегда** JWT. MatchServer валидирует подпись в `onAuth()`.

### 5.7. Тестирование Telegram

**HTTPS-туннель:**
1. `npm run dev:client`
2. `cloudflared tunnel --url http://localhost:5173`
3. BotFather: `/setmenubutton` на HTTPS URL
4. Открыть бота → кнопка меню → игра

**Dev-мок:** `?platform=telegram_mock` активирует `TelegramAdapterMock`.

---

## 6. Пользовательские сценарии

### 6.1. Первый вход (Standalone)

1. Игрок открывает игру в браузере.
2. `PlatformManager` → `runtimePlatform = standalone`.
3. `getOrCreateGuestToken()` → `guestToken`.
4. Переход на Главную (`LobbyScreen`).
5. Генерация никнейма и скина → `localStorage`.
6. Кнопка «Войти» видна.

### 6.2. Первый вход (Telegram)

1. Игрок открывает Mini App.
2. `PlatformManager` → `runtimePlatform = telegram`.
3. `trySilentAuth()` → `POST /auth/telegram` → `users` с `is_anonymous = true`.
4. Переход на Главную (`LobbyScreen`).
5. Никнейм из Telegram или генерируется.

### 6.3. Начало игры

1. На Главной игрок нажимает «Арена».
2. Переход на Подготовку (`MatchmakingScreen`).
3. Выбор класса (один по умолчанию).
4. «Играть!» → Бой (`BattleScreen`).

### 6.4. Завершение матча

1. После Боя → Результаты (`ResultsScreen`).
2. Клиент запрашивает `POST /match-results/claim` → `claimToken`.
3. Если масса ≥ `registrationPromptMinMass`:
   - Модальное окно: «Сохранить прогресс» / «Сыграть ещё»

### 6.5. Завершение профиля (Standalone)

1. Выбор провайдера (Google / Яндекс).
2. OAuth-флоу → `code`.
3. `POST /auth/upgrade` режим `convert_guest`:
   - `authPayload` = OAuth-код
   - `claimToken`
   - `nickname`
4. Сервер создаёт `users` с `is_anonymous = false`.
5. Инициализация рейтингов из `claimToken.finalMass`.

### 6.6. Завершение профиля (Telegram)

1. «Сохранить прогресс».
2. `POST /auth/upgrade` режим `complete_profile`:
   - `claimToken`
   - `nickname`
3. Сервер обновляет `users`: `is_anonymous = false`.
4. Инициализация рейтингов.

### 6.7. Повторный вход

1. `tryRestoreSession()`.
2. Если токен валиден → Главная.
3. Если истёк:
   - Telegram: `trySilentAuth()` → новый токен
   - Standalone: гостевой режим

### 6.8. Вход в существующий аккаунт (Standalone)

1. Гость нажимает «Войти».
2. OAuth-флоу → `POST /auth/oauth`.
3. Если аккаунт найден → загрузка профиля.
4. Если не найден → ошибка 404.

**Важно:** Создание нового аккаунта через `auth/oauth` запрещено.

---

## 7. Система рейтинга

### 7.1. Два рейтинга

| Рейтинг | Таблица | Правило |
|---------|---------|---------|
| Накопительный | `leaderboard_total_mass` | `total_mass += finalMass` |
| Рекордный | `leaderboard_best_mass` | `best_mass = max(best_mass, finalMass)` |

### 7.2. Начисление

После каждого матча **зарегистрированного** (`is_anonymous = false`):

1. Проверка `rating_awards(user_id, match_id)` — если есть, прекратить
2. Обновить `total_mass`, `matches_played`
3. Если `finalMass > best_mass` → обновить `best_mass`
4. Создать запись в `rating_awards`

### 7.3. Таблица лидеров

- Две вкладки: «Накопительный» / «Рекордный»
- Топ-100 игроков
- Позиция текущего игрока отдельно
