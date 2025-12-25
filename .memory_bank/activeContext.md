# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**PR #4: gameplay/UI улучшения + Codex/Copilot ревью фиксы**

- Ветка: `feat/gameplay-ui-improvements`
- Коммиты: 6 (текущий `282835f`)
- Контроль изменений: main@main vs feat/gameplay-ui-improvements@282835f

## Полный список изменений

### Новые модули
- **shared/src/nameGenerator.ts** — генератор русских имён (DRY: `createLcg()` helper)
- **shared/src/mathUtils.ts** — математические утилиты (оптимизированные)

### UI компоненты
- **client/src/main.ts**:
  - Results overlay (победитель, лидерборд 10, таймер)
  - Mouse control (agar.io стиль)
  - Crown для KING
  - Уникальные имена
  - DOM API вместо innerHTML (XSS-безопасность)

### Оптимизации
- wrapAngle: O(n) while-циклы → O(1) modulo
- Math.hypot → Math.sqrt (производительность)
- matchMedia кэширован в isCoarsePointer
- latestSnapshot вместо snapshotBuffer[length-1]

### Smoothing конфиг
| Параметр | Значение |
|----------|----------|
| velocityWeight | 0.7 |
| catchUpSpeed | 10.0 |
| maxCatchUpSpeed | 800 |
| teleportThreshold | 100 |
| angleCatchUpSpeed | 12.0 |
| lookAheadMs | 150 |

### PvP механика
| Параметр | Значение | Описание |
|----------|----------|---------|
| pvpBiteDamageAttackerMassPct | 0.05 | +5% урона от своей массы |
| pvpBiteDamageVictimMassPct | 0.03 | +3% урона от массы жертвы |
| **pvpVictimMassLossPct** | **0.50** | **Жертва теряет 50% массы** |
| **pvpAttackerMassGainPct** | **0.25** | **Охотник получает 25% массы жертвы** |

## Модульность
- Новые модули: nameGenerator, mathUtils
- Экспорты унифицированы через shared/src/index.ts
- DRY: дублированные генераторы работают через createLcg()

## Проверки
- ✅ npm run build — ok
- ✅ npm run test (determinism) — PASSED
- ✅ Построение не рушит детерминизм
