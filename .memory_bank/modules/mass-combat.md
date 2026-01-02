# Mass Combat System

**Статус:** актуально
**Дата:** 2026-01-03

## Краткое описание
- Масса = здоровье и размер.
- Минимальная масса смерти: `physics.minSlimeMass`.
- PvP укус: потери через `combat.pvpBiteVictimLossPct`, награда атакующему через `combat.pvpBiteAttackerGainPct`, разлёт через `combat.pvpBiteScatterPct`.
- Рот в рот: урон только если масса атакующего больше массы защитника более чем на 10%.
- Scatter orbs: количество и скорость задаются `combat.pvpBiteScatterOrbCount` и `combat.pvpBiteScatterSpeed`, цвет зависит от `classId`.
- Укус орба: ограничение по массе через `orbs.orbBiteMinMass` и `orbs.orbBiteMaxMass`, доля укуса через `slimeConfigs.*.combat.orbBitePctOfMass`.
- Last Breath: `combat.lastBreathDurationSec`, неуязвимость до конца окна.
- GCD после укуса: `server.globalCooldownTicks`.

## Связанные файлы
- `server/src/rooms/ArenaRoom.ts`
- `shared/src/config.ts`
- `config/balance.json`
