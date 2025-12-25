# Active Context

Текущее состояние проекта и фокус работы.

## Текущее состояние
**PR #4: gameplay/UI улучшения + Codex/Copilot ревью фиксы (раунд 2)**

- Ветка: `feat/gameplay-ui-improvements`
- Коммиты: 9 (текущий `0654687`)
- Контроль изменений: main@main vs feat/gameplay-ui-improvements@0654687

## Полный список изменений

### Новые модули
- **shared/src/nameGenerator.ts** — генератор русских имён (DRY: `createLcg()` helper)
- **shared/src/mathUtils.ts** — математические утилиты (оптимизированные)

### UI компоненты
- **client/src/main.ts**:
  - Results overlay (победитель, лидерборд 10, таймер)
  - Mouse control (agar.io стиль, параметры из конфига)
  - Crown для KING
  - Уникальные имена
  - DOM API вместо innerHTML (XSS-безопасность)
  - HUD: лидерборд топ-5 (было топ-3)

### Оптимизации (раунд 1)
- wrapAngle: O(n) while-циклы → O(1) modulo
- Math.hypot → Math.sqrt
- matchMedia кэширован в isCoarsePointer
- latestSnapshot вместо snapshotBuffer

### Исправления раунд 2 (Codex/Copilot)
- **JoystickConfig.mode**: убран "dynamic", только "fixed" | "adaptive"
- **Валидация smoothing**: velocityWeight [0..1], teleportThreshold >= 1
- **Удалён snapshotBuffer**: U2-стиль, только latestSnapshot
- **lookAheadMs**: один источник через getSmoothingConfig()
- **nameSeed из sessionId**: не изменяет RNG симуляции (детерминизм)
- **PvP кража массы**: привязана к урону (damagePct), не фиксированный %
- **Mouse control config**: mouseDeadzone, mouseMaxDist в balance.json

### Smoothing конфиг (с валидацией)
| Параметр | Значение | Валидация |
|----------|----------|-----------|
| velocityWeight | 0.7 | [0..1] |
| catchUpSpeed | 10.0 | >= 0 |
| maxCatchUpSpeed | 800 | >= 0 |
| teleportThreshold | 100 | >= 1 |
| angleCatchUpSpeed | 12.0 | >= 0 |
| lookAheadMs | 150 | >= 0 |

### Controls конфиг
| Параметр | Значение | Описание |
|----------|----------|---------|
| mouseDeadzone | 30 | Мёртвая зона мыши (px) |
| mouseMaxDist | 200 | Макс. дистанция (px) |

### PvP механика (привязана к урону)
| Параметр | Значение | Описание |
|----------|----------|---------|
| pvpVictimMassLossPct | 0.50 | × damagePct |
| pvpAttackerMassGainPct | 0.25 | × damagePct |

## Проверки
- ✅ npm run build — ok (0 errors, gzip 32.29 kB)
- ✅ npm run test (determinism) — PASSED
- ✅ Ветка чистая

## Готовность к мержу
- ✅ 9 коммитов (0654687 HEAD)
- ✅ Все проверки пройдены
- ✅ Статус: **READY FOR MERGE**
