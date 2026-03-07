# Reverse: Client UI Components & State Management
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

## 1. Обзор

Клиентский UI реализован на **Preact** с **@preact/signals** для реактивного управления состоянием. Архитектура разделена на три слоя:

1. **UIBridge** (`UIBridge.tsx`) -- мост между Canvas-игрой (main.ts) и Preact UI. Предоставляет императивный API для game loop.
2. **State Management** (`signals/gameState.ts`) -- глобальное состояние через Preact Signals. Единый store без Redux/MobX.
3. **Components** -- Preact компоненты (JSX), каждый инжектирует CSS через `injectStyles()`.

Стилизация: CSS-in-JS через строковые литералы, инжектируемые в DOM утилитой `injectStyles(id, css)`. Каждый компонент использует уникальный `STYLES_ID` для дедупликации.

Ключевая особенность: UIBridge экспортирует императивный API (`syncPlayerState`, `setPhase`, `showResults` и др.), который вызывается из `main.ts` в game loop (10 Hz HUD-тик). Компоненты **не** управляют game state напрямую -- только читают signals и вызывают callbacks.

## 2. Исходные файлы

| Файл | Размер | Назначение |
|---|---|---|
| `client/src/ui/UIBridge.tsx` | ~437 строк | Мост Canvas <-> Preact |
| `client/src/ui/signals/gameState.ts` | ~668 строк | Глобальное состояние (signals) |
| `client/src/ui/screens/ScreenManager.tsx` | ~392 строки | Система экранов и модальных окон |
| `client/src/ui/components/MainScreen.tsx` | ~789 строк | Главный экран (лобби v2) |
| `client/src/ui/components/MainMenu.tsx` | ~572 строки | Меню выбора класса/имени |
| `client/src/ui/components/LeaderboardScreen.tsx` | ~863 строки | Глобальная таблица лидеров |
| `client/src/ui/components/ResultsScreen.tsx` | ~573 строки | Экран результатов матча |
| `client/src/ui/components/GameHUD.tsx` | ~500 строк | Игровой HUD |
| `client/src/ui/components/AbilityButtons.tsx` | ~361 строка | Кнопки способностей с кулдауном |
| `client/src/ui/components/TalentModal.tsx` | ~207 строк | Модал выбора талантов |
| `client/src/ui/components/RegistrationPromptModal.tsx` | ~397 строк | Модал сохранения прогресса |
| `client/src/ui/components/AccountConflictModal.tsx` | ~423 строки | Модал конфликта OAuth |
| `client/src/ui/components/NicknameConfirmModal.tsx` | ~366 строк | Модал подтверждения никнейма |
| `client/src/ui/components/OAuthProviderSelector.tsx` | ~311 строк | Выбор OAuth провайдера |
| `client/src/ui/components/BootScreen.tsx` | ~210 строк | Экран загрузки |
| `client/src/ui/components/ConnectingScreen.tsx` | ~57 строк | Индикатор подключения |
| `client/src/ui/components/ShutdownBanner.tsx` | ~83 строки | Баннер перезагрузки сервера |
| `client/src/ui/data/abilities.ts` | ~67 строк | Данные способностей |
| `client/src/ui/data/classes.ts` | ~31 строка | Данные классов |
| `client/src/ui/data/rarity.ts` | ~29 строк | Данные редкости |

## 3. UIBridge

**Файл:** `client/src/ui/UIBridge.tsx`

### 3.1. Назначение

Мост между Canvas game loop (main.ts) и Preact UI слоем. Обеспечивает однонаправленную синхронизацию: game loop -> signals -> components.

### 3.2. Архитектура

```
main.ts (game loop)
  |
  v  императивные вызовы
UIBridge (syncPlayerState, setPhase, showResults, ...)
  |
  v  пишет в signals
gameState.ts (signals)
  |
  v  реактивные подписки
Preact Components (GameHUD, TalentModal, ...)
  |
  v  callbacks
UIBridge.UICallbacks -> main.ts
```

### 3.3. UICallbacks (колбеки из UI в game loop)

```typescript
interface UICallbacks {
  onArena: () => void;                              // MainScreen -> лобби
  onBack: () => void;                               // Лобби -> MainScreen
  onPlay: (name: string, classId: number) => void;  // Начать матч
  onSelectTalent: (talentId: string, index: number) => void;
  onBootRetry?: () => void;                          // Повтор загрузки
  onActivateAbility: (slot: number, pointerId: number) => void;
  onPlayAgain: (classId: number) => void;            // Играть снова
  onExit: () => void;                               // На главную
  onCancelMatchmaking?: () => void;                  // Отмена поиска
}
```

### 3.4. Публичный API (вызывается из main.ts)

| Функция | Описание |
|---|---|
| `initUI(container, callbacks)` | Инициализация: создание контейнера, подписка на события, первый рендер |
| `renderUI()` | Принудительный перерендер `<UIRoot />` |
| `destroyUI()` | Размонтирование, cleanup event listeners |
| `syncPlayerState(stats)` | Обновление данных игрока (10 Hz) |
| `syncLeaderboard(entries)` | Обновление таблицы лидеров |
| `syncMatchTimer(timer)` | Обновление таймера матча |
| `showTalentChoices(choices, queueSize, timer)` | Показать выбор талантов |
| `hideTalentChoices()` | Скрыть выбор талантов |
| `syncAbilityCooldown(slot, remaining, total)` | Обновление кулдауна способности |
| `syncAbilitySlots(slot0, slot1, slot2)` | Обновление слотов способностей |
| `syncBoost(boost)` | Установить активный буст |
| `setPhase(phase)` | Переключение фазы игры + принудительный рендер |
| `setConnected(connected, error?)` | Статус подключения |
| `setConnecting(connecting)` | Статус "подключаемся" |
| `updateBootProgress(stage, progress, error?)` | Прогресс загрузки (BootScreen) |
| `showResults(results)` | Показать результаты матча |
| `setHudVisible(visible)` | Скрыть/показать HUD |
| `resetUI()` | Полный сброс состояния |
| `clearDeadFlag()` | Сброс флага смерти при новом матче |
| `getSelectedClass()` | Получить выбранный класс |
| `getPlayerName()` | Получить имя игрока |
| `goToLobby()` | Перейти на экран выбора класса |
| `goToMainScreen()` | Вернуться на главный экран |

### 3.5. UIRoot -- корневой компонент

`UIRoot()` -- функциональный компонент, который рендерит дерево экранов на основе signals:

- **phase === 'boot'** -> `<BootScreen />`
- **phase === 'connecting'** -> `<ConnectingScreen />`
- **phase === 'menu' && screen === 'main-menu'** -> `<MainScreen />`
- **phase === 'menu' && screen === 'lobby'** -> `<MainMenu />`
- **phase === 'playing' || 'waiting'** -> `<GameHUD />` + `<AbilityButtons />`
- **showTalentModal** -> `<TalentModal />`
- **phase === 'results'** -> `<ResultsScreen />`
- **oauthConflict** -> `<AccountConflictModal />`
- **oauthNicknameConfirm** -> `<NicknameConfirmModal />`
- **showLeaderboard** -> `<LeaderboardScreen />`
- Всегда: `<ShutdownBanner />`

### 3.6. Особенности реализации

- `renderUI()` вызывается императивно после изменений в signals, которые не вызывают автоматический перерендер Preact (например, при `setPhase`).
- `initMobileDetection()` сохраняет cleanup функцию для удаления event listeners при `destroyUI()`.
- Скрытие inline boot screen (HTML-элемент `#inline-boot`) при stage `ready` или `error` через прямой DOM-доступ.
- `batch()` из `@preact/signals` используется для группировки обновлений.

## 4. State Management (signals/gameState.ts)

**Файл:** `client/src/ui/signals/gameState.ts`

### 4.1. Типы

| Тип | Значения / Поля |
|---|---|
| `GamePhase` | `'boot' \| 'menu' \| 'connecting' \| 'waiting' \| 'playing' \| 'results'` |
| `BootStage` | `'initializing' \| 'authenticating' \| 'loadingConfig' \| 'ready' \| 'error'` |
| `ScreenType` | `'main-menu' \| 'lobby' \| 'game' \| 'results' \| 'settings' \| 'shop' \| 'profile'` |
| `ModalType` | `'talent' \| 'pause' \| 'confirm-exit' \| 'settings'` |
| `MatchmakingStatus` | `'idle' \| 'searching' \| 'found' \| 'connecting' \| 'error'` |
| `PlayerStats` | `{ name, mass, kills, maxMass, level, xp, classId, flags }` |
| `LeaderboardEntry` | `{ name, mass, kills, isLocal, place, classId? }` |
| `TalentChoice` | `{ id, name, icon, description, rarity }` |
| `AbilityCooldown` | `{ slot, remaining, total, ready }` |
| `AbilitySlots` | `{ slot0, slot1, slot2 }` (string | null) |
| `MatchTimerState` | `{ phase, timeLeft, totalTime }` |
| `BoostState` | `{ active, type, icon, color, timeLeft, isChargeBased? }` |
| `User` | `{ id, platformType, platformId, nickname, createdAt }` |
| `Profile` | `{ rating, ratingDeviation, gamesPlayed, gamesWon, totalKills, highestMass, level, xp, avatarUrl? }` |
| `MatchAssignment` | `{ matchId, roomId, roomHost, roomPort, joinToken }` |

### 4.2. Полная карта Signals

#### Фаза и навигация

| Signal | Тип | Начальное значение | Описание |
|---|---|---|---|
| `gamePhase` | `GamePhase` | `'boot'` | Текущая фаза игры |
| `bootState` | `BootState` | `{ stage: 'initializing', progress: 0 }` | Состояние загрузки |
| `currentScreen` | `ScreenType` | `'main-menu'` | Текущий экран |
| `activeModal` | `ModalType \| null` | `null` | Активное модальное окно |
| `screenStack` | `ScreenType[]` | `['main-menu']` | Стек экранов |

#### Подключение

| Signal | Тип | Начальное значение | Описание |
|---|---|---|---|
| `isConnected` | `boolean` | `false` | Подключён к серверу |
| `isConnecting` | `boolean` | `false` | В процессе подключения |
| `connectionError` | `string \| null` | `null` | Ошибка подключения |
| `serverUrl` | `string` | `''` | URL сервера |
| `cachedJoinToken` | `string \| null` | из localStorage | Кэшированный токен |

#### Игрок

| Signal | Тип | Начальное значение | Описание |
|---|---|---|---|
| `localPlayer` | `PlayerStats \| null` | `null` | Данные локального игрока |
| `selectedClassId` | `number` | `-1` | Выбранный класс (-1 = не выбран) |
| `playerName` | `string` | `''` | Имя игрока |

#### Матч

| Signal | Тип | Начальное значение | Описание |
|---|---|---|---|
| `matchTimer` | `MatchTimerState` | `{ phase: '', timeLeft: 0, totalTime: 0 }` | Таймер матча |
| `leaderboard` | `LeaderboardEntry[]` | `[]` | Таблица лидеров (in-game) |
| `playerCount` | `number` | `0` | Количество игроков |

#### Таланты

| Signal | Тип | Начальное значение | Описание |
|---|---|---|---|
| `talentChoices` | `TalentChoice[]` | `[]` | Доступные таланты |
| `talentQueueSize` | `number` | `0` | Размер очереди |
| `talentTimerSeconds` | `number` | `0` | Таймер выбора |
| `showTalentModal` | `boolean` | `false` | Показать модал |

#### Способности

| Signal | Тип | Начальное значение | Описание |
|---|---|---|---|
| `abilityCooldowns` | `AbilityCooldown[]` | `[{slot:0,...}, {slot:1,...}, {slot:2,...}]` | Кулдауны 3 слотов |
| `abilitySlots` | `AbilitySlots` | `{ slot0: null, slot1: null, slot2: null }` | ID способностей в слотах |

#### Буст

| Signal | Тип | Начальное значение | Описание |
|---|---|---|---|
| `activeBoost` | `BoostState \| null` | `null` | Текущее усиление |

#### Результаты матча

| Signal | Тип | Начальное значение | Описание |
|---|---|---|---|
| `matchResults` | object \| null | `null` | `{ winner, finalLeaderboard, personalStats, nextMatchTimer }` |
| `currentRoomId` | `string \| null` | `null` | ID комнаты Colyseus (fallback) |
| `currentMatchId` | `string \| null` | `null` | UUID матча из серверного state |
| `resultsWaitTime` | `number` | `0` | Клиентский таймер ожидания (сек) |

#### Server lifecycle

| Signal | Тип | Начальное значение | Описание |
|---|---|---|---|
| `shutdownAt` | `number` | `0` | Timestamp (ms) перезагрузки сервера. 0 = нет |
| `arenaWaitTime` | `number` | `0` | Ожидание арены (при подключении к завершённой арене) |

#### UI состояние

| Signal | Тип | Начальное значение | Описание |
|---|---|---|---|
| `hudVisible` | `boolean` | `true` | Видимость HUD |
| `isMobile` | `boolean` | `false` | Мобильное устройство |
| `safeAreaInsets` | `{ top, bottom, left, right }` | `{ 0, 0, 0, 0 }` | Безопасные зоны |
| `levelThresholds` | `number[]` | из DEFAULT_BALANCE_CONFIG | Пороги уровней |
| `minSlimeMass` | `number` | из DEFAULT_BALANCE_CONFIG | Минимальная масса |

#### Auth состояние

| Signal | Тип | Начальное значение | Описание |
|---|---|---|---|
| `authToken` | `string \| null` | `null` | JWT токен |
| `currentUser` | `User \| null` | `null` | Текущий пользователь |
| `currentProfile` | `Profile \| null` | `null` | Профиль пользователя |
| `isAuthenticated` | `boolean` | `false` | Авторизован |
| `isAuthenticating` | `boolean` | `false` | В процессе авторизации |
| `authError` | `string \| null` | `null` | Ошибка авторизации |
| `oauthConflict` | `OAuthConflictResponse \| null` | `null` | Данные конфликта OAuth (409) |
| `oauthNicknameConfirm` | `OAuthPrepareResponse \| null` | `null` | Данные подтверждения никнейма |
| `showLeaderboard` | `boolean` | `false` | Глобальная таблица лидеров |

#### Matchmaking состояние

| Signal | Тип | Начальное значение | Описание |
|---|---|---|---|
| `matchmakingStatus` | `MatchmakingStatus` | `'idle'` | Статус поиска |
| `queuePosition` | `number \| null` | `null` | Позиция в очереди |
| `matchAssignment` | `MatchAssignment \| null` | `null` | Назначение матча |
| `matchmakingError` | `string \| null` | `null` | Ошибка поиска |

### 4.3. Computed values

| Computed | Формула | Описание |
|---|---|---|
| `isInGame` | `gamePhase === 'playing' \|\| gamePhase === 'waiting'` | В матче |
| `showHud` | `isInGame && hudVisible && localPlayer !== null` | Показывать HUD |
| `isPlayerDead` | `(player.flags & FLAG_IS_DEAD) !== 0` | Игрок мёртв |
| `hasTalentPending` | `talentChoices.length > 0 && talentQueueSize > 0` | Есть ожидающий выбор талантов |
| `isMatchmaking` | `status === 'searching' \|\| status === 'found'` | В поиске матча |
| `canStartGame` | `isAuthenticated && matchmakingStatus === 'idle'` | Можно начать игру |
| `currentPlace` | Место игрока из leaderboard | Текущее место |

### 4.4. Действия (Actions)

| Действие | Описание |
|---|---|
| `setBootProgress(stage, progress, error?)` | Прогресс загрузки (только растёт, не откатывается) |
| `resetBootProgress()` | Сброс прогресса загрузки |
| `setGamePhase(phase)` | Смена фазы с автоматическим переключением экранов |
| `pushScreen(screen)` / `popScreen()` | Навигация по стеку экранов |
| `openModal(modal)` / `closeModal()` | Управление модальными окнами |
| `updateLocalPlayer(stats)` | Обновление данных игрока (merge) |
| `updateLeaderboard(entries)` | Обновление лидерборда |
| `updateMatchTimer(timer)` | Обновление таймера |
| `setTalentChoices(...)` / `clearTalentChoices()` | Управление талантами |
| `updateAbilityCooldown(slot, remaining, total)` | Обновление кулдауна |
| `updateAbilitySlots(slot0, slot1, slot2)` | Обновление слотов |
| `setMatchResults(results)` | Установка результатов (автоматически меняет phase на 'results') |
| `resetGameState()` | Полный сброс: фаза, экраны, игрок, таймеры, матчмейкинг. **НЕ** сбрасывает auth и shutdownAt |
| `clearPlayerDeadFlag()` | Сброс FLAG_IS_DEAD через bitwise AND |
| `setAuthState(user, profile, token)` | Установка auth данных + playerName из nickname |
| `clearAuthState()` | Полный сброс auth |
| `setOAuthConflict(conflict)` / `clearOAuthConflict()` | Управление конфликтом OAuth |
| `setOAuthNicknameConfirm(prepare)` / `clearOAuthNicknameConfirm()` | Подтверждение никнейма |
| `openLeaderboard()` / `closeLeaderboard()` | Глобальная таблица |
| `setMatchmakingSearching()` / `setMatchFound(assignment)` / `resetMatchmaking()` | Matchmaking FSM |
| `setLevelThresholds(thresholds, minMass?)` | Обновление порогов из runtime config (merge с defaults) |
| `initMobileDetection()` | Инициализация media query (`pointer: coarse`) + visualViewport safe area |

### 4.5. Автоматическое переключение экранов при смене фазы

`setGamePhase()` внутри `batch()` автоматически устанавливает `currentScreen`:

| Фаза | currentScreen | screenStack |
|---|---|---|
| `boot` | (не меняется) | (не меняется) |
| `menu` | `'main-menu'` | `['main-menu']` |
| `connecting` / `waiting` | `'lobby'` | (не меняется) |
| `playing` | `'game'` | (не меняется) |
| `results` | `'results'` | (не меняется) |

## 5. Screen Flow

### 5.1. Основной flow

```
[Boot]
  |  stage: initializing -> authenticating -> loadingConfig -> ready
  v
[MainScreen] (phase='menu', screen='main-menu')
  |  onArena callback
  v
[MainMenu/Lobby] (phase='menu', screen='lobby')
  |  onPlay callback (name, classId)
  v
[ConnectingScreen] (phase='connecting')
  |  setPhase('waiting') или setPhase('playing')
  v
[GameHUD + AbilityButtons] (phase='playing' или 'waiting')
  |  showTalentChoices -> TalentModal (overlay)
  |  matc ends -> showResults
  v
[ResultsScreen] (phase='results')
  |  onPlayAgain -> connecting -> playing
  |  onExit -> MainScreen
  v
[MainScreen] (цикл)
```

### 5.2. Условия переходов

| Переход | Условие | Инициатор |
|---|---|---|
| Boot -> Menu | `stage === 'ready'` | main.ts вызывает `setPhase('menu')` |
| MainScreen -> Lobby | Клик "Арена" | `onArena` callback |
| Lobby -> MainScreen | Клик "На главную" | `onBack` callback |
| Lobby -> Connecting | Клик "Играть" | `onPlay` callback |
| Connecting -> Playing | Подключение к комнате | main.ts вызывает `setPhase('playing')` |
| Playing -> Results | Матч завершён | `showResults()` -> `setMatchResults()` -> `setGamePhase('results')` |
| Results -> Playing | Клик "Играть снова" | `onPlayAgain` callback |
| Results -> Menu | Клик "На главную" | `onExit` callback -> `resetGameState()` |

### 5.3. Модальные overlay (не привязаны к фазе)

| Модал | Условие появления |
|---|---|
| `TalentModal` | `showTalentModal === true` (любая фаза playing/waiting) |
| `AccountConflictModal` | `oauthConflict !== null` |
| `NicknameConfirmModal` | `oauthNicknameConfirm !== null` |
| `LeaderboardScreen` | `showLeaderboard === true` |
| `ShutdownBanner` | `shutdownAt > 0` (всегда рендерится, скрывается если 0) |
| `RegistrationPromptModal` | Локальный state в MainScreen / ResultsScreen / LeaderboardScreen |

## 6. Компоненты

### 6.1 ScreenManager

**Файл:** `client/src/ui/screens/ScreenManager.tsx`

**Назначение:** Система управления экранами и модальными окнами с анимациями переходов. Реализует паттерн registry + stack.

**Реестры:**
- `screenRegistry: Map<ScreenType, ScreenConfig>` -- регистрация экранов с компонентами
- `modalRegistry: Map<ModalType, ModalConfig>` -- регистрация модальных окон

**Особенности:**
- Slide-анимации при переходах (slideInRight/slideOutLeft, обратные при возврате)
- Модальные окна с backdrop blur, focus trap, Escape для закрытия
- Обработка hardware Back button через `popstate` (Android)
- Safe area поддержка через CSS `env(safe-area-inset-*)`
- Четыре размера модальных окон: `small | medium | large | fullscreen`

**Важно:** ScreenManager **не используется** в UIRoot напрямую. UIBridge реализует свою логику переключения экранов через `gamePhase` + `currentScreen`. ScreenManager доступен как отдельная подсистема (экспортирует `mountScreenManager`, `navigateTo`, `goBack`, `showModal`, `hideModal`).

**Навигационные хелперы:**
- `navigateTo(screen)` -> `pushScreen(screen)`
- `goBack()` -> `popScreen()`
- `showModal(modal)` -> `openModal(modal)`
- `hideModal()` -> `closeModal()`

### 6.2 BootScreen

**Файл:** `client/src/ui/components/BootScreen.tsx`

**Назначение:** Экран загрузки приложения. Визуализация прогресса инициализации.

**Props:**
- `onRetry?: () => void` -- callback повтора при ошибке

**State:** Читает `bootState` signal (`stage`, `progress`, `error`).

**Стадии отображения:**
| Stage | Текст |
|---|---|
| `initializing` | "Инициализация..." |
| `authenticating` | "Авторизация..." |
| `loadingConfig` | "Загрузка..." |
| `ready` | "Готово" |
| `error` | "Ошибка" + текст ошибки + кнопка "Повторить" |

**Визуал:** Фоновое изображение `/backgrounds/bg_loading_screen.jpg`, прогресс-бар в стиле печенья (cookie-themed), текст в стиле "Titan One" font.

**Прогресс:** Анимированная полоса заполнения 0-100%, CSS transition `width 0.3s ease-out`.

### 6.3 MainScreen

**Файл:** `client/src/ui/components/MainScreen.tsx`

**Назначение:** Главный экран игры -- лобби в стиле мобильных игр. Показывает профиль игрока, валюту, героя и кнопку "Арена".

**Props:**
- `onArena: () => void` -- переход в лобби выбора класса

**State:**
- Reads: `currentUser`, `currentProfile` signals
- Computed: `isGuest` -- `useComputed(() => currentUser.value?.id === 'guest')`
- Local: `showAuthModal: boolean` (для RegistrationPromptModal)

**Элементы экрана:**
| Элемент | Расположение | Описание |
|---|---|---|
| HUD Profile | Top-left | Аватар в рамке, уровень (звезда), имя, медали / кнопка "Войти" |
| Currency Panel | Top-right | Монеты + кристаллы (заглушки: всегда 0) |
| Hero Container | Center | Спрайт героя с анимацией `floatHero` (парение) |
| Arena Button | Bottom-right | Jelly-style кнопка "Арена" (красная, HSL-переменные) |
| Side Menu | Bottom-left | Настройки, Лидеры, Гардероб (настройки и гардероб -- заглушки) |
| Version Tag | Bottom-right corner | `v{__APP_VERSION__}` |

**User Interactions:**
- Клик "Арена" -> `onArena()`
- Клик "Войти" (гости) -> показ `RegistrationPromptModal` с `intent="login"`
- Клик "Лидеры" -> `openLeaderboard()`
- Клик на Settings/Skins -> заглушки (ничего не делают)

**Responsive:** Три media query breakpoint (desktop, mobile landscape, mobile portrait, very small portrait).

### 6.4 MainMenu

**Файл:** `client/src/ui/components/MainMenu.tsx`

**Назначение:** Экран лобби -- выбор имени и класса перед игрой. Это "старый" лобби, сохранённый для flow выбора класса.

**Props:**
- `onPlay: (name: string, classId: number) => void`
- `onBack?: () => void`
- `onCancelMatchmaking?: () => void`
- `isConnecting?: boolean`

**State:**
- Local: `name` (input), `classId` (selected class)
- Signals: `playerName`, `selectedClassId`, `connectionError`, `isAuthenticated`, `isAuthenticating`, `authError`, `currentUser`, `matchmakingStatus`, `queuePosition`, `matchmakingError`, `matchTimer`, `arenaWaitTime`

**Поведение:**
- При mount: генерирует случайное имя через `generateRandomName()` из shared, если имя пустое или равно `GUEST_DEFAULT_NICKNAME`
- При mount: если `selectedClassId < 0`, выбирает случайный класс
- При изменении имени: если отличается от начального, случайно меняет класс
- Кнопка "Играть": текст зависит от состояния (`"Авторизация..."`, `"Поиск..."`, `"Подключение..."`, `"Играть"`)
- Ожидание арены: если `arenaWaitTime > 0` -- показывает таймер вместо кнопки
- Matchmaking статус: если ищем/нашли/ошибка -- показывает блок с позицией в очереди и кнопкой отмены
- Enter на input -> `handlePlay()`

**Классы:** 3 кнопки из `CLASSES_DATA` (Охотник, Воин, Собиратель) с цветной рамкой при выборе.

**Ограничения имени:** `maxLength={20}`.

### 6.5 ConnectingScreen

**Файл:** `client/src/ui/components/ConnectingScreen.tsx`

**Назначение:** Индикатор подключения к серверу. Минимальный компонент. Предотвращает мелькание главного экрана при переподключении (#126).

**Props:** нет

**Визуал:** Полноэкранный тёмный фон, спиннер (CSS border animation), текст "Подключение..."

**Особенность:** `injectStyles()` вызывается напрямую в теле компонента (не в useEffect), что является отклонением от паттерна других компонентов.

### 6.6 GameHUD

**Файл:** `client/src/ui/components/GameHUD.tsx`

**Назначение:** Игровой HUD -- отображение статистики, таймера, лидерборда, буста и оверлея смерти.

**Props:** нет (все данные из signals)

**Подкомпоненты:**

| Компонент | Описание |
|---|---|
| `PlayerStats` | Уровень (звезда + XP-бар), масса, убийства |
| `Leaderboard` | Топ-5 из in-game лидерборда |
| `BoostPanel` | Активный буст (иконка, тип, время/заряды) |
| `MatchTimer` | Центральный таймер матча + фаза |
| `DeathOverlay` | Полноэкранный overlay "Вы погибли" (только при phase='playing' и FLAG_IS_DEAD) |

**Утилиты:**
- `formatTime(seconds)` -- `M:SS` с `Math.ceil`
- `formatMass(mass)` -- `>= 10000` -> `Xk`, иначе `Math.floor`
- `getLevelProgress(level, mass)` -- прогресс до следующего уровня: `(mass - deathMass) / (nextThreshold - deathMass) * 100%`

**Conditions:**
- `showHud.value` -- computed: `isInGame && hudVisible && localPlayer !== null`
- `isPlayerDead.value` -- computed из `FLAG_IS_DEAD`

**Responsive:** Компактный HUD на mobile (<768px), скрытие лидерборда в portrait (<480px).

### 6.7 AbilityButtons

**Файл:** `client/src/ui/components/AbilityButtons.tsx`

**Назначение:** Кнопки способностей с визуализацией кулдауна (SVG круговой прогресс).

**Props:**
- `onActivateAbility: (slot: number, pointerId: number) => void`

**State:** Читает `abilityCooldowns`, `abilitySlots` signals.

**Рендер:**
- Показывает только заполненные слоты (`slot0`, `slot1`, `slot2`)
- Slot 0 -- полный размер (70px), slots 1-2 -- уменьшенные (60px, класс `small`)
- `onPointerDown` вместо onClick для лучшей отзывчивости на тачскринах

**Кулдаун визуализация:**
- SVG circle с `stroke-dasharray`/`stroke-dashoffset` для кругового прогресса
- Overlay затемнение при кулдауне
- Числовой таймер (секунды с одной десятой)
- Анимация пульсации при готовности (`abilityPulse`)

**Цвета слотов:** Slot 0 -- голубой (#4fc3f7), Slot 1 -- фиолетовый (#c74ff7), Slot 2 -- золотой (#f7c74f).

**Иконки:** Маппинг из `ABILITY_ICON_MAP`: dash->lightning, shield->shield, slow->snowflake, pull->magnet, projectile->bang, spit->droplets, bomb->bomb, push->wind, mine->skull.

**Responsive:** Уменьшение на mobile, вертикальное расположение в portrait.

### 6.8 TalentModal

**Файл:** `client/src/ui/components/TalentModal.tsx`

**Назначение:** Модальное окно выбора талантов при повышении уровня. Overlay поверх игрового экрана (не блокирует геймплей).

**Props:**
- `onSelectTalent: (talentId: string, index: number) => void`

**State:** Читает `talentChoices`, `talentQueueSize`, `talentTimerSeconds`, `showTalentModal`.

**Расположение:** Левый край, вертикально по центру (`left: 20px, top: 50%, transform: translateY(-50%)`).

**Элементы:**
- Заголовок "Выбери талант"
- Таймер (секунды)
- Счётчик очереди (`+N в очереди`)
- Grid кнопок: иконка, название, описание, редкость

**Редкость (border-color):**
- 0 (Обычный) -- серый (#6b7280)
- 1 (Редкий) -- синий (#3b82f6)
- 2 (Эпический) -- фиолетовый (#a855f7)

**Хинт:** "Клик или клавиши 7 / 8 / 9" (hotkeys обрабатываются в main.ts, не в компоненте).

**Ширина:** `min(420px, 44vw)` -- полупрозрачный фон.

### 6.9 ResultsScreen

**Файл:** `client/src/ui/components/ResultsScreen.tsx`

**Назначение:** Экран результатов матча. Показывает победителя, финальный лидерборд, личную статистику, награды.

**Props:**
- `onPlayAgain: (classId: number) => void`
- `onExit: () => void`

**State:**
- Signals: `matchResults`, `resultsWaitTime`, `selectedClassId`, `matchAssignment`, `currentRoomId`, `currentMatchId`
- Services: `matchResultsService` (claimStatus, claimRewards), `authService.isAnonymous()`
- Local: `showRegistrationModal`, `lastClaimedMatchRef`, `capturedMatchIdRef`

**Логика наград:**
- При первом рендере с results: захватывает matchId через ref (чтобы не реагировать на смену matchId)
- Вычисляет place из `finalLeaderboard.find(e => e.isLocal)`
- Вызывает `matchResultsService.setLocalRewards(place, kills)` для локального расчёта наград
- Для гостей: запрашивает claimToken через `matchResultsService.getClaimToken(matchId)`
- Награды: XP, монеты, рейтинг (positive/negative coloring)

**Кнопки:**
- "Играть снова" -- disabled при `resultsWaitTime > 0` или `claimStatus === 'claiming'`
- "На главную" -- вызывает `resetGameState()` + `onExit()`

**Для гостей:** Если `maxMass >= 200`, показывает ссылку "Сохранить прогресс" -> `RegistrationPromptModal`.

### 6.10 LeaderboardScreen

**Файл:** `client/src/ui/components/LeaderboardScreen.tsx`

**Назначение:** Глобальная таблица лидеров с двумя вкладками. Полноэкранный overlay.

**Props:**
- `onClose: () => void`

**State:**
- Service signals: `leaderboardMode`, `leaderboardEntries`, `leaderboardUserEntry`, `leaderboardLoadStatus`, `leaderboardError`
- Local: `userRowPosition` (IntersectionObserver), `showSaveProgressModal`
- Computed: `guestEntry` (из localStorage)

**Вкладки:**
- "Накопительный" (`total`) -- суммарная масса
- "Рекордный" (`best`) -- лучшая масса

**Особенности:**
- **IntersectionObserver** для отслеживания видимости строки игрока: sticky плашка сверху/снизу
- **Гостевая плашка:** данные из localStorage (guest_nickname, claimToken, last_match_mass), кнопка "Сохранить прогресс"
- **Миниатюры скинов:** спрайт из `sprites/slimes/base/{skinId}`, fallback `slime-base.webp`, валидация через `isValidSprite()`
- **Автозакрытие:** при `matchmakingStatus === 'found' || 'connecting'`
- **Fallback никнейм:** `getDisplayNickname()` -- "Игрок" + последние 4 символа userId
- Поддержка top-1/2/3 стилизации (золото/серебро/бронза)

**API:** `leaderboardService.fetchLeaderboard(mode)` при mount и смене mode. `leaderboardService.switchMode(newMode)`.

### 6.11 RegistrationPromptModal

**Файл:** `client/src/ui/components/RegistrationPromptModal.tsx`

**Назначение:** Модал для предложения сохранить прогресс гостям. Показывается после матча или из лидерборда.

**Props:**
- `onClose: () => void`
- `intent?: 'login' | 'convert_guest'` (default: `'convert_guest'`)

**State:**
- Local: `isLoading`, `error`
- Services: `platformManager` (isTelegram, isStandalone), claimToken signal

**Поведение по платформам:**

| Платформа | UI | Действие |
|---|---|---|
| Telegram (in-app) | Кнопка "Войти через Telegram" | POST `/api/v1/auth/upgrade` с claimToken |
| Telegram (external) | Кнопка "Открыть в Telegram" | `window.open('https://t.me/SlimeArenaBot')` |
| Standalone (web) | `OAuthProviderSelector` | OAuth flow (Google/Yandex/VK) |

**Benefits list:** (для convert_guest)
- Сохранение рейтинга и статистики
- Участие в глобальном рейтинге
- Доступ к скинам и наградам
- Игра с разных устройств

**Валидация claimToken:**
- `effectiveClaimToken` = `claimToken.value || localStorage.getItem('registration_claim_token')`
- `canUpgrade = intent === 'login' || hasClaimToken || !isTelegram`

### 6.12 AccountConflictModal

**Файл:** `client/src/ui/components/AccountConflictModal.tsx`

**Назначение:** Модал для разрешения конфликта OAuth 409 -- когда аккаунт OAuth уже привязан к другому профилю.

**Props:**
- `conflict: OAuthConflictResponse`
- `currentNickname?: string`
- `currentMass?: number`
- `onSwitch: () => void`
- `onCancel: () => void`

**Отображение:**
- Два блока: "Существующий аккаунт" (зелёный border) и "Текущий (гость)" (серый border)
- Аватар с инициалами (первая буква, поддержка кириллицы) или img
- Предупреждение: "При переключении прогресс текущего гостевого аккаунта будет потерян"

**Действия:**
- "Войти как {nickname}" -> `resolveOAuthConflict(pendingAuthToken)` -> `authService.finishUpgrade(accessToken)` -> `onSwitch()`
- "Остаться гостем" -> `onCancel()`

**Защита:** Overlay не закрывается при loading, кнопки disabled при loading.

### 6.13 NicknameConfirmModal

**Файл:** `client/src/ui/components/NicknameConfirmModal.tsx`

**Назначение:** Модал подтверждения никнейма после OAuth. Показывает имя из OAuth провайдера и позволяет изменить.

**Props:**
- `prepare: OAuthPrepareResponse`
- `onConfirm: () => void`
- `onCancel: () => void`

**State:**
- Local: `nickname` (input, init from `prepare.displayName`), `isLoading`, `error`, `validationError`

**Валидация:** 2-20 символов.

**Действия:**
- "Сохранить" -> `completeOAuthUpgrade(prepareToken, nickname, guestToken)` -> `authService.finishUpgrade(accessToken, nickname)` -> `onConfirm()`
- "Отмена" -> `onCancel()`
- Enter на input -> confirm

**Аватар:** Отображает `prepare.avatarUrl` или инициал.

### 6.14 OAuthProviderSelector

**Файл:** `client/src/ui/components/OAuthProviderSelector.tsx`

**Назначение:** Компонент выбора OAuth провайдера с учётом региона.

**Props:**
- `intent: OAuthIntent` (`'login' | 'convert_guest'`)
- `gameState?: string`
- `onError?: (error: string) => void`
- `disabled?: boolean`
- `showTitle?: boolean` (default: true)

**State:**
- Local: `providers`, `loading`, `error`, `region`, `startingOAuth`
- Loaded from: `oauthService.loadConfig()`

**Провайдеры:**
| Provider | Цвет фона | Иконка (SVG) |
|---|---|---|
| Google | Белый (#fff) | Многоцветная G |
| Yandex | Красный (#fc3f1d) | Я |
| VK | Синий (#0077ff) | VK logo |

**Поведение:**
- При mount загружает конфиг через `oauthService.loadConfig()`
- При клике: сохраняет claimToken в localStorage, вызывает `oauthService.startOAuth()` (редирект на провайдера)
- Region hint отображается если `region !== 'GLOBAL'`

### 6.15 ShutdownBanner

**Файл:** `client/src/ui/components/ShutdownBanner.tsx`

**Назначение:** Красный баннер с обратным отсчётом до перезагрузки сервера. Рендерится поверх всего UI.

**Props:** нет

**State:**
- Signal: `shutdownAt` (timestamp ms, 0 = нет перезагрузки)
- Local signal: `countdown` (обновляется каждую секунду через `setInterval`)

**Визуал:**
- `z-index: 10000` (поверх всего)
- Красный фон (#d32f2f) с пульсацией
- `pointer-events: none` -- не блокирует взаимодействие
- Иконка предупреждения + текст "Сервер будет перезагружен через N сек!"

**Условие скрытия:** `!shutdownAt.value || shutdownAt.value <= 0 || countdown.value <= 0`

## 7. UI Data

### 7.1 abilities.ts

**Файл:** `client/src/ui/data/abilities.ts`

**Назначение:** Централизованное хранение данных способностей для UI.

**ABILITY_ICON_MAP** -- маппинг abilityId -> emoji:

| abilityId | Icon |
|---|---|
| `dash` | lightning |
| `shield` | shield |
| `slow` | snowflake |
| `pull` | magnet |
| `projectile` | explosion |
| `spit` | droplets |
| `bomb` | bomb |
| `push` | wind |
| `mine` | skull |

**SLOT_COLORS:** slot 0 -> #4fc3f7 (голубой), slot 1 -> #c74ff7 (фиолетовый), slot 2 -> #f7c74f (золотой).

**Хелперы:** `getAbilityIcon(id)`, `getSlotColor(slot)`.

**Legacy:** `ABILITIES_DATA` массив с default-иконками (обратная совместимость).

### 7.2 classes.ts

**Файл:** `client/src/ui/data/classes.ts`

**Назначение:** Данные трёх игровых классов.

| id | name | icon | cssClass | color |
|---|---|---|---|---|
| 0 | Охотник | target | hunter | #4ade80 (зелёный) |
| 1 | Воин | swords | warrior | #f87171 (красный) |
| 2 | Собиратель | gem | collector | #60a5fa (синий) |

**Хелперы:** `getClassById(id)`, `getClassName(id)`, `getClassColor(id)`.

### 7.3 rarity.ts

**Файл:** `client/src/ui/data/rarity.ts`

**Назначение:** Данные редкости для талантов.

| id | name | color |
|---|---|---|
| 0 | Обычный | #6b7280 (серый) |
| 1 | Редкий | #3b82f6 (синий) |
| 2 | Эпический | #a855f7 (фиолетовый) |

**Хелперы:** `getRarityById(id)`, `getRarityName(id)`, `getRarityColor(id)`.

## 8. Захардкоженные значения

| Значение | Файл | Контекст |
|---|---|---|
| `MAX_ABILITY_SLOTS = 3` | gameState.ts | Максимум слотов способностей |
| `selectedClassId = -1` | gameState.ts | Класс не выбран |
| `mass: 100` | gameState.ts (updateLocalPlayer) | Начальная масса по умолчанию |
| `coins = 0, gems = 0` | MainScreen.tsx | Валюта-заглушка (всегда 0) |
| `xpPercent = profile.xp / 1000 * 100` | MainScreen.tsx | XP прогресс (делитель 1000 -- заглушка) |
| `maxLength={20}` | MainMenu.tsx, NicknameConfirmModal.tsx | Макс. длина имени |
| Никнейм validation: 2-20 | NicknameConfirmModal.tsx | Валидация никнейма |
| `finalMass >= 200` | ResultsScreen.tsx | Порог для показа "Сохранить прогресс" |
| Leaderboard top-5 in HUD | GameHUD.tsx | `leaderboard.value.slice(0, 5)` |
| `mass >= 10000` -> `Xk` | GameHUD.tsx | Форматирование массы |
| SVG circle `r="45"` | AbilityButtons.tsx | Радиус кругового прогресса кулдауна |
| Ability button 70px/60px | AbilityButtons.tsx | Размеры кнопок (slot 0 vs 1-2) |
| TalentModal width `min(420px, 44vw)` | TalentModal.tsx | Ширина модала |
| `https://t.me/SlimeArenaBot` | RegistrationPromptModal.tsx | URL Telegram бота |
| `/api/v1/auth/upgrade` | RegistrationPromptModal.tsx | Endpoint upgrade |
| `'registration_claim_token'` | multiple files | localStorage key для claimToken |
| `'pending_claim_token'` | OAuthProviderSelector.tsx | Legacy localStorage key |
| `/backgrounds/bg_loading_screen.jpg` | BootScreen.tsx | Фон загрузки |
| `/backgrounds/bg_main_screen.jpg` | MainScreen.tsx | Фон главного экрана |
| `/hud/hud_avatar_frame_cookie.webp` | MainScreen.tsx | Рамка аватара |
| `/hud/hud_profile_base_chocolate.webp` | MainScreen.tsx | База профиля HUD |
| `/hud/hud_level_badge_star_blue.webp` | MainScreen.tsx | Звезда уровня |
| `/hud/hud_avatar_hero_01.webp` | MainScreen.tsx | Аватар по умолчанию |
| `/skins/lobby/hero_skin_current.webp` | MainScreen.tsx | Спрайт героя в лобби |
| `/icons/icon_currency_coin.webp` | MainScreen.tsx | Иконка монет |
| `/icons/icon_currency_gem.webp` | MainScreen.tsx | Иконка кристаллов |
| `/icons/icon_menu_settings.webp` | MainScreen.tsx | Иконка настроек |
| `/icons/icon_menu_leaderboard.webp` | MainScreen.tsx, MainMenu.tsx | Иконка лидеров |
| `/icons/icon_menu_skins.webp` | MainScreen.tsx | Иконка гардероба |
| Font families: `'Nunito'`, `'IBM Plex Mono'`, `'Titan One'`, `'Trebuchet MS'` | Various | Шрифты |

## 9. Расхождения с документацией

### 9.1. Расхождения с GDD-UI.md (v3.3.2)

| # | GDD-UI | Реализация | Severity |
|---|---|---|---|
| 1 | **Мини-карта** (правый верхний угол, 15% ширины) | **Не реализована** в UI-компонентах. Рендерится на Canvas в main.ts | P1 (отсутствует в Preact слое) |
| 2 | **Джойстик** (адаптивный, левый нижний угол) | **Не реализован** в Preact. Обрабатывается в Canvas/main.ts | P0 (Canvas) |
| 3 | **Карточки выбора** -- правый край, середина, свёрнутое состояние через 3 сек | TalentModal: **левый край**, без автосворачивания, без свайпа | P2 |
| 4 | **Индикатор очереди** -- над умениями, мигающий | В TalentModal как `+N в очереди` текст, **не над кнопками умений** | P2 |
| 5 | **Стоимость умения** в % массы | **Не отображается** в AbilityButtons | P2 |
| 6 | **Состояние "Недостаточно массы"** (красная рамка) | **Не реализовано** -- только ready/cooldown | P2 |
| 7 | **Уведомления** (убийство, гибель, уровень, зона...) | Только `DeathOverlay`. Остальные уведомления рендерятся на Canvas | P1 |
| 8 | **Визуализация усилений** (частицы, контуры, иконки) | Только `BoostPanel` в HUD. Визуальные эффекты на Canvas | P0 (Canvas) |
| 9 | **Экран результатов** -- выбор класса для следующего матча | **Не реализован** на ResultsScreen. Используется `selectedClassId` из предыдущего выбора | P1 |

### 9.2. Расхождения с ScreenMap v1.6.1

| # | ScreenMap | Реализация | Severity |
|---|---|---|---|
| 1 | **LobbyScreen** -- центральный узел | Разделён на **MainScreen** (визуальный лобби) + **MainMenu** (выбор класса) | Дизайн-решение |
| 2 | **MatchmakingScreen** -- отдельный экран поиска | **Нет отдельного экрана**. Matchmaking status показывается внутри MainMenu | P1 |
| 3 | **ProfileScreen, ShopScreen, SettingsScreen, BattlePassScreen** | **Не реализованы**. Кнопки Settings/Skins -- заглушки | P1 (будущее) |
| 4 | **ClassSelectModal** -- детальный просмотр класса | **Не реализован**. Классы выбираются простыми кнопками | P2 |
| 5 | **RewardModal, ConfirmModal, DisconnectModal, PlatformLimitModal** | **Не реализованы** как отдельные компоненты | P1 |
| 6 | **CardPickerOverlay** -- правая часть, сворачивание | TalentModal слева, без сворачивания | P2 |
| 7 | **PauseOverlay** -- меню паузы | **Не реализован** | P2 |
| 8 | **FinalCountdownOverlay** -- последние 10 сек | **Не реализован** в Preact (может быть на Canvas) | P2 |

### 9.3. Расхождения с UI-TZ v1.6.2

| # | UI-TZ | Реализация | Severity |
|---|---|---|---|
| 1 | **LobbyScreen** с героем по центру, навигация слева, Арена справа | MainScreen реализует этот layout | Соответствует |
| 2 | **RuntimeConfig** -- числовые значения из конфигов | Частично: `levelThresholds` из config, но XP прогресс захардкожен (`/1000`) | P2 |
| 3 | **operationId** для идемпотентности | **Не видно** в UI-компонентах (может быть в сервисах) | Требует проверки |
| 4 | **BootScreen** -- единый макет SplashScreen + LoadingScreen | **Соответствует** | OK |

## 10. Технический долг

| # | Проблема | Файл(ы) | Severity |
|---|---|---|---|
| 1 | **Валюта-заглушка** -- coins и gems всегда 0, кнопки "+" ничего не делают | MainScreen.tsx | P1 |
| 2 | **Settings заглушка** -- кнопка настроек без функционала | MainScreen.tsx | P1 |
| 3 | **Skins/Гардероб заглушка** -- кнопка без функционала | MainScreen.tsx | P1 |
| 4 | **XP прогресс захардкожен** -- делитель 1000 вместо runtime config | MainScreen.tsx | P2 |
| 5 | **Медали захардкожены** -- три цветных div вместо реальных достижений | MainScreen.tsx | P2 |
| 6 | **ScreenManager не используется** -- UIBridge реализует свою навигацию, ScreenManager экспортирует API но не интегрирован в UIRoot | ScreenManager.tsx, UIBridge.tsx | P2 (архитектурный) |
| 7 | **renderUI() вызывается императивно** -- часть signals не тригерят перерендер Preact автоматически, требуя ручного вызова | UIBridge.tsx | P2 |
| 8 | **injectStyles в теле компонента** -- ConnectingScreen вызывает injectStyles не в useEffect | ConnectingScreen.tsx | P3 |
| 9 | **Спрайт героя захардкожен** -- `/skins/lobby/hero_skin_current.webp` не зависит от выбранного скина | MainScreen.tsx | P2 |
| 10 | **Отсутствие accessibility** -- нет ARIA labels на большинстве интерактивных элементов (кроме ScreenManager модалки) | Various | P3 |
| 11 | **Отсутствие i18n** -- все строки на русском захардкожены | All components | P2 |
| 12 | **Unused variables** -- `_authenticated`, `_user` в MainMenu с void suppression | MainMenu.tsx | P3 |
| 13 | **Отсутствие выбора класса на ResultsScreen** -- GDD требует, не реализовано | ResultsScreen.tsx | P1 |
| 14 | **playerCount signal** -- объявлен но нигде не обновляется и не используется | gameState.ts | P3 |
| 15 | **serverUrl signal** -- объявлен, не используется в компонентах | gameState.ts | P3 |

## 11. Заметки для форка BonkRace

| Компонент | Рекомендация |
|---|---|
| **UIBridge** | Переиспользовать полностью. Заменить callbacks: `onPlay` -> `onStartRace`, убрать `onSelectTalent`. Добавить race-specific (`onBoost`, `onUsePowerUp`). |
| **gameState.ts** | Рефакторить: убрать talent*, ability*, boost signals. Добавить `racePosition`, `lapCount`, `raceTimer`, `powerUpInventory`. Оставить auth/matchmaking как есть. |
| **ScreenManager** | Переиспользовать (навигация и модалки универсальны). |
| **MainScreen** | **Адаптировать**. Заменить "Арена" -> "Гонка". Убрать выбор класса. Добавить выбор транспорта/трассы. Героя заменить на BonkRace персонажа. |
| **MainMenu** | **Адаптировать** -> RaceSetupScreen. Убрать выбор класса. Добавить выбор трассы, количество кругов. |
| **GameHUD** | **Заменить** -> RaceHUD. Убрать массу, убийства, XP-бар. Добавить позицию, круги, скорость, мини-карту трассы. |
| **AbilityButtons** | **Убрать** или заменить на PowerUpButtons (1-2 кнопки, без кулдауна, inventory-based). |
| **TalentModal** | **Убрать** -- нет системы талантов в BonkRace. |
| **ResultsScreen** | **Адаптировать**. Заменить "массу" -> "время финиша". Убрать kills. Лидерборд по позициям (1st, 2nd, 3rd). |
| **LeaderboardScreen** | **Переиспользовать** полностью. Заменить "массу" -> "лучшее время". Вкладки: "По времени" / "По победам". |
| **RegistrationPromptModal** | **Переиспользовать** без изменений. |
| **AccountConflictModal** | **Переиспользовать** без изменений. |
| **NicknameConfirmModal** | **Переиспользовать** без изменений. |
| **OAuthProviderSelector** | **Переиспользовать** без изменений. |
| **BootScreen** | **Переиспользовать**, заменить фон и бренд. |
| **ConnectingScreen** | **Переиспользовать** без изменений. |
| **ShutdownBanner** | **Переиспользовать** без изменений. |
| **data/abilities.ts** | **Убрать** или заменить на `data/powerups.ts`. |
| **data/classes.ts** | **Убрать** -- нет классов в BonkRace. Заменить на `data/vehicles.ts`. |
| **data/rarity.ts** | **Переиспользовать** если есть рарность power-ups. Иначе убрать. |
