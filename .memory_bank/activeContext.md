# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**Ветка main актуальна (26 декабря 2025)**

- PR #5 смержен в main
- Все ветки очищены (только main осталась)
- ChatGPT ревью: критический баг исправлен

### Последние коммиты в main:
- `c284daf` — fix: Last Breath mass balance - rewards scale with actual loss
- `8425dc3` — Merge PR #5: feat: mass-as-hp + orb physics + camera/mouse fixes
- Полный список в PR #5

## Баланс орбов v2.5.0

### Честная физика орбов
Формула радиуса: `radius = baseRadius × √(mass / baseMass / density)`

Плотность — абсолютная величина (кг/м²). Для сравнения: плотность слайма ≈ 0.32 кг/м².

| Тип | density | Масса (кг) | Частота | Радиус (м) |
|-----|---------|------------|---------|------------|
| green | 0.2 | 10–50 | 45% | 7.1–15.8 |
| blue | 0.3 | 30–150 | 30% | 10.0–22.4 |
| red | 0.4 | 80–400 | 20% | 14.1–31.6 |
| gold | 0.5 | 200–1000 | 5% | 20.0–44.7 |

### Параметры физики (balance.json)
| Параметр | Значение | Описание |
|----------|----------|----------|
| environmentDrag | 0.01 | 1% потери скорости за тик (единый для всех) |
| orbLinearDamping | 0 | Убран как нефизическое явление |
| restitution | 0.9 | 90% энергии сохраняется при столкновении |
| initialCount | 10 | Начальное количество орбов |
| maxCount | 15 | Максимальное количество орбов |

### Параметры управления (FlightAssist)
| Параметр | Значение | Описание |
|----------|----------|----------|
| turnTorqueNm | 35000 | Крутящий момент поворота |
| angularSpeedLimitDegps | 180 | Максимальная угловая скорость (°/с) |
| angularStopTimeS | 0.3 | Время остановки вращения |
| yawRateGain | 4.0 | Коэффициент усиления по курсу |

### Камера (Agar.io стиль)
| Параметр | Значение | Описание |
|----------|----------|----------|
| desiredView | 400×400 м | Область видимости (2x зум-аут) |
| Следит за | smoothedPlayer | Сглаженная позиция (плавное движение) |
| Центрирование | с clamp | Игрок в центре, но не выходит за края мира |

### Управление мышью
- Привязано к **позиции слайма на экране** (не к центру)
- Вычисляется направление от слайма к курсору
- Переменные `smoothedPlayerX/Y` синхронизированы с камерой
- Корректно работает у краёв карты (нет инвертирования)

### Поедание орбов
- `orbBitePctOfMass` = 10% — орб можно проглотить, если его масса ≤ 10% массы слайма

## Изменённые файлы (сессия 25.12.2025)
1. **config/balance.json** — density, spawn counts, physics params, turn params
2. **client/src/main.ts** — камера: desiredView 400×400, instant centering
3. **server/src/rooms/ArenaRoom.ts** — tryEatOrb() использует orbBitePctOfMass
4. **docs/SlimeArena-GDD-v2.5.md** — обновлён до v2.5.0

## Предыдущие изменения

### Mass-as-HP System
- **HP удалён**: `Player.hp` и `Player.maxHp` убраны из схемы
- **Масса = здоровье**: смерть при `mass <= minSlimeMass` (50 кг)
- **Инвариант массы**: `massLoss = attackerGain + scatterMass` (масса не создаётся из воздуха)
- **Last Breath**: награды масштабируются пропорционально фактической потере
- **PvP Bite**: -20% массы жертвы, +10% атакующему, +10% разлетается орбами
- **Scatter Orbs**: 3 орба при укусе, разлёт 60 м/с (было 200)
- **forceSpawnOrb**: scatter orbs игнорируют maxCount лимит
- **Results Freeze**: полная заморозка симуляции при isMatchEnded

### PR #4
- Results overlay (победитель, лидерборд)
- Mouse control (agar.io стиль)
- Name generator (русские имена)
- U2-стиль сглаживания

## Проверки
- ✅ npm run build — ok (gzip 32.17 kB)
- ✅ npm run test (determinism) — PASSED
- ✅ GDD v2.5.0 — обновлён, переименован в SlimeArena-GDD-v2.5.md
- ✅ Камера: плавная, без дёрганья
- ✅ Мышь: корректная у краёв карты
- ✅ Copilot review: 4/4 замечаний исправлены

## Коммиты (текущая сессия)
- ae5b0d0: fix: camera follows localPlayer directly (не плавная)
- 92da9f6: fix: mouse control uses smoothed player position (финальная)
- 12cb70c: fix: Copilot review fixes (damageMult, getOrbRadius, GDD)
- 4898261: fix: Last Breath now awards mass and spawns scatter orbs
- 066a1f8: merge: resolve conflicts with main (keep mass-as-hp system)
