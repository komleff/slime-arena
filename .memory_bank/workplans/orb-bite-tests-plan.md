# План минимальных проверок орбов и укусов

## Цель
Зафиксировать минимальный набор проверок логики орбов и укусов без реализации тестов.

## Область
- Укус орба (`tryEatOrb`)
- Укус слайма по слайму (`processCombat`)
- Пороговые параметры `orbBiteMinMass` и `orbBiteMaxMass`
- Инварианты массы и GCD

## Сценарии проверки
1. **Укус орба: масса ниже порога**
   - Вход: `player.mass < orbBiteMinMass`
   - Ожидание: масса игрока не изменяется, орб не удаляется, GCD выставлен.

2. **Укус орба: проглатывание целиком**
   - Вход: `orb.mass <= effectiveMass * orbBitePctOfMass`
   - Ожидание: орб удаляется, прирост массы = `orb.mass * (1 + mod_orbMassBonus)`.

3. **Укус орба: частичный укус**
   - Вход: `orb.mass > effectiveMass * orbBitePctOfMass`
   - Ожидание: орб уменьшается на `biteMass`, игрок получает `biteMass * (1 + mod_orbMassBonus)`.

4. **Ограничение силы укуса орба**
   - Вход: `player.mass > orbBiteMaxMass`
   - Ожидание: `effectiveMass = orbBiteMaxMass`, укус не усиливается выше порога.

5. **PvP укус: инвариант массы**
   - Вход: стандартный укус в бок
   - Ожидание: `attackerGain + scatterMass <= actualLoss`.

6. **PvP укус: рот в рот**
   - Вход: разница масс <= 10%
   - Ожидание: урон не наносится, GCD выставлен.

7. **GCD на укус**
   - Вход: два укуса подряд
   - Ожидание: второй укус блокируется до `gcdReadyTick`.

## Данные и точки наблюдения
- `player.mass`, `orb.mass`
- `player.gcdReadyTick`
- `player.lastBiteTick`
- `attackerGain`, `scatterMass`, `actualLoss`

## Файлы и модули
- `server/src/rooms/ArenaRoom.ts`
- `shared/src/config.ts`
- `config/balance.json`

## Риски
- Детерминизм: важно исключить влияние RNG.
- Скрытые модификаторы талантов (например, `mod_orbMassBonus`).
