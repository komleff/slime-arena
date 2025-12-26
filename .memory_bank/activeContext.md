# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**Ветка feat/gameplay-mvp-classes — 4 коммита (26 декабря 2025)**

### Последние коммиты:
- (pending) feat: colored scatter orbs - victim class color
- `99685eb` feat: projectile ability (Выброс) - slot 1, key 2
- `db54cc1` feat: biteResistPct - Warrior bite resistance & Sweet/Hunger zones
- `043bc2f` fix: code review - shield flag, position:fixed, keys 2/3, GDD values

## Новые механики (текущая сессия)

### Colored Scatter Orbs (цветные пузыри урона)
При любом уроне (укус, снаряд) масса жертвы вылетает цветными пузырями:
| classId | Класс | Цвет scatter orbs |
|---------|-------|-------------------|
| 0 | Hunter | #4ade80 (зелёный) |
| 1 | Warrior | #f87171 (красный) |
| 2 | Collector | #60a5fa (синий) |

- colorId = classId + 10 для scatter orbs
- Визуальная обратная связь: видно кто получил урон по цвету пузырей

### biteResistPct (Сопротивление укусам)
| Класс | biteResistPct |
|-------|---------------|
| Hunter | 0 |
| Warrior | 0.15 (−15% потерь) |

- Применяется в `processCombat()` и `applyProjectileDamage()`
- Максимальный резист: 50% (cap)

### Projectile (Выброс) — Universal Ability Slot 1
| Параметр | Значение |
|----------|----------|
| Клавиша | 2 |
| Slot | 1 |
| Стоимость | 2% массы |
| Кулдаун | 3 сек |
| Скорость | 400 м/с |
| Дальность | 300 м |
| Урон | 10% массы цели |

**Механики:**
- Блокируется щитом (щит снимается)
- Триггерит Last Breath
- Scatter orbs 50% урона (цвет жертвы)

## Проверки
- ✅ npm run build — ok (126.42 kB gzip)
- ✅ npm run test (determinism) — passed

## Следующие шаги
- [ ] Review и merge PR #6
- [ ] Реализация талантов (passive bonuses)
- [ ] Визуальный эффект Last Breath
