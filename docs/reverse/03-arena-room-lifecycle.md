# Reverse: ArenaRoom Core Lifecycle
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

---

## 1. Обзор

`ArenaRoom` -- центральный класс серверной логики Slime Arena. Наследуется от `Room<GameState>` (Colyseus) и содержит:

- Полный жизненный цикл матча: инициализация, подключение игроков, игровой тик, фазы матча, перезапуск
- Авторитетную симуляцию: все решения принимаются сервером, клиент отправляет только InputCommand
- ECS-подобную архитектуру с системами, вынесенными в отдельные модули (`./systems/*`), но оркестрируемыми через ArenaRoom
- Детерминированный RNG (`Rng`), инициализируемый сидом, для воспроизводимости
- Интеграцию с MetaServer через `MatchResultService` (результаты матчей)

**Размер файла:** 2788 строк (на момент ревизии 425d333).

---

## 2. Исходные файлы

| Файл | Строк | Назначение |
|---|---:|---|
| `server/src/rooms/ArenaRoom.ts` | 2788 | Основной класс комнаты, оркестрация всех систем |
| `server/src/index.ts` | 195 | Точка входа MatchServer: Express + Colyseus, Internal API |
| `server/src/services/MatchResultService.ts` | 136 | Отправка MatchSummary на MetaServer с retry |
| `server/src/rooms/schema/GameState.ts` | ~300 | Colyseus schema: Player, Orb, Chest, Zone, etc. |
| `server/src/rooms/systems/*.ts` | ~20 файлов | Модули игровых систем |
| `server/src/rooms/helpers/arenaGeneration.ts` | — | Генерация карты: препятствия, зоны, safe zones |
| `server/src/meta/services/JoinTokenService.ts` | — | JWT-валидация joinToken |
| `config/balance.json` | ~500 | Конфигурация баланса |
| `shared/src/types.ts` | — | MatchPhaseId, InputCommand, MatchSummary |

---

## 3. Жизненный цикл комнаты

### 3.1 onCreate() -- инициализация
**Строки:** 182--338

Порядок инициализации:
1. **Загрузка баланса** (стр. 183): `loadBalanceConfig()` из `config/balance.json`
2. **maxClients** (стр. 184): устанавливается из `balance.server.maxPlayers` (по умолчанию 20)
3. **Seed и RNG** (стр. 185-186): `seed = options.seed ?? Date.now()`, создаётся `Rng(seed)`
4. **Телеметрия** (стр. 187-188): `TelemetryService`, отключается через `TELEMETRY_DISABLED=1`
5. **Match ID** (стр. 189): `initMatchId()` -- генерирует UUID через `crypto.randomUUID()`
6. **Размер карты** (стр. 190): `applyMapSizeConfig()` -- случайный выбор из `balance.world.mapSizes`
7. **Пересчёт тиков** (стр. 192-204): все длительности из секунд в тики (`secondsToTicks()`)
   - `attackCooldownTicks`, `invulnerableTicks`, `biteCooldownTicks`
   - `respawnShieldTicks`, `respawnDelayTicks`, `orbSpawnIntervalTicks`
   - `chestSpawnIntervalTicks`, `lastBreathTicks`, `rebelUpdateIntervalTicks`
   - `inputTimeoutTicks`, `resultsDurationTicks`, `restartDelayTicks`
   - `metricsIntervalTicks = tickRate` (метрики раз в секунду)
8. **GameState** (стр. 206-210): `setState(new GameState())`, phase = "Spawn", timeRemaining = durationSec
9. **Генерация арены** (стр. 211): `generateArena()` -- препятствия, зоны, safe zones
10. **Регистрация обработчиков сообщений** (стр. 213-332):
    - `"selectClass"` -- выбор/смена класса (валидация classId 0-2)
    - `"input"` -- ввод игрока (moveX, moveY, abilitySlot)
    - `"talentChoice"` -- выбор таланта из карточки (choice 0-2)
    - `"cardChoice"` -- выбор умения из карточки (choice 0-2)
11. **Simulation interval** (стр. 334): `setSimulationInterval(() => this.onTick(), simulationIntervalMs)`
12. **Начальные орбы** (стр. 336): `spawnInitialOrbs()`

### 3.2 onAuth() -- валидация
**Строки:** 344--371

Аутентификация через JWT joinToken:
1. Проверяет env `JOIN_TOKEN_REQUIRED` (значения "true" или "1")
2. **Без токена:**
   - Если `JOIN_TOKEN_REQUIRED` -- отклоняет с ошибкой
   - Иначе -- разрешает (dev mode), возвращает `true`
3. **С токеном:**
   - Вызывает `joinTokenService.verifyTokenForRoom(token, roomId)`
   - При успехе возвращает `JoinTokenPayload` (userId, nickname, matchId, spriteId, guestSubjectId)
   - При ошибке -- бросает исключение

**JoinTokenPayload** доступен в `onJoin()` через `client.auth`.

### 3.3 onJoin() -- подключение игрока
**Строки:** 373--469

1. Создаёт `new Player()`, id = sessionId
2. **Извлечение данных из токена** (стр. 378-394):
   - `userId`, `guestSubjectId`, `spriteId` -- из JoinTokenPayload
3. **Имя игрока** (стр. 397-413): приоритет `tokenNickname > options.name > generateUniqueName()`
   - Для генерации используется хеш от sessionId (не RNG симуляции!)
   - Имя обрезается до 24 символов
4. **Точка спавна** (стр. 414-421): `findSpawnPoint()` с проверкой коллизий с препятствиями и лава-зонами
5. **Инициализация массы/уровня** (стр. 422-423): `initialMass`, `initialLevel`
6. **Класс** (стр. 427-443): classId из options (0=Hunter, 1=Warrior, 2=Collector), -1 = не выбран
   - Классовые умения: `["dash", "shield", "pull"]`
   - Слот 0 = классовое умение, слоты 1-2 пустые
7. **Состояние игрока** (стр. 444-458):
   - Если classId < 0, isMatchEnded, или phase == "Results": `isDead = true, respawnAtTick = MAX_SAFE_INTEGER`
8. **Добавление в state** (стр. 460): `state.players.set(sessionId, player)`
9. **Обновление лидерборда** (стр. 463-465): если матч активен
10. **Отправка баланса** (стр. 467): `client.send("balance", this.balance)`

### 3.4 onMessage() -- обработка ввода
**Строки:** 213--332 (зарегистрированы в onCreate)

| Тип сообщения | Строка | Валидация | Действие |
|---|---:|---|---|
| `"selectClass"` | 213 | classId: 0-2, !isMatchEnded, !Results, класс ещё не выбран | Устанавливает classId, abilitySlot0, сбрасывает массу/скорость, invulnerable shield |
| `"input"` | 271 | seq > lastProcessedSeq, moveX/Y: clamp [-1,1], нормализация | Записывает inputX/Y, lastInputTick; abilitySlot (0-2) если есть в пакете |
| `"talentChoice"` | 318 | choice: 0-2, pendingTalentCard существует | Записывает talentChoicePressed2 |
| `"cardChoice"` | 326 | choice: 0-2, pendingAbilityCard существует | Записывает cardChoicePressed |

**Важные детали input:**
- Используется sequence number (`seq`) для отбрасывания устаревших пакетов
- `abilitySlot` записывается в player.abilitySlotPressed только если поле явно присутствует в data (стр. 304) -- обычные input движения не перезатирают нажатие
- Вектор ввода нормализуется, clamp к единичному кругу

### 3.5 onLeave() -- отключение
**Строки:** 471--475

Минимальная логика:
1. Удаляет игрока из `state.players`
2. Обновляет лидерборд
3. Логирует

**Нет reconnect-логики**, нет сохранения состояния покинувшего игрока.

### 3.6 onDispose() -- очистка
**Строки:** 477--480

1. Логирует roomId
2. Закрывает телеметрию (`telemetry.close()`)

**Нет очистки** таймеров, состояния, MatchResultService -- Colyseus управляет lifecycle комнаты.

---

## 4. Фазы матча

### 4.1 Определение фаз

Фазы определяются в `balance.json` -> `match.phases`:

| Фаза | startSec | endSec | Длительность |
|---|---:|---:|---:|
| Growth | 0 | 30 | 30 сек |
| Hunt | 30 | 60 | 30 сек |
| Final | 60 | 90 | 30 сек |

**Общая длительность матча:** `match.durationSec` = 90 сек (из balance.json).

**Дополнительные фазы (не в config, управляются кодом):**

| Фаза | Длительность | Управление |
|---|---|---|
| `Spawn` | 0 тиков (мгновенный переход) | Начальная фаза, переписывается при первом `updateMatchPhase()` |
| `Results` | `resultsDurationSec` (12 сек) + `restartDelaySec` (3 сек) = 15 сек | Устанавливается в `endMatch()` |

### 4.2 Управление фазами (`updateMatchPhase`)
**Строки:** 1560--1603

Логика:
1. Если `isMatchEnded` -- отсчитывает таймер Results, при истечении вызывает `restartMatch()`
2. Вычисляет `elapsedSec = tick / tickRate`, обновляет `timeRemaining`
3. Если `elapsedSec >= durationSec` -- вызывает `endMatch()`
4. Иначе -- ищет текущую фазу по `balance.match.phases` (первая, где `startSec <= elapsed < endSec`)
5. Если фаза не найдена -- fallback на "Final"
6. При смене фазы -- логирует, вызывает `handlePhaseChange()`

### 4.3 handlePhaseChange()
**Строки:** 1798--1806

- Очищает `state.hotZones`
- `Hunt`: спавнит hotZones (`chaosCount` штук, `spawnMultiplierChaos`)
- `Final`: спавнит hotZones (`finalCount` штук, `spawnMultiplierFinal`, первая в центре)

### 4.4 endMatch()
**Строки:** 1605--1628

1. Ставит `isMatchEnded = true`, `resultsStartTick = tick`
2. `state.phase = "Results"`
3. Обновляет лидерборд
4. Логирует телеметрию `match_end`
5. Останавливает всех игроков (обнуление input/velocity)
6. Вызывает `submitMatchResults()`

### 4.5 restartMatch()
**Строки:** 1691--1796

Полный сброс состояния:
1. Обнуляет tick, matchId, все счётчики ID
2. Очищает orbs, chests, hotZones, slowZones, zones, obstacles, safeZones, toxicPools, projectiles, mines
3. Генерирует новую арену
4. Для каждого игрока:
   - Сброс позиции (randomPointInMap), массы, уровня, killCount
   - `isDead = true`, `classId = -1` -- ожидание выбора класса
   - Сброс талантов, умений, бустов, способностей
5. Спавнит начальные орбы
6. Обновляет лидерборд

---

## 5. Игровой тик (onTick)
**Строки:** 499--549

**Частота:** 30 Гц (`simulationIntervalMs` = 33.33 мс)

### 5.1 ТОЧНЫЙ порядок вызова систем

```
onTick() {
  tick += 1
  state.serverTick = tick

  // 0. updateMatchPhase (стр. 505)
  //    Проверяет время, переключает фазы, может завершить/перезапустить матч

  // === Если isMatchEnded (Results phase): ЗАМОРОЗКА ===
  //  - updateOrbsVisual()     (стр. 510) — только визуальное замедление орбов
  //  - updatePlayerFlags()    (стр. 511) — пересчёт битовых флагов
  //  - reportMetrics()        (стр. 512) — метрики тика
  //  - return                 (стр. 513)

  // === Основной цикл симуляции (стр. 516-539) ===
```

| # | Система | Метод ArenaRoom | Модуль | Строка | Назначение |
|---|---|---|---|---:|---|
| 1 | CollectInputs | `collectInputs()` | inline (noop) | 516 | Заглушка, ввод собирается в onMessage |
| 2 | ApplyInputs | `applyInputs()` | inline | 517 | Deadzone, нормализация, таймаут, stun-проверка |
| 3 | BoostSystem | `boostSystem()` | `boostSystem.ts` | 518 | Обработка активных бустов (rage, haste, guard, greed) |
| 4 | AbilitySystem | `abilitySystem()` | `abilitySystem.ts` | 519 | GCD, cooldown, активация/очередь способностей |
| 5 | AbilityCardSystem | `abilityCardSystem()` | `abilitySystem.ts` | 520 | Обработка карточек выбора умений (тайм-аут, применение) |
| 6 | TalentCardSystem | `talentCardSystem()` | `talentCardSystem.ts` | 521 | Обработка карточек выбора талантов |
| 7 | UpdateOrbs | `updateOrbs()` | `orbSystem.ts` | 522 | Спавн, физика, коллизии орбов, TTL |
| 8 | UpdateChests | `updateChests()` | `chestSystem.ts` | 523 | Спавн сундуков по интервалу |
| 9 | ToxicPoolSystem | `toxicPoolSystem()` | `effectSystems.ts` | 524 | Урон/замедление от токсичных луж, TTL |
| 10 | SlowZoneSystem | `slowZoneSystem()` | `effectSystems.ts` | 525 | Установка FLAG_SLOWED для игроков в slow-зонах (до flightAssist!) |
| 11 | FlightAssistSystem | `flightAssistSystem()` | `movementSystems.ts` | 526 | Рассчёт сил/моментов по джойстику, flight assist |
| 12 | PhysicsSystem | `physicsSystem()` | `movementSystems.ts` | 527 | Интеграция позиций/скоростей, drag, world bounds |
| 13 | CollisionSystem | `collisionSystem()` | `collisionSystem.ts` | 528 | Столкновения слайм-слайм, слайм-орб, слайм-препятствие |
| 14 | ProjectileSystem | `projectileSystem()` | `abilitySystem.ts` | 529 | Движение снарядов, попадания, TTL |
| 15 | MineSystem | `mineSystem()` | `abilitySystem.ts` | 530 | Детонация мин при контакте |
| 16 | ChestSystem | `chestSystem()` | `chestSystem.ts` | 531 | Столкновения слайм-сундук, открытие, арморные кольца |
| 17 | StatusEffectSystem | `statusEffectSystem()` | `effectSystems.ts` | 532 | Таймеры статус-эффектов (stun, invisible, etc.) |
| 18 | ZoneEffectSystem | `zoneEffectSystem()` | `effectSystems.ts` | 533 | Эффекты зон: Nectar (+масса), Lava (-масса), Ice, Slime, Turbo |
| 19 | DeathSystem | `deathSystem()` | `deathSystem.ts` | 534 | Гибель (масса <= min), Last Breath, респавн, death explosion, death needles |
| 20 | HungerSystem | `hungerSystem()` | `hungerSystem.ts` | 535 | Пассивная потеря массы со временем |
| 21 | SafeZoneSystem | `safeZoneSystem()` | `safeZoneSystem.ts` | 536 | Урон вне безопасных зон в фазе Final |
| 22 | RebelSystem | `rebelSystem()` | `rebelSystem.ts` | 537 | Назначение/обновление Короля (rebel) |
| 23 | UpdatePlayerFlags | `updatePlayerFlags()` | inline | 538 | Пересчёт битовых флагов для синхронизации клиенту |
| 24 | ReportMetrics | `reportMetrics()` | inline | 539 | Сбор и логирование метрик производительности тика |

### 5.2 Критичные детали порядка

- **SlowZoneSystem (10) перед FlightAssistSystem (11):** FLAG_SLOWED должен быть актуален при расчёте сил движения. Комментарий в коде (стр. 525).
- **FlightAssist (11) перед Physics (12):** Силы рассчитываются до интеграции.
- **Physics (12) перед Collision (13):** Позиции обновляются, затем разрешаются столкновения.
- **Collision (13) включает combat:** столкновения слайм-слайм запускают `processCombat()`.
- **ZoneEffectSystem (18) после Physics (12):** эффекты зон применяются к уже обновлённым позициям.
- **DeathSystem (19) после ZoneEffect (18):** смерть обрабатывается после всех источников урона.
- **RebelSystem (22) после DeathSystem (19):** Король определяется после всех смертей/респавнов.
- **UpdatePlayerFlags (23) последний:** финальный snapshot флагов перед отправкой клиенту.

### 5.3 Обработка ошибок в тике
**Строки:** 540--548

При любом исключении в `onTick()`:
1. Логирует `CRITICAL` ошибку с tick number и stack trace
2. Отключает всех клиентов (`client.leave()`)
3. Фактически убивает комнату

---

## 6. Конфигурация

### 6.1 Серверные параметры (balance.json -> server)

| Параметр | Значение | Описание |
|---|---:|---|
| `maxPlayers` | 20 | Максимум клиентов в комнате |
| `tickRate` | 30 | Тиков в секунду |
| `simulationIntervalMs` | 33.33 | Интервал симуляции в мс |
| `globalCooldownMs` | 100 | GCD в мс |
| `abilityQueueSize` | 1 | Размер очереди способностей |

### 6.2 Параметры матча (balance.json -> match)

| Параметр | Значение | Описание |
|---|---:|---|
| `durationSec` | 90 | Длительность матча |
| `resultsDurationSec` | 12 | Показ результатов |
| `restartDelaySec` | 3 | Задержка перед рестартом |

### 6.3 Мир (balance.json -> world)

| Параметр | Значение | Описание |
|---|---:|---|
| `mapSize` | 1000 | Базовый размер (перезаписывается) |
| `mapSizes` | [800, 1200, 1600] | Случайный выбор при создании |

### 6.4 Загрузка конфига

`loadBalanceConfig()` (стр. 183) загружает `config/balance.json` и парсит через `resolveBalanceConfig()` из `shared/src/config.ts` с валидацией типов и fallback-значениями.

Конфиг загружается **однократно при создании комнаты** и не обновляется динамически. При рестарте матча используется тот же конфиг.

---

## 7. Методы ArenaRoom

### 7.1 Lifecycle (Colyseus)

| Метод | Строка | Видимость | Назначение |
|---|---:|---|---|
| `onCreate(options)` | 182 | public | Инициализация комнаты |
| `onAuth(client, options)` | 344 | public async | JWT-валидация joinToken |
| `onJoin(client, options)` | 373 | public | Создание игрока, спавн, отправка баланса |
| `onLeave(client)` | 471 | public | Удаление игрока |
| `onDispose()` | 477 | public | Закрытие телеметрии |

### 7.2 Тик и фазы

| Метод | Строка | Видимость | Назначение | Вызывается из |
|---|---:|---|---|---|
| `onTick()` | 499 | private | Главный тик-цикл | setSimulationInterval |
| `updateMatchPhase()` | 1560 | private | Управление фазами матча | onTick |
| `endMatch()` | 1605 | private | Завершение матча | updateMatchPhase |
| `restartMatch()` | 1691 | private | Перезапуск матча | updateMatchPhase |
| `handlePhaseChange(phase)` | 1798 | private | Обработка смены фазы (hotZones) | updateMatchPhase |

### 7.3 Системы (делегирование в модули)

| Метод | Строка | Модуль |
|---|---:|---|
| `collectInputs()` | 551 | inline (noop) |
| `applyInputs()` | 555 | inline |
| `boostSystem()` | 593 | `boostSystem.ts` |
| `abilitySystem()` | 597 | `abilitySystem.ts` |
| `abilityCardSystem()` | 2283 | `abilitySystem.ts` |
| `talentCardSystem()` | 2320 | `talentCardSystem.ts` |
| `updateOrbs()` | 1383 | `orbSystem.ts` |
| `updateOrbsVisual()` | 1391 | `orbSystem.ts` |
| `updateChests()` | 1395 | `chestSystem.ts` |
| `toxicPoolSystem()` | 1403 | `effectSystems.ts` |
| `slowZoneSystem()` | 1399 | `effectSystems.ts` |
| `flightAssistSystem()` | 833 | `movementSystems.ts` |
| `physicsSystem()` | 837 | `movementSystems.ts` |
| `collisionSystem()` | 841 | `collisionSystem.ts` |
| `projectileSystem()` | 960 | `abilitySystem.ts` |
| `mineSystem()` | 974 | `abilitySystem.ts` |
| `chestSystem()` | 989 | `chestSystem.ts` |
| `statusEffectSystem()` | 1407 | `effectSystems.ts` |
| `zoneEffectSystem()` | 1411 | `effectSystems.ts` |
| `deathSystem()` | 1243 | `deathSystem.ts` |
| `hungerSystem()` | 1447 | `hungerSystem.ts` |
| `safeZoneSystem()` | 1451 | `safeZoneSystem.ts` |
| `rebelSystem()` | 1455 | `rebelSystem.ts` |
| `updatePlayerFlags()` | 1470 | inline |
| `reportMetrics(startMs)` | 2710 | inline |

### 7.4 Способности и бой

| Метод | Строка | Видимость | Назначение |
|---|---:|---|---|
| `activateAbility(player, slot)` | 601 | public | Активация способности из слота |
| `resetAbilityCooldowns(player, tick)` | 605 | public | Сброс КД всех слотов |
| `setAbilityLevelForSlot(player, slot, level)` | 613 | public | Установка уровня умения |
| `getAbilityLevelForAbility(player, abilityId)` | 617 | public | Уровень конкретного умения |
| `getAbilityConfigById(abilityId, level)` | 624 | public | Конфиг способности с уровнем |
| `processCombat(attacker, defender, dx, dy)` | 943 | public | Обработка PvP-боя (делегация) |
| `applyShieldReflection(defender, attacker, loss)` | 947 | public | Отражение урона щитом |
| `spawnPvPBiteOrbs(x, y, totalMass, colorId)` | 956 | public | Орбы от PvP-укуса |
| `applyProjectileDamage(attacker, defender, pct)` | 978 | public | Урон снарядом |
| `applySelfDamage(player, pct)` | 985 | public | Самоурон (от мины) |
| `explodeBomb(proj)` | 967 | public | Взрыв бомбы AoE |
| `applyPushWave(x, y, r, impulse, min, max, excl)` | 795 | public | Волна отталкивания |
| `getDamageBonusMultiplier(attacker, includeBite)` | 778 | public | Множитель урона с бонусами |
| `getDamageTakenMultiplier(defender)` | 783 | public | Множитель получаемого урона |
| `clearInvisibility(player)` | 789 | public | Снятие невидимости |

### 7.5 Масса, уровень, спавн

| Метод | Строка | Видимость | Назначение |
|---|---:|---|---|
| `applyMassDelta(player, delta)` | 2216 | public | Изменение массы с clamp к min |
| `updatePlayerLevel(player)` | 2235 | private | Обновление уровня по массе |
| `tryGenerateNextCard(player)` | 2242 | public | Генерация следующей карточки из очереди |
| `spawnOrb(x, y, mass)` | 1990 | public | Спавн орба с проверкой maxCount |
| `forceSpawnOrb(x, y, mass, colorId)` | 1998 | public | Спавн орба без проверки maxCount |
| `findSpawnPoint(radius, padding, retries, pref)` | 1845 | public | Поиск точки спавна без коллизий |
| `getPlayerRadius(player)` | 2081 | public | Радиус слайма с учётом класса и талантов |
| `getMouthPoint(player)` | 2089 | public | Точка притяжения орбов (1.9 * radius от центра) |
| `getContactZone(attacker, dx, dy)` | 2131 | public | Определение зоны контакта: mouth/tail/side |
| `getClassStats(player)` | 2098 | public | Статы класса (radiusMult, damageMult, etc.) |

### 7.6 Бусты

| Метод | Строка | Видимость | Назначение |
|---|---:|---|---|
| `clearBoost(player)` | 664 | public | Очистка буста |
| `tryConsumeGuard(player)` | 690 | public | Поглощение заряда Guard |

### 7.7 Таланты

| Метод | Строка | Видимость | Назначение |
|---|---:|---|---|
| `awardTalentToPlayer(player)` | 2551 | public | Выдача таланта (из сундука/уровня) |
| `addTalentToPlayer(player, talentId)` | 2356 | private | Добавление/повышение уровня таланта |
| `recalculateTalentModifiers(player)` | 2426 | private | Пересчёт mod_* полей |
| `generateTalentCard(player)` | 2466 | private | Генерация карточки 1-из-3 |
| `tryGenerateNextTalentCard(player)` | 2489 | private | Следующая карточка из очереди |
| `forceAutoPickTalent(player)` | 2501 | private | Автовыбор при переполнении очереди |

### 7.8 Death-related

| Метод | Строка | Видимость | Назначение |
|---|---:|---|---|
| `handlePlayerDeath(player)` | 1247 | private | Делегация в playerStateManager |
| `handlePlayerRespawn(player)` | 1379 | private | Делегация в playerStateManager |
| `awardKillMass(player)` | 1251 | public | Награда за убийство |
| `spawnDeathExplosion(player)` | 1259 | public | AoE взрыв при смерти (талант) |
| `spawnDeathNeedles(player)` | 1331 | public | Снаряды при смерти (талант) |
| `spawnToxicPool(player)` | 1362 | public | Токсичная лужа при смерти (талант) |

### 7.9 Мониторинг и инфраструктура

| Метод | Строка | Видимость | Назначение |
|---|---:|---|---|
| `getRoomStats()` | 2743 | public | Статистика комнаты для Internal API |
| `setShutdownAt(shutdownAtMs)` | 2786 | public | Уведомление о перезагрузке сервера |
| `logTelemetry(event, data, player)` | 2696 | public | Запись телеметрии |
| `secondsToTicks(seconds)` | 2572 | public | Конвертация секунд в тики |

---

## 8. Подсчёт результатов матча

### 8.1 submitMatchResults()
**Строки:** 1630--1689

Вызывается из `endMatch()`. Формирует `MatchSummary` и отправляет на MetaServer.

**Формирование PlayerResult:**
```
Для каждого player в state.players:
  - placement = indexOf(sessionId в leaderboard) + 1
  - Если не в leaderboard: placement = leaderboard.length + 1
  - userId (из joinToken, для зарегистрированных)
  - guestSubjectId (для гостевых аккаунтов)
  - finalMass, killCount, level, classId, isDead
  - deathCount = 0 (TODO: не реализован)
```

**MatchSummary:**
```
- matchId: UUID
- mode: "arena"
- startedAt / endedAt: ISO timestamps
- configVersion: "1.0.0" (захардкожено)
- buildVersion: "0.3.1" (захардкожено)
- playerResults: PlayerResult[]
- matchStats: { totalKills, totalBubblesCollected: 0 (TODO), matchDurationMs }
- guestSubjectId: первый найденный гость
```

### 8.2 MatchResultService
**Файл:** `server/src/services/MatchResultService.ts`

- Singleton, инициализируется в `server/src/index.ts` при наличии `META_SERVER_URL` + `MATCH_SERVER_TOKEN`
- Отправляет POST на `{metaServerUrl}/api/v1/match-results/submit`
- Авторизация: `ServerToken {token}` в заголовке
- Retry: 5 попыток с exponential backoff (1s, 2s, 4s, 8s)
- Timeout: 10 секунд на запрос
- 4xx ошибки (кроме 429) -- не retry
- 5xx и 429 -- retry

### 8.3 Placement / XP / Coins

На стороне ArenaRoom:
- **Placement:** позиция в leaderboard (отсортирован по массе, топ-10)
- **XP/Coins:** не рассчитываются в ArenaRoom -- это ответственность MetaServer

---

## 9. Захардкоженные значения

| Значение | Где (строка) | Описание |
|---|---:|---|
| `maxClients = 20` | 134 | Начальное значение (перезаписывается из balance) |
| `maxTalentQueue = 3` | 160 | Максимум карточек талантов в очереди (НЕ используется -- используется `balance.talents.cardQueueMax`) |
| `configVersion: "1.0.0"` | 1670 | Версия конфигурации в MatchSummary |
| `buildVersion: "0.3.1"` | 1671 | Версия билда в MatchSummary (устаревшая) |
| `totalBubblesCollected: 0` | 1675 | Счётчик пузырей не реализован |
| `deathCount: 0` | 1647 | Счётчик смертей не реализован |
| `slice(0, 24)` | 230, 398, 400 | Максимальная длина имени = 24 символа |
| `getMouthPoint: offset = radius * 1.9` | 2091 | Смещение точки рта |
| `classAbilities = ["dash", "shield", "pull"]` | 233, 434 | Дублировано в 2 местах |
| `orbOrbCollisions: slop = 0.001, percent = 0.8` | 886-887 | Параметры позиционной коррекции |
| `spawnDeathExplosion: speed clamp 30-120` | 1324 | Лимиты скорости отбрасывания |
| `spawnDeathNeedles: spread ограничен PI/3` | 1338 | Угол разброса иголок |
| `spawnDeathNeedles: radius * 0.7` | 1353 | Размер иголок относительно базового |
| `spawnChestRewardOrbs: scatterAngle +-0.35` | 1204 | Разброс угла орбов из сундука |
| `spawnLavaOrbs: rng.range(-0.3, 0.3)` | 1440 | Разброс угла лава-орбов |
| `clamp(impulseNs / targetMass, 30, 120)` | 1324 | Death explosion knockback speed limits |
| `warnThresholdMs = tickBudgetMs * 0.85` | 2720 | Порог предупреждения о тяжёлом тике |

---

## 10. Расхождения с документацией

### 10.1 Фазы матча: длительности

| Документ | Фазы | Длительность |
|---|---|---|
| **GDD-Core 1.3** | Growth 0-60, Hunt 60-120, Final 120-180 | **180 сек** |
| **balance.json** | Growth 0-30, Hunt 30-60, Final 60-90 | **90 сек** |
| **Код** | Использует balance.json | **90 сек** |

**Расхождение:** GDD документирует 180-секундный матч, balance.json и код используют 90 секунд. Вероятно, balance.json -- актуальный источник, GDD устарел.

### 10.2 Фаза "Spawn"

- **GDD-Core 1.4** описывает состояния: Lobby, Running, Results
- **Код:** использует "Spawn" как начальную фазу вместо "Lobby"
- `MatchPhaseId` в `shared/src/types.ts` = `["Growth", "Hunt", "Final", "Results"]` -- **"Spawn" НЕ входит в тип**
- Но `GameState.phase` объявлен как `string`, не как `MatchPhaseId`, поэтому "Spawn" работает

### 10.3 Порядок систем в тике: systemPatterns.md vs код

**systemPatterns.md** документирует 16 систем с порядком из "Architecture v3.3":

| systemPatterns.md | Реальный порядок в коде |
|---|---|
| 3: AbilitySystem | 4: AbilitySystem (после BoostSystem) |
| 4: FlightAssistSystem | 11: FlightAssistSystem (после SlowZone) |
| 7: ZoneSystem | 18: ZoneEffectSystem (после CollisionSystem) |
| 8: CombatSystem | Нет отдельной системы -- часть CollisionSystem |
| 9: PickupSystem | Нет отдельной системы -- часть CollisionSystem |
| 11: BoostSystem | 3: BoostSystem (перед AbilitySystem) |
| 15: KingSystem | 22: RebelSystem |
| 16: SnapshotSystem | Нет отдельной системы -- Colyseus sync |

**Ключевые отличия:** BoostSystem переместилась перед AbilitySystem. Добавлены ToxicPoolSystem, SlowZoneSystem (разделение ZoneSystem). AbilityCardSystem и TalentCardSystem не документированы. Реальный порядок содержит 24 шага вместо 16.

### 10.4 Состояния комнаты

- **GDD-Core 1.4:** "Lobby" -- ожидание игроков
- **Код:** нет состояния "Lobby". Комната создаётся в "Spawn", немедленно переходит в "Growth" на первом тике.
- Новые игроки могут присоединяться во время матча (mid-match join).

### 10.5 Количество игроков

- **GDD-Core 1.2:** "2-30 (зависит от размера карты)"
- **balance.json:** `maxPlayers = 20`
- **Код:** `maxClients` из balance = 20. Нет динамической привязки к размеру карты.

### 10.6 configVersion / buildVersion

- `configVersion: "1.0.0"` и `buildVersion: "0.3.1"` захардкожены в submitMatchResults (стр. 1670-1671)
- Реальная версия проекта: 0.8.7

---

## 11. Технический долг

### 11.1 Критический

| Проблема | Строка | Описание |
|---|---:|---|
| `deathCount: 0` TODO | 1647 | Счётчик смертей не реализован -- метрика потеряна |
| `totalBubblesCollected: 0` TODO | 1675 | Счётчик пузырей не реализован |
| Нет reconnect | 471-475 | onLeave полностью удаляет игрока, нет механики переподключения |
| Захардкоженные buildVersion/configVersion | 1670-1671 | "0.3.1" вместо реальной версии |

### 11.2 Архитектурный

| Проблема | Описание |
|---|---|
| `classAbilities` дублированы | Массив `["dash", "shield", "pull"]` в стр. 233 и 434 |
| `maxTalentQueue = 3` не используется | Поле объявлено (стр. 160), но используется `balance.talents.cardQueueMax` (стр. 2552) |
| `require()` runtime import | `require("./schema/GameState")` в стр. 2269 для AbilityCard -- потенциальная проблема с bundlers |
| `collectInputs()` пустой | Стр. 551-553 -- noop метод, ввод обрабатывается в onMessage |
| Монолитные inline-методы | `updatePlayerFlags()` (стр. 1470-1558), `applyInputs()` (стр. 555-591), `orbOrbCollisions()` (стр. 884-941) -- не вынесены в модули |
| "Spawn" вне MatchPhaseId | Фаза "Spawn" используется в коде, но отсутствует в типе MatchPhaseId |
| `guestSubjectId` -- только первый | В submitMatchResults берётся первый найденный гость (стр. 2657-2662), остальные игнорируются |

### 11.3 Незначительный

| Проблема | Описание |
|---|---|
| TODO комментарии | 4 штуки в submitMatchResults -- не реализованные метрики |
| `matchIndex` | Инкрементируется (стр. 2687), но нигде не используется кроме initMatchId |
| Пересчёт баланса при рестарте | При restartMatch() используется старый конфиг, hot-reload конфига невозможен |

---

## 12. Заметки для форка BonkRace

Для адаптации ArenaRoom под BonkRace (гоночная игра) потребуются следующие изменения:

### 12.1 ArenaRoom -> RaceRoom

- Переименовать класс, сохранить Colyseus Room lifecycle
- `GameState` -> `RaceState`: убрать orbs/chests/talents/rebel, добавить laps/checkpoints/positions
- Оставить: physics/collision системы, world bounds, player schema (с изменениями)

### 12.2 Фазы матча -> Lap-based

| ArenaRoom фаза | BonkRace аналог |
|---|---|
| Spawn | Countdown (3-2-1 Start) |
| Growth | Гонка (lap 1...N) |
| Hunt | Не нужна |
| Final | Last Lap (ускоренный спавн препятствий) |
| Results | Finish Screen (placement по времени, не по массе) |

- Условие победы: первый финишировавший N кругов (вместо массы)
- timeRemaining -> lap counter + total time

### 12.3 Тик -> Physics + Checkpoints

Порядок систем для RaceRoom:
1. CollectInputs
2. ApplyInputs
3. BoostSystem (speed pads вместо орбов)
4. FlightAssistSystem / SteeringAssist
5. PhysicsSystem (критичен для гонки -- столкновения с трассой)
6. CollisionSystem (бампинг между игроками)
7. CheckpointSystem (НОВАЯ: проверка прохождения чекпоинтов)
8. LapSystem (НОВАЯ: подсчёт кругов, определение winner)
9. ItemSystem (НОВАЯ: вместо талантов -- предметы на трассе)
10. DeathSystem (респавн на последнем чекпоинте, не random)
11. UpdatePlayerFlags

### 12.4 Что можно переиспользовать

| Модуль | Применимость | Изменения |
|---|---|---|
| `movementSystems.ts` | Высокая | FlightAssist -> SteeringAssist, PhysicsSystem as-is |
| `collisionSystem.ts` | Средняя | Убрать orb/chest коллизии, добавить wall collision |
| `deathSystem.ts` | Низкая | Другая механика смерти (чекпоинт-респавн) |
| `Rng` | Высокая | As-is |
| `TelemetryService` | Высокая | As-is |
| `MatchResultService` | Высокая | Другой формат PlayerResult (time, laps) |
| balance.json | Низкая | Полностью другая структура |

### 12.5 Ключевые архитектурные решения

- **Детерминизм:** сохранить подход fixed timestep + Rng. Для гонки детерминизм ещё важнее.
- **Нет reconnect:** в гонке потеря соединения критичнее. Нужен reconnect с восстановлением позиции.
- **Карточки/Таланты:** убрать полностью. Заменить системой предметов (снаряды, щиты, ускорения).
- **Rebel/King:** убрать. Нет аналога в гонке.
- **onTick error handling:** улучшить -- не убивать комнату, а попытаться восстановить.
