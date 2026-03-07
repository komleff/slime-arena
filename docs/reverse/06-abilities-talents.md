# Reverse: Abilities & Talents
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

---

## 1. Обзор

Система способностей и талантов -- основная прогрессия внутри матча. Игрок получает способности через слоты (slot0 -- классовая, slot1 -- level 3, slot2 -- level 5) и таланты через карточки при достижении уровней 2, 4, 6+.

**Ключевые подсистемы:**
- **AbilityActivationSystem** -- активация 9 типов способностей, расчёт стоимости, cooldown, double-ability.
- **AbilitySystem** -- tick-системы GCD, очередь нажатий, маршрутизация ввода.
- **TalentGenerator** -- генерация карточек талантов (детерминистичная, через Rng).
- **TalentModifierCalculator** -- пересчёт mod_* полей игрока на основе набранных талантов.
- **TalentCardSystem** -- выбор из карточки, автовыбор по таймауту.
- **EffectSystems** -- slowZone, toxicPool, statusEffect (frost, poison), zoneEffect (lava, nectar, ice, turbo).

---

## 2. Исходные файлы

| Файл | Строк | Назначение |
|---|---:|---|
| `server/src/rooms/systems/abilityActivationSystem.ts` | ~600 | Активация всех 9 способностей, cooldown, double-ability |
| `server/src/rooms/systems/abilitySystem.ts` | ~232 | GCD, очередь, projectileSystem, mineSystem |
| `server/src/rooms/systems/talentCardSystem.ts` | ~32 | Tick-система выбора из карточки талантов |
| `server/src/rooms/systems/effectSystems.ts` | ~158 | slowZone, toxicPool, statusEffect, zoneEffect |
| `server/src/rooms/systems/talent/TalentGenerator.ts` | ~303 | Генерация карточек (3 опции) |
| `server/src/rooms/systems/talent/TalentModifierCalculator.ts` | ~274 | Пересчёт mod_* модификаторов |
| `server/src/rooms/systems/talent/index.ts` | ~20 | Реэкспорт |
| `server/src/rooms/ArenaRoom.ts` | ~2800 | getAbilityConfigById, forceAutoPickTalent, applyTalentCardChoice |
| `config/balance.json` | ~737 | Все числовые значения способностей и талантов |

---

## 3. Система способностей

### 3.1 Слоты (slot0=классовое, slot1=level3, slot2=level5)

```typescript
// ArenaRoom.ts:233-234
const classAbilities = ["dash", "shield", "pull"];
player.abilitySlot0 = classAbilities[player.classId] || "dash";
```

| Слот | Поле | Момент получения | Содержимое |
|---:|---|---|---|
| 0 | `abilitySlot0` | Старт матча | classId=0 -> `dash`, classId=1 -> `shield`, classId=2 -> `pull` |
| 1 | `abilitySlot1` | Уровень 3 (300 кг) | Выбор 1 из 3 через AbilityCard |
| 2 | `abilitySlot2` | Уровень 5 (800 кг) | Выбор 1 из 3 через AbilityCard |

**Пул общих способностей** (balance.json `slime.abilityPool`):
```json
["slow", "projectile", "spit", "bomb", "push", "mine"]
```

**Уровни способностей** (`abilityLevel0..2`): от 1 до 3, повышаются через карточки-апгрейды (появляются когда все 3 слота заняты).

**ВАЖНО:** Классовая способность Собирателя хранится как `"pull"` в слотах, но конфиг извлекается из `abilities.magnet`. Маппинг в `getAbilityConfigById`:
```typescript
case "pull":
case "magnet":
    return resolveLevel(abilities.magnet);
```

### 3.2 GCD (gcdReadyTick, длительность)

**globalCooldownTicks** вычисляется при старте из `globalCooldownMs`:
```
globalCooldownTicks = Math.max(1, Math.round(globalCooldownMs / (1000 / tickRate)))
```
При `globalCooldownMs = 100` и `tickRate = 30`: `Math.round(100 / 33.33) = 3 тика`.

**Применение GCD:**
- После активации способности: `player.gcdReadyTick = room.tick + balance.server.globalCooldownTicks`
- После укуса пузыря/слайма: аналогично
- Блокирует и способности, и укусы

**Очередь способностей:** если GCD не готов и `abilityQueueSize > 0`, нажатие сохраняется в `queuedAbilitySlot`. При готовности GCD -- автоактивация из очереди.

### 3.3 AbilityCard (очередь карточек, автовыбор)

Система AbilityCard (`abilityCardSystem` в abilitySystem.ts):
- Карточка хранится в `player.pendingAbilityCard`
- Игрок выбирает через `cardChoicePressed` (индекс 0-2)
- Автовыбор по таймауту `expiresAtTick`: выбирается первый вариант (индекс 0)
- При смерти таймер приостанавливается (`card.expiresAtTick += 1` каждый тик)

---

## 4. Каждая способность (9 штук)

### Общая формула стоимости

```typescript
function getAbilityCostPct(room, player, basePct, extraMultiplier = 1): number {
    const reduction = clamp(player.mod_abilityCostReduction, 0, 0.9);  // cap 90%
    const multiplier = Math.max(0, extraMultiplier);
    const reducedPct = basePct * (1 - reduction) * multiplier;
    return Math.max(reducedPct, 0.01);  // min 1%
}
massCost = player.mass * getAbilityCostPct(...)
```
Проверка: `player.mass - massCost < minSlimeMass (50)` -- если нет массы, способность не активируется.

### Общая формула cooldown

```typescript
function getAbilityCooldownSec(room, player, baseCooldownSec): number {
    const reduction = clamp(player.mod_cooldownReduction, 0, 0.9);  // cap 90%
    return Math.max(0.1, baseCooldownSec * (1 - reduction));  // min 0.1 сек
}
```

---

### 4.1 dash (Рывок)
**Класс:** Hunter (slot0) + общий пул (slot1/2 для других классов -- НЕТ, в abilityPool нет dash)
**Класс-эксклюзив:** Да, только через slot0 Hunter.

| Параметр | Lv1 | Lv2 | Lv3 |
|---|---:|---:|---:|
| massCostPct | 3% | 3% | 3% |
| cooldownSec | 5 | 4 | 4 |
| distanceM | 80 | 80 | 104 |
| durationSec | 0.3 | 0.3 | 0.3 |
| collisionDamageMult | 1.5 | 1.5 | 1.5 |

**Активация:**
1. Списывает массу
2. Вычисляет `dashTargetX/Y` = позиция + cos/sin(angle) * distance * (1 + mod_dashDistanceBonus)
3. Ограничивает к границам мира (`clampPointToWorld`)
4. Устанавливает `dashEndTick` = tick + durationSec * tickRate
5. Ставит `FLAG_DASHING`
6. Если `mod_invisibleDurationSec > 0` -- активирует невидимость

**Особенности:**
- Единственная способность, НЕ снимающая невидимость при активации (строка 112: `if (abilityId !== "dash")`)
- `collisionDamageMult` присутствует в конфиге, но в `activateDash` не используется -- обрабатывается в movementSystems/collisionSystem

---

### 4.2 shield (Щит)
**Класс:** Warrior (slot0)
**Класс-эксклюзив:** Да, только через slot0 Warrior.

| Параметр | Lv1 | Lv2 | Lv3 |
|---|---:|---:|---:|
| massCostPct | 4% | 4% | 4% |
| cooldownSec | 8 | 8 | 8 |
| durationSec | 2.5 | 2.5 | 2.5 |
| reflectDamagePct | 0 | 0.30 | 0.30 |
| burstRadiusM | 0 | 0 | 40 |

**Активация:**
1. Списывает массу
2. Устанавливает `shieldEndTick` = tick + durationSec * tickRate
3. Ставит `FLAG_ABILITY_SHIELD`

**Отражение урона (Lv2+):** обрабатывается в `combatSystem.ts:applyShieldReflection` -- при укусе в щит атакующий получает `reflectPct` от нанесённого урона.

**Волна отталкивания (Lv3):** при окончании щита (ArenaRoom.ts:1498-1510) проверяется `burstRadiusM > 0`, затем вызывается `applyPushWave` с конфигом `push` level 1 в качестве параметров импульса.

---

### 4.3 pull / magnet (Притяжение)
**Класс:** Collector (slot0). В коде хранится как `"pull"`, конфиг читается из `abilities.magnet`.
**Класс-эксклюзив:** Да, только через slot0 Collector.

| Параметр | Lv1 | Lv2 | Lv3 |
|---|---:|---:|---:|
| massCostPct | 2% | 2% | 2% |
| cooldownSec | 7 | 7 | 7 |
| durationSec | 1.5 | 1.5 | 1.5 |
| radiusM | 120 | 150 | 150 |
| pullSpeedMps | 50 | 50 | 70 |

**Активация:**
1. Списывает массу
2. Устанавливает `magnetEndTick` = tick + durationSec * tickRate
3. Ставит `FLAG_MAGNETIZING`

**Логика притяжения:** обрабатывается в `orbSystem.ts` -- при `FLAG_MAGNETIZING` орбы в радиусе `magnetConfig.radiusM` двигаются к игроку со скоростью `pullSpeedMps`.

---

### 4.4 slow (Замедление)
**Общий пул.**

| Параметр | Lv1 | Lv2 | Lv3 |
|---|---:|---:|---:|
| massCostPct | 2% | 2% | 2% |
| cooldownSec | 7 | 7 | 7 |
| durationSec | 2 | 2 | 2 |
| radiusM | 80 | 100 | 100 |
| slowPct | 0.30 | 0.30 | 0.40 |

**Активация:**
1. Списывает массу
2. Создаёт объект `SlowZone` в `room.state.slowZones`
3. Зона привязана к координатам игрока в момент создания (НЕ следует за ним)
4. `endTick` = tick + durationSec * tickRate

**Механика замедления** (effectSystems.ts:slowZoneSystem):
- Не замедляет владельца зоны
- Суммарное замедление от нескольких зон складывается
- Капается на `0.80` (80% max slow)
- Добавляет `FLAG_SLOWED`

---

### 4.5 projectile (Выброс)
**Общий пул.**

| Параметр | Lv1 | Lv2 | Lv3 |
|---|---:|---:|---:|
| massCostPct | 2% | 2% | 2% |
| cooldownSec | 3 | 3 | 3 |
| speedMps | 400 | 400 | 400 |
| rangeM | 300 | 300 | 300 |
| damagePct | 0.15 | 0.18 | 0.18 |
| radiusM | 8 | 8 | 8 |
| piercingHits | 0 | 0 | 2 |
| piercingDamagePct | 0 | 0 | 0.6 |

**Активация:**
1. Списывает массу
2. Создаёт объект `Projectile` с `projectileType = 0` (по умолчанию)
3. Направление: `cos/sin(player.angle) * speedMps`
4. Если `mod_projectileRicochet > 0`: `remainingRicochets` = round(mod_projectileRicochet)
5. Пробивание: `max(basePierceHits, talentPierceHits)` -- талант и уровень НЕ суммируются, берётся максимум

**Снаряд (abilitySystem.ts:projectileSystem):**
- Движется каждый тик: `proj.x += proj.vx * dt`
- Удаляется при: достижении maxRangeM, выходе за границы мира, попадании в препятствие, попадании в игрока
- Рикошет от стен: если `projectileType === 0` и `remainingRicochets > 0` -- отражение скорости, обнуление пройденной дистанции
- Пробивание: при попадании `remainingPierces -= 1`, после первого пробития `damagePct *= piercingDamagePct`
- Не попадает по владельцу, мёртвым, lastBreath, неуязвимым

---

### 4.6 spit (Плевок)
**Общий пул.**

| Параметр | Lv1 | Lv2 | Lv3 |
|---|---:|---:|---:|
| massCostPct | 3% | 3% | 3% |
| cooldownSec | 4 | 4 | 4 |
| speedMps | 350 | 350 | 350 |
| rangeM | 200 | 200 | 200 |
| damagePct | 0.08 | 0.08 | 0.092 |
| radiusM | 6 | 6 | 6 |
| projectileCount | 3 | 4 | 4 |
| spreadAngleDeg | 30 | 30 | 30 |

**Активация:**
1. Списывает массу один раз (за весь веер)
2. Создаёт `projectileCount` снарядов, распределённых равномерно по углу `spreadAngleDeg`
3. Формула угла: `startAngle = player.angle - spreadRad/2`, шаг = `spreadRad / (count - 1)`
4. Все снаряды имеют `projectileType = 0`

---

### 4.7 bomb (Бомба)
**Общий пул.**

| Параметр | Lv1 | Lv2 | Lv3 |
|---|---:|---:|---:|
| massCostPct | 4% | 4% | 4% |
| cooldownSec | 6 | 6 | 5 |
| speedMps | 200 | 200 | 200 |
| rangeM | 250 | 250 | 250 |
| damagePct | 0.12 | 0.12 | 0.12 |
| radiusM | 10 | 10 | 10 |
| explosionRadiusM | 50 | 70 | 70 |

**Активация:**
1. Списывает массу
2. Создаёт `Projectile` с `projectileType = 1` (бомба)
3. При достижении maxRangeM, попадании в стену, препятствие или игрока -- `room.explodeBomb(proj)`
4. `explodeBomb` -- AoE урон всем в `explosionRadiusM` (в combatSystem.ts)

---

### 4.8 push (Отталкивание)
**Общий пул.**

| Параметр | Lv1 | Lv2 | Lv3 |
|---|---:|---:|---:|
| massCostPct | 3% | 3% | 3% |
| cooldownSec | 6 | 6 | 6 |
| radiusM | 80 | 100 | 100 |
| impulseNs | 50000 | 50000 | 65000 |
| minSpeedMps | 30 | 30 | 30 |
| maxSpeedMps | 120 | 120 | 150 |

**Активация:**
1. Списывает массу
2. Устанавливает `pushEndTick` = tick + 0.25 * tickRate (захардкожено 0.25 сек)
3. Вызывает `applyPushWave`

**applyPushWave** (экспортируемая функция):
- Воздействует на: слаймов, орбы, сундуки
- Для слаймов: `speed = clamp(impulseNs / mass, minSpeedMps, maxSpeedMps)`
- Для орбов: `speed = clamp(impulseNs / orbMass, 50, 200)` -- захардкожены мин/макс
- Для сундуков: `speed = clamp(impulseNs / chestMass, 20, 80)` -- захардкожены мин/макс
- Не воздействует на владельца (`excludeId`)

---

### 4.9 mine (Мина)
**Общий пул.**

| Параметр | Lv1 | Lv2 | Lv3 |
|---|---:|---:|---:|
| massCostPct | 2% | 2% | 2% |
| cooldownSec | 10 | 10 | 10 |
| damagePct | 0.15 | 0.15 | 0.20 |
| radiusM | 15 | 15 | 15 |
| durationSec | 20 | 20 | 20 |
| maxMines | 1 | 2 | 2 |

**Активация:**
1. Подсчитывает текущие мины игрока
2. Если `mineCount >= config.maxMines` -- удаляет САМУЮ СТАРУЮ мину (первую найденную в итераторе)
3. Списывает массу
4. Создаёт `Mine` в `room.state.mines`

**Детонация (mineSystem):**
- Каждый тик проверяет коллизии с игроками
- Не срабатывает на владельца, мёртвых, lastBreath, неуязвимых
- При контакте: `applyProjectileDamage(owner, player, mine.damagePct)`
- Удаляется при истечении `endTick` или детонации

---

## 5. Система талантов

### 5.1 TalentGenerator -- алгоритм генерации карточек

Файл: `server/src/rooms/systems/talent/TalentGenerator.ts`

**Входные данные:**
- `player` -- текущий игрок (его таланты, способности, класс, уровень)
- `talentConfig` -- пул талантов, веса редкостей, таймаут
- `balance` -- конфиги всех талантов (common, rare, epic, classTalents)
- `deps` -- Rng, текущий тик, вспомогательные функции

**Алгоритм:**

1. **Определение весов редкостей** по уровню игрока:
   - Ключ: `min(player.level, 7)`, если нет -- fallback к `"2"`
   - Например, level 4: `{ common: 70, rare: 28, epic: 2 }`

2. **Сбор доступных талантов** по редкостям:
   - Для каждого таланта проверяется: (a) конфиг существует, (b) требование выполнено, (c) не на макс. уровне
   - Классовые таланты добавляются в отдельный список И в общий пул (в rare или epic)

3. **Сбор улучшений способностей** (только если все 3 слота заняты):
   - Для каждого слота с `level < 3` создаётся `UpgradeItem` с ID `"ability:${abilityId}:${nextLevel}"`
   - Редкость улучшения: `0` (common)

4. **Формирование 3 карточек:**
   - **Первый слот:** приоритет классовому таланту (если доступен); иначе -- обычный pickTalent
   - **Остальные слоты:** с вероятностью `abilityUpgradeChance` (0.5 по умолчанию) -- улучшение, иначе -- талант
   - **Гарантия:** минимум 1 талант в наборе (`needsTalent` проверка)

5. **pickTalent -- выбор таланта:**
   - Бросок `rng.next() * 100` -> определение целевой редкости по весам
   - Фильтрация кандидатов: не дубли, не более 2 из одной категории
   - Если кандидатов нет -- выбор из всех доступных

6. **Создание TalentCard:**
   - `option0`, `option1`, `option2` -- ID выбранных элементов
   - `rarity0`, `rarity1`, `rarity2` -- редкость (0=common, 1=rare, 2=epic)
   - `expiresAtTick` = currentTick + secondsToTicks(cardChoiceTimeoutSec)

### 5.2 Редкости и веса (common, rare, epic, class)

| Уровень | common (%) | rare (%) | epic (%) |
|---:|---:|---:|---:|
| 2 | 100 | 0 | 0 |
| 3 | 85 | 15 | 0 |
| 4 | 70 | 28 | 2 |
| 5 | 60 | 35 | 5 |
| 6 | 50 | 40 | 10 |
| 7+ | 40 | 45 | 15 |

Классовые таланты имеют фиксированную редкость: `"rare"` -> rarity=1, `"epic"` -> rarity=2.

### 5.3 TalentModifierCalculator -- как таланты модифицируют mod_* поля

Файл: `server/src/rooms/systems/talent/TalentModifierCalculator.ts`

**Алгоритм `recalculateTalentModifiers`:**
1. Обнуляет ВСЕ mod_* поля до дефолтов (0 или 1 для мультипликаторов)
2. Итерирует `player.talents`
3. Для каждого таланта: находит конфиг через `getTalentConfig`, извлекает `values[level-1]`
4. Вызывает `applyTalentEffect(player, config.effect, value)`
5. Капает `biteResistPct` на 0.5 (50% максимум)

**Важно:** дефолт `mod_respawnMass = 100`, `mod_doubleAbilitySecondCostMult = 1`, `mod_leviathanRadiusMul = 1`, `mod_leviathanMouthMul = 1`, `mod_toxicPoolBonus = 1`.

**Поиск конфига таланта `getTalentConfig`:**
1. common[talentId] -> rare[talentId] -> epic[talentId] -> classTalents[className][talentId]

### 5.4 TalentCard -- выбор из 3, автовыбор

**talentCardSystem** (talentCardSystem.ts):
- Проверяет `player.pendingTalentCard`
- При смерти: приостановка таймера (`expiresAtTick += 1`)
- При нажатии `talentChoicePressed2`: `room.applyTalentCardChoice(player, index)`
- При таймауте: `room.forceAutoPickTalent(player)`

**applyTalentCardChoice** (ArenaRoom.ts:2327):
1. Извлекает `chosen` из `options[choiceIndex]`
2. Если chosen -- `"ability:xxx:N"` -> `applyAbilityUpgrade` (повышает уровень способности)
3. Иначе -> `addTalentToPlayer` (добавляет/повышает уровень таланта)
4. Очищает `pendingTalentCard`, генерирует следующую из очереди

**forceAutoPickTalent** (ArenaRoom.ts:2501):
1. Пропускает UpgradeItem (предпочитает таланты)
2. Для каждого таланта: получает `category`, вычисляет `score = priorities[category]`
3. Выбирает талант с наивысшим score
4. Если талантов нет -- fallback на первый непустой вариант

**Приоритеты автовыбора по классам:**
```json
{
  "hunter":    { "speed": 3, "damage": 2, "defense": 1, "gather": 1 },
  "warrior":   { "defense": 3, "damage": 2, "speed": 1, "gather": 1 },
  "collector": { "gather": 3, "defense": 2, "speed": 1, "damage": 1 }
}
```

---

## 6. Полный список талантов

### 6.1 Обычные (common)

| ID | Имя | maxLevel | values | effect | category | mod_* поля |
|---|---|---:|---|---|---|---|
| `fastLegs` | Быстрые ноги | 3 | [0.10, 0.18, 0.25] | `speedLimitBonus` | speed | `mod_speedLimitBonus` += value |
| `spinner` | Юла | 3 | [0.10, 0.18, 0.25] | `turnBonus` | speed | `mod_turnBonus` += value |
| `sharpTeeth` | Острые зубы | 3 | [0.15, 0.25, 0.35] | `biteDamageBonus` | damage | `mod_biteDamageBonus` += value |
| `glutton` | Обжора | 3 | [0.20, 0.35, 0.50] | `orbMassBonus` | gather | `mod_orbMassBonus` += value |
| `thickSkin` | Толстая шкура | 3 | [0.12, 0.20, 0.27] | `biteResistBonus` | defense | `biteResistPct` += value (cap 0.5) |
| `economical` | Экономный | 3 | [0.15, 0.25, 0.33] | `abilityCostReduction` | gather | `mod_abilityCostReduction` += value |
| `recharge` | Перезарядка | 3 | [0.15, 0.25, 0.33] | `cooldownReduction` | speed | `mod_cooldownReduction` += value |
| `aggressor` | Агрессор | 1 | [0.12] | `aggressorDual` | damage | `mod_damageBonus` += value, `mod_damageTakenBonus` += value |
| `sturdy` | Стойкий | 1 | [0.10] | `allDamageReduction` | defense | `mod_allDamageReduction` += value |
| `accelerator` | Ускоритель | 1 | [0.15] | `thrustForwardBonus` | speed | `mod_thrustForwardBonus` += value |
| `anchor` | Якорь | 1 | [0.20] | `thrustReverseBonus` | defense | `mod_thrustReverseBonus` += value |
| `crab` | Краб | 1 | [0.15] | `thrustLateralBonus` | speed | `mod_thrustLateralBonus` += value |
| `bloodlust` | Кровожадность | 1 | [0.15] | `killMassBonus` | damage | `mod_killMassBonus` += value |
| `secondWind` | Второе дыхание | 1 | [150] | `respawnMass` | defense | `mod_respawnMass` = value (перезаписывает!) |
| `sense` | Чутьё | 2 | [2, 5] | `chestSense` | gather | **НЕ РЕАЛИЗОВАН** -- effect отсутствует в applyTalentEffect |
| `regeneration` | Регенерация | 2 | [[0.01,5], [0.01,4]] | `outOfCombatRegen` | defense | **НЕ РЕАЛИЗОВАН** -- effect отсутствует в applyTalentEffect |

### 6.2 Редкие (rare)

| ID | Имя | maxLevel | values | effect | requirement | category | mod_* поля |
|---|---|---:|---|---|---|---|---|
| `poison` | Яд | 2 | [[0.02,3], [0.03,3]] | `poisonOnBite` | -- | damage | `mod_poisonDamagePctPerSec`, `mod_poisonDurationSec` |
| `frost` | Мороз | 2 | [[0.30,2], [0.40,2.5]] | `frostOnBite` | -- | damage | `mod_frostSlowPct`, `mod_frostDurationSec` |
| `vampire` | Вампир | 1 | [[0.20, 0.25]] | `vampireBite` | -- | gather | `mod_vampireSideGainPct`, `mod_vampireTailGainPct` |
| `vacuum` | Вакуум | 2 | [[40,15], [60,20]] | `vacuumOrbs` | -- | gather | `mod_vacuumRadius`, `mod_vacuumSpeed` |
| `motor` | Мотор | 1 | [0.25] | `allThrustBonus` | -- | speed | `mod_thrustForwardBonus` += v, `mod_thrustReverseBonus` += v, `mod_thrustLateralBonus` += v |
| `ricochet` | Рикошет | 1 | [1] | `projectileRicochet` | `projectile` | damage | `mod_projectileRicochet` = value |
| `piercing` | Пробивание | 1 | [[1.0, 0.6]] | `projectilePiercing` | `projectile` | damage | `mod_projectilePiercingHits` = 1 + value[0], `mod_projectilePiercingDamagePct` = value[1] |
| `longDash` | Длинный рывок | 1 | [0.40] | `dashDistanceBonus` | `dash` | speed | `mod_dashDistanceBonus` += value |
| `backNeedles` | Иглы назад | 1 | [[3, 0.10]] | `deathNeedles` | -- | damage | `mod_deathNeedlesCount`, `mod_deathNeedlesDamagePct` |
| `toxic` | Токсичный | 1 | [2.0] | `toxicPoolBonus` | -- | damage | `mod_toxicPoolBonus` = value (перезаписывает!) |

### 6.3 Эпические (epic)

| ID | Имя | maxLevel | values | effect | requirement | category | mod_* поля |
|---|---|---:|---|---|---|---|---|
| `lightning` | Молния | 1 | [[0.25, 0.3]] | `lightningSpeed` | -- | speed | `mod_lightningSpeedBonus`, `mod_lightningStunSec` |
| `doubleActivation` | Двойная активация | 1 | [[1.0, 0.80]] | `doubleAbility` | -- | damage | `mod_doubleAbilityWindowSec`, `mod_doubleAbilitySecondCostMult` |
| `explosion` | Взрыв | 1 | [[60, 0.08]] | `deathExplosion` | -- | damage | `mod_deathExplosionRadiusM`, `mod_deathExplosionDamagePct` |
| `leviathan` | Левиафан | 1 | [[1.3, 1.5]] | `leviathanSize` | -- | defense | `mod_leviathanRadiusMul`, `mod_leviathanMouthMul` |
| `invisible` | Невидимка | 1 | [1.5] | `invisibleAfterDash` | `dash` | speed | `mod_invisibleDurationSec` = value |

### 6.4 Классовые таланты

**Hunter:**
| ID | Имя | maxLevel | values | effect | rarity | requirement | mod_* |
|---|---|---:|---|---|---|---|---|
| `ambush` | Засада | 1 | [0.30] | `ambushDamage` | rare | -- | `mod_ambushDamage` = value |
| `hunterInvisible` | Невидимка | 1 | [1.5] | `invisibleAfterDash` | epic | `dash` | `mod_invisibleDurationSec` = value |

**Warrior:**
| ID | Имя | maxLevel | values | effect | rarity | requirement | mod_* |
|---|---|---:|---|---|---|---|---|
| `indestructible` | Несокрушимый | 1 | [0.15] | `allDamageReduction` | rare | -- | `mod_allDamageReduction` += value |
| `thorns` | Шипы | 1 | [0.10] | `thornsDamage` | rare | -- | `mod_thornsDamage` = value |

**Collector:**
| ID | Имя | maxLevel | values | effect | rarity | requirement | mod_* |
|---|---|---:|---|---|---|---|---|
| `parasite` | Паразит | 1 | [0.05] | `parasiteMass` | rare | -- | `mod_parasiteMass` = value |
| `magnet` | Магнит | 1 | [[50, 10]] | `magnetOrbs` | rare | -- | `mod_magnetRadius`, `mod_magnetSpeed` |

---

## 7. Классы (Hunter, Warrior, Collector)

### 7.1 Пассивные отличия

| Параметр | Hunter (classId=0) | Warrior (classId=1) | Collector (classId=2) |
|---|---|---|---|
| `speedMult` | 1.15 (+15%) | 0.9 (-10%) | 1.0 |
| `damageVsSlimeMult` | -- | 1.1 (+10%) | -- |
| `eatingPowerMult` | -- | -- | 1.25 (+25%) |
| `swallowLimit` | 50 | 45 | 70 |
| `biteFraction` | 0.3 | 0.35 | 0.5 |

### 7.2 Классовые способности

| Класс | Способность | ID в слоте | ID в конфиге |
|---|---|---|---|
| Hunter | Рывок | `dash` | `abilities.dash` |
| Warrior | Щит | `shield` | `abilities.shield` |
| Collector | Притяжение | `pull` | `abilities.magnet` |

### 7.3 Классовые таланты

- **Hunter:** ambush (rare), hunterInvisible (epic)
- **Warrior:** indestructible (rare), thorns (rare)
- **Collector:** parasite (rare), magnet (rare)

**Механика классовых талантов в генераторе:**
- Классовые таланты добавляются и в отдельный список, и в общий пул (rare/epic)
- Первый слот карточки: приоритет классовому таланту (если доступен)
- Это гарантирует появление хотя бы 1 классового таланта

---

## 8. Эффекты (effectSystems.ts)

### 8.1 slowZoneSystem
- Удаляет зоны с `endTick <= tick`
- Для каждого живого игрока суммирует замедление от SlowZone (кроме своих), ToxicPool, Frost
- Cap: 80% суммарного замедления
- Устанавливает `player.slowPct` и `FLAG_SLOWED`

**Frost** (от таланта frost):
- `frostEndTick`, `frostSlowPct` -- устанавливаются при укусе (в combatSystem)
- По истечении обнуляются

### 8.2 toxicPoolSystem
- Удаляет лужи с `endTick <= tick`
- Наносит DoT: `massLoss = player.mass * totalDamagePctPerSec * dt * damageTakenMult`
- Не наносит урон игрокам с `FLAG_ABILITY_SHIELD`, неуязвимым, мёртвым, lastBreath
- Проверяет `tryConsumeGuard` (буст Guard поглощает удар)

**Параметры из balance.json:**
```json
"toxicPools": { "radiusM": 20, "durationSec": 3, "damagePctPerSec": 0.01, "slowPct": 0.2 }
```

### 8.3 statusEffectSystem
- Обрабатывает отравление (poison):
  - `poisonEndTick > tick && poisonDamagePctPerSec > 0`: DoT аналогично toxicPool
  - По истечении обнуляет `poisonEndTick`, `poisonDamagePctPerSec`, `poisonTickAccumulator`
- Не наносит урон с `FLAG_ABILITY_SHIELD`, неуязвимым

### 8.4 zoneEffectSystem
- Обрабатывает зоны на карте (ZONE_TYPE_NECTAR, ZONE_TYPE_LAVA):
  - **Nectar:** `massGainPctPerSec` * player.mass * dt -> applyMassDelta (положительная)
  - **Lava:** `damagePctPerSec` * player.mass * dt * damageTakenMult -> applyMassDelta (отрицательная) + spawnLavaOrbs
- Ice и Turbo зоны обрабатываются в movementSystems.ts (через множители)

---

## 9. Захардкоженные значения

| Значение | Место | Описание |
|---|---|---|
| `0.25 сек` | activatePush, строка 544 | Длительность визуального эффекта push |
| `0.9` | getAbilityCostPct, строка 206 | Максимальный cap снижения стоимости |
| `0.01` | getAbilityCostPct, строка 208 | Минимальная стоимость способности (1%) |
| `0.9` | getAbilityCooldownSec, строка 212 | Максимальный cap снижения cooldown |
| `0.1 сек` | getAbilityCooldownSec, строка 213 | Минимальный cooldown |
| `50, 200` | applyPushWave, строка 510 | Min/max скорость отброса орбов |
| `20, 80` | applyPushWave, строка 525 | Min/max скорость отброса сундуков |
| `0.80` | slowZoneSystem, строка 52 | Cap суммарного замедления |
| `0.5` | recalculateTalentModifiers, строка 121 | Cap biteResistPct |
| `100` | recalculateTalentModifiers, строка 62 | Дефолт mod_respawnMass |
| `1` | recalculateTalentModifiers, строка 78 | Дефолт mod_doubleAbilitySecondCostMult |
| `1` | recalculateTalentModifiers, строки 81-82 | Дефолт mod_leviathanRadiusMul, mod_leviathanMouthMul |
| `1` | recalculateTalentModifiers, строка 86 | Дефолт mod_toxicPoolBonus |
| `3` | balance.json server.globalCooldownTicks | GCD в тиках (вычисляется из globalCooldownMs=100) |
| `12 сек` | talents.cardChoiceTimeoutSec | Таймаут автовыбора карточки |
| `3` | talents.cardQueueMax | Максимум карточек в очереди |
| `0.5` | talents.abilityUpgradeChance | Шанс апгрейда способности в карточке |

---

## 10. Расхождения с документацией

### 10.1 Нереализованные таланты

| ID | Имя | В balance.json | В TalentModifierCalculator | В пуле talentPool | Статус |
|---|---|---|---|---|---|
| `sense` | Чутьё | Да, effect=`chestSense` | **НЕТ** -- case отсутствует | Да (common) | **Можно выбрать, но ничего не делает** |
| `regeneration` | Регенерация | Да, effect=`outOfCombatRegen` | **НЕТ** -- case отсутствует | Да (common) | **Можно выбрать, но ничего не делает** |
| `momentum` | Разгон | **НЕТ** в balance.json | НЕТ | НЕТ | Только в GDD и клиентских описаниях |
| `berserk` | Берсерк | **НЕТ** в balance.json | НЕТ | НЕТ | Только в GDD и клиентских описаниях |
| `symbiosisBubbles` | Симбиоз | **НЕТ** в balance.json | НЕТ | НЕТ | Только в GDD |

### 10.2 Расхождения в названиях и маппинге

| Аспект | GDD | Код | Комментарий |
|---|---|---|---|
| Притяжение (ID) | "Притяжение" | `pull` в слоте, `magnet` в конфиге | Двойной маппинг в getAbilityConfigById |
| Замедление (ID) | "slowField" в GDD | `slow` в коде | GDD упоминает slowField, код использует slow |
| Невидимка (классовый) | Только Hunter | `invisible` в epic-пуле (общий) + `hunterInvisible` (классовый) | Два варианта: общий epic требует dash, классовый тоже |
| Несокрушимый | "Несокрушимый" = -15% потери | `indestructible` effect=`allDamageReduction` | Использует тот же effect что и `sturdy`, значения стекаются |

### 10.3 GDD упоминает, но не реализовано

| GDD | Описание | Статус в коде |
|---|---|---|
| Разгон (Охотник) | +5% к скорости за секунду движения | Не реализован, нет в balance.json |
| Берсерк (Воин) | +3% к урону за 100 кг потерь | Не реализован, нет в balance.json |
| Симбиоз (Собиратель) | +50% пузырей при укусе слайма | Не реализован, нет в balance.json |
| Вакуум уровень 2 | "Радиус 60 м, 20 м/с" | Реализован корректно |
| Магнит уровень 2 | "Радиус 70 м, 15 м/с" | Нет в balance.json -- magnet maxLevel=1 |

### 10.4 Расхождения в числах

| Параметр | GDD | balance.json | Расхождение |
|---|---|---|---|
| GDD gcdTicks | 3 тика | Вычисляется: 100ms / 33.33ms = 3 | Совпадает |
| GDD matchDurationSec | 180 | 90 | **Расхождение** -- match сокращён до 90 сек |
| GDD фазы | 0-60, 60-120, 120-180 | 0-30, 30-60, 60-90 | **Расхождение** -- пропорционально сокращены |
| Мороз Lv2 frost | -40%, 2.5 сек | [0.40, 2.5] | Совпадает |
| Вампир | "бок 10%->20%, хвост 15%->25%" | [0.20, 0.25] | Совпадает (новые значения) |
| `economical` category | GDD: "Экономный" | balance: `"gather"` | GDD не указывает категорию, но gather -- спорно |
| `recharge` category | GDD: "Перезарядка" | balance: `"speed"` | GDD не указывает категорию |

---

## 11. Технический долг

1. **sense и regeneration -- "мёртвые" таланты.** Присутствуют в пуле common, могут быть выбраны игроком, но эффекты `chestSense` и `outOfCombatRegen` не реализованы в `applyTalentEffect`. Игрок получает бесполезный талант.

2. **momentum, berserk, symbiosisBubbles -- не определены.** GDD описывает 3 классовых таланта (по 1 сложному на класс), но они не существуют в balance.json и не реализованы нигде. Клиент содержит только описания для UI (`client/src/main.ts:335,341`).

3. **Дублирование `invisible` и `hunterInvisible`.** В эпическом пуле есть `invisible` (с requirement="dash"), и у Hunter есть классовый `hunterInvisible` с идентичным эффектом. Фактически Hunter может получить оба, но они перезаписывают одно и то же поле `mod_invisibleDurationSec`.

4. **`pull` / `magnet` двойной маппинг.** В слоте хранится `"pull"`, но конфиг в `abilities.magnet`. `getAbilityConfigById` обрабатывает оба варианта, но это неочевидно и потенциально хрупко.

5. **push визуальная длительность захардкожена** в `activatePush`: `0.25 * tickRate` тиков. Не параметризована в balance.json.

6. **applyPushWave -- захардкоженные лимиты для орбов и сундуков.** Скорость отброса орбов: [50, 200], сундуков: [20, 80] -- не в balance.json.

7. **respawnMass и toxicPoolBonus -- перезаписывают вместо аддитивности.** `applyTalentEffect("respawnMass", value)` делает `player.mod_respawnMass = value`, а не `+= value`. При нескольких талантах с этим эффектом последний выигрывает.

8. **Типизация `any`.** Все системы (abilityActivationSystem, abilitySystem, effectSystems, talentCardSystem) принимают `room: any` -- нет типобезопасности.

9. **magnet (классовый талант Collector) maxLevel=1.** GDD описывает 2 уровня (50м/10мпс и 70м/15мпс), но в balance.json maxLevel=1. Второй уровень не реализован.

---

## 12. Заметки для форка BonkRace

### Способности -> Power-ups гонки

| Slime Arena | BonkRace аналог | Заметки |
|---|---|---|
| dash | Нитро-буст | Мгновенное ускорение вперёд |
| shield | Щит / Иммунитет | Защита от попаданий на N секунд |
| slow | Масляное пятно | Зона замедления на трассе |
| projectile | Ракета | Одиночный снаряд вперёд |
| spit | Шрапнель | Веер снарядов |
| bomb | Бомба | AoE взрыв |
| push | Ударная волна | Отталкивание в радиусе |
| mine | Шип-ловушка | Оставляется на трассе |
| pull/magnet | Магнит монет | Притяжение бонусов |

### Таланты -> Апгрейды машины

| Категория | Slime Arena | BonkRace |
|---|---|---|
| speed | fastLegs, spinner | Двигатель, шины |
| damage | sharpTeeth, aggressor | Таран, вооружение |
| defense | thickSkin, sturdy | Броня, амортизация |
| gather | glutton, vacuum | Магнит монет, бонусный множитель |

### Классы -> Типы машин

| Slime Arena | BonkRace |
|---|---|
| Hunter (+15% скорость, dash) | Спорткар (скорость, нитро) |
| Warrior (+10% урон, shield, -10% скорость) | Броневик (прочность, щит) |
| Collector (+25% сбор, magnet) | Грузовик (сбор ресурсов, магнит) |

**Ключевые адаптации:**
- Способности становятся подбираемыми power-ups на трассе вместо слотовой системы.
- Таланты -> перманентные апгрейды между гонками (гараж).
- GCD заменяется cooldown-ом power-ups.
- Масса заменяется очками здоровья или позицией.
