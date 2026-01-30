# Slime Arena — ТЗ: StandaloneAdapter с OAuth авторизацией

**Версия:** 1.0  
**Дата:** 30 января 2026  
**Автор:** Claude Opus 4.5 (Architect)  
**Приоритет:** P0  
**Зависимости:** TZ-MetaGameplay-v1.3, Architecture v4.2.5 Part4

---

## 1. Правовой контекст

### 1.1. Закон РФ об авторизации (ФЗ-406 от 31.07.2023)

С 1 января 2025 года на **российских сайтах** запрещена авторизация через иностранные системы (Google ID, Apple ID) для пользователей из РФ.

| Что запрещено | Что разрешено |
|---------------|---------------|
| Google OAuth для пользователей из РФ | VK ID |
| Apple ID для пользователей из РФ | Яндекс ID |
| Facebook Login для пользователей из РФ | Сбер ID |
| | Mail.ru ID |
| | Госуслуги (ЕСИА) |
| | Номер телефона (российский оператор) |

### 1.2. Область применения закона

| Условие | Применяется закон? |
|---------|-------------------|
| Владелец сайта — российское юр.лицо, пользователь из РФ | **Да** |
| Владелец сайта — иностранное юр.лицо | Нет |
| Пользователь из-за рубежа | Нет |
| Игровые порталы (CrazyGames, Poki) | Нет (иностранные площадки) |

### 1.3. Рекомендация для Slime Arena

Использовать **гибридный подход**: показывать разные провайдеры авторизации в зависимости от геолокации пользователя.

---

## 2. Минимальный набор OAuth-провайдеров

### 2.1. Матрица провайдеров по регионам

| Провайдер | РФ | СНГ | Европа | США/Азия | Приоритет |
|-----------|:--:|:---:|:------:|:--------:|:---------:|
| **VK ID** | ✅ | ✅ | — | — | P0 |
| **Яндекс ID** | ✅ | ✅ | — | — | P0 |
| **Google OAuth** | ❌* | ✅ | ✅ | ✅ | P0 |
| Сбер ID | ✅ | — | — | — | P2 |
| Mail.ru ID | ✅ | ✅ | — | — | P2 |
| Apple ID | ❌* | ✅ | ✅ | ✅ | P2 |

*❌ — запрещено законом для пользователей из РФ на российских сайтах*

### 2.2. Рекомендуемый минимум (P0)

| Регион | Провайдеры | Обоснование |
|--------|------------|-------------|
| **РФ** | VK ID + Яндекс ID | Соответствие закону, максимальный охват |
| **СНГ** | VK ID + Яндекс ID + Google | VK и Яндекс популярны, Google как fallback |
| **Глобально** | Google OAuth | Самый распространённый |

### 2.3. Статистика популярности (РФ, 2024-2025)

| Провайдер | Охват среди интернет-пользователей РФ |
|-----------|--------------------------------------|
| VK | ~70% |
| Яндекс | ~60% |
| Mail.ru | ~40% |
| Сбер | ~30% (банковские клиенты) |

---

## 3. Архитектура решения

### 3.1. Определение региона пользователя

| Метод | Точность | Когда использовать |
|-------|----------|-------------------|
| GeoIP по IP-адресу | Высокая | Основной метод |
| Accept-Language заголовок | Средняя | Дополнительный сигнал |
| Timezone браузера | Средняя | Fallback |
| Явный выбор пользователя | 100% | Переопределение |

### 3.2. Логика выбора провайдеров

```
┌─────────────────────────────────────────────────────────────────┐
│                    Определение региона                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │   РФ    │          │   СНГ   │          │ Глобально│
   └────┬────┘          └────┬────┘          └────┬────┘
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ VK ID   │          │ VK ID   │          │ Google  │
   │ Яндекс  │          │ Яндекс  │          │         │
   │         │          │ Google  │          │         │
   └─────────┘          └─────────┘          └─────────┘
```

### 3.3. Структура StandaloneAdapter

| Компонент | Ответственность |
|-----------|-----------------|
| `StandaloneAdapter` | Реализация `IPlatformAdapter` |
| `StandaloneAuthProvider` | Управление OAuth-флоу |
| `OAuthProviderFactory` | Создание провайдеров по региону |
| `GeoLocationService` | Определение региона |
| `VKAuthProvider` | Интеграция с VK ID |
| `YandexAuthProvider` | Интеграция с Яндекс ID |
| `GoogleAuthProvider` | Интеграция с Google OAuth |

---

## 4. VK ID

### 4.1. Общая информация

| Параметр | Значение |
|----------|----------|
| Документация | `https://id.vk.com/about/business/go/docs` |
| Тип интеграции | OAuth 2.0 + VK ID SDK |
| Области доступа | `vkid.personal_info`, `email` |
| Одобрение приложения | Требуется модерация |

### 4.2. Endpoints

| Endpoint | URL |
|----------|-----|
| Авторизация | `https://id.vk.com/authorize` |
| Токен | `https://id.vk.com/oauth2/token` |
| Информация о пользователе | `https://id.vk.com/oauth2/user_info` |

### 4.3. Параметры запроса авторизации

| Параметр | Описание |
|----------|----------|
| `client_id` | ID приложения |
| `redirect_uri` | URI редиректа после авторизации |
| `response_type` | `code` |
| `scope` | `vkid.personal_info email` |
| `state` | CSRF-токен |
| `code_challenge` | PKCE challenge (обязательно) |
| `code_challenge_method` | `S256` |

### 4.4. Ответ с токеном

| Поле | Тип | Описание |
|------|-----|----------|
| `access_token` | string | Токен доступа |
| `refresh_token` | string | Токен обновления |
| `id_token` | string | JWT с данными пользователя |
| `expires_in` | number | Время жизни токена (секунды) |
| `user_id` | number | ID пользователя VK |

### 4.5. Данные пользователя (user_info)

| Поле | Тип | Описание |
|------|-----|----------|
| `user_id` | string | Уникальный ID |
| `first_name` | string | Имя |
| `last_name` | string | Фамилия |
| `avatar` | string | URL аватарки |
| `email` | string | Email (если запрошен) |
| `phone` | string | Телефон (если запрошен) |

### 4.6. VK ID SDK (рекомендуется)

VK предоставляет JavaScript SDK для упрощения интеграции:

| Функция | Описание |
|---------|----------|
| `VKIDSDK.init()` | Инициализация SDK |
| `VKIDSDK.Auth.login()` | Открытие окна авторизации |
| `VKIDSDK.Auth.logout()` | Выход |
| `VKIDSDK.Auth.getUser()` | Получение данных пользователя |

**Важно:** VK ID требует обязательного использования PKCE.

---

## 5. Яндекс ID

### 5.1. Общая информация

| Параметр | Значение |
|----------|----------|
| Документация | `https://yandex.ru/dev/id/doc/` |
| Тип интеграции | OAuth 2.0 |
| Области доступа | `login:info`, `login:email`, `login:avatar` |
| Одобрение приложения | Автоматическое |

### 5.2. Endpoints

| Endpoint | URL |
|----------|-----|
| Авторизация | `https://oauth.yandex.ru/authorize` |
| Токен | `https://oauth.yandex.ru/token` |
| Информация о пользователе | `https://login.yandex.ru/info` |

### 5.3. Параметры запроса авторизации

| Параметр | Описание |
|----------|----------|
| `client_id` | ID приложения |
| `redirect_uri` | URI редиректа |
| `response_type` | `code` |
| `scope` | `login:info login:email login:avatar` |
| `state` | CSRF-токен |
| `force_confirm` | `yes` — всегда показывать окно подтверждения |

### 5.4. Ответ с токеном

| Поле | Тип | Описание |
|------|-----|----------|
| `access_token` | string | Токен доступа |
| `refresh_token` | string | Токен обновления |
| `token_type` | string | `bearer` |
| `expires_in` | number | Время жизни токена |

### 5.5. Данные пользователя (/info)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный ID |
| `login` | string | Логин |
| `display_name` | string | Отображаемое имя |
| `real_name` | string | Реальное имя |
| `default_email` | string | Email |
| `default_avatar_id` | string | ID аватарки |

### 5.6. Формирование URL аватарки

```
https://avatars.yandex.net/get-yapic/{avatar_id}/islands-200
```

Размеры: `islands-small`, `islands-middle`, `islands-200`.

---

## 6. Google OAuth 2.0

### 6.1. Общая информация

| Параметр | Значение |
|----------|----------|
| Документация | `https://developers.google.com/identity/protocols/oauth2` |
| Тип интеграции | OAuth 2.0 + Google Identity Services |
| Области доступа | `openid`, `email`, `profile` |
| Одобрение приложения | Требуется верификация для production |

### 6.2. Endpoints

| Endpoint | URL |
|----------|-----|
| Авторизация | `https://accounts.google.com/o/oauth2/v2/auth` |
| Токен | `https://oauth2.googleapis.com/token` |
| Информация о пользователе | `https://www.googleapis.com/oauth2/v2/userinfo` |

### 6.3. Параметры запроса авторизации

| Параметр | Описание |
|----------|----------|
| `client_id` | ID приложения |
| `redirect_uri` | URI редиректа |
| `response_type` | `code` |
| `scope` | `openid email profile` |
| `state` | CSRF-токен |
| `access_type` | `offline` для refresh_token |
| `prompt` | `consent` для повторного запроса разрешений |

### 6.4. Ответ с токеном

| Поле | Тип | Описание |
|------|-----|----------|
| `access_token` | string | Токен доступа |
| `refresh_token` | string | Токен обновления (если `access_type=offline`) |
| `id_token` | string | JWT с данными пользователя |
| `expires_in` | number | Время жизни токена |
| `token_type` | string | `Bearer` |

### 6.5. Данные пользователя (userinfo)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный ID |
| `email` | string | Email |
| `verified_email` | boolean | Email подтверждён |
| `name` | string | Полное имя |
| `given_name` | string | Имя |
| `family_name` | string | Фамилия |
| `picture` | string | URL аватарки |
| `locale` | string | Локаль |

### 6.6. Google Identity Services (GIS)

Для веб-приложений рекомендуется использовать новый Google Identity Services SDK вместо старого Google Sign-In.

| Функция | Описание |
|---------|----------|
| `google.accounts.id.initialize()` | Инициализация |
| `google.accounts.id.prompt()` | One Tap авторизация |
| `google.accounts.id.renderButton()` | Отрисовка кнопки |

---

## 7. Изменения в базе данных

### 7.1. Обновление таблицы oauth_links

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ |
| `user_id` | UUID | FK → users.id |
| `provider` | VARCHAR(32) | `vk`, `yandex`, `google`, `telegram`, `crazygames` |
| `provider_user_id` | VARCHAR(255) | ID пользователя у провайдера |
| `provider_email` | VARCHAR(255) | Email от провайдера |
| `provider_avatar` | VARCHAR(512) | URL аватарки |
| `created_at` | TIMESTAMP | Дата создания |
| `updated_at` | TIMESTAMP | Дата обновления |

**Уникальный индекс:** `(provider, provider_user_id)`

### 7.2. Новые значения auth_provider в таблице users

| Значение | Описание |
|----------|----------|
| `telegram` | Авторизация через Telegram |
| `crazygames` | Авторизация через CrazyGames |
| `vk` | Авторизация через VK ID |
| `yandex` | Авторизация через Яндекс ID |
| `google` | Авторизация через Google |

---

## 8. API MetaServer

### 8.1. POST /api/v1/auth/oauth

Авторизация через OAuth-провайдера.

**Запрос:**

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `provider` | string | Да | `vk`, `yandex`, `google` |
| `code` | string | Да | Authorization code от провайдера |
| `redirectUri` | string | Да | URI редиректа (должен совпадать) |
| `codeVerifier` | string | Для VK | PKCE verifier |

**Ответ (успех):**

| Поле | Тип | Описание |
|------|-----|----------|
| `accessToken` | string | JWT токен игры |
| `userId` | string | UUID пользователя |
| `isNewUser` | boolean | Новый пользователь? |
| `profile` | ProfileSummary | Данные профиля |

**Ответ (ошибка):**

| Код | Описание |
|----|----------|
| 400 | Невалидный код или провайдер |
| 401 | Ошибка авторизации у провайдера |
| 409 | OAuth-аккаунт уже привязан к другому пользователю |

### 8.2. POST /api/v1/auth/oauth/link

Привязка дополнительного OAuth-провайдера к существующему аккаунту.

**Запрос:**

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `provider` | string | Да | Провайдер |
| `code` | string | Да | Authorization code |
| `redirectUri` | string | Да | URI редиректа |

**Заголовки:** `Authorization: Bearer {accessToken}`

**Ответ:** как `/auth/oauth`

### 8.3. DELETE /api/v1/auth/oauth/unlink

Отвязка OAuth-провайдера от аккаунта.

**Запрос:**

| Поле | Тип | Обязательно | Описание |
|------|-----|:-----------:|----------|
| `provider` | string | Да | Провайдер для отвязки |

**Ограничение:** Нельзя отвязать последний провайдер (аккаунт станет недоступен).

---

## 9. Клиентская реализация

### 9.1. Структура файлов

| Файл | Назначение |
|------|------------|
| `client/src/platform/StandaloneAdapter.ts` | Основной адаптер |
| `client/src/platform/providers/StandaloneAuthProvider.ts` | Управление OAuth |
| `client/src/platform/oauth/OAuthProviderFactory.ts` | Фабрика провайдеров |
| `client/src/platform/oauth/VKAuthProvider.ts` | VK ID |
| `client/src/platform/oauth/YandexAuthProvider.ts` | Яндекс ID |
| `client/src/platform/oauth/GoogleAuthProvider.ts` | Google OAuth |
| `client/src/services/GeoLocationService.ts` | Определение региона |
| `client/src/ui/components/OAuthModal.tsx` | UI выбора провайдера |

### 9.2. Интерфейс IOAuthProvider

| Метод | Описание |
|-------|----------|
| `getProviderName()` | Возвращает `vk`, `yandex`, `google` |
| `getAuthUrl(state, codeChallenge?)` | Формирует URL авторизации |
| `exchangeCode(code, codeVerifier?)` | Обменивает code на данные пользователя |
| `getButtonConfig()` | Конфигурация кнопки (цвет, текст, иконка) |

### 9.3. Flow авторизации на клиенте

```
┌─────────────────────────────────────────────────────────────────┐
│                    OAuth Flow на клиенте                         │
└─────────────────────────────────────────────────────────────────┘

1. Пользователь нажимает "Войти"
                │
                ▼
2. GeoLocationService определяет регион
                │
                ▼
3. OAuthModal показывает доступные провайдеры
                │
                ▼
4. Пользователь выбирает провайдер (напр. VK ID)
                │
                ▼
5. OAuthProvider генерирует state и codeChallenge (PKCE)
                │
                ▼
6. Открывается popup с URL авторизации провайдера
                │
                ▼
7. Пользователь авторизуется, даёт разрешения
                │
                ▼
8. Провайдер редиректит на redirectUri с code
                │
                ▼
9. Клиент отправляет code на POST /auth/oauth
                │
                ▼
10. MetaServer обменивает code на токен провайдера
                │
                ▼
11. MetaServer получает данные пользователя от провайдера
                │
                ▼
12. MetaServer создаёт/находит пользователя, возвращает accessToken
                │
                ▼
13. Клиент сохраняет accessToken, обновляет UI
```

### 9.4. OAuthModal — конфигурация кнопок

| Провайдер | Цвет фона | Цвет текста | Иконка |
|-----------|-----------|-------------|--------|
| VK ID | #0077FF | #FFFFFF | vk-logo.svg |
| Яндекс ID | #FC3F1D | #FFFFFF | yandex-logo.svg |
| Google | #FFFFFF | #757575 | google-logo.svg |

---

## 10. Серверная реализация

### 10.1. Структура файлов

| Файл | Назначение |
|------|------------|
| `server/src/services/OAuthService.ts` | Бизнес-логика OAuth |
| `server/src/providers/VKOAuthProvider.ts` | Интеграция VK |
| `server/src/providers/YandexOAuthProvider.ts` | Интеграция Яндекс |
| `server/src/providers/GoogleOAuthProvider.ts` | Интеграция Google |
| `server/src/routes/auth.ts` | HTTP endpoints |

### 10.2. Интерфейс IOAuthServerProvider

| Метод | Описание |
|-------|----------|
| `exchangeCodeForToken(code, redirectUri, codeVerifier?)` | Обмен code на access_token |
| `getUserInfo(accessToken)` | Получение данных пользователя |
| `validateToken(accessToken)` | Проверка валидности токена |

### 10.3. OAuthService — основные методы

| Метод | Описание |
|-------|----------|
| `authenticateWithOAuth(provider, code, redirectUri, codeVerifier)` | Полный flow авторизации |
| `linkOAuthProvider(userId, provider, code, redirectUri)` | Привязка провайдера |
| `unlinkOAuthProvider(userId, provider)` | Отвязка провайдера |
| `findUserByOAuth(provider, providerUserId)` | Поиск пользователя по OAuth |

---

## 11. Конфигурация

### 11.1. Переменные окружения

| Переменная | Описание | Обязательно |
|------------|----------|:-----------:|
| `VK_CLIENT_ID` | ID приложения VK | Да (для РФ) |
| `VK_CLIENT_SECRET` | Секрет приложения VK | Да (для РФ) |
| `YANDEX_CLIENT_ID` | ID приложения Яндекс | Да (для РФ) |
| `YANDEX_CLIENT_SECRET` | Секрет приложения Яндекс | Да (для РФ) |
| `GOOGLE_CLIENT_ID` | ID приложения Google | Да |
| `GOOGLE_CLIENT_SECRET` | Секрет приложения Google | Да |
| `OAUTH_REDIRECT_URI` | URI редиректа | Да |

### 11.2. Флаги в config/features.json

| Флаг | Тип | Default | Описание |
|------|-----|---------|----------|
| `oauthVKEnabled` | boolean | true | Включить VK ID |
| `oauthYandexEnabled` | boolean | true | Включить Яндекс ID |
| `oauthGoogleEnabled` | boolean | true | Включить Google OAuth |
| `oauthRegionDetectionEnabled` | boolean | true | Определение региона |

### 11.3. Регистрация приложений

| Провайдер | URL консоли разработчика |
|-----------|--------------------------|
| VK ID | `https://id.vk.com/about/business/go` |
| Яндекс | `https://oauth.yandex.ru/client/new` |
| Google | `https://console.cloud.google.com/apis/credentials` |

---

## 12. Безопасность

### 12.1. PKCE (Proof Key for Code Exchange)

**Обязательно для VK ID**, рекомендуется для всех провайдеров.

| Параметр | Описание |
|----------|----------|
| `code_verifier` | Случайная строка 43-128 символов |
| `code_challenge` | `BASE64URL(SHA256(code_verifier))` |
| `code_challenge_method` | `S256` |

### 12.2. State параметр (CSRF-защита)

| Требование | Описание |
|------------|----------|
| Генерация | Криптографически случайная строка |
| Хранение | sessionStorage или httpOnly cookie |
| Валидация | Сравнение при получении callback |
| Время жизни | 10 минут |

### 12.3. Защита от атак

| Атака | Защита |
|-------|--------|
| CSRF | state параметр |
| Code injection | PKCE |
| Replay attack | Одноразовый code |
| Token theft | httpOnly cookies для refresh_token |
| Open redirect | Whitelist redirect_uri |

---

## 13. Тестирование

### 13.1. Чеклист VK ID

- [ ] Приложение зарегистрировано в VK ID
- [ ] Redirect URI добавлен в настройки приложения
- [ ] PKCE работает корректно
- [ ] Получение user_info успешно
- [ ] Создание пользователя в БД
- [ ] Повторный вход в существующий аккаунт
- [ ] Привязка VK к существующему аккаунту
- [ ] Отвязка VK (при наличии другого провайдера)

### 13.2. Чеклист Яндекс ID

- [ ] Приложение зарегистрировано в Яндекс OAuth
- [ ] Redirect URI добавлен
- [ ] Получение токена успешно
- [ ] Получение user_info успешно
- [ ] Аватарка загружается корректно
- [ ] Создание/вход пользователя

### 13.3. Чеклист Google OAuth

- [ ] Проект создан в Google Cloud Console
- [ ] OAuth consent screen настроен
- [ ] Redirect URI добавлен
- [ ] Получение id_token успешно
- [ ] Создание/вход пользователя

### 13.4. Чеклист интеграции

- [ ] Определение региона работает
- [ ] Для РФ показываются VK + Яндекс
- [ ] Для СНГ показываются VK + Яндекс + Google
- [ ] Для остального мира показывается Google
- [ ] Popup не блокируется браузером
- [ ] Callback обрабатывается корректно
- [ ] accessToken сохраняется и восстанавливается
- [ ] Рейтинг начисляется зарегистрированным игрокам

---

## 14. Интеграция в Sprint-15/16

### 14.1. Декомпозиция задач

| ID | Задача | Оценка | Приоритет |
|----|--------|--------|-----------|
| SA-1 | GeoLocationService | 2ч | P0 |
| SA-2 | OAuthProviderFactory + интерфейсы | 2ч | P0 |
| SA-3 | VKAuthProvider (клиент) | 4ч | P0 |
| SA-4 | VKOAuthProvider (сервер) | 4ч | P0 |
| SA-5 | YandexAuthProvider (клиент) | 3ч | P0 |
| SA-6 | YandexOAuthProvider (сервер) | 3ч | P0 |
| SA-7 | GoogleAuthProvider (клиент) | 3ч | P0 |
| SA-8 | GoogleOAuthProvider (сервер) | 3ч | P0 |
| SA-9 | OAuthModal UI | 3ч | P0 |
| SA-10 | POST /auth/oauth endpoint | 3ч | P0 |
| SA-11 | Тестирование VK ID | 2ч | P0 |
| SA-12 | Тестирование Яндекс ID | 2ч | P0 |
| SA-13 | Тестирование Google OAuth | 2ч | P0 |

**Общая оценка:** 36 часов (~5 рабочих дней)

### 14.2. Порядок выполнения

```
День 1: SA-1, SA-2, SA-9 (инфраструктура + UI)
День 2: SA-3, SA-4 (VK ID)
День 3: SA-5, SA-6 (Яндекс ID)
День 4: SA-7, SA-8, SA-10 (Google + endpoint)
День 5: SA-11, SA-12, SA-13 (тестирование)
```

---

## 15. Критерии приёмки

### 15.1. P0 — Обязательно

- [ ] VK ID работает для пользователей из РФ
- [ ] Яндекс ID работает для пользователей из РФ
- [ ] Google OAuth работает для пользователей из-за рубежа
- [ ] Определение региона корректное
- [ ] PKCE реализован для VK ID
- [ ] State параметр валидируется
- [ ] accessToken выдаётся и сохраняется
- [ ] Повторный вход работает
- [ ] Рейтинг начисляется

### 15.2. P1 — Желательно

- [ ] Привязка нескольких провайдеров к одному аккаунту
- [ ] Отвязка провайдера
- [ ] Явный выбор региона пользователем
- [ ] Кэширование GeoIP

### 15.3. P2 — После запуска

- [ ] Сбер ID
- [ ] Mail.ru ID
- [ ] Apple ID (для iOS)
- [ ] Госуслуги (ЕСИА)

---

## 16. Глоссарий

| Термин | Описание |
|--------|----------|
| OAuth 2.0 | Протокол авторизации для делегирования доступа |
| PKCE | Proof Key for Code Exchange — расширение OAuth для защиты мобильных/SPA приложений |
| Authorization Code | Одноразовый код, обмениваемый на access_token |
| Access Token | Токен для доступа к API провайдера |
| Refresh Token | Долгоживущий токен для обновления access_token |
| ID Token | JWT с данными пользователя (OpenID Connect) |
| State | Параметр для защиты от CSRF-атак |
| Redirect URI | URL, на который провайдер возвращает пользователя после авторизации |
| VK ID | Система авторизации ВКонтакте |
| GeoIP | Определение геолокации по IP-адресу |
| ФЗ-406 | Федеральный закон от 31.07.2023 об авторизации |

---

## 17. Ссылки

### 17.1. Документация провайдеров

| Провайдер | URL |
|-----------|-----|
| VK ID | https://id.vk.com/about/business/go/docs |
| Яндекс OAuth | https://yandex.ru/dev/id/doc/ |
| Google OAuth | https://developers.google.com/identity/protocols/oauth2 |

### 17.2. Законодательство

| Документ | URL |
|----------|-----|
| ФЗ-406 от 31.07.2023 | http://publication.pravo.gov.ru/document/0001202307310012 |

---

## История версий

| Версия | Дата | Изменения |
|--------|------|-----------|
| 1.0 | 30 января 2026 | Первоначальная версия |
