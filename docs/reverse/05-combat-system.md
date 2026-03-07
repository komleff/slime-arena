# Reverse: Combat System
**Версия:** v0.8.7 (425d333) | **Дата:** 2026-03-07

---

## 1. Обзор

Боевая система Slime Arena реализована как набор ECS-подобных систем (functions), вызываемых на каждом тике сервера (30 FPS). Масса = HP: слайм гибнет при `mass <= minSlimeMass` (50 кг). Все расчёты авторитетны (серверные), клиент получает только результат.

Ключевые принципы:
- **Mass conservation** — масса не создаётся из воздуха. При укусе `victimLoss = attackerGain + scatterMass`.
- **Zone-based combat** — попадание определяется зонами слайма (mouth / side / tail).
- **Last Breath** — защита от мгновенной смерти: если масса падает ниже `minSlimeMass`, включается кратковременная неуязвимость.
- **Invulnerability frames (i-frames)** — после получения урона кратковременная неуязвимость (0.2 сек).
- **GCD (Global Cooldown)** — между укусами и умениями действует общий кулдаун (`globalCooldownTicks`).

---

## 2. Исходные файлы

| Файл | Назначение |
|---|---|
| `server/src/rooms/systems/combatSystem.ts` | PvP укус (`processCombat`), отражение щитом, урон снарядом, самоурон, взрыв бомбы, спаун scatter-орбов |
| `server/src/rooms/systems/deathSystem.ts` | Проверка смерти (mass <= min), обработка Last Breath таймера, триггер респауна |
| `server/src/rooms/systems/hungerSystem.ts` | Потеря массы за пределами hotZone во время Hunt/Final фаз |
| `server/src/rooms/systems/rebelSystem.ts` | Назначение повстанца (лидера по массе) |
| `server/src/rooms/systems/orbSystem.ts` | Спаун/обновление орбов, притяжение (magnet/vacuum/талант) |
| `server/src/rooms/systems/safeZoneSystem.ts` | Урон за пределами безопасных зон в финале |
| `server/src/rooms/systems/boostSystem.ts` | Таймеры и расход зарядов бустов (rage, haste, guard, greed) |
| `server/src/rooms/systems/playerStateManager.ts` | `handlePlayerDeath`, `handlePlayerRespawn`, `updatePlayerLevel` |
| `server/src/rooms/ArenaRoom.ts` | Вспомогательные методы: `getContactZone`, `getClassStats`, `getDamageBonusMultiplier`, `getDamageTakenMultiplier`, `applyMassDelta`, `tryConsumeGuard`, `clearBoost`, `applyBoost` |
| `config/balance.json` | Все параметры баланса |

---

## 3. PvP Бой (processCombat)

### 3.1. Условия попадания

Функция `processCombat(room, attacker, defender, dx, dy)` вызывается из collisionSystem при контакте двух игроков.

**Предусловия (ранний выход):**
1. `attacker.isDead || defender.isDead` — мёртвые не атакуют/не получают урон
2. `attacker.stunEndTick > room.tick` — атакующий оглушён
3. `room.tick < attacker.lastAttackTick + room.attackCooldownTicks` — кулдаун атаки
4. `room.tick < attacker.gcdReadyTick` — глобальный кулдаун (GCD)
5. `room.tick < defender.invulnerableUntilTick` — неуязвимость жертвы (укус не проходит, но GCD применяется к атакующему)

**Определение зон:**
```
getContactZone(attacker, dx, dy):
  angleToTarget = atan2(dy, dx)
  diff = normalizeAngle(angleToTarget - attacker.angle)
  mouthHalf = getMouthHalfAngle(attacker)  // balance.combat.mouthArcDeg / 2, модифицировано Leviathan
  tailHalf = balance.combat.tailArcDeg / 2

  |diff| <= mouthHalf  → "mouth"
  |diff| >= PI - tailHalf → "tail"
  иначе → "side"
```

**Обязательное условие:** зона атакующего ДОЛЖНА быть `"mouth"`. Если нет — выход.

**Mouth-to-mouth (рот в рот):**
Если зона защитника тоже `"mouth"`, укус проходит ТОЛЬКО если `attacker.mass > defender.mass * 1.1` (разница > 10%). Иначе — GCD и выход.

### 3.2. Расчёт урона (PvP Bite Formula)

```
attackerGain = attacker.mass * pvpBiteAttackerGainPct * combinedMult
scatterMass  = defender.mass * pvpBiteScatterPct * combinedMult
massLoss     = attackerGain + scatterMass
```

**combinedMult** = `zoneMultiplier * classStats.damageMult * damageBonusMult * damageTakenMult * (1 - totalResist)`

Где:
- `zoneMultiplier` = 1.0 (side), `tailDamageMultiplier` (tail), 1.0 (mouth)
- `classStats.damageMult` = бонус класса (Warrior = 1.1, остальные = 1.0)
- `damageBonusMult` = `(1 + mod_damageBonus + mod_biteDamageBonus) * rageDamageMultiplier`
  - Включает талант "Засада" (ambush): если `mod_ambushDamage > 0` и зона защитника `side` или `tail`, бонус добавляется аддитивно
- `damageTakenMult` = `(1 + mod_damageTakenBonus) * (1 - clamp(mod_allDamageReduction, 0, 0.9))`
- `totalResist` = `min(0.5, classStats.biteResistPct + defender.biteResistPct)` — cap 50%

### 3.3. Обработка Shield / Guard

**Порядок проверок (до применения урона):**
1. Если у защитника активен `FLAG_ABILITY_SHIELD` — вызывается `applyShieldReflection` (см. секцию 4)
2. Если у защитника активен Guard boost — `tryConsumeGuard` поглощает удар, заряд расходуется

### 3.4. Vampire Talents

После проверки щита, часть `scatterMass` перераспределяется в `attackerGain`:
- При укусе в `side`: если `mod_vampireSideGainPct > 0`, перенос = `(vampirePct - pvpBiteAttackerGainPct) * defender.mass * combinedMult`
- При укусе в `tail`: аналогично через `mod_vampireTailGainPct`
- Перенос ограничен текущим `scatterMass` (не уходит в минус)
- **Масса не создаётся:** бонус берётся ЗА СЧЁТ scatter

### 3.5. Last Breath

Если `newDefenderMass <= minSlimeMass` и Last Breath ещё не активен:
- Потеря ограничивается до `defender.mass - minSlimeMass`
- `attackerGain` и `scatterMass` масштабируются пропорционально (`scale = maxLoss / massLoss`)
- Устанавливается `isLastBreath = true`, `lastBreathEndTick`, `invulnerableUntilTick`

### 3.6. Mass Conservation Invariant

После `applyMassDelta(defender, -massLoss)`:
- Если фактическая потеря (`actualLoss`) < расчётной (`massLoss`) из-за clamp в `applyMassDelta`:
  - `attackerGain` и `scatterMass` масштабируются по `actualLoss / massLoss`
- Гарантия: атакующий получает + scatter = фактическая потеря жертвы

### 3.7. Дополнительные эффекты при укусе

**Thorns (Шипы, Warrior):**
```
reflectedDamage = actualLoss * defender.mod_thornsDamage
→ applyMassDelta(attacker, -reflectedDamage)
→ scatter orbs цвета АТАКУЮЩЕГО
```
Guard атакующего проверяется перед Thorns.

**Parasite (Паразит, Collector):**
```
stolenMass = actualLoss * attacker.mod_parasiteMass
→ applyMassDelta(attacker, +stolenMass)
```

**Scatter Orbs:**
Если `scatterMass > 0` — спавн PvP bite orbs цвета жертвы.

**Poison (Яд):**
```
defender.poisonDamagePctPerSec = max(текущий, attacker.mod_poisonDamagePctPerSec)
defender.poisonEndTick = max(текущий, tick + duration)
```
Яд **не стакается**, а перезаписывается на максимум.

**Frost (Мороз):**
```
defender.frostSlowPct = max(текущий, attacker.mod_frostSlowPct)
defender.frostEndTick = max(текущий, tick + duration)
```

**Lightning (Молния):**
```
defender.stunEndTick = max(текущий, tick + attacker.mod_lightningStunSec)
```

**Invisibility clear:**
Атакующий теряет невидимость (`clearInvisibility`) при любом укусе.

### 3.8. i-frames после укуса

Если Last Breath НЕ активирован:
```
defender.invulnerableUntilTick = room.tick + room.invulnerableTicks
```
Где `invulnerableTicks = secondsToTicks(balance.combat.damageInvulnSec)` = 0.2 сек.

---

## 4. Shield Reflection

Функция `applyShieldReflection(room, defender, attacker, incomingLoss)`.

**Предусловия:**
- `incomingLoss > 0`
- Атакующий жив и не в Last Breath
- Атакующий не в i-frames

**Механика:**
1. Получить уровень умения Shield у защитника
2. `reflectPct = shieldConfig.reflectDamagePct` (balance: level 1 = 0%, level 2-3 = 30%)
3. `reflectedDamage = incomingLoss * reflectPct`
4. Если у атакующего Guard — Guard поглощает
5. Иначе: `applyMassDelta(attacker, -reflectedDamage)`
6. Scatter orbs = `reflectedDamage * 0.5` цвета атакующего
7. Атакующий получает `lastDamagedById = defender.id`

**Важно:** Shield level 1 НЕ отражает урон (`reflectDamagePct = 0`). Отражение работает только на level 2+.

---

## 5. Projectile Damage

Функция `applyProjectileDamage(room, attacker, defender, damagePct)`.

**Формула:**
```
massLoss = defender.mass * damagePct * damageBonusMult * damageTakenMult * (1 - totalResist)
```

**Отличия от PvP Bite:**
- `damageBonusMult` вызывается с `includeBiteBonus = false` (не включает `mod_biteDamageBonus`)
- **Снаряд НЕ даёт массу атакующему** — только урон жертве
- Scatter orbs = `massLoss * 0.5` (половина от потерянной массы)
- `biteResistPct` применяется и к снарядам (cap 50%)
- Shield reflection и Guard работают так же как при укусе
- Last Breath работает так же

**i-frames после попадания:** `damageInvulnSec` (0.2 сек).

---

## 6. Bomb Explosion

Функция `explodeBomb(room, proj)`.

**Механика:**
1. Найти владельца снаряда (`proj.ownerId`)
2. Для каждого живого игрока (кроме владельца):
   - Пропустить мёртвых, в Last Breath, в i-frames
   - Проверить дистанцию: `dx^2 + dy^2 <= proj.explosionRadiusM^2`
   - Если в радиусе: `applyProjectileDamage(room, owner, player, proj.damagePct)`
3. Владелец бомбы **не получает урон** от своей бомбы

**Параметры из balance.json:**
| Уровень | `explosionRadiusM` | `damagePct` | `cooldownSec` |
|---|---|---|---|
| 1 | 50 | 12% | 6 |
| 2 | 70 | 12% | 6 |
| 3 | 70 | 12% | 5 |

**Knockback:** Бомба НЕ реализует knockback в `explodeBomb`. Импульс отталкивания, если он есть, должен обрабатываться отдельно (в текущем коде не обнаружен для bomb).

---

## 7. Self Damage

Функция `applySelfDamage(room, player, damagePct)`.

**Формула:**
```
massLoss = player.mass * damagePct
```

**Особенности:**
- НЕ применяются модификаторы урона (`damageBonusMult`, `damageTakenMult`, `biteResistPct`)
- НЕ применяется Shield/Guard
- Scatter orbs = `massLoss * 0.5` цвета игрока
- Last Breath работает
- i-frames после самоурона: `damageInvulnSec` (0.2 сек)

**Источники самоурона:** собственная мина (Mine ability).

---

## 8. Death System

Файл: `deathSystem.ts` + `playerStateManager.ts`.

### 8.1. Тик системы смерти

Вызывается каждый тик. Для каждого игрока:
1. Если `isLastBreath` и `tick >= lastBreathEndTick` → сбросить Last Breath
2. Если `!isDead && mass <= minSlimeMass && !isLastBreath` → `handlePlayerDeath`
3. Если `isDead && tick >= respawnAtTick` → `handlePlayerRespawn`

### 8.2. handlePlayerDeath

**Порядок операций:**
1. Установить `isDead = true`, `isLastBreath = false`
2. `respawnAtTick = tick + respawnDelayTicks`
3. Обнулить скорость, ввод, невидимость, doubleAbility
4. Очистить boost
5. **Kill credit:** если `lastDamagedById` указывает на живого игрока — `killer.killCount++`, `awardKillMass`
6. Логирование `player_death`
7. Сброс `lastDamagedById`
8. **Спецэффекты при смерти:**
   - `spawnDeathExplosion` — AoE взрыв (талант Explosion)
   - `spawnDeathNeedles` — иглы (талант backNeedles)
   - `spawnToxicPool` — токсичная лужа
9. **Scatter orbs при смерти:**
   - Масса = `player.mass * death.massToOrbsPercent` (30%)
   - Количество = `death.orbsCount` (4), с проверкой minOrbMass
   - Разлёт на 360 градусов, spread = 30 ед., скорость = 150 м/с
   - Цвет = `getDamageOrbColorId` (classId + 10, или золотой для Rebel)
   - Используется `forceSpawnOrb` (игнорирует maxCount)

### 8.3. handlePlayerRespawn

**Порядок операций:**
1. `isDead = false`, `isLastBreath = false`
2. Масса: `max(max(minRespawnMass, mod_respawnMass), mass * (1 - massLostPercent))`
   - `minRespawnMass` = 100 (balance.json)
   - `massLostPercent` = 50% (balance.json)
   - Талант "Второе дыхание" увеличивает `mod_respawnMass`
3. Случайная позиция через `findSpawnPoint`
4. Сброс: скорость, stun, frost, poison, invisibility, slow, boost, doubleAbility, pendingLavaScatterMass
5. `invulnerableUntilTick = tick + respawnShieldTicks` (5.0 сек)
6. GCD сбрасывается: `gcdReadyTick = tick`

### 8.4. Параметры смерти (balance.json → death)

| Параметр | Значение | Описание |
|---|---|---|
| `respawnDelaySec` | 2 | Задержка перед респауном |
| `massLostPercent` | 0.5 | Потеря массы при смерти (50%) |
| `massToOrbsPercent` | 0.3 | Масса, переходящая в орбы (30%) |
| `orbsCount` | 4 | Количество орбов при смерти |
| `minRespawnMass` | 100 | Минимальная масса при респауне |

---

## 9. Orb System

Файл: `orbSystem.ts`.

### 9.1. Спаун орбов (natural spawn)

Вызывается каждый тик в `updateOrbs`:
- Интервал: `orbSpawnIntervalTicks` (из `orbs.respawnIntervalSec` = 0.5 сек)
- Условие: `orbs.size < orbs.maxCount` (maxCount = 15)
- `spawnMultiplier` = `getOrbSpawnMultiplier()` (увеличивается в hotZones)
- Количество: `floor(spawnMultiplier)` + случайный +1 с вероятностью дробной части
- Позиция: случайная точка через `randomOrbSpawnPoint()`

### 9.2. Scatter Orbs (PvP)

Функция `spawnPvPBiteOrbs(room, x, y, totalMass, colorId)`:
- `count` = `pvpBiteScatterOrbCount` (3)
- `minOrbMass` = `scatterOrbMinMass` (5)
- Если `totalMass < minOrbMass` — орбы не создаются
- Если `perOrbMass < minOrbMass` — количество уменьшается: `floor(totalMass / minOrbMass)`
- Угол: равномерный по 360 + случайное смещение ±0.3 рад
- Скорость: `pvpBiteScatterSpeed` (60 м/с)
- **Используется `forceSpawnOrb`** — игнорирует maxCount. Боевая механика важнее лимита

### 9.3. Притяжение орбов

Для каждого орба проверяются все "магнитные" игроки:
- **Ability Pull (magnet):** `FLAG_MAGNETIZING`, радиус и скорость из конфига умения
- **Talent Vacuum:** `mod_vacuumRadius`, `mod_vacuumSpeed`
- **Talent Magnet (Collector):** `mod_magnetRadius`, `mod_magnetSpeed`
- Берётся максимум из всех источников
- Направление: к точке `getMouthPoint(player)` (ко рту)
- Формула: `orb.v += normalized_direction * speed * dt * 2`

### 9.4. Физика орбов

- Damping: `max(0, 1 - environmentDrag - orbLinearDamping)` (= 0.99)
- Speed cap: `maxOrbSpeed` (1000)
- Мировые границы: `applyWorldBounds`
- Радиус: `getOrbRadius(mass, density)` — из shared

### 9.5. updateOrbsVisual

Вызывается в фазе Results. Только замедление и движение, без спауна и притяжения.

---

## 10. Hunger System

Файл: `hungerSystem.ts`.

### 10.1. Условия активации

- Фаза: **Hunt** или **Final** (не Growth)
- SafeZone НЕ активна или нет safeZones
- Есть хотя бы одна hotZone

### 10.2. Механика

Для каждого живого игрока вне hotZone:
```
drainPerSec = min(maxDrainPerSec, baseDrainPerSec + scalingPerMass * (player.mass / 100))
drain = drainPerSec * dt
targetMass = max(max(hunger.minMass, minSlimeMass), player.mass - drain)
applyMassDelta(player, targetMass - player.mass)
```

### 10.3. Параметры (balance.json → hunger)

| Параметр | Значение | Описание |
|---|---|---|
| `baseDrainPerSec` | 2 | Базовая потеря массы/сек |
| `scalingPerMass` | 0.01 | Скейлинг от массы |
| `maxDrainPerSec` | 12 | Максимум потери/сек |
| `minMass` | 50 | Минимальная масса (не ниже) |

**Формула дрейна для конкретной массы:**
- 100 кг → `min(12, 2 + 0.01 * 1)` = 2.01/сек
- 500 кг → `min(12, 2 + 0.01 * 5)` = 2.05/сек
- 1000 кг → `min(12, 2 + 0.01 * 10)` = 2.1/сек
- Дрейн практически плоский — скейлинг слабый

---

## 11. Rebel System

Файл: `rebelSystem.ts`.

### 11.1. Механика

Обновляется каждые `rebelUpdateIntervalTicks` (5 сек):
1. Вычислить среднюю массу живых игроков
2. Найти лидера (максимальная масса)
3. Если `leader.mass >= avgMass * massThresholdMultiplier` (1.2) → `rebelId = leader.id`
4. Иначе → `rebelId = ""`

### 11.2. Эффект Rebel

- Rebel определяется по `state.rebelId`
- Орбы при укусе/смерти Rebel имеют **золотой цвет** (`getDamageOrbColorId` → `"gold"` type index)
- Rebel виден всем на мини-карте (UI-эффект)

### 11.3. Параметры (balance.json → rebel)

| Параметр | Значение |
|---|---|
| `updateIntervalSec` | 5 |
| `massThresholdMultiplier` | 1.2 |

---

## 12. SafeZone System

Файл: `safeZoneSystem.ts`.

### 12.1. Условия активации

- `isSafeZoneActive()` = true: фаза `"Final"` И `elapsedSec >= safeZones.finalStartSec` (120 сек)
- Есть хотя бы одна safeZone

**Важно:** `finalStartSec = 120`, но матч длится 90 сек (Match.durationSec). Это означает что safeZoneSystem **никогда не активируется** в текущей конфигурации. Вероятно параметр устарел или предназначен для других режимов.

### 12.2. Механика урона

Для каждого живого игрока, не в Last Breath, не в i-frames, не внутри safeZone:
```
massLoss = player.mass * damagePctPerSec * dt * damageTakenMult
```
Если `massLoss > 0` и Guard не поглощает — `applyMassDelta(player, -massLoss)`.

### 12.3. Параметры (balance.json → safeZones)

| Параметр | Значение |
|---|---|
| `finalStartSec` | 120 |
| `warningSec` | 10 |
| `damagePctPerSec` | 0.015 (1.5%/сек) |
| `minDistance` | 200 |

---

## 13. Boost System

Файл: `boostSystem.ts` + `ArenaRoom.ts`.

### 13.1. Типы бустов

| Буст | Длительность | Эффект | Заряды | Стак |
|---|---|---|---|---|
| `rage` | 10 сек | `damageMul = 1.25` (+25% урона) | нет | время продлевается (cap `maxStackTimeSec` = 20 сек) |
| `haste` | 10 сек | `speedMul = 1.30` (+30% скорости) | нет | время продлевается |
| `guard` | 15 сек | Поглощает 1 удар | 1 заряд | время продлевается, заряды обновляются |
| `greed` | 15 сек | `bubbleMassMul = 2.0` (x2 масса от орбов) | 3 заряда | время продлевается, заряды обновляются |

### 13.2. Тик системы

Каждый тик для каждого игрока с активным бустом:
1. Если тип невалидный — очистить
2. Если `boostEndTick > 0 && tick >= boostEndTick` — очистить
3. Если `guard`/`greed` и `boostCharges <= 0` — очистить

### 13.3. Стакинг бустов

При повторном получении того же буста:
- `boostEndTick += durationTicks`, ограничен `tick + maxStackTimeSec` (20 сек)
- Для charge-based: `boostCharges = max(текущие, maxCharges)` (обновление, не сложение)

### 13.4. Guard — поглощение удара

`tryConsumeGuard(player)`:
1. Если Guard не активен → false
2. `boostCharges--`
3. Если `boostCharges <= 0` → clearBoost
4. Return true (удар поглощён)

**Guard блокирует:**
- PvP укус (в combatSystem)
- Projectile damage
- SafeZone damage
- Shield reflection
- Thorns (если у атакующего Guard)

### 13.5. Greed — усиленный сбор

`applyGreedToOrbGain(player, gain)`:
- Множитель `bubbleMassMul` (2.0) к массе собранного орба
- Расходует 1 заряд при каждом применении

### 13.6. Источники бустов

Бусты дропаются из сундуков (Chests). Типы бустов зависят от редкости сундука:
- `rare`: haste, guard
- `epic`: rage, haste, guard
- `gold`: greed, rage, guard

---

## 14. Захардкоженные значения

| Значение | Где | Описание |
|---|---|---|
| `1.1` (10%) | `combatSystem.ts:42` | Порог массы для mouth-to-mouth: `attackerMass > defenderMass * 1.1` |
| `0.5` (50%) | `combatSystem.ts:73` | Cap resist: `Math.min(0.5, totalResist)` |
| `0.5` | `combatSystem.ts:249` | Scatter от Shield reflection: `reflectedDamage * 0.5` |
| `0.5` | `combatSystem.ts:349` | Scatter от Projectile damage: `massLoss * 0.5` |
| `0.5` | `combatSystem.ts:385` | Scatter от Self damage: `massLoss * 0.5` |
| `0.3` | `combatSystem.ts:281,296` | Случайное смещение угла scatter: `rng.range(-0.3, 0.3)` рад |
| `2` | `orbSystem.ts:57` | Множитель силы притяжения: `speed * dt * 2` |
| `30` | `playerStateManager.ts:66` | Spread distance при death orbs spawn (30 ед.) |
| `150` | `playerStateManager.ts:71` | Начальная скорость death orbs (150 м/с) |
| `0.9` | `ArenaRoom.ts:784` | Cap `allDamageReduction`: `clamp(reduction, 0, 0.9)` |
| `10` | `ArenaRoom.ts:1234` | Offset для colorId орбов: `classId + 10` |

---

## 15. Расхождения с документацией

### 15.1. GDD-Combat.md vs Код

| Тема | GDD | Код | Статус |
|---|---|---|---|
| **Bite % (PvP)** | `biteMassPercent = 10%` (раздел 2.1) | `pvpBiteAttackerGainPct = 0.10`, `pvpBiteScatterPct = 0.10` — раздельные параметры | GDD описывает упрощённо, код точнее |
| **Scatter в GDD примере** | "scatterMass = 100 * 10% = 10 кг" (раздел 2.4) | Совпадает | OK |
| **Модификатор Warrior** | "×1.1 (+10%)" к укусу слайма | `classes.warrior.damageVsSlimeMult = 1.1` через `classStats.damageMult` | OK |
| **Модификатор Collector** | "×1.25 (+25%)" к укусу пузырей | `eatingPowerMult = 1.25` — применяется отдельно в orbBite, НЕ в combatSystem | OK (разная логика) |
| **Toxicpool** | Радиус 20м, 3 сек, 1%/сек, -20% скорость (раздел 5.1) | `toxicPools.radiusM=20, durationSec=3, damagePctPerSec=0.01, slowPct=0.2` | OK — полное совпадение |
| **Death bubbles** | 6-8 шт (раздел 5.2) | `death.orbsCount = 4` | **РАСХОЖДЕНИЕ** — в коде 4, в GDD 6-8 |
| **Death bubble speed** | 20-40 м/с (раздел 5.2) | Захардкожено `150` м/с | **РАСХОЖДЕНИЕ** — код значительно быстрее |
| **Stunlock duration** | 0.3 сек (раздел 6.1) | Из talents: `lightning.values = [[0.25, 0.3]]`, где 0.3 = `lightningStunSec` | OK |
| **Невидимость снимается** | "Укус, активация умения" (раздел 6.3) | `clearInvisibility(attacker)` вызывается в processCombat | OK, но проверка снятия при активации умения — в другом месте |
| **Зоны слайма** | Пасть 120, бока 60+60, хвост 120 (раздел 1.1) | `mouthArcDeg=120, tailArcDeg=120`, side = остаток (120) = 60+60 | OK |
| **Invulnerability** | 0.2 сек (раздел 4.1) | `damageInvulnSec = 0.2` | OK |
| **Respawn shield** | Не описан в GDD-Combat | `respawnShieldSec = 5.0` | GDD не покрывает |
| **Last Breath** | Не описан в GDD-Combat | `lastBreathDurationSec = 0.5` | GDD не покрывает |
| **GDD scatterMass формула** | "scatterMass = масса_жертвы * pvpBiteScatterPct * modifiers" | GDD пример 7.2 НЕ применяет modifiers к scatter: "scatterMass: 150 * 10% = 15 кг" | **РАСХОЖДЕНИЕ** — код применяет `combinedMult` симметрично к обоим, GDD пример нет |

### 15.2. memory_bank/modules/mass-combat.md vs Код

| Тема | mass-combat.md | Код | Статус |
|---|---|---|---|
| `pvpBiteVictimLossPct` | Упоминается как отдельный параметр | Не существует в balance.json; `victimLoss = attackerGain + scatterMass` | **РАСХОЖДЕНИЕ** — устаревший параметр в документации |

### 15.3. Architecture Part1 vs Код

Архитектурный документ не описывает деталей боевой системы (раздел 2.2: "Формулы физики, параметры баланса — в GDD"). Конфликтов нет.

---

## 16. Технический долг

1. **Все системы типизированы как `any`** — `room: any`, `attacker: any`, `defender: any`. Нет типизации Room/Player в системных функциях, что мешает рефакторингу и может приводить к runtime-ошибкам.

2. **Захардкоженные множители** — scatter от shield/projectile/self (0.5), magnet force multiplier (2), death orb speed (150), death orb spread (30) — не вынесены в balance.json.

3. **SafeZone `finalStartSec = 120`** при матче в 90 сек — система фактически неактивна. Либо параметр устарел, либо предполагается другой режим.

4. **Hunger scaling слишком слабый** — `scalingPerMass = 0.01` даёт разницу в 0.1 кг/сек между 100 кг и 1000 кг слаймами. Фактически плоский drain для всех размеров.

5. **Death orbs count расходится с GDD** — balance.json = 4, GDD = 6-8. Нужно согласовать.

6. **Death orbs speed расходится с GDD** — код = 150 м/с (захардкожено), GDD = 20-40 м/с. Значительное расхождение.

7. **`pvpBiteVictimLossPct` в memory_bank** — упоминается устаревший параметр, которого нет в коде. Документация не синхронизирована.

8. **Rebel эффект не описан полностью** — Rebel получает золотые scatter orbs, но GamePlay-эффект (бонус/штраф повстанца, если таковой предполагается GDD) не реализован в rebelSystem.ts. Система только назначает rebelId.

9. **Bomb без knockback** — функция `explodeBomb` наносит только урон через `applyProjectileDamage`. Knockback/impulse от взрыва не реализован. Если это задумано — ок, но GDD может ожидать отталкивание.

10. **Self damage без модификаторов** — `applySelfDamage` не применяет `damageTakenMult` и резист. Это может быть intentional, но не документировано.

---

## 17. Заметки для форка BonkRace

**BonkRace** — гоночная игра. Боевая система удаляется полностью. Однако отдельные компоненты можно переиспользовать:

### Переиспользуемое

1. **Collision / knockback** — зоны контакта (`getContactZone`), формула импульса отскока и физика столкновений из collisionSystem полезны для бамперных взаимодействий на трассе.

2. **Boost System** — архитектура бустов (тип, длительность, заряды, стакинг) идеально подходит для power-ups на трассе:
   - `rage` → "Nitro" (ускорение)
   - `haste` → "Speed Boost" (увеличение скорости)
   - `guard` → "Shield" (защита от столкновения/ловушки)
   - `greed` → можно переиспользовать под "Magnet" для сбора монет

3. **i-frames** — механика временной неуязвимости после столкновения (anti-stunlock) применима к гонкам.

4. **Zone-based effects** — SafeZone/HotZone инфраструктура может стать зонами ускорения/замедления на трассе.

### Удаляемое

1. **combatSystem.ts** — полностью (processCombat, applyShieldReflection, applyProjectileDamage, applySelfDamage, explodeBomb, spawnPvPBiteOrbs)
2. **deathSystem.ts** — смерть заменяется на штраф/респаун на трассе
3. **hungerSystem.ts** — не применимо
4. **rebelSystem.ts** — не применимо
5. **Все talent/ability модификаторы** боевого урона (sharpTeeth, thorns, poison, frost, lightning, vampire, parasite, ambush)

### Адаптируемое

1. **orbSystem.ts** — орбы → монеты/бонусы на трассе. Спаун, притяжение (magnet), физика замедления — всё полезно.
2. **Mass-as-resource** — масса может стать "запасом нитро" или "здоровьем машины" в BonkRace.
3. **boostSystem.ts** — один к одному как power-up system, нужно только переименовать и добавить гоночные эффекты.
