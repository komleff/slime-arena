# Reverse: Client Game Loop, Rendering, Input
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

---

## 1. Обзор

Клиент Slime Arena — монолитный SPA на TypeScript, собираемый через Vite. Ядро сосредоточено в `main.ts` (~3985 строк), который выполняет роль application controller: boot sequence, подключение к Colyseus, game loop, рендеринг Canvas 2D, input, HUD-синхронизация с Preact UI. Модули `game/`, `input/`, `rendering/`, `effects/` выделены из `main.ts`, но основная оркестрация остаётся в нём.

**Авторитетная модель:** сервер — единственный источник истины. Клиент отправляет только `InputCommand` (moveX, moveY, abilitySlot), получает state через Colyseus sync. Клиентского предсказания (client-side prediction / reconciliation) нет — используется U2-style предиктивное сглаживание визуального состояния.

---

## 2. Исходные файлы

| Файл | Строк | Назначение |
|------|-------|------------|
| `client/src/main.ts` | ~3985 | Точка входа, boot, Colyseus, game loop оркестрация, render, camera, sprites, талант/ability UI, minimap |
| `client/src/game/GameLoopManager.ts` | 144 | Менеджер таймеров (input, hud, RAF) |
| `client/src/game/SmoothingSystem.ts` | 338 | U2-style предиктивное сглаживание позиций |
| `client/src/input/InputManager.ts` | 528 | Keyboard, pointer (touch/pen), mouse обработка |
| `client/src/input/joystick.ts` | 245 | Виртуальный джойстик (состояние, DOM, вычисление moveX/moveY) |
| `client/src/rendering/draw.ts` | 227 | Примитивы: drawCircle, drawCrown, drawSprite, worldToScreen, screenToWorld, drawGrid |
| `client/src/effects/VisualEffects.ts` | 204 | Всплывающие тексты (FloatingText) и вспышки (FlashEffect) |

---

## 3. Инициализация приложения (main.ts)

### 3.1. Boot Sequence

Порядок загрузки при старте:

1. **DOM-создание** (строки 75-161):
   - Создаётся root `<div>` (monospace, dark background)
   - Создаётся `<canvas>` с `touch-action: none`, `tabIndex=0`
   - Блокировка мобильного зума через `gesturestart/gesturechange/gestureend`
   - Обработка потери/восстановления Canvas 2D контекста (`contextlost`/`contextrestored`)

2. **UI-элементы** (строки 163-560):
   - Talent modal (3 кнопки выбора, таймер, подсказка 7/8/9)
   - Talent reward panel (уведомление о полученном таланте, 2.4 сек)
   - Ability card modal (выбор умения, 3 кнопки, таймер)
   - Queue indicator (пульсирующий бадж "Карточек: N")
   - Joystick layer (DOM-элементы: layer, base, knob)

3. **Game state variables** (строки 580-930):
   - `activeRoom` — текущая Colyseus комната
   - `balanceConfig` (DEFAULT_BALANCE_CONFIG) — параметры баланса
   - World bounds (`worldWidth`, `worldHeight`), chest/zone радиусы
   - Camera (`camera.x`, `camera.y`, `cameraZoom`, `cameraZoomTarget`)
   - Joystick state + config из balance.json
   - Sprite cache (`spriteCache`), player→sprite маппинг (`playerSpriteById`)
   - Snapshot types: `SnapshotPlayer`, `SnapshotOrb`, `SnapshotChest`, `SnapshotHotZone`, `SnapshotSlowZone`, `SnapshotToxicPool`, `SnapshotProjectile`, `SnapshotMine`
   - `latestSnapshot` (U2-style: только последний)
   - `smoothingSystem` (SmoothingSystem) из `client/src/game/`
   - `visualEffects` (VisualEffects) из `client/src/effects/`

4. **Preact UI инициализация** (строки 3784-3859):
   - `initUI(uiContainer, uiCallbacks)` монтирует Preact в `#ui-root`
   - `uiCallbacks`: `onArena`, `onBack`, `onPlay`, `onSelectTalent`, `onActivateAbility`, `onPlayAgain`, `onExit`, `onCancelMatchmaking`

5. **Async сервисы** (строки 3862-3985):
   - `initializeServices()` — IIFE async:
     - `updateBootProgress('initializing', 10)` — прогресс-бар
     - OAuth callback check и обработка
     - `authService.initialize()` — восстановление сессии
     - `configService.loadConfig()` — загрузка RuntimeConfig
     - Минимальное время boot screen: 1000ms (`MIN_BOOT_DISPLAY_MS`)
     - `setPhase("menu")` — переход в главное меню

### 3.2. Порядок фаз (gamePhase signal)

```
boot → menu → connecting → playing/waiting → results → menu
                                  ↕
                           classSelectMode (показ лобби)
```

---

## 4. Colyseus подключение

### 4.1. connectToServer(playerName, classId)

Основная функция подключения к серверу (строки 1397-3740).

**Алгоритм:**
1. Установка safety timeout (10 сек, `CONNECTING_TIMEOUT_MS`)
2. `setConnecting(true)` — UI индикатор
3. Показать canvas, блокировка viewport zoom
4. Определение WebSocket URL:
   - HTTPS + домен → `wss://hostname` (через reverse proxy)
   - HTTP / IP / localhost → `ws://hostname:2567`
   - Override через `VITE_WS_URL`
5. `authService.getRoomJoinToken(playerName)` — получение joinToken
6. `client.joinOrCreate("arena", { name, classId, joinToken })`
7. Ожидание начального state (`waitForInitialState`):
   - Проверка `room.state.phase` сразу
   - Подписка на `onStateChange`
   - Fallback timeout 500ms
8. Если фаза = `"Results"` → покинуть комнату, показать таймер ожидания
9. Иначе → `setPhase("playing")`, настройка listeners

### 4.2. State synchronization

```
room.onStateChange → captureSnapshot(room.state)
```

`captureSnapshot` (строки 966-1089):
- Дебаунс: минимум 10ms между снапшотами
- Копирует все коллекции в plain-объекты: players, orbs, chests, hotZones, slowZones, toxicPools, projectiles, mines
- Результат сохраняется в `latestSnapshot` (U2-style: всегда только один)

### 4.3. Collection listeners

| Коллекция | onAdd | onRemove | onChange |
|-----------|-------|----------|---------|
| `players` | Инкремент счётчика, определение localPlayer, установка спрайта, камера | Декремент, сброс localPlayer | Обновление спрайта |
| `orbs` | Инкремент | Декремент | Пустой (для Colyseus tracking) |
| `chests` | Инкремент, кэш позиции для эффектов | Декремент, вспышка + floating text | Обновление кэша позиции |
| `hotZones` | Инкремент | Декремент | Пустой |
| `zones` | — | — | Пустой |

### 4.4. Message handlers

| Сообщение | Обработка |
|-----------|-----------|
| `"balance"` | `applyBalanceConfig(config)` — обновление всех параметров |
| `"chestReward"` | Floating text + talent reward card (2.4 сек) |

### 4.5. Обработка разрыва

- `room.onLeave`: gameLoop.stop(), smoothingSystem.clear(), скрыть canvas, сброс в `"menu"` (если не `"connecting"`)
- `room.onError`: gameLoop.stop(), скрыть модалки, `activeRoom = null`
- Safety timeout (10 сек): сброс из `"connecting"` в `"menu"` при зависании подключения

---

## 5. Game Loop

### 5.1. GameLoopManager

**Файл:** `client/src/game/GameLoopManager.ts`

Три независимых цикла:

| Цикл | Механизм | Интервал | Callback |
|------|----------|----------|----------|
| Input | `setInterval` | `inputIntervalMs` (default 33ms, вычисляется из `tickRate`: `1000/tickRate`) | `onInputTick` |
| HUD | `setInterval` | `hudIntervalMs` (default 200ms = 5 Hz) | `onHudTick` |
| Render | `requestAnimationFrame` | ~16ms (vsync) | `onRender` |

**Lifecycle:**
- `start()` — запуск всех трёх циклов
- `stop()` — остановка (clearInterval, cancelAnimationFrame, вызов `onStop`)
- `pause()`/`resume()` — флаг `isPaused`, таймеры продолжают работать, но колбэки не вызываются
- **Guard:** `start()` при уже запущенном — warn и return

**Input tick callback** (`handleInputTick`, строки 2506-2522):
1. Guard: `!activeRoom`, `!inputManager.hasFocus`, `!visible`, `!document.hasFocus()`
2. `inputManager.getMovementInput()` — приоритет: joystick > mouse
3. Инкремент `globalInputSeq` (единый монотонный счётчик)
4. `activeRoom.send("input", { seq, moveX, moveY })`
5. **Heartbeat:** отправляется КАЖДЫЙ тик, даже если вектор не изменился (предотвращение автостопа на сервере)

**HUD tick callback** (`handleHudTick`, строки 3551-3655):
1. `updateHud()` — boost sync, card collapse при damage
2. `updateResultsOverlay()` — переход в Results фазу
3. `refreshTalentModal()` — обновление карточки талантов
4. `updateQueueIndicator()` — бадж очереди карточек
5. `updateAbilityCardUI()` — карточка выбора умений
6. `syncPlayerState()`, `syncLeaderboard()`, `syncMatchTimer()` — Preact signals
7. `syncAbilitySlots()`, `syncAbilityCooldown()` — для Preact AbilityButtons
8. Class select mode check (`classId < 0` → показать экран выбора)

### 5.2. SmoothingSystem (U2-стиль)

**Файл:** `client/src/game/SmoothingSystem.ts`

**Принцип:** визуальное состояние (visual state) плавно догоняет серверное состояние с предсказанием вперёд. Буфер снапшотов не используется — только последний снапшот.

**Три хранилища:**
- `visualPlayers: Map<string, VisualEntity>`
- `visualOrbs: Map<string, VisualEntity>`
- `visualChests: Map<string, VisualEntity>`

**VisualEntity:**
```typescript
{ x, y, vx, vy, angle }
```

**Конфигурация (SmoothingConfig из balance.json → clientNetSmoothing):**

| Параметр | Default | Описание |
|----------|---------|----------|
| `lookAheadMs` | 150 | Предсказание вперёд (мс) |
| `velocityWeight` | 0.7 | Вес velocity vs catch-up (0=только catch-up, 1=только velocity) |
| `catchUpSpeed` | 10.0 | Базовая скорость догоняния |
| `maxCatchUpSpeed` | 800 | Максимальная скорость коррекции |
| `teleportThreshold` | 100 | Порог телепортации (м) |
| `angleCatchUpSpeed` | 12.0 | Скорость сглаживания угла |

**Алгоритм smoothStep (для игроков):**
1. Вычислить целевую позицию: `target = server + velocity * lookAheadSec`
2. Вычислить ошибку (error = distance visual→target)
3. Если `error > teleportThreshold` → телепорт (мгновенное перемещение)
4. Velocity integration: `velocityMove = targetV * dtSec`
5. Catch-up коррекция: `correction = direction * min(error * catchUpSpeed, maxCatchUpSpeed) * dtSec`
6. Ограничение коррекции: не перескакивать цель
7. Комбинирование: `visual += velocityMove * velocityWeight + correction * (1 - velocityWeight)`
8. Lerp velocity: `visual.v = lerp(visual.v, target.v, clamp(dtSec * 8, 0, 1))`
9. Сглаживание угла через `angleCatchUpSpeed`

**Различия по типам сущностей:**

| Сущность | Catch-up множитель | Max catch-up множитель | Угол |
|----------|-------------------|------------------------|------|
| Players | 1.0x | 1.0x | Да (angleCatchUpSpeed) |
| Orbs | 1.5x (быстрее) | 1.0x | Нет |
| Chests | 0.8x (медленнее) | 0.5x | Нет |

**Frozen mode:** при фазе Results (`smoothingSystem.setFrozen(true)`) орбы и сундуки не обновляют позицию.

**Delta time:**
- `updateDeltaTime(nowMs)`: `dtSec = min((now - last) / 1000, 0.1)` — ограничение 100ms (10 FPS минимум)
- Первый кадр: `dtSec = 0` (без движения)

**getSmoothedRenderState** (строки 1092-1237):
- Берёт `latestSnapshot`
- Для каждого типа сущности вызывает соответствующий smooth метод
- HotZones, SlowZones, ToxicPools, Mines — без сглаживания (копируются напрямую)
- Projectiles — простая экстраполяция: `x + vx * lookAheadSec` (без smoothing, они быстрые)
- Удаляет из visual state сущности, исчезнувшие из снапшота

---

## 6. Input System

### 6.1. InputManager (mouse, keyboard, touch)

**Файл:** `client/src/input/InputManager.ts`

**Архитектура:** класс `InputManager` принимает зависимости (`InputManagerDeps`) и колбэки (`InputCallbacks`). Управляет keyboard, pointer (touch/pen) и mouse обработчиками. Делегирует джойстик в `joystick.ts`.

**Lifecycle:**
- `attach()` — регистрация всех event listeners (keydown, pointerdown, mousemove, mouseleave, focus, blur, visibilitychange)
- `detach()` — удаление всех listeners + отключение joystick pointer listeners

**MouseState:**
```typescript
{ active, screenX, screenY, worldX, worldY, moveX, moveY }
```

**Приоритет ввода** (`getMovementInput`):
1. Joystick (если `active`) → `{ x: moveX, y: -moveY }` (инверсия Y!)
2. Mouse (если `active`) → `{ x: moveX, y: moveY }`
3. Нет ввода → `{ x: 0, y: 0 }`

**Keyboard обработка** (`onKeyDown`):
- Guards: `!visible`, `!hasFocus`, modifiers (ctrl/meta/alt), `repeat`, `classSelectMode`
- Клавиши `1/2/3` → `onSendInput(lastSent.x, lastSent.y, slot)` (активация ability)
- Клавиши `7/8/9` → выбор таланта или ability card (через `getPlayerPendingCards`)

**Mouse обработка:**
- `onMouseMove`: игнорирует на coarse-pointer устройствах, обновляет screen→world координаты
- `onMouseLeave`: clamp курсора к краям canvas (не теряет управление)
- `updateMouseDirection(playerWorldX, playerWorldY, scale)`:
  - Deadzone и maxDist в мировых координатах (делится на `scale` для zoom-независимости)
  - Интенсивность линейная: `(dist - deadzone) / (maxDist - deadzone)`
  - Результат: нормализованный вектор `moveX/moveY` в [-1, 1]

**Pointer (touch/pen) обработка:**
- `onPointerDown`:
  - Mouse pointer → skip (не активирует джойстик)
  - Не touch/pen и не coarse → skip
  - Joystick already active → skip
  - Activation gate: `clientX > maxX` или `clientY < minY` → skip
  - Активация: установка `joystickState`, вызов `setPointerCapture`
- `onPointerMove`: обновление позиции knob
- `onPointerUp`/`onPointerCancel`: сброс джойстика, `releasePointerCapture`, `onSendStopInput`

**Focus/Blur/Visibility:**
- `onBlur`: сброс всего input state, `onSendStopInput`, сброс джойстика
- `visibilitychange hidden`: аналогично blur
- `visibilitychange visible`: восстановление `hasFocus`

**Debug mode:** `?debugJoystick=1` в URL — логирование всех joystick событий (throttled 80ms для move).

### 6.2. Joystick (виртуальный для мобильных)

**Файл:** `client/src/input/joystick.ts`

**JoystickState:**
```typescript
{ active, pointerId, pointerType, baseX, baseY, knobX, knobY, moveX, moveY }
```

**JoystickConfig (из balance.json → controls):**

| Параметр | Default | Описание |
|----------|---------|----------|
| `radius` | 100 | Радиус зоны джойстика (px) |
| `deadzone` | 0.07 | Мёртвая зона (доля радиуса) |
| `sensitivity` | 1.15 | Множитель чувствительности |
| `mode` | `"adaptive"` | `"adaptive"` (база в точке касания) или `"fixed"` (фиксированная позиция) |
| `followSpeed` | 0.95 | Скорость следования базы (не используется в текущей версии) |
| `knobRadius` | `radius * 0.45` | Вычисляется автоматически |

**updateJoystickFromPointer — алгоритм:**
1. Clamp базы в пределах canvas (padding = radius)
2. Ограничить knob радиусом от базы
3. Deadzone: `deadzonePx = radius * deadzone`
4. Нормализация: `normalized = (distance - deadzonePx) / (radius - deadzonePx)`
5. Sensitivity: `outX = clamp(outX * sensitivity, -1, 1)`
6. Результат → `moveX`, `moveY` (в пределах [-1, 1])

**DOM-элементы:**
- `layer` (fixed, inset 0, pointer-events none, z-index 5)
- `base` (круг с полупрозрачной рамкой и blur)
- `knob` (голубоватый полупрозрачный круг)
- Видимость: `opacity 0/1` (без layout shift)

**Adaptive vs Fixed mode:**
- **Adaptive:** база фиксируется в точке первого касания, НЕ смещается при drag
- **Fixed:** база в `joystickFixedBase` (нижний-левый угол, padding 24px)

### 6.3. Input → InputCommand → Colyseus message (поток)

```
Touch/Pointer Event
    ↓
InputManager.onPointerDown → joystick activation
InputManager.onPointerMove → updateJoystickFromPointer → moveX/moveY
    ↓
Mouse Event
    ↓
InputManager.onMouseMove → screen→world conversion
InputManager.updateMouseDirection → deadzone → intensity → moveX/moveY
    ↓
Keyboard Event (1/2/3)
    ↓
InputManager.onKeyDown → onSendInput(lastSent.x, lastSent.y, slot)
    ↓
handleInputTick (каждые ~33ms)
    ↓
inputManager.getMovementInput() → { x, y }  (joystick > mouse)
    ↓
globalInputSeq++ → room.send("input", { seq, moveX, moveY })
```

**Ключевые детали:**
- Input отправляется каждый тик как heartbeat (даже если не изменился)
- `globalInputSeq` — единый монотонный счётчик для всех input команд (UI кнопки и game loop)
- Ability activation из Preact UI: `activateAbilityFromUI(slot)` → тот же `room.send("input", {..., abilitySlot})`

---

## 7. Rendering Pipeline

### 7.1. Canvas setup, resize, DPR

**Canvas (строки 126-161):**
- Создаётся программно (`document.createElement("canvas")`)
- CSS: `display: block`, `touch-action: none`, `tabIndex: 0`
- Background: `radial-gradient(circle at 30% 30%, #10141d, #090b10 60%)`
- Скрыт (`display: none`) до входа в матч

**Resize (строка 1330-1342):**
```typescript
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    updateJoystickConfig();
}
```
- **DPR не используется!** Canvas рендерится в CSS пикселях (`window.innerWidth/innerHeight`)
- Нет `devicePixelRatio` масштабирования (потенциальная размытость на HiDPI)

**Context loss handling:**
- `contextlost` → `event.preventDefault()` (предотвращение потери)
- `contextrestored` → `canvasCtx = getCanvasContext()` (восстановление)

### 7.2. Camera (follow player, zoom, world-to-screen, screen-to-world)

**Camera state:**
- `camera = { x: 0, y: 0 }` — мировые координаты центра камеры
- `cameraZoom` — текущий zoom (lerp к `cameraZoomTarget`)
- `desiredView` — адаптивный размер области просмотра

**Адаптивный размер обзора (`getDesiredViewSize`):**

| Ширина экрана | desiredView | Поведение |
|---------------|-------------|-----------|
| < 480px | 450 | Мобильный портрет, крупный слайм |
| 480-768px | 600 | Планшет / мобильный ландшафт |
| > 768px | 800 | Десктоп, стандартный обзор |

**Zoom-система (строки 2731-2759):**
1. `baseScale = min(canvasWidth / desiredView.width, canvasHeight / desiredView.height)`
2. `scale = baseScale * cameraZoom`
3. Zoom зависит от массы: `massT = clamp((mass - zoomMassMin) / (zoomMassMax - zoomMassMin), 0, 1)`
4. `targetZoom = zoomMax - (zoomMax - zoomMin) * massT` (при росте массы zoom уменьшается = отдаление)
5. Damage hold: при получении урона zoom фиксируется на `zoomDamageHoldSec` секунд (не зумится на потерю массы)
6. Плавная анимация: `cameraZoom += (target - current) * zoomSpeed * dtSec`

**Параметры zoom (из balance.json → camera):**

| Параметр | Значение |
|----------|----------|
| `zoomMin` | 1.0 |
| `zoomMax` | 2.5 |
| `zoomSpeed` | 0.5 |
| `zoomDamageHoldSec` | 3 |
| `zoomMassMin` | 100 |
| `zoomMassMax` | 2000 |

**Camera follow (строки 2767-2771):**
- Камера всегда центрирована на сглаженной позиции игрока (стиль Agar.io)
- Clamping: камера не выходит за границы мира
- `maxCamX = max(0, worldHalfW - halfWorldW)`

**worldToScreen / screenToWorld (rendering/draw.ts):**
```
screenX = (worldX - camX) * scale + canvasWidth/2
screenY = (camY - worldY) * scale + canvasHeight/2  // Y инвертирована!
```
Ось Y: мировая растёт вверх, экранная — вниз.

### 7.3. Draw functions

**Порядок отрисовки (Z-order, строки 2707-3537):**

1. `clearRect` — очистка canvas
2. `drawGrid` — фоновая сетка (шаг 200, major каждые 1000)
3. **Hunger Zone** (Hunt/Final): красный фон + destination-out для Sweet Zones
4. **Hot Zones (Sweet Zones)** — золотой полупрозрачный круг
5. **Slow Zones** — фиолетовый радиальный градиент + обводка
6. **Toxic Pools** — зелёный радиальный градиент + обводка
7. **Generic Zones** (Nectar/Ice/Slime/Lava/Turbo) — цвет по типу, Lava пульсирует
8. **Safe Zones** (финал) — зелёный, пульсация если активны
9. **Obstacles** — Spikes (шипы + "⚠") / Pillars / Generic
10. **Orbs** — цветные кружки по `colorId` + специальные цвета для рассыпанных (10/11/12)
11. **Chests** — пульсирующие кружки + иконка + armor rings
12. **Projectiles** — свой=голубой, чужой=красный, bomb=оранжевый, с glow
13. **Mines** — пульсирующий круг + пунктирная обводка + иконка "💀"
14. **Королевское сияние** (REBEL) — золотой радиальный градиент
15. **Mouth sectors** (если включен) — цветной сектор рта
16. **Players:**
    - Respawn shield (голубое свечение)
    - Dash trail (огненные следы)
    - Magnet field (фиолетовый, пунктирный круг от пасти)
    - Push wave (голубые кольца)
    - Ability shield (голубой ободок)
    - Input arrow (стрелка направления, только для self)
    - **Sprite** (drawSprite с rotation по angle) или fallback круг
    - Имя + иконка класса / корона
    - KING / LB / DEAD метки
17. **Chest edge indicators** — стрелки по краям экрана
18. **KING edge indicator** — стрелка + корона по краю (если King за экраном)
19. **Visual effects** (flash + floating texts)
20. **Minimap** (15% ширины, правый верхний угол)

**drawSlime (встроен в render, строки 3193-3434):**
- Загрузка спрайта: `loadSprite(spriteName)` → кэш `spriteCache`
- `computeSpriteScale(img)` — вычисление масштаба по bounding box непрозрачных пикселей (alpha > 8)
- Радиус: `getSlimeRadiusFromConfig(mass, slimeConfig) * classRadiusMult * leviathanMul * scale`
- Классы: collector имеет `radiusMult`, leviathan увеличивает размер
- Невидимость: свой = alpha * 0.5, чужой = skip

**drawGrid (rendering/draw.ts, строки 147-205):**
- Шаг 200 (minor), 1000 (major)
- Minor: `rgba(255,255,255,0.12)`, lineWidth 1
- Major: `rgba(255,255,255,0.25)`, lineWidth 2
- Clamping к границам мира

**drawMinimap (строки 2524-2705):**
- 15% ширины canvas, правый верхний угол, margin 20px
- Coordinate conversion: мировые → minimap (Y инвертирована)
- Слои: zones → hot zones → slow zones → toxic pools → obstacles → safe zones → chests → king → viewport rect → self marker
- Self = `#6fd6ff`, King = `#ffc857` + "👑"

**Culling:** все сущности проверяются на попадание в viewport (`Math.abs(entity.x - camera.x) > halfWorldW + margin`) перед отрисовкой.

---

## 8. Visual Effects

**Файл:** `client/src/effects/VisualEffects.ts`

**Два типа эффектов:**

### FloatingText
- Мировые координаты, поднимается вверх на 30 пикселей за `durationMs`
- Alpha: `1 - progress` (линейное затухание)
- Тень для читаемости: `rgba(0,0,0,0.8)`, blur 4, offset (1,1)
- Шрифт: `bold ${fontSize}px Arial, sans-serif`
- Используется для: награды сундуков, damage numbers (не реализовано)

### FlashEffect
- Мировые координаты, радиальный градиент
- Радиус расширяется: `radius * (1 + progress * 0.5)`
- Alpha: `(1 - progress) * 0.8`
- Используется для: вспышка при открытии сундука

**Очистка:** обратная итерация с `splice` для удаления истекших эффектов.

**Вызов:** `visualEffects.draw(ctx, scale, camX, camY, canvasWidth, canvasHeight)` — после всех игровых объектов, перед minimap.

---

## 9. Конфигурация

Параметры из `config/balance.json`, используемые клиентом:

### controls
| Параметр | Значение | Описание |
|----------|----------|----------|
| `joystickMode` | `"adaptive"` | Режим джойстика |
| `joystickRadius` | 100 | Радиус (px) |
| `joystickDeadzone` | 0.07 | Мёртвая зона (доля) |
| `joystickSensitivity` | 1.15 | Чувствительность |
| `joystickFollowSpeed` | 0.95 | Скорость следования базы |
| `inputTimeoutMs` | 500 | Таймаут ввода (серверный) |
| `mouseDeadzone` | 30 | Мёртвая зона мыши (px) |
| `mouseMaxDist` | 200 | Макс. дистанция мыши (px) |

### clientNetSmoothing
| Параметр | Значение | Описание |
|----------|----------|----------|
| `lookAheadMs` | 150 | Предсказание вперёд |
| `velocityWeight` | 0.7 | Вес velocity |
| `catchUpSpeed` | 10.0 | Скорость догоняния |
| `maxCatchUpSpeed` | 800 | Макс. скорость коррекции |
| `teleportThreshold` | 100 | Порог телепорта |
| `angleCatchUpSpeed` | 12.0 | Скорость угла |

### camera
| Параметр | Значение | Описание |
|----------|----------|----------|
| `zoomMin` | 1.0 | Минимальный zoom |
| `zoomMax` | 2.5 | Максимальный zoom |
| `zoomSpeed` | 0.5 | Скорость анимации zoom |
| `zoomDamageHoldSec` | 3 | Удержание zoom после урона |
| `zoomMassMin` | 100 | Масса для max zoom |
| `zoomMassMax` | 2000 | Масса для min zoom |

### visual.mouthSector
| Параметр | Значение | Описание |
|----------|----------|----------|
| `enabled` | true | Включен |
| `radiusMultiplier` | 1.3 | Множитель радиуса |
| `angleRadians` | 2.0944 (~120°) | Угол сектора |
| `colors.player` | `rgba(96,165,250,0.2)` | Цвет своего |
| `colors.enemy` | `rgba(239,68,68,0.2)` | Цвет врага |

### visual.inputArrow
| Параметр | Значение | Описание |
|----------|----------|----------|
| `enabled` | true | Включена |
| `minIntensity` | 0.15 | Порог отображения |
| `tipAngleRatio` | 0.85 | Угол наконечника |
| `color` | `rgba(111,214,255,0.8)` | Цвет стрелки |

---

## 10. Захардкоженные значения

| Значение | Где | Описание |
|----------|-----|----------|
| 10ms | `captureSnapshot` debounce | Минимальный интервал между снапшотами |
| 0.1 (100ms) | `SmoothingSystem.updateDeltaTime` | Максимальная delta time (ограничение) |
| 200ms | `GameLoopManager` default `hudIntervalMs` | Частота обновления HUD |
| 33ms | `GameLoopManager` default `inputIntervalMs` | Частота отправки input |
| 10000ms | `CONNECTING_TIMEOUT_MS` | Таймаут подключения |
| 500ms | `waitForInitialState` fallback timeout | Ожидание начального state |
| 1000ms | `MIN_BOOT_DISPLAY_MS` | Минимальное время boot screen |
| 2400ms | `showTalentRewardCard` timeout | Время показа награды таланта |
| 4000ms | `cleanupPendingChestRewards` | Время жизни pending reward |
| 64 | `pendingChestRewardsMax` | Макс. количество pending rewards |
| 300ms | `sendTalentChoice` debounce | Debounce выбора таланта |
| 8 (alpha threshold) | `computeSpriteScale` | Порог прозрачности для bbox |
| 200 (grid step) | `drawGrid` | Шаг сетки |
| 0.15 (15%) | minimap width | Ширина миникарты |
| 20px | minimap margin | Отступ миникарты |
| 450/600/800 | `getDesiredViewSize` breakpoints | Адаптивный zoom по ширине экрана |
| `"arena"` | `client.joinOrCreate("arena", ...)` | Имя комнаты Colyseus |
| 2567 | WebSocket port | Порт для прямого подключения |
| `dtSec * 8` | velocity lerp factor | Скорость сходимости velocity в SmoothingSystem |
| 1.5x / 0.8x | orb / chest catch-up multipliers | Множители скорости догоняния |

---

## 11. Расхождения с документацией

### vs Architecture Part1 (v4.2.5)

| Спецификация | Реальность |
|-------------|-----------|
| `battle/*` слой: `GameSession`, `BattleContainer` | Не реализован. Вся логика в `main.ts` → `connectToServer` closure |
| `state/*` слой: `AppState` и селекторы | Частично: Preact signals в `ui/signals/gameState.ts`, но нет единого AppState |
| `events/*`: `AppEvents`, шина событий | Не реализована |
| `network/*`: обработчики сообщений | Inline в `connectToServer` |
| `net/smoothing.ts` | Реализован как `game/SmoothingSystem.ts` |
| `HUDController` с throttled updates | HUD обновляется через `setInterval(200ms)` + Preact signals, без формального HUDController |
| `RenderSystem` | Нет — рендеринг как inline функция `render()` в closure |
| `ScreenManager` | Нет — управление через `gamePhase` signal и UIBridge |
| `UIFacade` | Частично: `UIBridge` + callbacks |
| DPR-aware canvas | **Не реализован.** Canvas 1:1 CSS pixels |

### vs U2-smoothing.md (v1.0)

| Документация | Реальность |
|-------------|-----------|
| "Параметры захардкожены в клиенте" | Параметры вынесены в `balance.json → clientNetSmoothing` (конфигурируемые!) |
| "Сундуки без сглаживания" | Сундуки имеют сглаживание через `smoothChest` (0.8x catch-up) |
| "Реализация в main.ts" | Вынесена в `game/SmoothingSystem.ts` (класс) |
| Нет упоминания frozen mode | Реализован: `setFrozen(true)` при Results |
| Один буфер snapshotBuffer | Корректно: `latestSnapshot` (один) |

---

## 12. Технический долг

1. **main.ts — God Object (~3985 строк).** Содержит: boot, Colyseus, render, camera, sprites, talent/ability UI (DOM creation), minimap, phase management, results overlay. Архитектура Part1 предполагает слои `battle/`, `network/`, `rendering/`, `state/` — ни один не реализован полноценно.

2. **Нет DPR-масштабирования.** Canvas рендерится 1:1 в CSS пикселях. На Retina/HiDPI дисплеях изображение размытое.

3. **Inline DOM creation.** Talent modal, ability card, queue indicator создаются в main.ts через `createElement` вместо Preact компонентов. Частичная миграция (abilities → Preact) уже произошла, но талант-модалка и ability card остались в DOM.

4. **Нет формальной Camera class.** Camera state разбросан по переменным в closure: `camera.x`, `camera.y`, `cameraZoom`, `cameraZoomTarget`, `desiredView`, `lastZoomUpdateMs`, `lastDamageTimeMs`.

5. **Дублирование captureSnapshot.** Строки 1084-1088 содержат дублирование: `latestSnapshot = snapshot;` записывается дважды.

6. **Нет frustum culling для minimap.** Все сущности рисуются на minimap даже если вне видимости.

7. **Sprite loading без retry/error handling.** `loadSprite` устанавливает `onload`, но нет `onerror`. При ошибке загрузки `ready` навсегда `false`, будет fallback-круг.

8. **No frame time budget.** Нет мониторинга времени кадра. При большом количестве сущностей рендер может занять >16ms без предупреждения.

9. **splice в цикле эффектов.** `VisualEffects` использует `splice(i, 1)` в обратном цикле — O(n) для каждого удаления.

10. **Joystick followSpeed** объявлен в конфиге, но не используется в коде (adaptive mode фиксирует базу в точке касания).

---

## 13. Заметки для форка BonkRace

| Компонент | Переиспользование | Адаптация |
|-----------|-------------------|-----------|
| **GameLoopManager** | Полностью. 3 цикла (input, hud, render) — универсальны | Без изменений |
| **SmoothingSystem** | Полностью. Velocity + catch-up подходит для любых движущихся объектов | Заменить `smoothPlayer/smoothOrb/smoothChest` на `smoothCar/smoothBonus/smoothObstacle` |
| **InputManager** | Структура — да. Handlers — адаптировать | Руль/педали вместо джойстика. Mouse → поворот руля. Touch → виртуальный руль + газ/тормоз |
| **Joystick** | Структура — да | Заменить на два элемента: руль (rotary) + газ/тормоз (vertical slider) |
| **Camera** | Follow player — да | Follow car. Zoom по скорости (не по массе). Look-ahead по вектору скорости |
| **Rendering** | drawGrid, worldToScreen — да | Адаптировать для трассы: lanes, checkpoints, finish line вместо zones/orbs/chests |
| **VisualEffects** | Полностью | Добавить: drift smoke, boost flame, collision sparks |
| **draw.ts** | drawCircle, drawSprite — да | drawCar (спрайт с rotation по heading), drawTrack |
| **Minimap** | Структура — да | Track-shaped minimap вместо квадратного. Маркеры позиций гонщиков |
| **Colyseus integration** | Шаблон — да | Та же модель: joinOrCreate, state sync, input commands |
| **main.ts closure** | Рефакторить! | Разбить на: BootManager, BattleSession, RenderPipeline, CameraController |
