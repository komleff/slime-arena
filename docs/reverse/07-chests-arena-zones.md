# Reverse: Chests & Arena Zones
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

---

## 1. Обзор

Модуль охватывает три тесно связанные подсистемы:

- **Chest System** — спавн, физика, вскрытие сундуков, награды (таланты/бусты), разлёт золотых орбов.
- **Arena Generator** — процедурная генерация арены при старте матча: безопасные зоны, зоны эффектов, препятствия (столбы, шипы, проходы).
- **PlayerStateManager** — управление уровнями игрока (level-up по массе), открытие слотов умений, выдача талантов, смерть и респаун.

Дополнительно задокументированы **зоны эффектов** (5 типов), **HotZone** (горячие зоны для орбов) и **SafeZone** (безопасные зоны финала).

---

## 2. Исходные файлы

| Файл | Назначение |
|------|-----------|
| `server/src/rooms/systems/chestSystem.ts` | Спавн-тик сундуков, физика (damping), проверка укуса по сундуку, снятие armorRings |
| `server/src/rooms/systems/arenaGenerator.ts` | Оркестратор генерации арены: вызов seed-генераторов, создание объектов Zone/Obstacle/SafeZone |
| `server/src/rooms/systems/playerStateManager.ts` | Смерть, респаун, updatePlayerLevel (пороги, слоты, таланты) |
| `server/src/rooms/systems/effectSystems.ts` | `slowZoneSystem`, `toxicPoolSystem`, `statusEffectSystem`, `zoneEffectSystem` (Nectar, Lava) |
| `server/src/rooms/systems/boostSystem.ts` | Тик-система бустов: проверка истечения по `boostEndTick`, обнуление зарядов |
| `server/src/rooms/systems/hungerSystem.ts` | Drain массы вне HotZone в фазах Hunt/Final |
| `server/src/rooms/systems/safeZoneSystem.ts` | Урон вне SafeZone в финале |
| `server/src/rooms/helpers/arenaGeneration.ts` | Seed-генераторы: `generateObstacleSeeds`, `generateSafeZoneSeeds`, `generateZoneSeeds` |
| `server/src/rooms/helpers/worldUtils.ts` | `getWorldBounds`, `randomPointInMap`, `clampPointToWorld`, `applyWorldBoundsCollision` |
| `server/src/rooms/helpers/mathUtils.ts` | `clamp`, `normalizeAngle`, `secondsToTicks`, `msToTicks` |
| `server/src/rooms/schema/GameState.ts` | Colyseus-схемы: `Chest`, `HotZone`, `Zone`, `Obstacle`, `SafeZone` |
| `server/src/rooms/ArenaRoom.ts` | Центральный файл: `openChest`, `spawnChest`, `spawnChestRewardOrbs`, `applyBoost`, `spawnHotZones`, `getZoneForPlayer`, `getZoneSpeedMultiplier`, `getZoneFrictionMultiplier`, `spawnLavaOrbs` |
| `config/balance.json` | Все числовые параметры: chests, boosts, obstacles, safeZones, zones, hotZones |
| `shared/src/constants.ts` | Константы: `ZONE_TYPE_NECTAR=1`, `ZONE_TYPE_ICE=2`, `ZONE_TYPE_SLIME=3`, `ZONE_TYPE_LAVA=4`, `ZONE_TYPE_TURBO=5`, `OBSTACLE_TYPE_PILLAR=1`, `OBSTACLE_TYPE_SPIKES=2` |

---

## 3. Chest System

### 3.1. Схема данных (Colyseus)

```
Chest {
  id: string           // "chest_{counter}"
  x, y: number         // Позиция на карте
  vx, vy: number       // Скорость (физика)
  type: number          // 0=rare, 1=epic, 2=gold
  armorRings: number    // 0..2 обручей защиты
}
```

### 3.2. Спавн сундуков

**Файл:** `chestSystem.ts` → `updateChests()`, `ArenaRoom.ts` → `spawnChest()`

Каждый тик проверяется условие спавна:
1. `room.tick - room.lastChestSpawnTick >= room.chestSpawnIntervalTicks` (интервал: `chests.spawnIntervalSec` = **20 сек**)
2. `room.state.chests.size < room.balance.chests.maxCount` (максимум: **3**)

При спавне:
- Точка выбирается через `findSpawnPoint(radius=14, spacing, retries)` — не в препятствиях, но **нет проверки расстояния до игроков и других сундуков** (см. расхождения).
- Тип сундука выбирается взвешенно по фазе матча через `chests.phaseWeights`:

| Фаза | rare | epic | gold |
|------|-----:|-----:|-----:|
| Growth | 85 | 15 | 0 |
| Hunt | 65 | 30 | 5 |
| Final | 50 | 35 | 15 |

- `armorRings` берутся из `chests.types[typeId].armorRings`: rare=0, epic=1, gold=2.
- Маппинг `type`: rare=0, epic=1, gold=2.

### 3.3. Физика сундуков

**Файл:** `chestSystem.ts` → `updateChests()`

Каждый тик:
```
damping = max(0, 1 - environmentDrag - orbLinearDamping)
chest.vx *= damping
chest.vy *= damping
chest.x += chest.vx * dt
chest.y += chest.vy * dt
applyWorldBounds(chest, chests.radius)
```

Сундук использует тот же коэффициент затухания, что и орбы (`environmentDrag + orbLinearDamping`). Отдельных параметров физики по типу сундука (`chestLinearDragMul`, `chestMaxSpeedMps`, `chestBiteImpulseMul`) в коде **нет** (см. расхождения).

### 3.4. Механика вскрытия

**Файл:** `chestSystem.ts` → `chestSystem()`

Для каждого живого игрока и каждого сундука:
1. Проверка расстояния: `dist <= playerRadius + chests.radius`
2. Проверка угла: сундук в секторе рта (`mouthHalfAngle`)
3. Проверка GCD: `room.tick >= player.gcdReadyTick`
4. Проверка кулдауна укуса: `room.tick >= player.lastBiteTick + biteCooldownTicks`
5. Если `chest.armorRings > 0` — снимается один обруч (`armorRings--`)
6. Если `chest.armorRings == 0` — вызывается `openChest(player, chest)`
7. Устанавливается `player.lastBiteTick = room.tick` и `player.gcdReadyTick = room.tick + globalCooldownTicks`

### 3.5. Открытие сундука и награды

**Файл:** `ArenaRoom.ts` → `openChest()`

Порядок наград:
1. **Талант** — `awardChestTalent(player, chestTypeId)`:
   - Собирается пул доступных талантов по редкостям (common/rare/epic)
   - Редкость выбирается взвешенно по `chests.rewards.talentRarityWeights[chestTypeId]`
   - Если на выбранной редкости пуст пул — фоллбэк на другие доступные редкости
   - Талант применяется немедленно через `addTalentToPlayer()` (без карточки выбора)

| chestType | common | rare | epic |
|-----------|-------:|-----:|-----:|
| rare | 80 | 20 | 0 |
| epic | 30 | 60 | 10 |
| gold | 0 | 40 | 60 |

2. **Буст** (если талант не выдан — пул пуст) — `awardChestBoost(player, chestTypeId)`:
   - Случайный буст из `boosts.allowedByChestType[chestTypeId]`
   - Применяется через `applyBoost()`

| chestType | Разрешённые бусты |
|-----------|------------------|
| rare | haste, guard |
| epic | rage, haste, guard |
| gold | greed, rage, guard |

3. **Разлёт орбов** — `spawnChestRewardOrbs()` (всегда, независимо от таланта/буста):
   - Вычисляется средняя масса живых игроков
   - `totalMass = averagePlayerMass * scatterTotalMassPct[typeIndex]`
   - Масса распределяется между орбами с весами `rng.range(0.7, 1.3)` (не равномерно)
   - Ближние орбы (innerFrac от общего числа) летят медленнее, дальние — быстрее
   - Мелкие орбы (масса < среднего) получают `scatterSmallBubbleSpeedMul = 1.25`
   - Угол: равномерный шаг + случайный разброс `[-0.35, 0.35]` рад
   - Все орбы — золотые (`density = 0.5`)

| Параметр | rare (idx=0) | epic (idx=1) | gold (idx=2) |
|----------|:---:|:---:|:---:|
| scatterTotalMassPct | 0.12 | 0.18 | 0.28 |
| scatterBubbleCount | 10 | 16 | 24 |
| scatterInnerFrac | 0.30 | 0.30 | 0.25 |
| innerSpeed min..max | 25..45 | 25..45 | 25..40 |
| outerSpeed min..max | 55..75 | 65..85 | 75..95 |

4. Сундук удаляется из `state.chests`.

### 3.6. Система бустов

**Файл:** `boostSystem.ts`, `ArenaRoom.ts` → `applyBoost()`, `clearBoost()` и др.

Типы бустов: `rage`, `haste`, `guard`, `greed`.

| Буст | durationSec | Эффект | Заряды |
|------|:-----------:|--------|:------:|
| rage | 10 | `damageMul = 1.25` | - |
| haste | 10 | `speedMul = 1.30` | - |
| guard | 15 | Поглощает урон | 1 |
| greed | 15 | `bubbleMassMul = 2.0` | 3 |

**Стекирование:** если тот же буст уже активен, длительность продлевается (`boostEndTick + durationTicks`), но не более `maxStackTimeSec = 20` сек от текущего тика. Заряды восстанавливаются до максимума.

**Истечение:** `boostSystem` каждый тик проверяет:
- `boostEndTick > 0 && tick >= boostEndTick` → `clearBoost()`
- `guard/greed` с `boostCharges <= 0` → `clearBoost()`

**clearBoost:** обнуляет `boostType`, `boostEndTick`, `boostCharges`.

---

## 4. Arena Generator

### 4.1. Pipeline генерации

**Файл:** `arenaGenerator.ts` → `generateArena()`, `helpers/arenaGeneration.ts`

При старте/рестарте матча вызывается `generateArena(room)`:

1. **Очистка** — `obstacles.clear()`, `safeZones.splice()`, `zones.clear()`; обнуление счётчиков `obstacleIdCounter`, `zoneIdCounter`.
2. **SafeZones** — `generateSafeZoneSeeds(rng, world, mapSize, balance.safeZones)`
3. **Effect Zones** — `generateZoneSeeds(rng, world, mapSize, balance.zones, safeZoneSeeds)`
4. **Obstacles** — `generateObstacleSeeds(rng, world, mapSize, balance.obstacles)`
5. **Initial Orbs** — `spawnInitialOrbs()` (вызывается отдельно, спавнит `orbs.initialCount` орбов)

### 4.2. Определение размера карты

**Файл:** `helpers/arenaGeneration.ts` → `getMapSizeKey()`

```
mapSize ≤ 900  → "small"
mapSize ≤ 1400 → "medium"
mapSize > 1400 → "large"
```

Конфигурации `countByMapSize`, `radiusByMapSize` и т.д. индексируются по этому ключу.

### 4.3. SafeZone Generation

Параметры из `balance.safeZones`:

| Параметр | small | medium | large |
|----------|:-----:|:------:|:-----:|
| count | 1 | 2 | 3 |
| radius | 120 | 150 | 180 |

- `minDistance = 200` между зонами
- `placementRetries = 30`
- `margin = radius + 10`
- Точка проверяется на `isInsideWorld()` и расстояние до уже размещённых зон

### 4.4. Zone Generation (зоны эффектов)

Параметры из `balance.zones`:

| Параметр | small | medium | large |
|----------|:-----:|:------:|:-----:|
| count | 3 | 4 | 5 |
| radius | 90 | 110 | 130 |

- `minDistance = 180` между зонами (и до SafeZone)
- `placementRetries = 40`
- Тип выбирается случайно по `typeWeights` (все = 1, равновероятно)
- Лава не ближе `lavaMinDistanceFromSpawn = 100` от центра (0,0)
- Зоны не пересекаются с SafeZones

### 4.5. Obstacle Generation

Параметры из `balance.obstacles`:

| Параметр | small | medium | large |
|----------|:-----:|:------:|:-----:|
| count | 4 | 6 | 9 |
| passageCount | 1 | 2 | 2 |

Сначала размещаются **проходы** (passage):
- Каждый проход = 2 столба (`OBSTACLE_TYPE_PILLAR`) с радиусом `passagePillarRadius = 18` и зазором `passageGapWidth = 25`
- Два столба располагаются симметрично относительно случайного центра на случайном угле

Затем оставшиеся **одиночные препятствия**:
- С шансом `spikeChance = 0.3` — шипы (`OBSTACLE_TYPE_SPIKES`, radius=16), иначе — столб (`OBSTACLE_TYPE_PILLAR`, radius=20)
- `spacing = 8` (минимальный зазор между препятствиями)
- `placementRetries = 30`

### 4.6. Поддержка форм мира

Генерация поддерживает `worldShape = "circle"` и `"rectangle"`:
- Для круга: `randomPointInMapWithMargin` генерирует точку через полярные координаты с `sqrt(rng)` для равномерного распределения
- Для прямоугольника: простой `rng.range` по X и Y с учётом margin
- `isInsideWorld()` проверяет принадлежность точки миру с учётом радиуса объекта

---

## 5. Зоны эффектов (5 типов)

### 5.1. Nectar (ZONE_TYPE_NECTAR = 1)

**Файл:** `effectSystems.ts` → `zoneEffectSystem()`

- Эффект: прирост массы `+massGainPctPerSec` в секунду (= **1%/сек**)
- Формула: `gain = player.mass * 0.01 * dt`
- Не действует на игроков в состоянии `isLastBreath`
- Применяется через `room.applyMassDelta(player, gain)`

### 5.2. Ice (ZONE_TYPE_ICE = 2)

**Файл:** `ArenaRoom.ts` → `getZoneFrictionMultiplier()`

- Эффект: множитель трения `frictionMultiplier = 0.3` (скольжение)
- Реализовано через движение: `getZoneFrictionMultiplier()` возвращает 0.3 для ледяной зоны
- Прямого кода в `zoneEffectSystem` нет — обрабатывается в `movementSystems.ts`
- Не влияет на скорость напрямую, только на трение

### 5.3. Slime (ZONE_TYPE_SLIME = 3)

**Файл:** `ArenaRoom.ts` → `getZoneSpeedMultiplier()`, `getZoneFrictionMultiplier()`

- Двойной эффект:
  - `speedMultiplier = 0.5` (замедление скорости)
  - `frictionMultiplier = 2.0` (повышенное трение)
- Обрабатывается в системе движения, не в `zoneEffectSystem`

### 5.4. Lava (ZONE_TYPE_LAVA = 4)

**Файл:** `effectSystems.ts` → `zoneEffectSystem()`, `ArenaRoom.ts` → `spawnLavaOrbs()`

- Эффект: потеря массы `damagePctPerSec = 0.02` (2%/сек)
- Формула: `massLoss = player.mass * 0.02 * dt * damageTakenMult`
- Защиты: не действует при `isLastBreath`, `invulnerableUntilTick`, `FLAG_ABILITY_SHIELD`
- `tryConsumeGuard()` может поглотить урон (буст guard)
- **Scatter:** `scatterPct = 0.5` потерянной массы рассыпается орбами
  - `spawnLavaOrbs()` накапливает массу в `player.pendingLavaScatterMass`
  - Рассыпает когда накоплено >= `scatterOrbMinMass` (default 5)
  - Кол-во орбов: `lava.scatterOrbCount = 6`
  - Скорость: `lava.scatterSpeedMps = 60`
  - Цвет: по классу игрока (`getDamageOrbColorId`)
  - Угол: равномерный шаг + случайный разброс `[-0.3, 0.3]` рад

### 5.5. Turbo (ZONE_TYPE_TURBO = 5)

**Файл:** `ArenaRoom.ts` → `getZoneSpeedMultiplier()`

- Эффект: `speedMultiplier = 1.4` (ускорение)
- Обрабатывается в системе движения, не в `zoneEffectSystem`

### 5.6. Определение зоны игрока

**Файл:** `ArenaRoom.ts` → `getZoneForPlayer()`

Линейный перебор всех зон. Возвращает **первую** зону, в радиус которой попадает центр игрока. Если игрок в нескольких зонах — применяется только первая найденная.

---

## 6. HotZone

### 6.1. Назначение

HotZone — зоны повышенного спавна орбов. Вне HotZone в фазах Hunt/Final действует система голода (`hungerSystem`), дренирующая массу.

### 6.2. Схема данных

```
HotZone {
  id: string              // "hot_{counter}"
  x, y: number            // Позиция центра
  radius: number          // Радиус зоны
  spawnMultiplier: number  // Множитель спавна орбов
}
```

### 6.3. Размещение

**Файл:** `ArenaRoom.ts` → `handlePhaseChange()`, `spawnHotZones()`

HotZones появляются при смене фаз матча:

| Фаза | Кол-во | spawnMultiplier | centerFirst |
|------|:------:|:---------------:|:-----------:|
| Hunt | 2 | 3 | false |
| Final | 1 | 5 | true |

При переходе на новую фазу старые HotZones очищаются (`state.hotZones.clear()`).

Параметры: `radius = 110`.

При `centerFirst = true` первая зона размещается в (0, 0), остальные — случайно через `randomPointInMap()`.

### 6.4. Влияние на спавн орбов

**Файл:** `ArenaRoom.ts` → `randomOrbSpawnPoint()`, `getOrbSpawnMultiplier()`

- При наличии HotZone орбы спавнятся **внутри** случайной HotZone (равномерное распределение через `sqrt(rng)`)
- `getOrbSpawnMultiplier()` возвращает максимальный `spawnMultiplier` среди всех HotZone — влияет на интервал спавна

### 6.5. Hunger System (связь с HotZone)

**Файл:** `hungerSystem.ts`

- Активен только в фазах Hunt/Final
- Не действует если SafeZone активны (финал)
- Не действует если нет HotZone вообще
- Игроки **внутри** HotZone не теряют массу
- Игроки **вне** HotZone теряют:
  ```
  drainPerSec = min(maxDrainPerSec, baseDrainPerSec + scalingPerMass * (mass / 100))
  ```
  - `baseDrainPerSec = 2`, `scalingPerMass = 0.01`, `maxDrainPerSec = 12`
  - Минимальная масса: `max(hunger.minMass, physics.minSlimeMass)`

---

## 7. PlayerStateManager

### 7.1. Уровни и пороги массы

**Файл:** `playerStateManager.ts` → `updatePlayerLevel()`

Пороги из `balance.slime.levelThresholds = [180, 300, 500, 800, 1200, 1800]`:

| Масса | Уровень |
|------:|:-------:|
| < 180 | 1 |
| >= 180 | 2 |
| >= 300 | 3 |
| >= 500 | 4 |
| >= 800 | 5 |
| >= 1200 | 6 |
| >= 1800 | 7 |

**Динамические уровни после 7:** каждый следующий порог = предыдущий * 1.5.
- Уровень 8: >= 2700, уровень 9: >= 4050, и т.д.

Уровень может только расти (если `newLevel <= player.level` — return).

### 7.2. Открытие слотов умений

`slotUnlockLevels = [1, 3, 5]` — слот 0 открыт с уровня 1 (стартовое умение), слот 1 — с уровня 3, слот 2 — с уровня 5.

При достижении уровня разблокировки:
1. Проверяется, пуст ли слот (`player[slotProp] === ""`)
2. Если пуст — добавляется в `pendingCardSlots` (очередь карточек)
3. `pendingCardCount` обновляется
4. Вызывается `tryGenerateNextCard(player)` — генерирует карточку «выбери 1 из 3 умений»

### 7.3. Выдача талантов

`talentGrantLevels = [2, 4, 6]`

Условие выдачи таланта при достижении уровня `lvl`:
```
isTalentLevel = talentGrantLevels.includes(lvl) || lvl > thresholds.length
```

Для уровней 7+ талант выдаётся **на каждом уровне** (т.к. `lvl > 6 = thresholds.length`).

Выдача через `room.awardTalentToPlayer(player)` — генерирует карточку выбора таланта или добавляет в очередь.

### 7.4. Обработка смерти

**Файл:** `playerStateManager.ts` → `handlePlayerDeath()`

При смерти:
1. Устанавливается `isDead = true`, `respawnAtTick = tick + respawnDelayTicks`
2. Обнуляются: скорость, input, invisibleEndTick, doubleAbility-*, boost
3. Если есть `lastDamagedById` — убийце начисляется `killCount++` и `awardKillMass()`
4. Логируется телеметрия
5. Визуальные эффекты: `spawnDeathExplosion()`, `spawnDeathNeedles()`, `spawnToxicPool()`
6. Разлёт орбов из массы погибшего:
   - `massForOrbs = player.mass * death.massToOrbsPercent`
   - Кол-во: `death.orbsCount` (корректируется если масса на орб < `scatterOrbMinMass = 5`)
   - Скорость: `spreadSpeed = 150` (захардкожено)
   - Разлёт: `spread = 30` (захардкожено)
   - Цвет: по классу игрока

### 7.5. Обработка респауна

**Файл:** `playerStateManager.ts` → `handlePlayerRespawn()`

При респауне:
1. `isDead = false`
2. Масса: `max(max(minRespawnMass, mod_respawnMass), mass * (1 - massLostPercent))`
3. Позиция: `findSpawnPoint()` — безопасная точка
4. Обнуляются все эффекты: stun, frost, poison, invisible, slow, boost, doubleAbility, lava scatter
5. Щит неуязвимости: `invulnerableUntilTick = tick + respawnShieldTicks`
6. `gcdReadyTick = tick` (GCD готов)
7. `queuedAbilitySlot = null`

### 7.6. awardKillMass

```
reward = initialMass * (1 + max(0, player.mod_killMassBonus))
```

По умолчанию: `initialMass = 100`, `mod_killMassBonus = 0` → награда = 100 массы.

### 7.7. awardTalentToPlayer

**Файл:** `ArenaRoom.ts` строка 2551

1. Если очередь талантов >= `cardQueueMax` (default 3) — принудительный автовыбор `forceAutoPickTalent()`
2. Если уже есть активная карточка — добавляется в `pendingTalentQueue`
3. Иначе — генерируется `generateTalentCard(player)`

---

## 8. Захардкоженные значения

| Значение | Где | Описание |
|----------|-----|----------|
| `spreadSpeed = 150` | `playerStateManager.ts:71` | Скорость разлёта орбов при смерти |
| `spread = 30` | `playerStateManager.ts:67` | Радиус разлёта орбов при смерти |
| `1.5` | `playerStateManager.ts:140` | Множитель для динамических уровней после базовых |
| `margin = radius + 10` | `arenaGeneration.ts:183,233` | Margin для зон при генерации |
| `0.7..1.3` | `ArenaRoom.ts:1184` | Диапазон весов массы для reward-орбов сундука |
| `±0.35` рад | `ArenaRoom.ts:1204` | Случайный разброс угла для reward-орбов сундука |
| `±0.3` рад | `ArenaRoom.ts:1440` | Случайный разброс угла для lava-scatter орбов |
| `scatterOrbMinMass = 5` | `ArenaRoom.ts:1421`, `playerStateManager.ts:48` | Минимальная масса орба (fallback через `??`) |
| `ZONE_TYPE_NECTAR=1, ICE=2, SLIME=3, LAVA=4, TURBO=5` | `shared/src/constants.ts` | Числовые ID типов зон |
| `OBSTACLE_TYPE_PILLAR=1, SPIKES=2` | `shared/src/constants.ts` | Числовые ID типов препятствий |
| `"hot_{counter}"` | `ArenaRoom.ts:1886` | Формат ID для HotZone |
| `"zone_{counter}"` | `arenaGenerator.ts:40` | Формат ID для Zone |
| `"obs_{counter}"` | `arenaGenerator.ts:61` | Формат ID для Obstacle |
| `"chest_{counter}"` | `ArenaRoom.ts:2041` | Формат ID для Chest |
| `mapSize ≤ 900` → small, `≤ 1400` → medium | `arenaGeneration.ts:44-46` | Границы определения размера карты |

---

## 9. Расхождения с документацией

### 9.1. Chests

| # | GDD | Код | Серьёзность |
|---|-----|-----|:-----------:|
| C1 | Тип `common` упоминается в GDD-Chests §7.2 (таблица редкостей) | В коде только `rare`, `epic`, `gold`. Нет типа `common` для сундука | Низкая (common в GDD — это редкость **таланта**, не тип сундука; корректно) |
| C2 | `chestSpawnIntervalSec = 18–26 сек` (диапазон) | В коде фиксировано `spawnIntervalSec = 20` | Средняя |
| C3 | `chestLifeTimeSec = 35 сек` (сундук исчезает по таймеру) | В коде **нет** TTL-таймера для сундуков — сундук живёт вечно до вскрытия или конца матча | Высокая |
| C4 | `chestSpawnMinDistanceToPlayerM = 120` | В коде нет проверки расстояния до игроков при спавне | Высокая |
| C5 | `chestSpawnMinDistanceToChestM = 200` | В коде нет проверки расстояния до других сундуков при спавне | Высокая |
| C6 | Физика по типам: `chestMassMul`, `chestMaxSpeedMps`, `chestLinearDragMul`, `chestBiteImpulseMul` | В коде все сундуки используют одинаковую физику (единый `damping` = orbDamping). Нет типоспецифичной массы/скорости/импульса | Высокая |
| C7 | GDD §5.4: «визуальный эффект при поломке обруча» | Серверная логика обручей реализована; визуал — на клиенте (не проверялось) | Информационная |
| C8 | GDD §3.3: Талант «Чутьё» с предупреждением за 2–5 сек | В серверном коде не обнаружена реализация | Средняя |

### 9.2. Arena

| # | GDD | Код | Серьёзность |
|---|-----|-----|:-----------:|
| A1 | Размеры: малая 800x800, средняя 1200x1200, большая 1600x1600 | Границы в `getMapSizeKey`: ≤900 → small, ≤1400 → medium. Для 800 → small, 1200 → medium, 1600 → large — **совпадает** | OK |
| A2 | Мин. 2 узких прохода на средней/большой карте | `passageCountByMapSize`: small=1, medium=2, large=2 — **совпадает** | OK |
| A3 | Зоны 0–5 | `countByMapSize`: small=3, medium=4, large=5 — всегда ≥3, не 0 | Низкая |
| A4 | Препятствия 3–10 | `countByMapSize`: small=4, medium=6, large=9. Проходы удваивают счёт (каждый = 2 объекта): small = до 4+2=6, medium = до 6+4=10, large = до 9+4=13. Может превышать 10 | Низкая |
| A5 | Валидация проходимости между точками | В коде **нет** проверки связности графа проходимости | Средняя |
| A6 | Лава ≤ 10% площади, Нектар ≤ 5% площади | В коде **нет** проверки процента площади зон | Средняя |
| A7 | Мин. 60% свободного пространства | В коде **нет** такой проверки | Средняя |
| A8 | Ширина узкого прохода 25 м, лимит массы 350 кг | `passageGapWidth = 25` — **совпадает**. Ограничение по массе 350 кг — **не реализовано** | Средняя |
| A9 | Шипы: 5% массы при касании | `spikeDamagePct = 0.05` в balance.json — **совпадает** (реализация в combat) | OK |

### 9.3. Zones

| # | GDD | Код | Серьёзность |
|---|-----|-----|:-----------:|
| Z1 | Nectar +1% в сек | `massGainPctPerSec = 0.01` — **совпадает** | OK |
| Z2 | Ice: трение ×0.3 | `frictionMultiplier = 0.3` — **совпадает** | OK |
| Z3 | Slime: скорость ×0.5, трение ×2.0 | `speedMultiplier = 0.5`, `frictionMultiplier = 2.0` — **совпадает** | OK |
| Z4 | Lava: -2% в сек | `damagePctPerSec = 0.02` — **совпадает** | OK |
| Z5 | Lava: 50% потерянной массы → пузыри | `scatterPct = 0.5` — **совпадает** | OK |
| Z6 | Turbo: скорость ×1.4 | `speedMultiplier = 1.4` — **совпадает** | OK |
| Z7 | SafeZone: урон вне зоны 1–2% | `damagePctPerSec = 0.015` (1.5%) — в диапазоне | OK |
| Z8 | SafeZone: активация в последние 60 сек (120–180) | `finalStartSec = 120` — **совпадает** | OK |
| Z9 | SafeZone: предупреждение за 10 сек | `warningSec = 10` в balance.json — **совпадает** (клиент) | OK |

### 9.4. Player Levels

| # | GDD | Код | Серьёзность |
|---|-----|-----|:-----------:|
| L1 | Уровень 1: 100 кг | Уровень 1 при mass < 180 — **совпадает** | OK |
| L2 | Уровни 2–7 по таблице | `levelThresholds = [180, 300, 500, 800, 1200, 1800]` — **совпадает** | OK |
| L3 | Уровень 7+: ×1.5 | Код: `dynamicThreshold *= 1.5` — **совпадает** | OK |
| L4 | Слот 2 на уровне 3, слот 3 на уровне 5 | `slotUnlockLevels = [1, 3, 5]` — **совпадает** | OK |
| L5 | Таланты на 2, 4, 6, 7+ | `talentGrantLevels = [2, 4, 6]` + `lvl > thresholds.length` — **совпадает** | OK |
| L6 | GDD §5.3: при гибели сохраняются таланты и умения | В `handlePlayerDeath()` таланты/умения не сбрасываются — **совпадает** | OK |
| L7 | GDD §5.3: масса → 100 кг при гибели | Код: `respawnMass = max(baseRespawn, mass * (1 - massLostPercent))` — масса не обязательно = 100, зависит от `massLostPercent` | Средняя |

---

## 10. Технический долг

| # | Описание | Приоритет |
|---|----------|:---------:|
| TD1 | **Отсутствует TTL сундуков** — `chestLifeTimeSec` из GDD не реализован. Сундуки накапливаются до maxCount и не исчезают. | P1 |
| TD2 | **Нет проверки расстояния при спавне сундуков** — нет `minDistanceToPlayer` и `minDistanceToChest`. Сундук может появиться рядом с игроком. | P1 |
| TD3 | **Нет типоспецифичной физики сундуков** — масса, скорость, сопротивление, импульс одинаковы для всех типов. GDD описывает 6 параметров по типам. | P2 |
| TD4 | **Нет валидации проходимости арены** — алгоритм генерации не проверяет, что между любыми двумя точками есть проход. | P2 |
| TD5 | **Нет ограничения площади зон** — лава и нектар могут занять больше площади, чем предусмотрено GDD (10% и 5%). | P2 |
| TD6 | **`getZoneForPlayer` возвращает первую зону** — при пересечении нескольких зон (маловероятно из-за minDistance) только первая применяется. | P3 |
| TD7 | **Захардкоженные значения** в playerStateManager: `spreadSpeed=150`, `spread=30`. Должны быть в balance.json. | P3 |
| TD8 | **Нет ограничения массы для узких проходов** — GDD описывает лимит 350 кг для прохождения, в коде нет такой проверки. | P2 |
| TD9 | **spawnIntervalSec фиксирован (20)** — GDD описывает диапазон 18–26 сек. | P3 |

---

## 11. Заметки для форка BonkRace

### Сундуки → Power-up Boxes

- Текущая система сундуков с armorRings и фазовыми весами **не подходит** для гоночной механики.
- Для BonkRace: power-up boxes размещаются на фиксированных позициях трассы (не случайно), респавнятся по таймеру.
- Убрать armorRings — power-up подбирается мгновенно при проезде.
- Бусты (rage → nitro, haste → turbo, guard → shield, greed → не нужен) — сохранить систему `applyBoost()` + `boostSystem()` с новыми типами.
- Таланты из сундуков → не нужны. Награда = только буст.

### Зоны → Участки трассы

- Зоны эффектов отлично маппируются на участки трассы:
  - **Turbo** → boost pad (ускоряющая полоса)
  - **Ice** → скользкий участок
  - **Slime** → грязь / песок (замедление)
  - **Lava** → опасный участок (отнимает HP / замедляет)
  - **Nectar** → зона восстановления (если есть HP)
- Генерация: вместо случайного размещения — привязка к сегментам трассы.
- `getZoneForPlayer()` → проверка, на каком сегменте трассы находится игрок.

### Level-up → Pit-stop апгрейды

- Система уровней по массе **не применима** к гонке. Масса как ресурс не используется.
- Возможная замена: pit-stop система, где между кругами/раундами можно выбрать апгрейд (из карточек «1 из 3»).
- Карточная система `tryGenerateNextCard()` / `generateAbilityCard()` может быть переиспользована.
- `updatePlayerLevel()` → убрать. `awardTalentToPlayer()` → вызывать по событию (прохождение pit-stop).

### HotZone → Бонусная зона трассы

- HotZone с `spawnMultiplier` → зона, где чаще спавнятся бонусы на трассе.
- `hungerSystem` (drain вне зоны) → **убрать**, не подходит для гонки.

### SafeZone → Финишная механика

- SafeZone + урон вне неё → можно переиспользовать как сужающуюся зону безопасности для battle royale-режима гонки.
- Для обычной гонки — **не нужна**.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Read CLAUDE-core.md for base rules", "status": "completed", "activeForm": "Reading CLAUDE-core.md"}, {"content": "Read chestSystem.ts", "status": "completed", "activeForm": "Reading chestSystem.ts"}, {"content": "Read arenaGenerator.ts", "status": "completed", "activeForm": "Reading arenaGenerator.ts"}, {"content": "Read playerStateManager.ts", "status": "completed", "activeForm": "Reading playerStateManager.ts"}, {"content": "Read effectSystems.ts (zoneEffectSystem)", "status": "completed", "activeForm": "Reading effectSystems.ts"}, {"content": "Find and read helpers/ files", "status": "completed", "activeForm": "Finding and reading helpers/ files"}, {"content": "Read GDD docs for comparison", "status": "completed", "activeForm": "Reading GDD docs"}, {"content": "Read ArenaRoom.ts for openChest, spawnChest, spawnLavaOrbs, HotZone, boost logic", "status": "completed", "activeForm": "Reading ArenaRoom.ts for chest/zone/boost methods"}, {"content": "Read balance.json for hardcoded values", "status": "completed", "activeForm": "Reading balance.json"}, {"content": "Read shared constants (ZONE_TYPE_*, OBSTACLE_TYPE_*)", "status": "completed", "activeForm": "Reading shared constants"}, {"content": "Create reverse documentation file", "status": "completed", "activeForm": "Creating reverse documentation"}]