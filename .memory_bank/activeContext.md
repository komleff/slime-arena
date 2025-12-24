# Active Context
Текущее состояние проекта и фокус работы.

## Текущее состояние
U2-стиль предиктивного сглаживания полностью реализован и задокументирован. PR #2 смержен в `main`. Создана документация.

## Последние изменения (декабрь 2025)

### U2-стиль сглаживания (v1.0)
- **Visual State System** — визуальное состояние отделено от серверного
- **Velocity Integration** — `VELOCITY_WEIGHT = 0.7` для точного направления движения
- **Catch-up коррекция** — `CATCH_UP_SPEED = 10.0` для плавного догоняния
- **Упрощён ClientNetSmoothingConfig** — остался только `lookAheadMs = 150`
- **Документация** — создан `.memory_bank/modules/U2-smoothing.md`

### Обновления документации (v2.4.1 / v1.5.1 / v1.8.1)
- **GDD v2.4.1** — добавлен раздел 0.11 про U2-сглаживание
- **Architecture v1.5.1** — раздел 10 полностью переписан под U2
- **Plan v1.8.1** — задача сглаживания отмечена выполненной
- **Flight-TZ v1.0.1** — раздел 13 обновлён под реализацию

### Код (ветка fix/smoothing-hermite-cleanup)
- `client/src/main.ts` — smoothStep с velocity integration
- `shared/src/config.ts` — очищен ClientNetSmoothingConfig
- `config/balance.json` — только `lookAheadMs`

## Константы сглаживания (захардкожены в клиенте)
| Константа | Значение | Назначение |
|-----------|----------|-----------|
| `VELOCITY_WEIGHT` | 0.7 | Вес velocity vs catch-up |
| `CATCH_UP_SPEED` | 10.0 | Скорость догоняния |
| `MAX_CATCH_UP_SPEED` | 800 | Макс. скорость коррекции |
| `TELEPORT_THRESHOLD` | 100 | Порог телепорта |
| `ANGLE_CATCH_UP_SPEED` | 12.0 | Скорость угла |

## Ближайшие шаги
- [ ] Смержить ветку `fix/smoothing-hermite-cleanup` в `main`
- [ ] Тестирование на мобильных устройствах
- [ ] Оптимизация `ArenaRoom.ts` (модульное разделение)
