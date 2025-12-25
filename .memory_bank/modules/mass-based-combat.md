# Mass-based Combat System

## Статус
✅ **РЕАЛИЗОВАНО** — Коммит b0f4910, PR #4 обновлён

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
// Вычисляем потерю массы жертвы
const victimMassLoss = defender.mass * slimeConfig.combat.biteDamagePctOfMass;

// Вычисляем прибыль массы атакующего
const attackerMassGain = victimMassLoss * slimeConfig.combat.biteVictimMassGainPct;

// Применяем потерю/прибыль массы
if (victimMassLoss > 0) {
    this.applyMassDelta(defender, -victimMassLoss);
    this.applyMassDelta(attacker, attackerMassGain);
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
| biteDamagePctOfMass | number | 0.5 | % массы жертвы, теряемой при укусе |
| biteVictimMassGainPct | number | 0.25 | % украденной массы, получаемой атакующим |
| orbBitePctOfMass | number | 0.05 | % массы шарика, теряемого при укусе |

### Physics
| Параметр | Тип | Значение | Описание |
|----------|-----|---------|---------|
| minSlimeMass | number | 50 | Минимальная масса (при <= смерть) |

## Значения для всех слаймов
Все типы (base, hunter, warrior, collector) используют одинаковые:
- `biteDamagePctOfMass`: 0.5
- `biteVictimMassGainPct`: 0.25

## Примеры расчётов

### Пример 1: Маленький слайм кусает большого
```
Атакующий: 100 масса
Жертва: 200 масса

victimMassLoss = 200 × 0.5 = 100
attackerMassGain = 100 × 0.25 = 25

Результат:
- Жертва: 200 - 100 = 100 (выживает)
- Атакующий: 100 + 25 = 125 (получил 25% украденной массы)
```

### Пример 2: Слайм на минимуме жизни
```
Жертва: 50 масса (минимум)
victimMassLoss = 50 × 0.5 = 25

После укуса:
- Жертва: 50 - 25 = 25 < 50 (minSlimeMass)
- СМЕРТЬ!
```

## Удалённые механики

### LastBreath (спешл-режим)
**Было:**
```typescript
if (defender.hp - damage <= 0 && !defender.isLastBreath && this.lastBreathTicks > 0) {
    defender.isLastBreath = true;
    defender.lastBreathEndTick = this.tick + this.lastBreathTicks;
    // Слайм может продолжить бороться с нулевым HP
}
```

**Теперь:** Просто смерть при недостаточной массе.

### HP-инвулнерабельность
**Было:**
```typescript
defender.invulnerableUntilTick = this.tick + this.invulnerableTicks;
```

**Теперь:** Удалена (масса = единственный показатель урона).

## Файлы изменений

### server/src/rooms/ArenaRoom.ts
- processCombat() упрощена (~40 строк удалено)
- Логика смерти централизована: `mass <= minSlimeMass`
- Удалены проверки HP

### shared/src/config.ts
- Интерфейс `SlimeConfig.combat`:
  - Добавлен `biteVictimMassGainPct: number`
- Значения по умолчанию для всех 4 слаймов
- Функция `readSlimeConfig()`:
  - Добавлена парсинг `biteVictimMassGainPct`

### config/balance.json
- Обновлены все 4 конфига слаймов:
  - `biteDamagePctOfMass`: 0.02 → 0.5
  - `biteVictimMassGainPct`: 0.25 (новый)

### client/package.json
- Порт разработки: 5173 → 5174

## Детерминизм

✅ **Система полностью детерминированна:**
- Нет случайных вычислений в боевой логике
- Потеря массы вычисляется детерминированно
- Условие смерти детерминировано (масса <= минимум)
- RNG не используется в processCombat()

## Тестирование

### npm run test
Убедиться:
1. Детерминизм сохранён (determinism test)
2. Боевая логика работает корректно
3. Смерть наступает при `mass <= 50`
4. Атакующий получает корректную прибыль массы

### Сценарии для вручную тестирования
1. **Маленький vs Большой**: Укусы не должны убивать большого сразу
2. **Минимальная масса**: Слайм с массой 50+ должен выжить, с <50 должен умереть
3. **Множественные укусы**: Накопление урона через несколько укусов должно привести к смерти
4. **Восстановление**: После смерти и респавна масса должна быть меньше (см. deathSystem)

## История изменений
- **PR #4**: Полная реализация (коммит b0f4910)
- **Проблема**: Первоначально PR описание не совпадало с диффом (только порт, без боя)
- **Решение**: Полное переписание PR с реальными изменениями боевой системы
