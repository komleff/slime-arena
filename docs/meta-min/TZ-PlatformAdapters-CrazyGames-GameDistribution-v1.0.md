# Slime Arena — ТЗ: Адаптеры CrazyGames и GameDistribution

**Версия:** 1.0  
**Дата:** 29 января 2026  
**Автор:** Claude Opus 4.5 (Architect)  
**Приоритет:** P1  
**Зависимости:** TZ-MetaGameplay-v1.3, Architecture v4.2.5 Part4, TZ-SoftLaunch-v1.4.7

---

## 1. Цель

Расширить платформенную абстракцию для поддержки двух дополнительных игровых порталов:

| Платформа | Охват | Приоритет |
|-----------|-------|-----------|
| CrazyGames | Глобально, 20M пользователей/месяц | P1 |
| GameDistribution | Глобально, 300M пользователей/месяц | P1 |

Добавление этих платформ позволит расширить охват аудитории без изменения основного кода игры.

---

## 2. Обновлённая таблица адаптеров

| Адаптер | Платформа | Авторизация | Реклама | Платежи | Социальные |
|---------|-----------|-------------|---------|---------|------------|
| `TelegramAdapter` | Telegram Mini Apps | initData, JWT | Telegram Ads | Stars | Инвайты, каналы |
| `YandexAdapter` | Яндекс Игры | Yandex ID | Yandex Ads | ЮMoney | Нет |
| `PokiAdapter` | Poki | Гостевой | Poki Ads | Нет | Нет |
| `CrazyGamesAdapter` | CrazyGames | JWT (опционально) | CG Ads | Xsolla | Инвайты |
| `GameDistributionAdapter` | GameDistribution | Гостевой | GD Ads (IMA) | Нет | Нет |
| `StandaloneAdapter` | Локальная разработка | Заглушки | Нет | Нет | Нет |

---

## 3. Определение платформы

### 3.1. Расширенная логика PlatformManager

Порядок проверки (от специфичного к общему):

| Приоритет | Условие | Адаптер |
|-----------|---------|---------|
| 1 | `window.Telegram?.WebApp?.initData` не пустой | TelegramAdapter |
| 2 | `window.CrazyGames?.SDK` существует | CrazyGamesAdapter |
| 3 | `window.gdsdk` или `window.GD_OPTIONS` существует | GameDistributionAdapter |
| 4 | `window.YaGames` существует | YandexAdapter |
| 5 | `window.PokiSDK` существует | PokiAdapter |
| 6 | Все остальные случаи | StandaloneAdapter |

### 3.2. Новые значения runtimePlatform

| Значение | Описание |
|----------|----------|
| `telegram` | Telegram Mini App |
| `yandex` | Яндекс Игры |
| `poki` | Poki |
| `crazygames` | CrazyGames |
| `gamedistribution` | GameDistribution |
| `standalone` | Браузер без контекста |

---

## 4. CrazyGamesAdapter

### 4.1. Общая информация

| Параметр | Значение |
|----------|----------|
| SDK URL | `https://sdk.crazygames.com/crazygames-sdk-v3.js` |
| Документация | `https://docs.crazygames.com/` |
| Глобальный объект | `window.CrazyGames.SDK` |
| Инициализация | Асинхронная, через `init()` |

### 4.2. Интерфейс IAuthProvider для CrazyGames

| Метод | Реализация |
|-------|------------|
| `tryRestoreSession()` | Проверить `isUserAccountAvailable()`, получить `getUserToken()` |
| `trySilentAuth()` | `getUser()` — если не null, пользователь авторизован |
| `getOrCreateGuestToken()` | Не применимо, использовать `guestToken` из MetaServer |
| `startLogin(provider)` | `showAuthPrompt()` — показать окно входа CrazyGames |
| `completeProfile(params)` | Стандартная логика через MetaServer |

### 4.3. Авторизация через CrazyGames

**Схема авторизации:**

1. Клиент вызывает `CrazyGames.SDK.user.getUserToken()`.
2. SDK возвращает JWT-токен с полями:
   - `userId` — уникальный идентификатор пользователя CrazyGames
   - `gameId` — идентификатор игры
   - `username` — отображаемое имя
   - `profilePictureUrl` — URL аватарки
3. Клиент отправляет токен на `POST /api/v1/auth/verify` с `platformType = 'crazygames'`.
4. MetaServer верифицирует токен через публичный ключ `https://sdk.crazygames.com/publicKey.json`.
5. MetaServer создаёт или находит запись в `users` с `auth_provider = 'crazygames'`.
6. MetaServer возвращает `accessToken` игры.

**Гостевой режим:**

Если `CrazyGames.SDK.user.getUser()` возвращает `null`, пользователь не авторизован в CrazyGames. В этом случае:
- Использовать стандартный гостевой flow через `POST /api/v1/auth/guest`
- Показывать кнопку «Войти через CrazyGames» в лобби

### 4.4. Интерфейс IAdsProvider для CrazyGames

| Метод | Реализация |
|-------|------------|
| `init()` | Инициализация выполняется при загрузке SDK |
| `showInterstitial()` | `requestAd('midgame', callbacks)` |
| `showRewarded()` | `requestAd('rewarded', callbacks)` |
| `isAvailable()` | `getEnvironment() === 'crazygames'` |

**Callbacks рекламы:**

| Callback | Действие |
|----------|----------|
| `adStarted` | Приостановить игру, отключить звук |
| `adFinished` | Возобновить игру, если rewarded — выдать награду |
| `adError` | Логировать ошибку, продолжить без награды |

**Баннеры:**

| Метод | Параметры |
|-------|-----------|
| `requestBanner()` | `id: string`, `width: number`, `height: number` |
| `clearBanner()` | `id: string` |

Размеры баннеров: 300x250, 728x90, 160x600, 970x90.

### 4.5. Интерфейс IDataProvider для CrazyGames

CrazyGames предоставляет модуль `data` для хранения прогресса. API идентичен `localStorage`.

| Метод | Описание |
|-------|----------|
| `getItem(key)` | Получить значение |
| `setItem(key, value)` | Сохранить значение |
| `removeItem(key)` | Удалить значение |
| `clear()` | Очистить всё |

**Ограничения:**
- Максимальный размер данных: 1 МБ
- Debounce сохранения: 1 секунда
- Синхронизация между устройствами для авторизованных пользователей

**Рекомендация:** Использовать `data` модуль только для кэша; основные данные хранить на MetaServer.

### 4.6. Интерфейс ISocialProvider для CrazyGames

| Метод | Реализация |
|-------|------------|
| `inviteFriends()` | `CrazyGames.SDK.game.inviteLink({ ... })` |
| `getFriendsList()` | Не поддерживается |
| `shareResult()` | Не поддерживается |

### 4.7. Интерфейс IPaymentProvider для CrazyGames (опционально)

CrazyGames поддерживает платежи через Xsolla.

| Метод | Реализация |
|-------|------------|
| `init()` | Получить Xsolla Project ID от CrazyGames |
| `getXsollaToken()` | `user.getXsollaUserToken()` |
| `purchase(sku)` | Использовать Xsolla SDK |

**Ограничения:**
- Требуется отдельное соглашение с CrazyGames
- Доступно только для авторизованных пользователей
- Токен действителен 1 час, SDK обновляет автоматически

### 4.8. События жизненного цикла

| Событие | Метод SDK | Когда вызывать |
|---------|-----------|----------------|
| Начало геймплея | `game.gameplayStart()` | Начало матча, выход из меню |
| Конец геймплея | `game.gameplayStop()` | Конец матча, вход в меню, пауза |
| Счастливый момент | `game.happyTime()` | Победа, новый рекорд |

### 4.9. Sitelock

CrazyGames SDK автоматически блокирует игру на неавторизованных доменах. На `localhost` и `127.0.0.1` SDK работает в режиме демо.

Для тестирования использовать:
- `?useLocalSdk=true` — принудительный локальный режим
- Developer Portal → Preview — полнофункциональное превью

---

## 5. GameDistributionAdapter

### 5.1. Общая информация

| Параметр | Значение |
|----------|----------|
| SDK URL | `https://html5.api.gamedistribution.com/main.min.js` |
| Документация | `https://github.com/GameDistribution/GD-HTML5/wiki` |
| Глобальный объект | `window.gdsdk` |
| Инициализация | Синхронная, через `GD_OPTIONS` |

### 5.2. Конфигурация SDK

Требуется добавить в `<head>` перед загрузкой SDK:

```
GD_OPTIONS = {
    gameId: '<GAME_ID>',        // Получить в Developer Portal
    onEvent: function(event) {
        // Обработка событий SDK
    }
}
```

### 5.3. Интерфейс IAuthProvider для GameDistribution

**GameDistribution не поддерживает авторизацию пользователей.**

| Метод | Реализация |
|-------|------------|
| `tryRestoreSession()` | Проверить `localStorage` на `guestToken` |
| `trySilentAuth()` | Не применимо, всегда возвращает `null` |
| `getOrCreateGuestToken()` | Стандартный flow через `POST /api/v1/auth/guest` |
| `startLogin(provider)` | Не применимо, платформа не поддерживает |
| `completeProfile(params)` | Не применимо |

**Важно:** На GameDistribution все игроки являются гостями. Рейтинг не начисляется.

### 5.4. Интерфейс IAdsProvider для GameDistribution

GameDistribution использует Google IMA SDK для рекламы.

| Метод | Реализация |
|-------|------------|
| `init()` | Выполняется при загрузке SDK |
| `showInterstitial()` | `gdsdk.showAd(AdType.Interstitial)` |
| `showRewarded()` | `gdsdk.showAd(AdType.Rewarded)` |
| `preloadRewarded()` | `gdsdk.preloadAd(AdType.Rewarded)` |
| `isAvailable()` | SDK инициализирован и `onInit` вызван |

**События SDK:**

| Событие | Описание | Действие |
|---------|----------|----------|
| `SDK_GAME_PAUSE` | Начало рекламы | Приостановить игру |
| `SDK_GAME_START` | Конец рекламы | Возобновить игру |
| `SDK_REWARDED_WATCH_COMPLETE` | Rewarded просмотрен полностью | Выдать награду |
| `SDK_ERROR` | Ошибка SDK | Логировать, продолжить |

### 5.5. Интерфейс IDataProvider для GameDistribution

**GameDistribution не предоставляет облачное хранилище.**

Использовать стандартный `localStorage` для кэша. Основные данные хранить на MetaServer (привязка по `guestToken`).

### 5.6. Интерфейс ISocialProvider для GameDistribution

**Не поддерживается.**

### 5.7. Интерфейс IPaymentProvider для GameDistribution

**Не поддерживается.**

### 5.8. События жизненного цикла

GameDistribution автоматически отслеживает события через `onEvent` callback.

| Событие | Код | Когда происходит |
|---------|-----|------------------|
| SDK готов | `SDK_READY` | После инициализации |
| Игра на паузе | `SDK_GAME_PAUSE` | Перед показом рекламы |
| Игра продолжается | `SDK_GAME_START` | После рекламы |

---

## 6. Изменения в базе данных

### 6.1. Обновление таблицы users

Добавить новые значения в `auth_provider`:

| Значение | Описание |
|----------|----------|
| `telegram` | Telegram (существующее) |
| `google` | Google OAuth (существующее) |
| `yandex` | Яндекс OAuth (существующее) |
| `crazygames` | CrazyGames JWT |

**Примечание:** GameDistribution не добавляется, так как платформа не поддерживает авторизацию.

### 6.2. Обновление таблицы oauth_links

Добавить поддержку `provider = 'crazygames'`:

| Поле | Тип | Описание |
|------|-----|----------|
| `provider` | VARCHAR | `google`, `yandex`, `telegram`, `crazygames` |
| `provider_user_id` | VARCHAR | Для CrazyGames — `userId` из JWT |

---

## 7. Изменения в API MetaServer

### 7.1. POST /api/v1/auth/verify

Добавить обработку `platformType = 'crazygames'`:

| Параметр | Значение |
|----------|----------|
| `platformType` | `crazygames` |
| `platformAuthToken` | JWT от CrazyGames SDK |

**Логика верификации:**

1. Получить публичный ключ с `https://sdk.crazygames.com/publicKey.json`.
2. Верифицировать JWT с использованием ключа.
3. Извлечь `userId`, `username`, `profilePictureUrl` из payload.
4. Найти или создать пользователя в `users`.
5. Вернуть `accessToken`.

**Кэширование публичного ключа:**

| Параметр | Значение |
|----------|----------|
| TTL кэша | 1 час |
| При ошибке верификации | Сбросить кэш и повторить |

### 7.2. Новые значения platformType

| Значение | Описание | Особенности |
|----------|----------|-------------|
| `telegram` | Telegram Mini Apps | Верификация initData |
| `yandex` | Яндекс Игры | Yandex ID |
| `poki` | Poki | Только гости |
| `crazygames` | CrazyGames | JWT + гости |
| `gamedistribution` | GameDistribution | Только гости |
| `guest` | Прямой гостевой вход | Без платформы |
| `dev` | Режим разработки | Без верификации |

---

## 8. Конфигурация

### 8.1. Новые переменные окружения

| Переменная | Описание | Обязательность |
|------------|----------|----------------|
| `CRAZYGAMES_PUBLIC_KEY_URL` | URL публичного ключа | Опционально (default: SDK URL) |
| `GAMEDISTRIBUTION_GAME_ID` | ID игры в GameDistribution | Обязательно для GD |

### 8.2. Новые флаги в config/features.json

| Флаг | Описание | Default |
|------|----------|---------|
| `platformCrazyGamesEnabled` | Включить CrazyGames | `false` |
| `platformGameDistributionEnabled` | Включить GameDistribution | `false` |
| `crazyGamesAuthEnabled` | Разрешить авторизацию CrazyGames | `true` |
| `crazyGamesPaymentsEnabled` | Разрешить платежи CrazyGames | `false` |

---

## 9. Структура файлов

### 9.1. Новые файлы клиента

| Файл | Назначение |
|------|------------|
| `client/src/platform/CrazyGamesAdapter.ts` | Адаптер CrazyGames |
| `client/src/platform/GameDistributionAdapter.ts` | Адаптер GameDistribution |
| `client/src/platform/providers/CrazyGamesAuthProvider.ts` | Авторизация CG |
| `client/src/platform/providers/CrazyGamesAdsProvider.ts` | Реклама CG |
| `client/src/platform/providers/GameDistributionAdsProvider.ts` | Реклама GD |

### 9.2. Изменяемые файлы

| Файл | Изменения |
|------|-----------|
| `client/src/platform/PlatformManager.ts` | Добавить определение CG и GD |
| `client/src/platform/types.ts` | Добавить типы для новых платформ |
| `server/src/services/AuthService.ts` | Добавить верификацию CrazyGames JWT |
| `server/src/config/features.ts` | Добавить новые флаги |

---

## 10. Тестирование

### 10.1. CrazyGames

| Среда | Способ |
|-------|--------|
| Локально | `localhost` с `?useLocalSdk=true` |
| Превью | Developer Portal → Upload → Preview |
| QA Tool | `https://www.crazygames.com/preview` |

### 10.2. GameDistribution

| Среда | Способ |
|-------|--------|
| Локально | Добавить `GD_OPTIONS` с `gameId` |
| Превью | Developer Portal → Upload → iframe |
| Верификация | Просмотреть рекламу полностью в iframe |

### 10.3. Чеклист тестирования

**CrazyGames:**

- [ ] SDK инициализируется без ошибок
- [ ] `getEnvironment()` возвращает `local` на localhost
- [ ] `getUser()` возвращает `null` для гостя
- [ ] `showAuthPrompt()` открывает окно входа
- [ ] `getUserToken()` возвращает валидный JWT
- [ ] MetaServer верифицирует JWT
- [ ] `requestAd('rewarded')` показывает демо-рекламу
- [ ] Callbacks `adStarted`/`adFinished` срабатывают
- [ ] `gameplayStart()`/`gameplayStop()` не вызывают ошибок
- [ ] Sitelock блокирует на неавторизованных доменах

**GameDistribution:**

- [ ] SDK инициализируется с `GD_OPTIONS`
- [ ] `SDK_READY` событие срабатывает
- [ ] `gdsdk.showAd()` показывает рекламу
- [ ] `SDK_GAME_PAUSE`/`SDK_GAME_START` срабатывают
- [ ] `SDK_REWARDED_WATCH_COMPLETE` срабатывает для rewarded
- [ ] Гостевой режим работает корректно
- [ ] `guestToken` сохраняется между сессиями

---

## 11. Риски и митигации

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| SDK изменит API | Средняя | Абстрагировать через интерфейсы провайдеров |
| Публичный ключ CG недоступен | Низкая | Fallback на кэшированный ключ |
| GameDistribution заблокирует без рекламы | Средняя | Интегрировать рекламу обязательно |
| Конфликт SDK на одной странице | Низкая | Загружать только нужный SDK |

---

## 12. Интеграция в Sprint-15

### 12.1. Декомпозиция задач

| ID | Задача | Оценка | Зависимости |
|----|--------|--------|-------------|
| CG-1 | Создать `CrazyGamesAdapter` с заглушками | 2ч | — |
| CG-2 | Реализовать `CrazyGamesAuthProvider` | 4ч | CG-1 |
| CG-3 | Реализовать верификацию JWT на MetaServer | 4ч | — |
| CG-4 | Реализовать `CrazyGamesAdsProvider` | 3ч | CG-1 |
| CG-5 | Добавить события жизненного цикла | 2ч | CG-1 |
| CG-6 | Тестирование в QA Tool | 2ч | CG-1..CG-5 |
| GD-1 | Создать `GameDistributionAdapter` с заглушками | 2ч | — |
| GD-2 | Реализовать `GameDistributionAdsProvider` | 3ч | GD-1 |
| GD-3 | Интегрировать события SDK | 2ч | GD-1 |
| GD-4 | Тестирование в iframe | 2ч | GD-1..GD-3 |
| PM-1 | Обновить `PlatformManager` | 2ч | CG-1, GD-1 |
| PM-2 | Добавить флаги в `features.json` | 1ч | — |

**Общая оценка:** 29 часов (~4 рабочих дня)

### 12.2. Порядок выполнения

```
┌─────────────────────────────────────────────────────────────┐
│                       Day 1                                  │
├─────────────────────────────────────────────────────────────┤
│  CG-1: CrazyGamesAdapter (заглушки)                         │
│  GD-1: GameDistributionAdapter (заглушки)                   │
│  PM-1: PlatformManager (определение платформ)               │
│  PM-2: features.json (флаги)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Day 2                                  │
├─────────────────────────────────────────────────────────────┤
│  CG-2: CrazyGamesAuthProvider                               │
│  CG-3: MetaServer JWT верификация                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Day 3                                  │
├─────────────────────────────────────────────────────────────┤
│  CG-4: CrazyGamesAdsProvider                                │
│  CG-5: События жизненного цикла CG                          │
│  GD-2: GameDistributionAdsProvider                          │
│  GD-3: События SDK GD                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Day 4                                  │
├─────────────────────────────────────────────────────────────┤
│  CG-6: Тестирование CrazyGames в QA Tool                    │
│  GD-4: Тестирование GameDistribution в iframe               │
│  Фиксы и интеграция                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. Критерии приёмки

### 13.1. CrazyGamesAdapter

- [ ] SDK загружается и инициализируется без ошибок
- [ ] Гостевой режим работает на CrazyGames
- [ ] Авторизация через CrazyGames создаёт пользователя в БД
- [ ] JWT верифицируется на MetaServer
- [ ] Реклама показывается (демо на localhost, реальная в QA Tool)
- [ ] Callbacks рекламы корректно обрабатываются
- [ ] `gameplayStart()`/`gameplayStop()` вызываются в нужных местах
- [ ] Sitelock не блокирует на localhost

### 13.2. GameDistributionAdapter

- [ ] SDK инициализируется с правильным `gameId`
- [ ] Гостевой режим работает корректно
- [ ] Реклама показывается
- [ ] Игра приостанавливается во время рекламы
- [ ] Rewarded награды выдаются после полного просмотра
- [ ] `guestToken` персистентен между сессиями

### 13.3. Общие

- [ ] `PlatformManager` корректно определяет платформу
- [ ] Флаги `features.json` работают
- [ ] Нет конфликтов между SDK разных платформ
- [ ] `npm run build` успешен
- [ ] `npm run test` проходит

---

## 14. Глоссарий

| Термин | Описание |
|--------|----------|
| CrazyGames | Игровой портал с 20M пользователей/месяц, поддерживает авторизацию и платежи |
| GameDistribution | Сеть дистрибуции HTML5 игр, 300M пользователей/месяц, только реклама |
| IMA SDK | Google Interactive Media Ads SDK, используется GameDistribution |
| JWT | JSON Web Token, формат токена авторизации CrazyGames |
| Xsolla | Платёжная система, интегрирована с CrazyGames |
| Sitelock | Механизм защиты от запуска игры на неавторизованных доменах |
| QA Tool | Инструмент тестирования CrazyGames на `crazygames.com/preview` |
| `GD_OPTIONS` | Объект конфигурации GameDistribution SDK |
| `guestToken` | Временный токен для гостевого режима |
| `accessToken` | JWT токен авторизации в MetaServer |

---

## 15. Ссылки

### 15.1. CrazyGames

| Ресурс | URL |
|--------|-----|
| Документация | `https://docs.crazygames.com/` |
| Developer Portal | `https://developer.crazygames.com/` |
| SDK v3 (HTML5) | `https://docs.crazygames.com/sdk/intro/` |
| Публичный ключ | `https://sdk.crazygames.com/publicKey.json` |
| QA Tool | `https://www.crazygames.com/preview` |

### 15.2. GameDistribution

| Ресурс | URL |
|--------|-----|
| GitHub Wiki | `https://github.com/GameDistribution/GD-HTML5/wiki` |
| Developer Portal | `https://developer.gamedistribution.com/` |
| SDK Implementation | `https://github.com/GameDistribution/GD-HTML5/wiki/SDK-Implementation` |

---

## История версий

| Версия | Дата | Изменения |
|--------|------|-----------|
| 1.0 | 29 января 2026 | Первоначальная версия |
