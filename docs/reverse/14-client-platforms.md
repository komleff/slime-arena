# Reverse: Client Platform Adapters
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

## 1. Обзор

Платформенные адаптеры — инфраструктурный слой клиента, абстрагирующий различия между игровыми платформами. Архитектура основана на двух параллельных интерфейсных иерархиях:

- **IAuthAdapter** — авторизация и получение credentials для MetaServer.
- **IAdsProvider** — показ rewarded-рекламы с вознаграждением.

Центральный оркестратор — **PlatformManager** (синглтон) — детектирует платформу, создаёт соответствующий адаптер и провайдер рекламы, предоставляет типизированные геттеры для платформоспецифичных операций.

**Поддерживаемые платформы (6 штук):**
1. Telegram Mini App
2. Yandex Games
3. Poki
4. CrazyGames
5. GameDistribution
6. Standalone (dev/iframe fallback)

Приоритет детекции в PlatformManager: Telegram -> CrazyGames -> GameDistribution -> Yandex -> Poki -> Standalone.

---

## 2. Исходные файлы

| Файл | Назначение | Строк |
|------|-----------|-------|
| `client/src/platform/IAuthAdapter.ts` | Интерфейс авторизации | 43 |
| `client/src/platform/IAdsProvider.ts` | Интерфейс рекламы | 58 |
| `client/src/platform/PlatformManager.ts` | Синглтон-оркестратор | 302 |
| `client/src/platform/TelegramAdapter.ts` | Auth-адаптер Telegram | 142 |
| `client/src/platform/YandexAdapter.ts` | Auth-адаптер Yandex Games | 133 |
| `client/src/platform/PokiAdapter.ts` | Auth-адаптер Poki | 144 |
| `client/src/platform/CrazyGamesAdapter.ts` | Auth-адаптер CrazyGames | 189 |
| `client/src/platform/GameDistributionAdapter.ts` | Auth-адаптер GameDistribution | 122 |
| `client/src/platform/StandaloneAdapter.ts` | Auth-адаптер dev/iframe | 117 |
| `client/src/platform/TelegramAdsProvider.ts` | Реклама Telegram | 79 |
| `client/src/platform/YandexAdsProvider.ts` | Реклама Yandex Games | 101 |
| `client/src/platform/PokiAdsProvider.ts` | Реклама Poki | 88 |
| `client/src/platform/CrazyGamesAdsProvider.ts` | Реклама CrazyGames | 76 |
| `client/src/platform/GameDistributionAdsProvider.ts` | Реклама GameDistribution | 208 |
| `client/src/platform/MockAdsProvider.ts` | Mock-реклама для dev | 48 |
| `client/src/platform/index.ts` | Реэкспорт модуля | 22 |

---

## 3. IAuthAdapter интерфейс

**Файл:** `client/src/platform/IAuthAdapter.ts`

### PlatformType (type alias)

```ts
type PlatformType = 'telegram' | 'dev' | 'yandex' | 'poki' | 'crazygames' | 'gamedistribution';
```

### PlatformCredentials (interface)

| Поле | Тип | Описание |
|------|-----|----------|
| `platformType` | `PlatformType` | Тип платформы |
| `platformData` | `string` | Данные для серверной верификации |
| `nickname` | `string?` | Предпочтительный никнейм пользователя |

### IAuthAdapter (interface)

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `getPlatformType()` | `() => PlatformType` | Возвращает тип платформы |
| `isAvailable()` | `() => boolean` | Синхронная проверка доступности SDK |
| `getCredentials()` | `() => Promise<PlatformCredentials>` | Получение credentials для auth-запроса на MetaServer |
| `getNickname()` | `() => string \| null` | Текущий никнейм (без сетевого вызова) |
| `requestAuth()` | `() => Promise<boolean>` | *Опциональный.* Интерактивный запрос авторизации. Возвращает true при успехе |

**Контракт:**
- `isAvailable()` синхронный, проверяет наличие SDK в window
- `getCredentials()` может throw при недоступности SDK
- `requestAuth()` помечен как опциональный (`?`), но реализован во всех адаптерах
- `platformData` — строковое представление, формат зависит от платформы

---

## 4. IAdsProvider интерфейс

**Файл:** `client/src/platform/IAdsProvider.ts`

### AdResultStatus (type alias)

```ts
type AdResultStatus = 'completed' | 'skipped' | 'error' | 'not_available';
```

### AdResult (interface)

| Поле | Тип | Описание |
|------|-----|----------|
| `status` | `AdResultStatus` | Результат показа |
| `errorMessage` | `string?` | Сообщение об ошибке (при `status === 'error'`) |
| `providerPayload` | `Record<string, unknown>?` | Платформенные данные для верификации |

### AdPlacement (type alias)

```ts
type AdPlacement = 'match_end' | 'daily_bonus' | 'double_reward' | 'extra_life';
```

### IAdsProvider (interface)

| Метод | Сигнатура | Описание |
|-------|-----------|----------|
| `getPlatformType()` | `() => PlatformType` | Тип платформы |
| `isAvailable()` | `() => boolean` | Синхронная проверка доступности рекламного SDK |
| `isAdReady(placement)` | `(AdPlacement) => Promise<boolean>` | Асинхронная проверка готовности рекламы |
| `showRewardedAd(placement)` | `(AdPlacement) => Promise<AdResult>` | Показ rewarded video |

**Контракт:**
- Все провайдеры используют единый таймаут `AD_TIMEOUT_MS = 30000` (30 секунд)
- `showRewardedAd()` никогда не reject-ит промис — ошибки возвращаются как `AdResult` со статусом `error`
- `providerPayload` в текущей реализации не заполняется ни одним провайдером
- `isAdReady()` у большинства провайдеров эквивалентен `isAvailable()` (нет preload API)

---

## 5. Платформенные адаптеры

### 5.1 TelegramAdapter

**Файл:** `client/src/platform/TelegramAdapter.ts`

**SDK:** `window.Telegram.WebApp` (Telegram Mini App API)

**Инициализация (конструктор):**
1. Проверяет `window.Telegram?.WebApp?.initData` и его length > 0
2. Если доступен — вызывает `WebApp.ready()` и `WebApp.expand()` (раскрытие на полный экран)

**isAvailable():** Проверяет наличие `window.Telegram.WebApp.initData` с непустой строкой.

**getCredentials():**
- `platformType: 'telegram'`
- `platformData`: raw `initData` строка (HMAC-подписанная серверная верификация)
- `nickname`: приоритет username > "first_name last_name" > first_name

**requestAuth():** Всегда возвращает `false`. Telegram-пользователь уже авторизован через initData. Upgrade анонимных пользователей идёт через `/api/v1/auth/upgrade`.

**Дополнительные методы (не в интерфейсе):**

| Метод | Описание |
|-------|----------|
| `getUserId()` | Telegram user ID (number) для отладки |
| `showBackButton(onClick)` | Показать кнопку "Назад" в Telegram UI |
| `hideBackButton()` | Скрыть кнопку "Назад" |

**Декларируемые типы:**
- `TelegramWebAppUser` — `id, first_name, last_name?, username?, language_code?`
- `TelegramWebApp` — `initData, initDataUnsafe, ready(), expand(), close(), MainButton, BackButton`

**Особенности:**
- `initDataUnsafe` используется только для извлечения nickname и userId (не для верификации)
- MainButton объявлен в типах, но методы для него не реализованы в адаптере

---

### 5.2 YandexAdapter

**Файл:** `client/src/platform/YandexAdapter.ts`

**SDK:** `window.ysdk` (Yandex Games SDK, предварительно инициализированный)

**Инициализация (конструктор):**
1. Проверяет наличие `window.ysdk`
2. Запускает `initializePlayer()` асинхронно — `ysdk.getPlayer({ scopes: false })` (анонимный режим)

**isAvailable():** Проверяет наличие `window.ysdk`.

**getCredentials():**
- Ожидает завершения `initPromise` (если ещё идёт инициализация)
- `platformType: 'yandex'`
- `platformData`: формат `"playerId:playerName"` (разделитель — двоеточие)
- `playerId` = `getIDPerGame()` || `getUniqueID()` с trim()
- Throw при пустом playerId (P0 проверка)

**requestAuth():**
- Вызывает `ysdk.getPlayer({ scopes: true, signed: true })` — запрос полных данных с подписью
- Возвращает `true` если `player.getMode() === 'full'`
- Catch ошибок возвращает `false`

**Дополнительные методы (не в интерфейсе):**

| Метод | Описание |
|-------|----------|
| `getPlayerId()` | ID игрока (IDPerGame или UniqueID) |
| `getPlayerMode()` | `'lite'` (анонимный) или `'full'` (авторизованный) |

**Декларируемые типы:**
- `YaPlayer` — `getIDPerGame(), getName(), getUniqueID(), getMode()`
- `YaGamesSDK` — `getPlayer(options?)`

---

### 5.3 PokiAdapter

**Файл:** `client/src/platform/PokiAdapter.ts`

**SDK:** `window.PokiSDK`

**Auth-модель:** Без нативной авторизации. Используется localStorage для генерации и хранения идентификатора.

**Ключи localStorage:**
- `poki_user_id` — сгенерированный userId
- `poki_nickname` — пользовательский никнейм

**Инициализация (конструктор):**
1. Загружает `poki_user_id` из localStorage, при отсутствии — генерирует
2. Формат userId: `poki_<timestamp_base36>_<random_base36_6_chars>`
3. Загружает `poki_nickname` из localStorage

**isAvailable():** Проверяет наличие `window.PokiSDK`.

**getCredentials():**
- `platformType: 'poki'`
- `platformData`: формат `"userId:nickname"` (fallback nickname: `'PokiPlayer'`)

**requestAuth():** Всегда возвращает `false` — Poki не предоставляет авторизацию.

**Дополнительные методы (не в интерфейсе):**

| Метод | Описание |
|-------|----------|
| `setNickname(nickname)` | Сохранение nickname в localStorage |
| `getUserId()` | Текущий userId |
| `notifyGameLoaded()` | Вызывает `PokiSDK.gameLoadingFinished()` |
| `happyTime(intensity?)` | Вызывает `PokiSDK.happyTime(intensity)` при победе/достижении |

**Особенности:**
- `notifyGameLoaded()` вынесен из конструктора (P1) — должен вызываться когда игра полностью готова
- `Math.random()` используется только для генерации ID, не для симуляции (детерминизм не нарушается)
- Все обращения к localStorage обёрнуты в try-catch (защита от incognito/iframe)

---

### 5.4 CrazyGamesAdapter

**Файл:** `client/src/platform/CrazyGamesAdapter.ts`

**SDK:** `window.CrazyGames.SDK`

**Инициализация (конструктор):**
1. Проверяет наличие `window.CrazyGames?.SDK`
2. Запускает `initializeSDK()` асинхронно:
   - `sdk.init()` — инициализация SDK
   - `sdk.user.getUser()` — получение данных пользователя
   - Логирует environment, username, accountAvailable

**isAvailable():** Проверяет наличие `window.CrazyGames?.SDK`.

**getCredentials():**
- Ожидает `initPromise`
- `platformType: 'crazygames'`
- `platformData`: JWT-токен от `sdk.user.getUserToken()` (с проверкой trim() на пустоту)
- `nickname`: `user.username` || `'CrazyPlayer'`
- Сервер извлекает username из JWT payload

**requestAuth():**
- Проверяет `sdk.user.isUserAccountAvailable()`
- Вызывает `sdk.user.showAuthPrompt()` — нативный диалог CrazyGames
- Возвращает `true` при успешной авторизации

**Дополнительные методы (не в интерфейсе):**

| Метод | Описание |
|-------|----------|
| `notifyGameplayStart()` | `sdk.game.gameplayStart()` — начало матча |
| `notifyGameplayStop()` | `sdk.game.gameplayStop()` — конец матча / показ меню |
| `happyTime()` | `sdk.game.happyTime()` — победа/достижение |
| `getEnvironment()` | `'local' \| 'crazygames' \| 'disabled'` |

**Экспортируемые типы:**
- `CrazyGamesUser` — `username, profilePictureUrl?`
- `CrazyGamesAdCallbacks` — `adStarted?, adFinished?, adError?`
- `CrazyGamesSDK` — `init(), user, ad, game, getEnvironment()`

---

### 5.5 GameDistributionAdapter

**Файл:** `client/src/platform/GameDistributionAdapter.ts`

**SDK:** `window.gdsdk` и `window.GD_OPTIONS`

**Auth-модель:** Без нативной авторизации. Используется localStorage (аналогично PokiAdapter и StandaloneAdapter).

**Ключи localStorage:**
- `gd_user_id` — сгенерированный userId
- `gd_nickname` — пользовательский никнейм

**Инициализация (конструктор):**
1. Загружает/генерирует userId. Формат: `gd_<timestamp_base36>_<random_base36_6_chars>`
2. Загружает nickname из localStorage

**isAvailable():** Проверяет `window.gdsdk || window.GD_OPTIONS`.

**getCredentials():**
- `platformType: 'gamedistribution'`
- `platformData`: формат `"userId:nickname"` (fallback nickname: `'GDPlayer'`)

**requestAuth():** Всегда возвращает `false`.

**Дополнительные методы (не в интерфейсе):**

| Метод | Описание |
|-------|----------|
| `setNickname(nickname)` | Сохранение nickname в localStorage |
| `getUserId()` | Текущий userId |

---

### 5.6 StandaloneAdapter

**Файл:** `client/src/platform/StandaloneAdapter.ts`

**SDK:** Нет внешнего SDK. Чистый localStorage.

**Auth-модель:** Локальная генерация userId, хранение в localStorage.

**Ключи localStorage:**
- `standalone_user_id` — сгенерированный userId
- `standalone_nickname` — пользовательский никнейм

**Инициализация (конструктор):**
1. Загружает/генерирует userId. Формат: `standalone_<timestamp_base36>_<random_base36_6_chars>`
2. Загружает nickname из localStorage

**isAvailable():** Всегда `true` — это fallback-адаптер.

**getCredentials():**
- `platformType: 'dev'` (DevAuthProvider на сервере ожидает именно `'dev'`)
- `platformData`: формат `"userId:nickname"` (fallback nickname: `'Player'`)

**requestAuth():** Не реализован (не объявлен в StandaloneAdapter, но контракт IAuthAdapter делает его опциональным).

**Дополнительные методы (не в интерфейсе):**

| Метод | Описание |
|-------|----------|
| `setNickname(nickname)` | Сохранение nickname в localStorage |
| `getUserId()` | Текущий userId |
| `reset()` | Полный сброс: удаление из localStorage, генерация нового userId, обнуление nickname |

---

## 6. Ads Providers

### 6.1 TelegramAdsProvider

**Файл:** `client/src/platform/TelegramAdsProvider.ts`

**SDK:** `window.Telegram.WebApp` с методом `showAd` (кастомный тип `TelegramWebAppWithAds`)

**isAvailable():** Проверяет наличие `window.Telegram.WebApp` И существование метода `showAd` (typeof === 'function').

**isAdReady():** Эквивалент `isAvailable()`. Telegram не имеет preload API.

**showRewardedAd():**
- Callback-based API: `webApp.showAd({ onReward, onError })`
- Обёрнут в Promise с таймаутом 30 секунд
- `onReward` -> `{ status: 'completed' }`
- `onError('AD_CLOSED')` -> `{ status: 'skipped' }`
- `onError(other)` -> `{ status: 'error', errorMessage }`
- Защита от двойного resolve через флаг `resolved`

**Особенности:**
- Метод `showAd` не является частью стандартного Telegram WebApp API — это кастомное расширение (объявлено через `TelegramWebAppWithAds` интерфейс)

---

### 6.2 YandexAdsProvider

**Файл:** `client/src/platform/YandexAdsProvider.ts`

**SDK:** `window.ysdk.adv`

**isAvailable():** Проверяет `ysdk && ysdk.adv`.

**isAdReady():** Эквивалент `isAvailable()`. Yandex SDK не предоставляет preload API.

**showRewardedAd():**
- Callback-based API: `ysdk.adv.showRewardedVideo({ callbacks: { onRewarded, onClose, onError } })`
- Двухфазная логика: `onRewarded` ставит флаг `rewarded = true`, `onClose(wasShown)` резолвит промис
- Результаты:
  - `rewarded === true` при close -> `{ status: 'completed' }`
  - `wasShown === true` но без reward -> `{ status: 'skipped' }`
  - `wasShown === false` -> `{ status: 'not_available' }`
  - `onError` -> `{ status: 'error', errorMessage }`
- Таймаут 30 секунд с флагом `resolved`

**Расширяет глобальный тип:**
- `YaGamesSDK.adv.showRewardedVideo(options)` — добавляет `adv` к интерфейсу, объявленному в YandexAdapter

---

### 6.3 PokiAdsProvider

**Файл:** `client/src/platform/PokiAdsProvider.ts`

**SDK:** `window.PokiSDK`

**isAvailable():** Проверяет `pokiSdk && typeof pokiSdk.rewardedBreak === 'function'`.

**isAdReady():** Единственный провайдер с реальной проверкой готовности — вызывает `PokiSDK.isAdBlocked()`. Возвращает `!isBlocked`.

**showRewardedAd():**
- Promise-based API: `PokiSDK.rewardedBreak()` возвращает `Promise<boolean>`
- `true` -> `{ status: 'completed' }`
- `false` -> `{ status: 'skipped' }`
- catch -> `{ status: 'error', errorMessage }`
- Race condition protection: `Promise.race([adPromise, timeoutPromise])` с флагом `resolved`

**Особенности:**
- Использует `Promise.race()` вместо callback-обёртки (P2 fix для race condition)
- Единственный провайдер с реальной проверкой `isAdReady()` через `isAdBlocked()`

---

### 6.4 CrazyGamesAdsProvider

**Файл:** `client/src/platform/CrazyGamesAdsProvider.ts`

**SDK:** `window.CrazyGames.SDK.ad`

**isAvailable():** Проверяет `sdk && typeof sdk.ad?.requestAd === 'function'`.

**isAdReady():** Эквивалент `isAvailable()`. CrazyGames SDK не предоставляет preload API.

**showRewardedAd():**
- Callback-based API: `sdk.ad.requestAd('rewarded', { adStarted, adFinished, adError })`
- `adStarted` — логирует паузу (фактическая пауза на уровне вызывающего кода)
- `adFinished` -> `{ status: 'completed' }`
- `adError(error)` -> `{ status: 'error', errorMessage }` (CrazyGames рекомендует продолжать игру при ошибке)
- Таймаут 30 секунд

**Особенности:**
- Импортирует тип `CrazyGamesSDK` из `CrazyGamesAdapter.ts` (переиспользование типов)
- Нет обработки статуса `'skipped'` — CrazyGames API не различает skip и finish

---

### 6.5 GameDistributionAdsProvider

**Файл:** `client/src/platform/GameDistributionAdsProvider.ts`

**SDK:** `window.gdsdk` (не кэшируется — SDK может загрузиться асинхронно) + `window.GD_OPTIONS.onEvent`

**Самый сложный провайдер.** Использует event-based модель через `GD_OPTIONS.onEvent`.

**isAvailable():** Проверяет `getSDK()` и `typeof sdk.showAd === 'function'`. SDK получается динамически при каждом вызове.

**isAdReady():** Эквивалент `isAvailable()`.

**showRewardedAd():**
1. Проверяет `adState.isShowing` — защита от параллельного показа
2. Пытается `sdk.preloadAd('rewarded')` (игнорирует ошибку, если не поддерживается)
3. Вызывает `sdk.showAd('rewarded')` — результат приходит через SDK-события, НЕ через промис
4. Ожидает событий через `GD_OPTIONS.onEvent` callback

**SDK-события:**

| Событие | Обработка |
|---------|-----------|
| `SDK_GAME_PAUSE` | Вызывает `gamePauseCallback` |
| `SDK_GAME_START` | Вызывает `gameResumeCallback` |
| `SDK_REWARDED_WATCH_COMPLETE` | `{ status: 'completed' }` |
| `SDK_ERROR` | `{ status: 'error', errorMessage }` |

**Состояние (AdState):**
```ts
interface AdState {
  resolve: ((result: AdResult) => void) | null;
  isShowing: boolean;
  timeoutId: ReturnType<typeof setTimeout> | null;
  resolved: boolean;
}
```

**Дополнительные методы:**

| Метод | Описание |
|-------|----------|
| `setGamePauseCallback(cb)` | Колбэк паузы игры во время рекламы |
| `setGameResumeCallback(cb)` | Колбэк возобновления после рекламы |

**Особенности:**
- `setupEventHandlers()` в конструкторе: расширяет существующий `GD_OPTIONS.onEvent` или создаёт новый
- P2: `gameId` устанавливается в пустую строку при отсутствии `GD_OPTIONS` (должен настраиваться в конфигурации)
- SDK не кэшируется в конструкторе — `getSDK()` проверяет `window.gdsdk` при каждом вызове
- Единственный провайдер с защитой от параллельного показа (`adState.isShowing`)

---

### 6.6 MockAdsProvider

**Файл:** `client/src/platform/MockAdsProvider.ts`

**SDK:** Нет. Заглушка для dev-режима.

**isAvailable():** Всегда `true`.

**isAdReady():** Всегда `true`.

**showRewardedAd():**
- Симулирует задержку `simulateDelay` мс (по умолчанию 1500 мс)
- При `simulateSuccess === true` -> `{ status: 'completed' }` (по умолчанию)
- При `simulateSuccess === false` -> `{ status: 'skipped' }`

**Тестовые методы:**

| Метод | Описание |
|-------|----------|
| `setSimulateSuccess(value)` | Переключение результата (completed/skipped) |
| `setSimulateDelay(ms)` | Настройка задержки |

**Особенности:**
- Используется ТОЛЬКО для platformType `'dev'` (StandaloneAdapter)
- Единственный провайдер без таймаута — используется setTimeout напрямую для симуляции

---

## 7. Сравнительная таблица платформ

### Auth-адаптеры

| Платформа | PlatformType | Auth метод | platformData формат | requestAuth() | Дополнительные API |
|-----------|-------------|------------|---------------------|---------------|--------------------|
| Telegram | `'telegram'` | WebApp initData (HMAC) | raw initData string | `false` (всегда) | BackButton, MainButton (типы) |
| Yandex | `'yandex'` | YaGames getPlayer | `"playerId:playerName"` | `true/false` (scopes+signed) | getPlayerMode(), getPlayerId() |
| Poki | `'poki'` | localStorage | `"userId:nickname"` | `false` (всегда) | happyTime(), notifyGameLoaded() |
| CrazyGames | `'crazygames'` | JWT token (getUserToken) | JWT string | `true/false` (showAuthPrompt) | gameplayStart/Stop(), happyTime(), getEnvironment() |
| GameDistribution | `'gamedistribution'` | localStorage | `"userId:nickname"` | `false` (всегда) | setNickname() |
| Standalone | `'dev'` | localStorage | `"userId:nickname"` | не реализован | reset(), setNickname() |

### Ads-провайдеры

| Платформа | SDK API | isAdReady() | Preload | Pause/Resume | Timeout |
|-----------|---------|-------------|---------|--------------|---------|
| Telegram | showAd (custom) | = isAvailable | Нет | Нет | 30s |
| Yandex | adv.showRewardedVideo | = isAvailable | Нет | Нет | 30s |
| Poki | rewardedBreak() | isAdBlocked() | Нет | Нет | 30s |
| CrazyGames | ad.requestAd('rewarded') | = isAvailable | Нет | adStarted (лог) | 30s |
| GameDistribution | showAd('rewarded') | = isAvailable | preloadAd (try) | gamePause/Resume callbacks | 30s |
| Mock (dev) | setTimeout | always true | Нет | Нет | Нет |

### Payments (In-App Purchases)

Ни один адаптер не реализует IPaymentProvider. Платёжный интерфейс описан в архитектурной документации, но в коде отсутствует.

---

## 8. Захардкоженные значения

| Значение | Где | Описание |
|----------|-----|----------|
| `AD_TIMEOUT_MS = 30000` | Все AdsProvider (кроме Mock) | Таймаут показа рекламы (30 секунд) |
| `simulateDelay = 1500` | MockAdsProvider | Задержка симуляции рекламы (1.5 секунды) |
| `'PokiPlayer'` | PokiAdapter.getCredentials() | Fallback nickname для Poki |
| `'GDPlayer'` | GameDistributionAdapter.getCredentials() | Fallback nickname для GameDistribution |
| `'CrazyPlayer'` | CrazyGamesAdapter.getCredentials() | Fallback nickname для CrazyGames |
| `'Player'` | StandaloneAdapter (DEFAULT_NICKNAME) | Fallback nickname для Standalone |
| `'poki_user_id'` / `'poki_nickname'` | PokiAdapter | Ключи localStorage |
| `'gd_user_id'` / `'gd_nickname'` | GameDistributionAdapter | Ключи localStorage |
| `'standalone_user_id'` / `'standalone_nickname'` | StandaloneAdapter | Ключи localStorage |
| `gameId: ''` | GameDistributionAdsProvider | Пустой gameId при отсутствии GD_OPTIONS (P2) |

**Формат генерации userId:**
- Все localStorage-адаптеры (Poki, GD, Standalone): `<prefix>_<Date.now().toString(36)>_<Math.random().toString(36).substring(2,8)>`
- Prefix: `poki_`, `gd_`, `standalone_`

---

## 9. Расхождения с документацией

**Документ сравнения:** `docs/soft-launch/SlimeArena-Architecture-v4.2.5-Part2.md`, раздел 2.2

### 9.1 Несовпадение имён интерфейсов

| Документация | Код | Статус |
|--------------|-----|--------|
| `IAuthProvider` | `IAuthAdapter` | Переименовано |
| `IPaymentProvider` | Не реализован | Отсутствует |
| `ISocialProvider` | Не реализован | Отсутствует (помечен "опционально для софт-лонча") |

### 9.2 Несовпадение обязательных методов

Документация (раздел 2.2) определяет минимальные методы:

| Документация | Код (IAuthAdapter) | Статус |
|--------------|--------------------|--------|
| `initialize` | Нет (логика в конструкторе) | Расхождение: инициализация в конструкторе |
| `isAvailable` | `isAvailable()` | Совпадает |
| `getUser` / `getAuthToken` | `getCredentials()` | Переименовано и объединено |
| `showRewarded` | `showRewardedAd(placement)` | Переименовано, добавлен параметр placement |
| `purchase` | Не реализован | Отсутствует (IPaymentProvider) |

### 9.3 Расширения относительно документации

- `requestAuth()` — метод для интерактивной авторизации, не описан в архитектуре
- `AdPlacement` enum — точки показа рекламы, не описаны в разделе 2.2
- `AdResult.providerPayload` — для серверной верификации, не описано
- Каждый адаптер имеет платформоспецифичные методы (happyTime, gameplayStart/Stop и т.д.)

### 9.4 PlatformManager

- Документация (раздел 2.3) описывает экспорт `I*Provider` набора — в коде это реализовано через типизированные геттеры (`getTelegramAdapter()`, `getCrazyGamesAdapter()` и т.д.)
- PlatformManager — синглтон (экспорт `platformManager`), а не класс для инстанцирования

---

## 10. Технический долг

### P0 (критическое)

Нет критических проблем.

### P1 (важное)

1. **IPaymentProvider не реализован** — документация описывает как обязательный интерфейс, но в коде отсутствует. Необходим для монетизации через in-app purchases (Yandex, Telegram).

2. **ISocialProvider не реализован** — описан как опциональный для софт-лонча, но потребуется для приглашений и шеринга.

3. **TelegramAdsProvider.showAd — нестандартный API** — метод `showAd` не является частью официального Telegram WebApp API. Необходима верификация наличия Telegram Ads SDK (Adsgram или аналог).

### P2 (улучшения)

4. **GameDistributionAdsProvider: пустой gameId** — при отсутствии `GD_OPTIONS` устанавливается `gameId: ''`. Должен настраиваться из конфигурации приложения.

5. **Дублирование кода генерации userId** — PokiAdapter, GameDistributionAdapter, StandaloneAdapter содержат идентичную логику `generateUserId()` с разными префиксами. Кандидат на вынос в утилиту.

6. **Дублирование localStorage-паттерна** — Три адаптера (Poki, GD, Standalone) имеют идентичную структуру: загрузка/генерация userId, загрузка/сохранение nickname из localStorage с try-catch. Кандидат на базовый класс `LocalStorageAdapter`.

7. **providerPayload не используется** — Поле объявлено в `AdResult`, но ни один провайдер его не заполняет. Потенциально нужно для серверной верификации rewarded ads.

8. **Отсутствие interstitial ads** — `IAdsProvider` содержит только `showRewardedAd`. Документация (раздел 2.2) упоминает "межстраничную" рекламу (`IAdsProvider` — "показ рекламы (межстраничной и с наградой)"), но interstitial API не реализован. У PokiSDK есть `commercialBreak()`, у GameDistribution — `showAd('interstitial')`, у CrazyGames — `requestAd('midgame')`.

9. **PlatformManager: нет lazy-init ads** — Ads-провайдер создаётся в `initializeAdsProvider()` синхронно. Для GameDistribution SDK может загрузиться позже (поэтому `getSDK()` динамический), но провайдер может быть создан до загрузки SDK.

### P3 (косметическое)

10. **Inconsistent requestAuth()** — StandaloneAdapter не реализует `requestAuth()` (интерфейс делает его опциональным), но остальные 5 адаптеров реализуют. Лучше реализовать во всех для единообразия.

11. **Смешение языков в логах** — часть console.log на русском ("Реклама успешно просмотрена"), часть на английском ("gameLoadingFinished() called").

---

## 11. Заметки для форка BonkRace

Все платформенные адаптеры **переиспользуются без изменений**. Это инфраструктурный слой, не зависящий от игровой логики.

**Что нужно сделать при форке:**

1. **Заменить ключи localStorage** — префиксы `poki_`, `gd_`, `standalone_` привязаны к проекту. Рекомендуется вынести в конфигурацию или заменить на project-specific (например, `bonkrace_`).

2. **GameDistribution gameId** — установить корректный `gameId` в `GD_OPTIONS` для нового проекта.

3. **Fallback-никнеймы** — заменить `'PokiPlayer'`, `'GDPlayer'`, `'CrazyPlayer'`, `'Player'` на контекстно-подходящие.

4. **Серверные AuthProvider-ы** — адаптеры отправляют `platformType` и `platformData` на MetaServer. Серверные `*AuthProvider` должны понимать формат `platformData` каждого адаптера:
   - Telegram: raw initData (HMAC-верификация)
   - Yandex: `"playerId:playerName"` (split по `:`)
   - CrazyGames: JWT (декодирование + верификация)
   - Poki / GD / Standalone: `"userId:nickname"` (split по `:`)

5. **PlatformManager приоритет** — порядок детекции платформ зафиксирован в коде. Если BonkRace планирует другие платформы — нужно менять порядок в `initialize()`.

6. **Ads placements** — `AdPlacement` тип (`'match_end' | 'daily_bonus' | 'double_reward' | 'extra_life'`) привязан к игровым механикам Slime Arena. Для BonkRace нужно определить свои точки показа.
