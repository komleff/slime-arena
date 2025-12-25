# Mass-based Combat System

## Статус
✅ **РЕАЛИЗОВАНО** — PR #4, с учётом Copilot ревью фиксов

## Обзор
Новая система боевого взаимодействия, в которой урон наносится напрямую потерей массы, а не уменьшением HP.

## Мотивация (Old System Problem)
- HP-урон был отделён от массы слайма
- Механика LastBreath усложняла логику смерти
- Несколько способов смерти: HP=0, mass=0, lastBreath истекает
- Непредсказуемое поведение в боевых ситуациях

## Решение (New System)

### Логика в processCombat()
```typescript
// Вычисляем потерю массы жертвы с учётом множителей
const victimMassLoss = 
    defender.mass * 
    slimeConfig.combat.biteDamagePctOfMass * 
    damageMultiplier *      // зона контакта: tail=1.5, mouth=0.5, side=1.0
    classStats.damageMult;  // warrior bonus: 1.1

// Вычисляем прибыль массы атакующего
const attackerMassGain = victimMassLoss * slimeConfig.combat.biteVictimMassGainPct;

// Применяем потерю/прибыль массы
if (victimMassLoss > 0) {
    this.applyMassDelta(defender, -victimMassLoss);
    this.applyMassDelta(attacker, attackerMassGain);
    // Временная неуязвимость жертвы
    defender.invulnerableUntilTick = this.tick + this.invulnerableTicks;
}

// Смерть при недостаточной массе
if (defender.mass <= this.balance.physics.minSlimeMass) {
    if (!defender.isDead) {
        this.handlePlayerDeath(defender);
    }
}
```

## Параметры конфигурации

### SlimeConfig.combat
| Параметр | Тип | Значение | Описание |
|----------|-----|---------|---------|
| biteDamagePctOfMass | number | 0.15 | Базовый % массы жертвы (до применения множителей) |
| biteVictimMassGainPct | number | 0.25 | % украденной массы, получаемой атакующим |
| orbBitePctOfMass | number | 0.05 | % массы шарика, теряемого при укусе |

### Множители урона
| Зона контакта | Множитель | Описание |
|---------------|-----------|---------|
| tail | 1.5 | Атака в хвост (tailDamageMultiplier) |
| mouth | 0.5 | Атака в рот (взаимный укус) |
| side | 1.0 | Атака в бок |

| Класс | damageMult | Описание |
|-------|------------|---------|
| warrior | 1.1 | Бонус к урону в PvP |
| hunter | 1.0 | Стандартный урон |
| collector | 1.0 | Стандартный урон |
| base | 1.0 | Стандартный урон |

### Physics
| Параметр | Тип | Значение | Описание |
|----------|-----|---------|---------|
| minSlimeMass | number | 50 | Минимальная масса (при <= смерть) |

## Примеры расчётов

### Пример 1: Обычная атака в бок
```
Атакующий: base, 100 масса
Жертва: 200 масса
Зона: side (1.0)

victimMassLoss = 200 × 0.15 × 1.0 × 1.0 = 30
attackerMassGain = 30 × 0.25 = 7.5

Результат:
- Жертва: 200 - 30 = 170 (выживает)
- Атакующий: 100 + 7.5 = 107.5
```

### Пример 2: Warrior атакует в хвост
```
Атакующий: warrior, 100 масса
Жертва: 200 масса
Зона: tail (1.5)
Class bonus: 1.1

victimMassLoss = 200 × 0.15 × 1.5 × 1.1 = 49.5
attackerMassGain = 49.5 × 0.25 = 12.4

Результат:
- Жертва: 200 - 49.5 = 150.5 (выживает)
- Атакующий: 100 + 12.4 = 112.4
```

### Пример 3: Слайм на минимуме жизни
```
Жертва: 60 масса
victimMassLoss = 60 × 0.15 = 9 (side, base)

После укуса:
- Жертва: 60 - 9 = 51 > 50 (minSlimeMass)
- Выживает! Потребуется ещё ~2 укуса для убийства
```

## Механики защиты

### Временная неуязвимость (invulnerableUntilTick)
- Флаг `invulnerableUntilTick` проверяется при каждой атаке (строка 685)
- После получения урона устанавливается: `defender.invulnerableUntilTick = this.tick + this.invulnerableTicks`
- Длительность: `damageInvulnSec` из balance.json (0.2 секунды = 6 тиков при 30 FPS)

### Cooldown атакующего (lastAttackTick)
- Атакующий не может атаковать чаще чем `attackCooldownTicks`
- Длительность: `attackCooldownSec` из balance.json (0.2 секунды)

## Удалённые механики

### LastBreath (спешл-режим)
**Было:**
```typescript
if (defender.hp - damage <= 0 && !defender.isLastBreath && this.lastBreathTicks > 0) {
    defender.isLastBreath = true;
    defender.lastBreathEndTick = this.tick + this.lastBreathTicks;
    // Слайм мог продолжить бороться с нулевым HP
}
```

**Теперь:** Смерть наступает строго при `mass <= minSlimeMass`.

### HP как отдельный показатель
- HP больше не используется в боевой логике
- Масса является единственным показателем здоровья слайма

## Файлы изменений

### server/src/rooms/ArenaRoom.ts
- processCombat() переписана на mass-based логику
- Добавлены множители `damageMultiplier * classStats.damageMult`
- Восстановлена установка `invulnerableUntilTick` после атаки
- Исправлен комментарий: "Охотник" → "Атакующий"

### shared/src/config.ts
- Интерфейс `SlimeConfig.combat`:
  - Добавлен `biteVictimMassGainPct: number`
- Значения по умолчанию: `biteDamagePctOfMass: 0.15`

### config/balance.json
- Все 4 конфига слаймов:
  - `biteDamagePctOfMass`: 0.15 (было 0.02, затем 0.5)
  - `biteVictimMassGainPct`: 0.25 (новый)

## Детерминизм

✅ **Система полностью детерминированна:**
- Нет случайных вычислений в боевой логике
- Потеря массы вычисляется детерминированно
- Все множители детерминированы (зона контакта, класс)
- RNG не используется в processCombat()

## История изменений
- **PR #4 v1**: biteDamagePctOfMass = 0.5 (слишком агрессивно)
- **PR #4 v2 (Copilot review)**: 
  - biteDamagePctOfMass снижен до 0.15
  - Добавлены множители damageMultiplier и classStats.damageMult
  - Восстановлена invulnerableUntilTick защита
  - Исправлен комментарий "Охотник" → "Атакующий"
