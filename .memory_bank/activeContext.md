# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**PR #4: Refactor — Mass-based combat system**

- Ветка: `refactor/mass-based-combat-system`
- Последний коммит: 18c8854 (fix: align docker-compose port with client dev port)
- Статус: Pull Request открыт, все замечания ревьюверов исправлены
- URL: https://github.com/komleff/slime-arena/pull/4

### Коммиты в PR
1. `b0f4910` — refactor: mass-based combat system
2. `0e3d47c` — docs: update Memory Bank after PR #4 refactor
3. `de55c62` — fix: Copilot review fixes for mass-based combat
4. `8ec5be9` — docs: update Memory Bank after Copilot review fixes
5. `18c8854` — fix: align docker-compose port with client dev port (5174)

## Полный список изменений

### Рефакторинг боевой системы (ArenaRoom.ts)
- **processCombat()** переписана на mass-based логику:
  ```typescript
  victimMassLoss = defender.mass 
      * slimeConfig.combat.biteDamagePctOfMass  // 0.15
      * damageMultiplier                         // tail=1.5, mouth=0.5, side=1.0
      * classStats.damageMult                    // warrior=1.1, остальные=1.0
  attackerMassGain = victimMassLoss * slimeConfig.combat.biteVictimMassGainPct
  ```
- **Смерть**: `mass <= minSlimeMass` (50)
- **Защита**: `invulnerableUntilTick` устанавливается после урона
- **Удалены**: LastBreath, HP-урон, HP-проверки

### Обновление конфигурации

#### balance.json
Для всех типов слаймов (base, hunter, warrior, collector):
```json
"combat": {
  "biteDamagePctOfMass": 0.15,     // базовый % (до множителей)
  "biteVictimMassGainPct": 0.25,   // % украденной массы атакующему
  "orbBitePctOfMass": 0.05
}
```

#### Множители урона
| Множитель | Значение | Источник |
|-----------|----------|----------|
| tailDamageMultiplier | 1.5 | Укус в хвост |
| mouth | 0.5 | Взаимный укус |
| side | 1.0 | Укус в бок |
| warrior.damageMult | 1.1 | Класс warrior |

#### client/package.json
- Порт разработки: 5173 → 5174 (проксирование на overmobile.space)

#### docker/docker-compose.yml
- Порт клиента: 5173:5173 → 5174:5174 (синхронизация с client/package.json)

## Механика боевого взаимодействия

| Параметр | Значение | Описание |
|----------|----------|---------|
| biteDamagePctOfMass | 0.15 | Базовый % массы жертвы за укус |
| biteVictimMassGainPct | 0.25 | % украденной массы атакующему |
| tailDamageMultiplier | 1.5 | Множитель урона в хвост |
| minSlimeMass | 50 | Минимальная масса (ниже = смерть) |
| damageInvulnSec | 0.2 | Временная неуязвимость после урона |

## Примеры расчётов

### Обычный укус в бок (base vs base)
```
Жертва: 200 массы
victimMassLoss = 200 × 0.15 × 1.0 × 1.0 = 30
attackerMassGain = 30 × 0.25 = 7.5
→ Жертва: 170, Атакующий: +7.5
```

### Warrior атакует в хвост
```
Жертва: 200 массы
victimMassLoss = 200 × 0.15 × 1.5 × 1.1 = 49.5
attackerMassGain = 49.5 × 0.25 = 12.4
→ Жертва: 150.5, Атакующий: +12.4
```

## Статус PR #4
- ✅ Код реализован с множителями урона
- ✅ Copilot ревью: 7/7 замечаний исправлено
- ✅ Документация обновлена
- ⏳ Тесты: требуется `npm run test`
- ⏳ Сборка: требуется `npm run build`

## Следующие шаги
1. Запустить `npm run test` для проверки детерминизма
2. Запустить `npm run build` для проверки сборки
3. Мерж в main
