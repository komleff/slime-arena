# Mass-as-HP System — Спецификация

**Версия:** 1.1  
**Дата:** 2025-12-26  
**Статус:** Реализовано

## Обзор

Система Mass-as-HP заменяет раздельные метрики HP и Mass единой механикой, где масса слайма является его здоровьем. Укус противника отбирает массу напрямую, часть которой достаётся атакующему, а часть разлетается в виде орбов.

## Ключевые параметры

### Порог смерти
- **Значение:** `physics.minSlimeMass` (50 кг)
- **Правило:** Если `player.mass <= minSlimeMass` и игрок не в состоянии Last Breath — смерть

### PvP Bite (укус игрока)
| Параметр | Значение | Описание |
|----------|----------|----------|
| `pvpBiteVictimLossPct` | 0.20 | Жертва теряет 20% своей массы |
| `pvpBiteAttackerGainPct` | 0.10 | Доля потерянной массы атакующему (50%) |
| `pvpBiteScatterPct` | 0.10 | Доля потерянной массы в scatter orbs (50%) |
| `pvpBiteScatterOrbCount` | 3 | Количество орбов при разлёте |
| `pvpBiteScatterSpeed` | 60 | Начальная скорость разлёта орбов (м/с) |

**Инвариант:** `massLoss = attackerGain + scatterMass` — масса не создаётся и не уничтожается.

### Orb Bite (поедание орба)
- **Лимит:** Максимум 10% собственной массы за один укус орба
- **Параметр:** `slimeConfig.combat.orbBitePctOfMass` (0.10 = 10%)

### Last Breath
- Активируется когда масса падает ≤ `minSlimeMass`
- Длительность: `combat.lastBreathDurationSec` (0.5 сек)
- Во время Last Breath игрок неуязвим
- **Награды масштабируются:** атакующий получает пропорционально фактической потере массы
- После истечения — смерть

## Удаляемые параметры

### Из схемы GameState (`Player`)
- `hp: number` — удалить
- `maxHp: number` — удалить

### Из balance.json
- `combat.pvpBiteDamageAttackerMassPct` — заменяется новой системой
- `combat.pvpBiteDamageVictimMassPct` — заменяется новой системой
- `combat.pvpVictimMassLossPct` — заменяется `pvpBiteVictimLossPct`
- `combat.pvpAttackerMassGainPct` — заменяется `pvpBiteAttackerGainPct`
- `formulas.hp` — удалить (HP больше не рассчитывается)

### Из ArenaRoom.ts
- `updateMaxHpForMass()` — удалить полностью
- Все обращения к `player.hp` и `player.maxHp`

## Новый алгоритм processCombat()

```
1. Проверки:
   - attacker.isDead || defender.isDead → return
   - tick < attacker.lastAttackTick + attackCooldownTicks → return
   - tick < defender.invulnerableUntilTick → return
   - attackerZone !== "mouth" → return

2. Расчёт потерь:
   massLoss = defender.mass * pvpBiteVictimLossPct * zoneMultiplier * damageMult

3. Last Breath check:
   if (defender.mass - massLoss <= minSlimeMass):
       massLoss = defender.mass - minSlimeMass  // Ограничиваем потерю
       triggersLastBreath = true

4. Расчёт наград от ФАКТИЧЕСКОЙ потери (инвариант массы):
   totalRewardPct = attackerGainPct + scatterPct
   attackerGain = massLoss * (attackerGainPct / totalRewardPct)
   scatterMass = massLoss * (scatterPct / totalRewardPct)

5. Применение:
   defender.mass -= massLoss
   attacker.mass += attackerGain
   spawnPvPBiteOrbs(defender.x, defender.y, scatterMass)

6. Активация Last Breath (если triggered):
   defender.isLastBreath = true
   defender.lastBreathEndTick = tick + lastBreathTicks
   defender.invulnerableUntilTick = lastBreathEndTick

7. Cooldowns:
   attacker.lastAttackTick = tick
   defender.invulnerableUntilTick = tick + invulnerableTicks
```

## Новый метод spawnPvPBiteOrbs()

```typescript
private spawnPvPBiteOrbs(x: number, y: number, totalMass: number, count: number): void {
    if (count <= 0 || totalMass <= 0) return;
    
    const perOrbMass = totalMass / count;
    const angleStep = (Math.PI * 2) / count;
    const speed = this.balance.combat.pvpBiteScatterSpeed;
    
    for (let i = 0; i < count; i++) {
        const angle = i * angleStep + this.rng.range(-0.3, 0.3);
        const orb = this.spawnOrb(x, y, perOrbMass);
        if (orb) {
            orb.vx = Math.cos(angle) * speed;
            orb.vy = Math.sin(angle) * speed;
        }
    }
}
```

## Изменения в deathSystem()

```typescript
// Старый код:
if (!player.isDead && player.hp <= 0 && !player.isLastBreath)

// Новый код:
if (!player.isDead && player.mass <= minSlimeMass && !player.isLastBreath)
```

## Изменения в талантах

### Талант 1 (Vital Burst)
- **Было:** +30% HP
- **Стало:** +30% массы (аналог Mass Surge, но сильнее)

## Results Phase — полная заморозка

При `isMatchEnded === true`:
- Блокировать `applyInputs()` ✓ (уже реализовано)
- Блокировать `physicsSystem()` — добавить
- Блокировать `collisionSystem()` — добавить
- Блокировать `hungerSystem()` — добавить
- Сохранить `updateOrbs()` с движением для визуала

## Миграция данных

Схема Colyseus обновляется — клиенты с устаревшей версией получат ошибку синхронизации. Требуется одновременное обновление клиента и сервера.

## Тестирование

1. **Детерминизм:** `npm run test` должен проходить
2. **PvP укус:** 
   - Жертва теряет ровно 20% массы
   - Атакующий получает 10% (до укуса)
   - Появляется 3 орба с суммарной массой 10%
3. **Last Breath:**
   - Активируется при массе ≤ 50 кг
   - Длится 0.5 сек
   - После — смерть и респаун
4. **Results:**
   - Слаймы не двигаются
   - Столкновений нет
   - Голод не работает
