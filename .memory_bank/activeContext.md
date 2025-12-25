# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**PR #4: Refactor — Mass-based combat system**

- Ветка: `refactor/mass-based-combat-system`
- Последний коммит: b0f4910 (refactor: mass-based combat system)
- Статус: Pull Request открыт и обновлён с реальными изменениями
- URL: https://github.com/komleff/slime-arena/pull/4

## Полный список изменений

### Рефакторинг боевой системы (ArenaRoom.ts)
- **processCombat()** упрощена: вместо HP-урона жертва теряет массу напрямую
  - `victimMassLoss = defender.mass * slimeConfig.combat.biteDamagePctOfMass`
  - `attackerMassGain = victimMassLoss * slimeConfig.combat.biteVictimMassGainPct`
- **Смерть** переопределена: `mass <= minSlimeMass` (было `hp <= 0`)
- **Удалены механики:**
  - LastBreath (спешл-режим низкого HP)
  - HP-инвулнерабельность после атаки
  - Все проверки HP в боевой логике

### Обновление конфигурации

#### balance.json
Для всех типов слаймов (base, hunter, warrior, collector):
```json
"combat": {
  "biteDamagePctOfMass": 0.5,      // было 0.02 (50% массы за укус)
  "biteVictimMassGainPct": 0.25,   // новый параметр (25% украденной массы)
  "orbBitePctOfMass": 0.05
}
```

#### config.ts
- Добавлен параметр `biteVictimMassGainPct: number` в интерфейс `SlimeConfig.combat`
- Обновлены значения по умолчанию для всех 4 конфигов слаймов
- Обновлена функция `readSlimeConfig()` для парсинга нового параметра

#### client/package.json
- Порт разработки: 5173 → 5174 (проксирование на overmobile.space)

## Механика боевого взаимодействия (НОВАЯ)

| Параметр | Значение | Описание |
|----------|----------|---------|
| biteDamagePctOfMass | 0.5 | % массы жертвы, теряемой при укусе |
| biteVictimMassGainPct | 0.25 | % украденной массы, получаемой атакующим |
| minSlimeMass | 50 | Минимальная масса (ниже = смерть) |

**Пример:** 
- Слайм массой 100 кусает слайма массой 200
- Жертва теряет: 200 × 0.5 = 100 единиц массы
- Атакующий получает: 100 × 0.25 = 25 единиц массы
- Жертва: 200 - 100 = 100 (выживает)

## Проверки
- ✅ Все файлы конфигурации обновлены (4 слайма × 2 параметра)
- ✅ ArenaRoom.ts обновлён с упрощённой логикой смерти
- ✅ Ветка запушена с правильными изменениями
- ⏳ npm run test — требуется запуск для проверки детерминизма
- ⏳ npm run build — требуется проверка

## Следующие шаги
1. Запустить `npm run test` для проверки детерминизма
2. Запустить `npm run build` для проверки сборки
3. Получить Copilot код-ревью
4. Мерж в main
